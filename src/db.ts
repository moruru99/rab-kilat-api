import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connStr = process.env.DATABASE_URL
  || 'postgresql://postgres:AyanaBungas@127.0.0.1:5432/rab_kilat';

const client = postgres(connStr, { max: 5 });
export const db = drizzle(client, { schema});

console.log('[DB] PostgreSQL connected:', connStr.replace(/\/\/.*@/, '//***@'));
