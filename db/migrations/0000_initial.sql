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
	"game" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_aliases" (
	"game" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "games_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "card_boolean_attributes" ADD CONSTRAINT "card_boolean_attributes_id_cards_id_fk" FOREIGN KEY ("id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_numeric_attributes" ADD CONSTRAINT "card_numeric_attributes_id_cards_id_fk" FOREIGN KEY ("id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_text_attributes" ADD CONSTRAINT "card_text_attributes_id_cards_id_fk" FOREIGN KEY ("id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_game_games_id_fk" FOREIGN KEY ("game") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_aliases" ADD CONSTRAINT "game_aliases_game_games_id_fk" FOREIGN KEY ("game") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_boolean_attributes_id_attribute_unique" ON "card_boolean_attributes" USING btree ("id","attribute");--> statement-breakpoint
CREATE INDEX "card_boolean_attributes_attribute_value_check_index" ON "card_boolean_attributes" USING btree ("attribute","value");--> statement-breakpoint
CREATE INDEX "card_boolean_attributes_attribute_value_sort_index" ON "card_boolean_attributes" USING btree ("attribute","value" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "card_numeric_attributes_id_attribute_unique" ON "card_numeric_attributes" USING btree ("id","attribute");--> statement-breakpoint
CREATE INDEX "card_numeric_attributes_attribute_value_check_index" ON "card_numeric_attributes" USING btree ("attribute","value");--> statement-breakpoint
CREATE INDEX "card_numeric_attributes_attribute_value_sort_index" ON "card_numeric_attributes" USING btree ("attribute","value" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "card_text_attributes_id_attribute_unique" ON "card_text_attributes" USING btree ("id","attribute");--> statement-breakpoint
CREATE INDEX "card_text_attributes_attribute_value_check_index" ON "card_text_attributes" USING btree ("attribute","value");--> statement-breakpoint
CREATE INDEX "card_text_attributes_attribute_value_sort_index" ON "card_text_attributes" USING btree ("attribute","value" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "cards_oid_game_unique" ON "cards" USING btree ("oid","game");--> statement-breakpoint
CREATE INDEX "cards_oid_index" ON "cards" USING btree ("oid");--> statement-breakpoint
CREATE INDEX "cards_name_index" ON "cards" USING btree ("name");