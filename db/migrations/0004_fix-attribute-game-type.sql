ALTER TABLE "attributes" DROP COLUMN "game";--> statement-breakpoint
ALTER TABLE "attributes" ADD COLUMN "game" uuid;--> statement-breakpoint
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_game_games_id_fk" FOREIGN KEY ("game") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_game_attribute_pk" PRIMARY KEY ("game","attribute");