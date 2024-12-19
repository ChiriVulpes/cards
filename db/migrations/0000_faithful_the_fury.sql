CREATE TABLE "attributes" (
	"attribute" text NOT NULL,
	"values" text[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "card_attributes" (
	"id" uuid NOT NULL,
	"attribute" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_attributes" ADD CONSTRAINT "card_attributes_id_cards_id_fk" FOREIGN KEY ("id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;