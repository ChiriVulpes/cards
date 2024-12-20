import { db } from '@/db/db' // Assuming your Drizzle instance is exported here
import type { AttributeTypes } from '@/db/schema'
import { Attributes, CardBooleanAttributes, CardNumericAttributes, CardTextAttributes, Cards, GameAliases, Games } from '@/db/schema'
import JSONEndpoint from '@/util/JSONEndpoint'
import { and, eq, notInArray, sql } from 'drizzle-orm'
import * as fs from 'fs'
import { glob } from 'glob'
import path from 'path'
import { chain } from 'stream-chain'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'

export const dynamic = 'force-dynamic'

/**
 * The number of cards to collect before querying the DB to insert them.
 *
 * This would be tweaked over time based on how frequently we need to reimport
 * and what appears to be the fastest and most efficient for the database and CI (though for right now this just runs on a server route).
 */
const BATCH_SIZE = 1000

export const GET = JSONEndpoint(async () => {
	if (process.env.NODE_ENV !== 'development')
		return new Response(null, { status: 403 })

	const imported = await ingest()
	return { imported }
})

interface CardInputShared {
	id: string | number
	name: string
	game: string
}

/** Shared properties on all card objects should not be imported as generic attributes */
const CARD_PROPERTIES_SHARED = ['id', 'name', 'game'] satisfies (keyof CardInputShared)[]

interface CardInputGeneric extends CardInputShared {
	[key: string]: unknown
}

interface ManifestDefinition {
	file: string
	game: string
	aliases?: string[]
}

