DROP INDEX "cards_oid_index";--> statement-breakpoint
CREATE INDEX "card_boolean_attributes_id_index" ON "card_boolean_attributes" USING btree ("id");--> statement-breakpoint
CREATE INDEX "card_numeric_attributes_id_index" ON "card_numeric_attributes" USING btree ("id");--> statement-breakpoint
CREATE INDEX "card_text_attributes_id_index" ON "card_text_attributes" USING btree ("id");--> statement-breakpoint
CREATE INDEX "cards_game_index" ON "cards" USING btree ("game");--> statement-breakpoint
CREATE INDEX "game_aliases_game_index" ON "game_aliases" USING btree ("game");