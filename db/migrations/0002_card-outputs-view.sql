CREATE MATERIALIZED VIEW card_outputs AS
SELECT 
    "cards"."id" AS id,
    "cards"."name" AS name,
	"cards"."oid" AS oid,
    "cards"."game" AS game,
    MIN("games"."name") AS game_name,
	(
		COALESCE(
			JSONB_AGG (ARRAY[TO_JSONB("card_text_attributes"."attribute"), TO_JSONB("card_text_attributes"."value")]) 
			FILTER (WHERE "card_text_attributes"."attribute" IS NOT NULL),
			'[]'::JSONB
		) ||
		COALESCE(
			JSONB_AGG (ARRAY[TO_JSONB("card_numeric_attributes"."attribute"), TO_JSONB("card_numeric_attributes"."value")]) 
			FILTER (WHERE "card_numeric_attributes"."attribute" IS NOT NULL),
			'[]'::JSONB
		) ||
		COALESCE(
			JSONB_AGG (ARRAY[TO_JSONB("card_boolean_attributes"."attribute"), TO_JSONB("card_boolean_attributes"."value")]) 
			FILTER (WHERE "card_boolean_attributes"."attribute" IS NOT NULL),
			'[]'::JSONB
		)
	) AS attributes
FROM "cards"
LEFT JOIN "card_text_attributes" ON "cards"."id" = "card_text_attributes"."id"
LEFT JOIN "card_numeric_attributes" ON "cards"."id" = "card_numeric_attributes"."id"
LEFT JOIN "card_boolean_attributes" ON "cards"."id" = "card_boolean_attributes"."id"
LEFT JOIN "games" ON "cards"."game" = "games"."id"
GROUP BY "cards"."id";

CREATE UNIQUE INDEX idx_card_outputs_id ON card_outputs(id);
