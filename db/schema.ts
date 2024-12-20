import { sql } from 'drizzle-orm'
import { boolean, decimal, index, jsonb, pgEnum, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const Games = pgTable('games', {
	id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
	name: text('name').notNull().unique(),
})

export const GameAliases = pgTable('game_aliases', {
	game: uuid('game').notNull().references(() => Games.id),
	alias: text('alias').notNull(),
})

export const AttributeTypes = pgEnum('attribute_types', ['text', 'numeric', 'boolean'])
export type AttributeTypes = typeof AttributeTypes.enumValues[number]

export const Attributes = pgTable('attributes',
	{
		game: text('game').notNull(),
		attribute: text('attribute').notNull(),
		types: AttributeTypes('types').array().notNull(),
		values: jsonb('values').notNull().default('[]'),
	},
	Attributes => [
		primaryKey({ columns: [Attributes.game, Attributes.attribute] }),
	],
)

export const Cards = pgTable('cards',
	{
		id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
		oid: text('oid').notNull(),
		name: text('name').notNull(),
		game: uuid('game').notNull().references(() => Games.id),
	},
	Cards => [
		uniqueIndex('cards_oid_game_unique').on(Cards.oid, Cards.game),
		index('cards_oid_index').on(Cards.oid),
		index('cards_name_index').on(Cards.name),
	],
)

export const CardTextAttributes = pgTable('card_text_attributes',
	{
		id: uuid('id').notNull().references(() => Cards.id),
		attribute: text('attribute').notNull(),
		value: text('value').notNull(),
	},
	CardAttributes => [
		uniqueIndex('card_text_attributes_id_attribute_unique')
			.on(CardAttributes.id, CardAttributes.attribute),
		index('card_text_attributes_attribute_value_check_index')
			.on(CardAttributes.attribute, CardAttributes.value),
		index('card_text_attributes_attribute_value_sort_index')
			.on(CardAttributes.attribute, sql`${CardAttributes.value} DESC`),
	],
)

export const CardNumericAttributes = pgTable('card_numeric_attributes',
	{
		id: uuid('id').notNull().references(() => Cards.id),
		attribute: text('attribute').notNull(),
		value: decimal('value').notNull(),
	},
	CardAttributes => [
		uniqueIndex('card_numeric_attributes_id_attribute_unique')
			.on(CardAttributes.id, CardAttributes.attribute),
		index('card_numeric_attributes_attribute_value_check_index')
			.on(CardAttributes.attribute, CardAttributes.value),
		index('card_numeric_attributes_attribute_value_sort_index')
			.on(CardAttributes.attribute, sql`${CardAttributes.value} DESC`),
	],
)

export const CardBooleanAttributes = pgTable('card_boolean_attributes',
	{
		id: uuid('id').notNull().references(() => Cards.id),
		attribute: text('attribute').notNull(),
		value: boolean('value').notNull(),
	},
	CardAttributes => [
		uniqueIndex('card_boolean_attributes_id_attribute_unique')
			.on(CardAttributes.id, CardAttributes.attribute),
		index('card_boolean_attributes_attribute_value_check_index')
			.on(CardAttributes.attribute, CardAttributes.value),
		index('card_boolean_attributes_attribute_value_sort_index')
			.on(CardAttributes.attribute, sql`${CardAttributes.value} DESC`),
	],
)

export const schema = {
	Games,
	GameAliases,
	Attributes,
	Cards,
	CardTextAttributes,
	CardNumericAttributes,
	CardBooleanAttributes,
}
