"use client";

import { FormEvent, useMemo, useState } from "react";
import { demoData } from "@/lib/demo-data";
import { formatServiceTime } from "@/lib/gtfs/time";
import { findJourneys } from "@/lib/routing/router";

const stations = demoData.stops;

export default function Home() {
  const [from, setFrom] = useState("southern-cross");
  const [to, setTo] = useState("craigieburn");
  const [leaveMode, setLeaveMode] = useState<"now" | "depart">("now");
  const [searched, setSearched] = useState(false);
  const journeys = useMemo(() => searched ? findJourneys(demoData, from, to, 0, new Date("2026-09-17T12:00:00+10:00")) : [], [from, to, searched]);
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSearched(true); }

  return <main>
    <section className="masthead"><div className="wordmark"><span aria-hidden>↗</span> Metrowise</div><p>Melbourne train journeys, without phantom transfers.</p></section>
    <form className="planner" aria-labelledby="plan-title" onSubmit={search}>
      <div className="eyebrow">Metropolitan trains · Melbourne</div><h1 id="plan-title">Where are you going?</h1>
      <div className="fields"><StationSelect label="From" value={from} onChange={setFrom}/><StationSelect label="To" value={to} onChange={setTo}/></div>
      <fieldset className="leave"><legend>Leave</legend><button className={`choice ${leaveMode === "now" ? "selected" : ""}`} onClick={() => setLeaveMode("now")} type="button">Now</button><button className={`choice ${leaveMode === "depart" ? "selected" : ""}`} onClick={() => setLeaveMode("depart")} type="button">Depart at</button></fieldset>
      <button className="find" type="submit">Find trains <span aria-hidden>→</span></button>
    </form>
    {searched && <section className="results" aria-live="polite"><div className="result-heading"><h2>{journeys.length ? "Best ways to travel" : "No scheduled train found"}</h2><p>{journeys.length ? "Demo schedule — import the official GTFS feed for live timetable searches." : "Try reversing the journey or select a station on this demonstration corridor."}</p></div>
      {journeys.map((journey, index) => <article className="journey" key={index}><div className="journey-top"><div><strong>{formatServiceTime(journey.departure)} <span>→</span> {formatServiceTime(journey.arrival)}</strong><small>{Math.round((journey.arrival - journey.departure) / 60)} min · {journey.viaCityLoop ? "Via City Loop" : "Scheduled service"}</small></div><span className="chip">{journey.transferCount} transfers</span></div>
        {journey.staysAboard && <div className="stay">Stay on this train <span>This train continues as another service — do not get off.</span></div>}
        <ol className="timeline">{journey.stops.map((stop, i) => <li key={`${stop.tripId}-${stop.stopId}-${i}`} className={stop.continuation ? "continues" : ""}><time>{formatServiceTime(stop.time)}</time><span className="dot"/><b>{stop.name.replace(" Station", "")}</b>{stop.platformCode && <small>Platform {stop.platformCode}</small>}{stop.continuation && <em>Train continues</em>}</li>)}</ol>
        <details><summary>Journey details</summary><p>Underlying timetable trips: {journey.technicalTripIds.join(" → ")}. This technical change is an explicit in-seat continuation, not a passenger transfer.</p></details>
      </article>)}</section>}
    <footer>Uses public transport data provided by the Victorian Department of Transport and Planning. Metrowise is an independent application and is not affiliated with PTV or the Victorian Government.</footer>
  </main>;
}

function StationSelect({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) { return <label><span>{label}</span><span className="select-wrap"><select value={value} onChange={(event) => onChange(event.target.value)}>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select><span className="chevron" aria-hidden>⌄</span></span></label>; }
