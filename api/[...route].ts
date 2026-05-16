import { getRequestListener } from '@hono/node-server';
import app from './_app';

export const config = {
  runtime: 'nodejs',
};

export default getRequestListener(app.fetch);
