CREATE TYPE "public"."attribute_types" AS ENUM('text', 'numeric', 'boolean');--> statement-breakpoint
CREATE TABLE "attributes" (
	"game" text NOT NULL,
	"attribute" text NOT NULL,
	"types" "attribute_types"[] NOT NULL,
	"values" jsonb DEFAULT '[]' NOT NULL,
	CONSTRAINT "attributes_game_attribute_pk" PRIMARY KEY("game","attribute")
);
--> statement-breakpoint
CREATE TABLE "card_boolean_attributes" (
	"id" uuid NOT NULL,
	"attribute" text NOT NULL,
	"value" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_numeric_attributes" (
	"id" uuid NOT NULL,
	"attribute" text NOT NULL,
	"value" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_text_attributes" (
	"id" uuid NOT NULL,
	"attribute" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oid" text NOT NULL,
	"name" text NOT NULL,
	"game" text NOT NULL,
	CONSTRAINT "cards_oid_unique" UNIQUE("oid")
);
--> statement-breakpoint
ALTER TABLE "card_boolean_attributes" ADD CONSTRAINT "card_boolean_attributes_id_cards_id_fk" FOREIGN KEY ("id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_numeric_attributes" ADD CONSTRAINT "card_numeric_attributes_id_cards_id_fk" FOREIGN KEY ("id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_text_attributes" ADD CONSTRAINT "card_text_attributes_id_cards_id_fk" FOREIGN KEY ("id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_boolean_attributes_id_attribute_unique" ON "card_boolean_attributes" USING btree ("id","attribute");--> statement-breakpoint
CREATE INDEX "card_boolean_attributes_attribute_value_check_index" ON "card_boolean_attributes" USING btree ("attribute","value");--> statement-breakpoint
CREATE INDEX "card_boolean_attributes_attribute_value_sort_index" ON "card_boolean_attributes" USING btree ("attribute","value" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "card_numeric_attributes_id_attribute_unique" ON "card_numeric_attributes" USING btree ("id","attribute");--> statement-breakpoint
CREATE INDEX "card_numeric_attributes_attribute_value_check_index" ON "card_numeric_attributes" USING btree ("attribute","value");--> statement-breakpoint
CREATE INDEX "card_numeric_attributes_attribute_value_sort_index" ON "card_numeric_attributes" USING btree ("attribute","value" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "card_text_attributes_id_attribute_unique" ON "card_text_attributes" USING btree ("id","attribute");--> statement-breakpoint
CREATE INDEX "card_text_attributes_attribute_value_check_index" ON "card_text_attributes" USING btree ("attribute","value");--> statement-breakpoint
CREATE INDEX "card_text_attributes_attribute_value_sort_index" ON "card_text_attributes" USING btree ("attribute","value" DESC);--> statement-breakpoint
CREATE INDEX "cards_oid_index" ON "cards" USING btree ("oid");--> statement-breakpoint
CREATE INDEX "cards_name_index" ON "cards" USING btree ("name");

CREATE OR REPLACE FUNCTION ensure_card_attributes_values_json_array()
RETURNS TRIGGER AS $$
BEGIN
    IF jsonb_typeof(NEW.values) <> 'array' THEN
        RAISE EXCEPTION 'Column must be a JSON array';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_card_attributes_values_json_array
BEFORE INSERT OR UPDATE ON "attributes"
FOR EACH ROW
EXECUTE FUNCTION ensure_card_attributes_values_json_array();
