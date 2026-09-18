ALTER TABLE trips ADD COLUMN IF NOT EXISTS shape_id text;

CREATE TABLE IF NOT EXISTS shapes (
  shape_id text NOT NULL,
  sequence integer NOT NULL,
  latitude real NOT NULL,
  longitude real NOT NULL,
  PRIMARY KEY (shape_id, sequence)
);

CREATE INDEX IF NOT EXISTS trips_shape_idx ON trips(shape_id);
