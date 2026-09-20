#!/bin/sh
set -eu

# Run this on the home server from the repository root. It imports into the
# inactive database, then swaps the app to it only after a successful import.
environment_file=.env.home
compose="docker compose --env-file $environment_file -f docker-compose.home.yml"
active_database=$(sed -n 's/^ACTIVE_DATABASE=//p' "$environment_file" | tail -n 1)

case "$active_database" in
  melbourne_transit_radar) next_database=melbourne_transit_radar_staging ;;
  melbourne_transit_radar_staging) next_database=melbourne_transit_radar ;;
  *) echo "ACTIVE_DATABASE must be a Melbourne Transport Radar database." >&2; exit 1 ;;
esac

$compose --profile maintenance run --build --rm -e "IMPORT_DATABASE=$next_database" importer npm run gtfs:update

sed -i "s/^ACTIVE_DATABASE=.*/ACTIVE_DATABASE=$next_database/" "$environment_file"
$compose up -d app
echo "Switched Melbourne Transport Radar to $next_database."
