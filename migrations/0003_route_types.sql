ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_type integer;

CREATE INDEX IF NOT EXISTS routes_route_type_idx ON routes(route_type);
