# Architecture

Next.js App Router provides the passenger UI and server API boundary. GTFS is downloaded outside requests, extracted from Folder 2, normalized into PostgreSQL/Drizzle tables and queried server-side. Realtime credentials remain in environment variables. Browser code receives only journey results, never GTFS archives or credentials.

Future updates can run `npm run gtfs:update` from a Vercel Cron Job, GitHub Action or external worker with database access.
