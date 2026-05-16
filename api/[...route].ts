import app from '../src/index';

export const config = {
  runtime: 'nodejs',
};

export default async (req: any, res: any) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v as string);
    }

    const body = req.method !== 'GET' && req.method !== 'HEAD'
      ? await new Promise<Buffer>((resolve) => {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => resolve(Buffer.concat(chunks)));
        })
      : undefined;

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
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
