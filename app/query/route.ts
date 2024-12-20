import { db } from '@/db/db'
import { Attributes, CardBooleanAttributes, CardNumericAttributes, CardTextAttributes, GameAliases } from '@/db/schema'
import Errors from '@/util/Errors'
import JSONEndpoint from '@/util/JSONEndpoint'
import type { SQL } from 'drizzle-orm'
import { and, eq, gte, ilike, lt, or, sql } from 'drizzle-orm'
import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { z, ZodError } from 'zod'

const DEFAULT_PAGE_SIZE = 100

const CARD_QUERY_ATTRIBUTE_PREFIX = 'attributes.'

////////////////////////////////////
//#region Card Query Schema

type CardQueryAttributeValueRange = { min?: number, max?: number }
namespace CardQueryAttributeValueRange {
	export function is (value: unknown): value is CardQueryAttributeValueRange {
		return typeof value === 'object' && value !== null && ('min' in value || 'max' in value)
	}
}
type CardQueryAttributeValueLiteral = string | number | boolean | CardQueryAttributeValueRange
type CardQueryAttributeValue = CardQueryAttributeValueLiteral | CardQueryAttributeValueLiteral[]
type CardQuerySchema = z.infer<z.ZodObject<typeof cardQuerySchemaShape>> & {
	[key: string]: CardQueryAttributeValue
}

const cardQuerySchemaShape = {
	name: z.string().optional(),
	id: z.string().optional(),
	oid: z.string().optional(),
	game: z.string().optional(),
	page: z.number({ coerce: true }).int().positive().optional(),
	page_size: z.number({ coerce: true }).int().positive().max(100).optional(),
}
const CardQuerySchema = z.object(cardQuerySchemaShape)
	.catchall(z.union([z.string(), z.number(), z.boolean()]))
	.superRefine(
		(query, context) => {
			for (const key in query) {
				if (key in cardQuerySchemaShape)
					continue

				if (!key.startsWith(CARD_QUERY_ATTRIBUTE_PREFIX))
					context.addIssue({ code: 'custom', message: `Invalid query parameter '${key}'` })

				parseQueryAttribute(query, key, context)
			}
		},
	)

//#endregion
////////////////////////////////////

////////////////////////////////////
//#region Query Value Syntax

const SkipAttribute = Symbol('SkipAttribute')
type SkipAttribute = typeof SkipAttribute
const SkipAttributeValue = Symbol('SkipAttributeValue')
type SkipAttributeValue = typeof SkipAttributeValue

function parseQueryAttribute (query: CardQuerySchema, key: string, context: z.RefinementCtx) {
	const stringValue = `${query[key]}`
	const value = parseAttributeQueryValue(key, stringValue, context)
	if (value === SkipAttribute || value === SkipAttributeValue) {
		delete (query as CardQuerySchema)[key]
		return
	}

	(query as CardQuerySchema)[key] = value ?? stringValue
}

/**
 * 1. Tries to parse the value as JSON.
 * 2. If that fails, tries to parse it as a special query syntax. (ie. color=w,g, or cost=2..5)
 * 3. If that fails, returns the raw string.
 */
function parseAttributeQueryValue (key: string, stringValue: string, context: z.RefinementCtx): CardQueryAttributeValue | undefined | SkipAttribute | SkipAttributeValue {
	try {
		const value = JSON.parse(stringValue)
		if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
			context.addIssue({ code: 'custom', message: `Invalid query parameter value for '${key}'` })
			return SkipAttribute
		}

		return value
	}
	catch {
		return parseSpecialQuerySyntax(key, stringValue, context) ?? stringValue
	}
}

/** any of (color=w,g), range (cost=2..5) */
function parseSpecialQuerySyntax (key: string, stringValue: string, context: z.RefinementCtx): CardQueryAttributeValue | undefined | SkipAttribute | SkipAttributeValue {
	const anyOfResult = parseAnyValueOfSyntax(key, stringValue, context)
	if (anyOfResult !== undefined)
		return anyOfResult

	const rangeResult = parseRangeSyntax(key, stringValue)
	if (rangeResult !== undefined)
		return rangeResult

	return undefined
}

