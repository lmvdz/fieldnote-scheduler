import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const sessions = sqliteTable('sessions',{id:text('id').primaryKey(), state:text('state').notNull(), revision:integer('revision').notNull().default(0),updated:integer('updated').notNull()});
export const slots = sqliteTable('slots',{slot:text('slot').primaryKey(),session:text('session').notNull(),state:text('state').notNull(),expires:integer('expires').notNull()});
export const orders = sqliteTable('orders',{id:text('id').primaryKey(),session:text('session').notNull(),revision:integer('revision').notNull(),amount:integer('amount').notNull(),status:text('status').notNull(),capture:text('capture'),mode:text('mode').notNull()},t=>[uniqueIndex('orders_capture_unique').on(t.capture)]);
export const events = sqliteTable('events',{id:text('id').primaryKey(),order:text('order_id').notNull(),created:integer('created').notNull()});