async function ingest () {
	const batch: CardInputGeneric[] = []
	let imported = 0

	/**
	 * Presumably a previous task would download the relevant files from sources before this task would run.
	 * This would, again, probably be in a CI pipeline.
	 */
	const files = await glob('data/*.json', { cwd: process.cwd() })

	const manifestPath = `data${path.sep}manifest.json`
	const manifest: ManifestDefinition[] = await fs.promises.readFile(manifestPath, 'utf8').then(JSON.parse)
	if (manifest && !Array.isArray(manifest))
		throw new Error('Manifest file is not an array with filenames and game names')

	const gameIds: UUID[] = []
	for (const file of files.filter(file => file !== manifestPath)) {
		const basename = path.basename(file)
		const game = manifest.find(definition => definition.file === basename.slice(0, basename.indexOf('.')))
		if (!game) {
			console.warn(`No game definition for ${basename}`)
			continue
		}

		const gameName = game.game
		const id = await updateGame(game, gameName)
		gameIds.push(id)

		console.log(`Processing ${gameName} data (${basename})`)

		const pipeline = chain([
			fs.createReadStream(path.join(process.cwd(), file)),
			parser(),
			streamArray(),
		] as const)

		let batchIndex = 1
		for await (const { value } of pipeline) {
			const isInvalid = false
				|| typeof value !== 'object' || value === null
				|| !value.name
				|| value.id === ''
				|| (typeof value.id !== 'string' && typeof value.id !== 'number')

			if (isInvalid) {
				console.log('Unsupported card format:', value)
				continue
			}

			value.game = gameName

			batch.push(value)

			if (batch.length >= BATCH_SIZE) {
				console.log('Processing batch', batchIndex++)
				imported += await processBatch(id, batch)
			}
		}

		// import leftovers (not full batch)
		console.log('Processing batch', batchIndex++)
		imported += await processBatch(id, batch)
	}

	for (const game of gameIds)
		await updateAttributeDefinitions(game)

	await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY card_outputs`)

	return imported
}

async function updateGame (game: ManifestDefinition, gameName: string) {
	const [{ id }] = await db.insert(Games)
		.values({ name: gameName })
		.onConflictDoUpdate({
			target: Games.name,
			set: { name: sql`EXCLUDED.name` },
		})
		.returning({ id: Games.id })

	await db.delete(GameAliases)
		.where(eq(GameAliases.game,
			db.select({ id: Games.id })
				.from(Games)
				.where(eq(Games.name, gameName))
				.limit(1),
		))

	if (game.aliases?.length)
		await db.insert(GameAliases)
			.values(game.aliases.map(alias => ({ game: id, alias })))

	return id as UUID
}

async function processBatch (game: UUID, batch: CardInputGeneric[]) {
	if (!batch.length)
		return 0

	const idMap = await updateCards(game, batch)
	const attributes = prepareCardAttributes(batch, idMap)
	await updateCardAttributes(CardTextAttributes, attributes.text)
	await updateCardAttributes(CardNumericAttributes, attributes.numeric)
	await updateCardAttributes(CardBooleanAttributes, attributes.boolean)

	const imported = batch.length
	batch.length = 0 // clear batch array
	return imported
}

type UUID = string & { _uuid: true }
type UUIDMap = Record<string, UUID>

async function updateCards (game: UUID, batch: CardInputGeneric[]): Promise<UUIDMap> {
	const cards = batch.map(item => ({
		oid: `${item.id}`,
		name: item.name,
		game,
	}))

	const ids = await db.insert(Cards)
		.values(cards)
		.onConflictDoUpdate({
			target: [Cards.game, Cards.oid],
			set: { name: sql`EXCLUDED.name` },
		})
		.returning({
			id: Cards.id,
			oid: Cards.oid,
		})

	return Object.fromEntries(ids.map(({ oid, id }) => [oid, id as UUID]))
}

interface CardAttribute<T> {
	/**
	 * Internal card ID, not the original ID associated with the card.
	 * This is a branded string type to ensure the correct ID is used.
	 */
	id: UUID
	attribute: string
	value: T
}

function prepareCardAttributes (batch: CardInputGeneric[], ids: UUIDMap) {
	const text: CardAttribute<string>[] = []
	const numeric: CardAttribute<number>[] = []
	const boolean: CardAttribute<boolean>[] = []
	for (const card of batch) {
		for (const key in card) {
			if (CARD_PROPERTIES_SHARED.includes(key as keyof CardInputShared))
				continue

			const value = card[key]
			switch (typeof value) {
				case 'string':
					text.push({
						id: ids[card.id],
						attribute: key,
						value: value,
					})
					break

				case 'number':
					numeric.push({
						id: ids[card.id],
						attribute: key,
						value: value,
					})
					break

				case 'boolean':
					boolean.push({
						id: ids[card.id],
						attribute: key,
						value: value,
					})
					break

				default:
					console.warn(`Card '${card.name}' (${card.id}) contains unsupported attribute value type in attribute '${key}'. Type: ${typeof value}`)
			}
		}
	}

	return {
		text,
		numeric,
		boolean,
	}
}

async function updateCardAttributes (table: typeof CardTextAttributes | typeof CardNumericAttributes | typeof CardBooleanAttributes, attributes: CardAttribute<any>[]) {
	if (!attributes.length)
		return

	await db.delete(table)
		.where(and(
			// delete attributes from last import where id is in the cards we're updating from
			eq(table.id, sql`ANY(ARRAY[${sql.join(attributes.map(c => sql`${c.id}::uuid`), sql`,`)}])`),
			// and the existing attribute is not in the new attributes
			notInArray(
				sql`(${table.id}::uuid, ${table.attribute})`,
				sql`(VALUES ${sql.join(attributes.map(a => sql`(${a.id}::uuid, ${a.attribute})`), sql`,`)})`,
			),
		))

	await db.insert(table)
		.values(attributes)
		.onConflictDoUpdate({
			target: [table.id, table.attribute],
			set: { value: sql`EXCLUDED.value` },
		})
}

async function updateAttributeDefinitions (game: UUID) {
	const attributeTypes = db.$with('attribute_types')
		.as(db
			.selectDistinct({ name: CardTextAttributes.attribute, type: sql<AttributeTypes>`'text'::attribute_types`.as('type') })
			.from(CardTextAttributes)
			.innerJoin(Cards, eq(CardTextAttributes.id, Cards.id))
			.where(eq(Cards.game, game))
			.union(db
				.selectDistinct({ name: CardNumericAttributes.attribute, type: sql<AttributeTypes>`'numeric'::attribute_types`.as('type') })
				.from(CardNumericAttributes)
				.innerJoin(Cards, eq(CardNumericAttributes.id, Cards.id))
				.where(eq(Cards.game, game)))
			.union(db
				.selectDistinct({ name: CardBooleanAttributes.attribute, type: sql<AttributeTypes>`'boolean'::attribute_types`.as('type') })
				.from(CardBooleanAttributes)
				.innerJoin(Cards, eq(CardBooleanAttributes.id, Cards.id))
				.where(eq(Cards.game, game))))

	const attributeValues = db.$with('attribute_values')
		.as(db
			.select({
				name: CardTextAttributes.attribute,
				value: sql`to_jsonb(${CardTextAttributes.value})`.as('value'),
			})
			.from(CardTextAttributes)
			.innerJoin(Cards, eq(CardTextAttributes.id, Cards.id))
			.where(eq(Cards.game, game))
			.union(db
				.select({
					name: CardNumericAttributes.attribute,
					value: sql`to_jsonb(${CardNumericAttributes.value})`.as('value'),
				})
				.from(CardNumericAttributes)
				.innerJoin(Cards, eq(CardNumericAttributes.id, Cards.id))
				.where(eq(Cards.game, game)))
			.union(db
				.select({
					name: CardBooleanAttributes.attribute,
					value: sql`to_jsonb(${CardBooleanAttributes.value})`.as('value'),
				})
				.from(CardBooleanAttributes)
				.innerJoin(Cards, eq(CardBooleanAttributes.id, Cards.id))
				.where(eq(Cards.game, game))))

	await db
		.insert(Attributes)
		.select(db
			.with(attributeTypes, attributeValues)
			.select({
				game: sql`${game}`.as('game'),
				attribute: attributeTypes.name,
				types: sql<AttributeTypes[]>`ARRAY_AGG(DISTINCT ${attributeTypes.type} ORDER BY ${attributeTypes.type})`.as('types'),
				values: sql<AttributeTypes[]>`CASE
					WHEN COUNT(DISTINCT ${attributeValues.value}) > 12 THEN '[]'::jsonb
					ELSE jsonb_agg(DISTINCT ${attributeValues.value})::jsonb
				END`.as('values'),
			})
			.from(attributeTypes)
			.leftJoin(attributeValues, eq(attributeTypes.name, attributeValues.name))
			.groupBy(attributeTypes.name))
		.onConflictDoUpdate({
			target: [Attributes.game, Attributes.attribute],
			set: {
				types: sql`EXCLUDED.types`,
				values: sql`EXCLUDED.values`,
			},
		})
}
