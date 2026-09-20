"use client";

import dynamic from "next/dynamic";

const MetroMap = dynamic(() => import("@/components/MetroMap"), { ssr: false });

export default function Home() {
  return (
    <main className="live">
      <header>
        <b className="brand"><i className="radar-mark" aria-hidden="true" /><span>Melbourne Transit Radar</span></b>
        <span className="network-state"><i aria-hidden="true" />Live network</span>
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
