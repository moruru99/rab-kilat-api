import { pgTable, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
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

const connStr = process.env.DATABASE_URL || 'postgresql://postgres:AyanaBungas@127.0.0.1:5432/rab_kilat';
const client = postgres(connStr, { max: 5 });
const db = drizzle(client, { schema: { user, session, account, verification } });

let _auth: any = null;
async function getAuth() {
  if (_auth) return _auth;
  const { drizzleAdapter } = await import('@better-auth/drizzle-adapter');
  _auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'),
    database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),
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
}

function setCorsHeaders(res: any, origin: string | undefined) {
  if (!origin) return;
  const allowed = ['http://localhost:5173', 'https://rab-kilat.vercel.app'];
  if (allowed.includes(origin) || (origin.endsWith('.vercel.app') && origin.includes('rab-kilat'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve('');
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

export default async (req: any, res: any) => {
  try {
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res, req.headers.origin);
      res.statusCode = 204;
      res.end();
      return;
    }
    setCorsHeaders(res, req.headers.origin);

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v as string);
    }
    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
      body: await readBody(req) || undefined,
    });

    const auth = await getAuth();
    const webResponse = await auth.handler(webRequest);
    res.statusCode = webResponse.status;
    webResponse.headers.forEach((v: string, k: string) => res.setHeader(k, v));
    res.end(await webResponse.text());
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`Auth error: ${err.message}`);
  }
};
