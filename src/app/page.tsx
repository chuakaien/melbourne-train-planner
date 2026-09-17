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
            <b>Vehicle positions</b>
            <p>
              Official realtime locations are used when available. Otherwise, coloured trains
              are projected from today&apos;s timetable and refresh every 30 seconds.
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
