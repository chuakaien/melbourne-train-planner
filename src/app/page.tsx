"use client";

import dynamic from "next/dynamic";

const MetroMap = dynamic(() => import("@/components/MetroMap"), { ssr: false });

export default function Home() {
  return (
    <main className="live">
      <header>
        <b>↗ Metrowise</b>
        <span>● Network map</span>
      </header>

      <section className="map-shell">
        <MetroMap />

        <aside>
          <small>MELBOURNE METRO</small>
          <h1>See the network move.</h1>
          <p>Explore stations, routes and live-ready train information across Melbourne.</p>
          <div>
            <b>Timetable vehicle positions</b>
            <p>
              Coloured trains are projected from today&apos;s official timetable and refresh every
              30 seconds. Realtime feed matching is the next upgrade.
            </p>
          </div>
        </aside>
      </section>

      <footer>
        Uses public transport data provided by the Victorian Department of Transport and
        Planning.
      </footer>
    </main>
  );
}
