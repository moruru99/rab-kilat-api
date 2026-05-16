import { Hono } from 'hono';
import { cors } from 'hono/cors';

export const config = {
  runtime: 'nodejs',
};

const app = new Hono();
app.use('/*', cors({ origin: '*', credentials: true }));

app.get('/api/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

export default async (req: any, res: any) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v as string);
    }

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
    });

    const webResponse = await app.fetch(webRequest);

    res.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(await webResponse.text());
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message, stack: err.stack }));
  }
};
