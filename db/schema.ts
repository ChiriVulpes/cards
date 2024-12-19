import { sql } from "drizzle-orm"
import { pgTable, text, uuid } from "drizzle-orm/pg-core"

export const Attributes = pgTable('attributes', {
	attribute: text('attribute').notNull(),
	values: text('values').notNull().array().default([]),
})

export const Cards = pgTable('cards', {
	id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
	name: text('name').notNull(),
})

export const CardAttributes = pgTable('card_attributes', {
	id: uuid('id').notNull().references(() => Cards.id),
	attribute: text('attribute').notNull(),
	value: text('value').notNull(),
})
