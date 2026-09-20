# Melbourne Transit Radar

Melbourne Transit Radar is a live Melbourne transport map for metropolitan and V/Line trains, trams, and buses. A GTFS `trip_id` is not necessarily one physical vehicle: when the official feed explicitly supplies `transfer_type=4`, the app tells passengers to stay aboard and counts zero transfers.

## Features

- Mobile-first station-to-station search surface
- Ordered City Loop stop sequence, rather than only a line label
- Explicit in-seat continuation semantics
- GTFS parsing, calendar support and times beyond 24:00
- PostgreSQL/Drizzle schema for server-side timetable data
- Repeatable official GTFS download command

## Architecture and data

The official Victorian DTP GTFS Schedule feed is the timetable foundation. The production flow downloads and extracts folders 1–4 (regional and metropolitan train, metropolitan tram, and Myki bus), normalizes them into PostgreSQL, then serves the map entirely server-side. See [architecture](docs/architecture.md), [GTFS findings](docs/gtfs-findings.md), and [routing](docs/routing.md).

## Install

```bash
git clone <your-repository-url>
cd melbourne-train-planner
npm install
cp .env.example .env.local
```

Set `DATABASE_URL` before importing timetable data. API keys are optional until realtime integration is configured and must remain server-side.

## Commands

```bash
npm run dev
npm test
npm run lint
npm run build
npm run gtfs:download
npm run gtfs:import
```

## Deployment

The project is deployed on Vercel and can also run on the home server as a
standalone Next.js container. The home-server stack listens only on
`127.0.0.1:14020`; host Nginx serves it at
`https://melbournetransport.chuakaien.com`.

On the server, create an untracked `.env.home` from `.env.home.example`, then
deploy the isolated app and PostgreSQL stack with:

```bash
cd /var/www/melbourne-train-planner
docker compose --env-file .env.home -f docker-compose.home.yml up -d --build
```

Import the latest official schedules after the database is healthy. This takes
several minutes and needs to be repeated when the weekly feed is refreshed:

```bash
docker compose --env-file .env.home -f docker-compose.home.yml --profile maintenance run --rm importer npm run gtfs:update
```

The database is a private Docker volume on the home server and is not exposed
to the internet or shared with other projects. Nginx configuration and the
wider server runbook live in `chuakaien/home-server-config`.

For subsequent zero-downtime feed refreshes, run the home-server script below.
It imports into the inactive database and switches the application only after
the import succeeds. The initial full import can take several minutes because
of the statewide bus feed.

```bash
./scripts/home-gtfs-refresh.sh
```

## Data attribution and limitations

Uses public transport data provided by the Victorian Department of Transport and Planning. This is an independent application and is not affiliated with PTV or the Victorian Government. The shipped interface is an illustrative fixture until a production GTFS import and database are configured; see [validation](docs/validation.md).