/** ie color=w,g */
function parseAnyValueOfSyntax (key: string, stringValue: string, context: z.RefinementCtx): CardQueryAttributeValue | undefined | SkipAttribute {
	const stringOptions = stringValue.split(',')
	if (stringOptions.length <= 1)
		return undefined

	const parsedOptions = stringOptions.map(option => {
		const value = parseAttributeQueryValue(key, option, context)
		// undefined means it's probably intended to be a raw string
		return value === undefined ? option : value
	}).filter(option => option !== SkipAttributeValue)

	if (parsedOptions.includes(SkipAttribute) || !parsedOptions.length)
		return SkipAttribute

	let options = parsedOptions as CardQueryAttributeValueLiteral[]

	const type = typeof options[0]
	let allSameType = true
	for (const option of options)
		if (typeof option !== type) {
			allSameType = false
			break
		}

	if (!allSameType)
		// when the options are mixed types, they're probably intended to be raw strings
		options = options.map(option => `${option}`)

	return options
}

/**
 * cost=2..5 — >=2 and <=5
 * cost=2.. — >=2
 * cost=..5 — <=5
 */
function parseRangeSyntax (key: string, stringValue: string): CardQueryAttributeValue | undefined | SkipAttributeValue {
	const range = stringValue.split('..')
	if (range.length !== 2)
		return undefined

	const [minString, maxString] = range
	const min = +minString || undefined
	const max = +maxString || undefined
	if (min === undefined && max === undefined)
		return SkipAttributeValue

	return { min, max }
}

//#endregion
////////////////////////////////////

// materialised view for drizzle querying, can't be part of `schema.ts` because it's not a real table
const CardOutputs = pgTable('card_outputs', {
	id: uuid('id').primaryKey(),
	oid: text('oid'),
	name: text('name'),
	game: uuid('game'),
	game_name: text('game_name'),
	attributes: jsonb('attributes'),
})

export const GET = JSONEndpoint(async (request, response) => {
	const searchParams = new URL(request.url).searchParams
	const body = Object.fromEntries(searchParams.entries())

	////////////////////////////////////
	//#region Shape Validation

	let query: CardQuerySchema | undefined
	try {
		query = CardQuerySchema.parse(body)
	}
	catch (err) {
		if (err instanceof ZodError)
			throw Errors.code(400, err.issues.map(issue => issue.message).join(', '))

		throw Errors.code(400, err)
	}

	//#endregion
	////////////////////////////////////

	const queryAttributes = query && Object.entries(query)
		.filter(([key]) => key.startsWith(CARD_QUERY_ATTRIBUTE_PREFIX))
		.map(([key, value]) => [key.slice(CARD_QUERY_ATTRIBUTE_PREFIX.length), value] as const)

	////////////////////////////////////
	//#region Attribute Validation

	// optimisation: make a model to store Attributes on the server until the next time they change rather than querying them each time.
	// research — does next.js have a standardised way of doing something like that?
	const attributes = await db.select().from(Attributes)

	for (const [queryAttribute, values] of queryAttributes) {
		const attributeDefinitions = attributes.filter(attribute => attribute.attribute === queryAttribute)
		if (!attributeDefinitions.length)
			throw Errors.code(400, `Invalid query attribute '${queryAttribute}'`)

		for (const value of Array.isArray(values) ? values : [values]) {
			const type = typeof value === 'string' ? 'text' : typeof value === 'boolean' ? 'boolean'
				: typeof value === 'number' || CardQueryAttributeValueRange.is(value) ? 'numeric'
					: undefined

			if (type === undefined)
				throw Errors.code(500, `Unimplemented attribute value: ${JSON.stringify(value)}`)

			if (!attributeDefinitions.some(attribute => attribute.types.includes(type)))
				throw Errors.code(400, `Invalid query attribute value type '${type}' for '${queryAttribute}'`)

			if (CardQueryAttributeValueRange.is(value))
				continue // already validated via type check above

			let hasPredefinedValues = true
			let hasExactMatch = false
			for (const definition of attributeDefinitions) {
				let options = definition.values as (string | number | boolean)[]
				if (!options.length) {
					hasPredefinedValues = false
					break
				}

				if (type === 'text')
					options = options.map(option => `${option}`.toLowerCase())

				if (options.includes(type === 'text' ? `${value}`.toLowerCase() : value)) {
					hasExactMatch = true
					break
				}
			}

			if (hasPredefinedValues && !hasExactMatch)
				throw Errors.code(400, `Invalid query attribute value '${value}' for '${queryAttribute}'`)
		}
	}

	//#endregion
	////////////////////////////////////

	console.dir(queryAttributes, { depth: Infinity })

	const page = query?.page ?? 1
	const pageSize = query?.page_size ?? DEFAULT_PAGE_SIZE

	const q = db
		.selectDistinct({
			id: CardOutputs.id,
			oid: CardOutputs.oid,
			name: CardOutputs.name,
			game: CardOutputs.game_name,
			attributes: CardOutputs.attributes,
		})
		.from(CardOutputs)
		.leftJoin(CardTextAttributes, eq(CardOutputs.id, CardTextAttributes.id))
		.leftJoin(CardNumericAttributes, eq(CardOutputs.id, CardNumericAttributes.id))
		.leftJoin(CardBooleanAttributes, eq(CardOutputs.id, CardBooleanAttributes.id))
		.leftJoin(GameAliases, eq(CardOutputs.game, GameAliases.game))
		.limit(pageSize + 1)
		.offset((page - 1) * pageSize)
		.where(!query ? undefined
			: and(
				////////////////////////////////////
				//#region Filters

				// simple query filters
				!query?.id ? undefined : eq(CardOutputs.id, query.id),
				!query?.oid ? undefined : eq(CardOutputs.oid, query.oid),

				// name="exact name" or name=partial. case insensitive
				!query?.name ? undefined
					: query.name.startsWith('"') && query.name.endsWith('"')
						? ilike(CardOutputs.name, query.name.slice(1, -1))
						: ilike(CardOutputs.name, sql`'%' || ${query.name} || '%'`),

				// game="exact name" or game=partial, checking game name & aliases. aliases only have exact match. case insensitive
				!query?.game ? undefined
					: or(
						// game name (exact or partial)
						query.game.startsWith('"') && query.game.endsWith('"')
							? ilike(CardOutputs.game_name, query.game.slice(1, -1))
							: ilike(CardOutputs.game_name, sql`'%' || ${query.game} || '%'`),

						// game alias (exact only)
						ilike(
							GameAliases.alias,
							query.game.startsWith('"') && query.game.endsWith('"')
								? query.game.slice(1, -1)
								: query.game,
						),
					),

				// attribute filters (anything that isn't shared on all cards)
				...!queryAttributes?.length ? []
					: queryAttributes.map(attribute => attributeMatchesFilter(...attribute)),

				//#endregion
				////////////////////////////////////
			))

	console.log(q.toSQL().sql)

	const cards = await q

	const has_more = cards.length > pageSize
	response.extension = { page, has_more }
	if (has_more)
		cards.pop()

	for (const card of cards)
		card.attributes = Object.fromEntries(card.attributes as [string, string][])

	return cards
})

