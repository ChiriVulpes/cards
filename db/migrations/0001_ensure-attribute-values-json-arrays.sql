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
