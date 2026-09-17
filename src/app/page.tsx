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
      </section>

      <footer>
        Uses public transport data provided by the Victorian Department of Transport and
        Planning.
      </footer>
    </main>
  );
}
