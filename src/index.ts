import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db } from './db';
import { projects } from './schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from './auth';

const app = new Hono();

const allowedOrigins = [
  'http://localhost:5173',
  'https://rab-kilat.vercel.app',
];

app.use('/*', cors({ origin: allowedOrigins, credentials: true }));

app.all('/*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/auth/')) {
    return auth.handler(c.req.raw);
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
      const newId = crypto.randomUUID();
      await db.insert(projects).values({
        id: newId, name, location, date: date || '',
        data: data || {}, updatedAt: now,
      }).execute();
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
