import {
  pgTable, text, jsonb, timestamp,
} from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('local'),
  name: text('name').notNull().default(''),
  location: text('location').notNull().default(''),
  date: text('date').notNull().default(''),
  data: jsonb('data').$type<{
    sections: any[];
    materials: any[];
    templates: any[];
  }>().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const syncLog = pgTable('sync_log', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull().default('local'),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type SyncLogEntry = typeof syncLog.$inferSelect;
export type NewSyncLogEntry = typeof syncLog.$inferInsert;
