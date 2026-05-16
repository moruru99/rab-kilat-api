import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { pgTable, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc } from 'drizzle-orm';
import { betterAuth } from 'better-auth';

const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});
const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('local'),
  name: text('name').notNull().default(''),
  location: text('location').notNull().default(''),
  date: text('date').notNull().default(''),
  data: jsonb('data').$type<{
    sections: any[];
    materials: any[];
    templates: any[];
  }>().default({} as any),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
const syncLog = pgTable('sync_log', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull().default('local'),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

const connStr = process.env.DATABASE_URL
  || 'postgresql://postgres:AyanaBungas@127.0.0.1:5432/rab_kilat';
const client = postgres(connStr, { max: 5 });
const db = drizzle(client, { schema: { projects, syncLog, user, session, account, verification } });

let _auth: any = null;
let _authError: any = null;
async function getAuth() {
  if (_auth) return _auth;
  if (_authError) throw _authError;
  try {
    const { drizzleAdapter } = await import('@better-auth/drizzle-adapter');
    _auth = betterAuth({
      baseURL: process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'),
      database: drizzleAdapter(db, {
        provider: 'pg',
        schema: { user, session, account, verification },
      }),
      emailAndPassword: { enabled: true, autoSignIn: true },
      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirectURI: (process.env.BETTER_AUTH_URL || 'http://localhost:5173') + '/api/auth/callback/google',
        },
      },
    });
    return _auth;
  } catch (err) {
    _authError = err;
    throw err;
  }
}

const app = new Hono();

app.onError((err, c) => {
  return c.text(`Unhandled: ${err.message}`, 500);
});

app.use('/*', cors({
  origin: (origin, c) => {
    if (!origin) return origin;
    const allowed = [
      'http://localhost:5173',
      'https://rab-kilat.vercel.app',
    ];
    if (allowed.includes(origin)) return origin;
    if (origin.endsWith('.vercel.app') && origin.includes('rab-kilat')) return origin;
    return null;
  },
  credentials: true,
}));

app.all('/*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/auth/')) {
    const auth = await getAuth().catch(() => null);
    if (!auth) return c.text('Auth unavailable', 503);
    try {
      const res = await auth.handler(c.req.raw);
      return res;
    } catch (err: any) {
      return c.text(`Auth error: ${err.message}`, 500);
    }
  }
  await next();
});

app.get('/api/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

app.get('/api/projects/last', async (c) => {
  try {
    const rows = await db.select().from(projects)
      .orderBy(desc(projects.updatedAt)).limit(1);
    return c.json(rows[0] || null);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/projects/save', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, location, date, data } = body;
    const now = new Date();

    if (id) {
      await db.update(projects)
        .set({ name, location, date: date || '', data: data || {}, updatedAt: now })
        .where(eq(projects.id, id))
        .execute();
    } else {
      await db.insert(projects).values({
        id: crypto.randomUUID(), name, location, date: date || '',
        data: data || {}, updatedAt: now,
      }).execute();
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
