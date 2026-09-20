# Melbourne Train Planner

Metrowise is a Melbourne metropolitan train journey planner designed to make through-running clear. A GTFS `trip_id` is not necessarily one physical train: when the official feed explicitly supplies `transfer_type=4`, the app tells passengers to stay aboard and counts zero transfers.

## Features

- Mobile-first station-to-station search surface
- Ordered City Loop stop sequence, rather than only a line label
- Explicit in-seat continuation semantics
- GTFS parsing, calendar support and times beyond 24:00
- PostgreSQL/Drizzle schema for server-side timetable data
- Repeatable official GTFS download command

## Architecture and data

The official Victorian DTP GTFS Schedule feed is the timetable foundation. The intended production flow downloads and extracts Folder 2 (Metropolitan Train), normalizes it into PostgreSQL, then routes entirely server-side. See [architecture](docs/architecture.md), [GTFS findings](docs/gtfs-findings.md), and [routing](docs/routing.md).

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

On the server, create an untracked `.env.home` containing
`MELBOURNE_TRAIN_DATABASE_DATABASE_URL`, then deploy with:

```bash
cd /var/www/melbourne-train-planner
docker compose -f docker-compose.home.yml up -d --build
```

The app uses the existing Neon timetable database, so no local database or
GTFS import is required on the home server. Nginx configuration and the wider
server runbook live in `chuakaien/home-server-config`.

## Data attribution and limitations

Uses public transport data provided by the Victorian Department of Transport and Planning. This is an independent application and is not affiliated with PTV or the Victorian Government. The shipped interface is an illustrative fixture until a production GTFS import and database are configured; see [validation](docs/validation.md).
