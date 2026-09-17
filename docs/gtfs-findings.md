# GTFS findings

Investigated 17 September 2026 from the official `https://data.ptv.vic.gov.au/downloads/gtfs.zip` archive. Folder `2/google_transit.zip` is the Metropolitan Train feed. It contains `agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt`, `transfers.txt`, `shapes.txt`, `levels.txt` and `pathways.txt`.

`trips.txt` includes route, service, trip, shape, headsign, direction and `block_id`. The observed feed has 34,212 trips; 26,893 have a non-empty block id across 13,437 blocks. Blocks are retained for operational analysis only: the router does not infer passenger continuations from them.

`stop_times.txt` provides ordered calls, arrival/departure times, platform stop IDs and pickup/drop-off flags. `transfers.txt` contains stop, route and trip-level fields plus transfer type. The snapshot has 13,456 `transfer_type=4` rows and no `transfer_type=5` rows. Type 4 is the sole passenger-facing in-seat signal.

Craigieburn is route `aus:vic:vic-02-CGB:` and City Loop platforms are represented as distinct platform stop IDs for Flinders Street, Parliament, Melbourne Central and Flagstaff. A production validation script must join actual type-4 records to ordered calls before asserting a particular Southern Cross–Craigieburn through-service; this repository deliberately does not claim that the illustrative UI trip is a live timetable validation.
