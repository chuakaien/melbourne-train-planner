CREATE TABLE IF NOT EXISTS routes (
  id text PRIMARY KEY,
  short_name text,
  long_name text,
  color text
);

CREATE INDEX IF NOT EXISTS routes_short_name_idx ON routes(short_name);