function unimplementedQueryParameterValueType (type: string) {
	return Errors.code(500, `Unimplemented query parameter value type '${type}'`)
}

////////////////////////////////////
//#region Attribute Filters

function attributeMatchesFilter (name: string, value: CardQueryAttributeValue) {
	const expr = attributeEqualsLiteral(value)
	switch (typeof value) {
		case 'string':
			return and(eq(CardTextAttributes.attribute, name), expr)
		case 'number':
			return and(eq(CardNumericAttributes.attribute, name), expr)
		case 'boolean':
			return and(eq(CardBooleanAttributes.attribute, name), expr)
		case 'object':
			if (CardQueryAttributeValueRange.is(value))
				return and(eq(CardNumericAttributes.attribute, name), expr)

			// "any of" values for this attribute
			if (Array.isArray(value)) {
				const type = typeof value[0]
				const table = type === 'string' ? CardTextAttributes : type === 'boolean' ? CardBooleanAttributes
					: type === 'number' || CardQueryAttributeValueRange.is(value[0]) ? CardNumericAttributes
						: undefined

				if (!table)
					throw unimplementedQueryParameterValueType(type)

				return and(
					eq(table.attribute, name),
					or(...value.map(option => {
						const expr = attributeEqualsLiteral(option)
						if (!expr)
							throw unimplementedQueryParameterValueType(typeof option)

						return expr
					})))
			}
		// eslint-disable-next-line no-fallthrough
		default:
			throw unimplementedQueryParameterValueType(typeof value)
	}
}

function attributeEqualsLiteral (value: CardQueryAttributeValue) {
	switch (typeof value) {
		case 'string':
			return ilike(CardTextAttributes.value, value)
		case 'number':
			return eq(CardNumericAttributes.value, sql`${value}`)
		case 'boolean':
			return eq(CardBooleanAttributes.value, value)
		case 'object':
			if (CardQueryAttributeValueRange.is(value))
				return attributeMatchesRange(value)
	}
}

function attributeMatchesRange (range: CardQueryAttributeValueRange) {
	const checks: SQL[] = []
	if (range.min !== undefined)
		checks.push(gte(CardNumericAttributes.value, `${range.min}`))
	if (range.max !== undefined)
		checks.push(lt(CardNumericAttributes.value, `${range.max}`))
	return and(...checks)
}

//#endregion
////////////////////////////////////
