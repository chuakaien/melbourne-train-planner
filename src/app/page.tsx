"use client";
import dynamic from "next/dynamic";
const MetroMap=dynamic(()=>import("@/components/MetroMap"),{ssr:false});
export default function Home(){return <main><header><b>↗ Metrowise</b><span>● Network map</span></header><section className="map-shell"><MetroMap/><aside><small>MELBOURNE METRO</small><h1>See the network move.</h1><p>Explore stations, routes and live-ready train information across Melbourne.</p><div><b>Live vehicle positions</b><p>Realtime matching is being connected. Station locations and scheduled data are live from the official GTFS feed.</p></div></aside></section><footer>Uses public transport data provided by the Victorian Department of Transport and Planning.</footer></main>}
