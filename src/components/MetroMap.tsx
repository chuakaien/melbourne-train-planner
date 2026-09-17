"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Station = { id: string; name: string; latitude: number; longitude: number };
type Vehicle = { id: string; routeId: string; routeName: string; routeColor: string | null; headsign: string; latitude: number; longitude: number };
type MapData = { stations: Station[]; vehicles: Vehicle[]; asOf: string; positionSource: "scheduled" | "realtime" };

function routeColour(routeId: string) {
  const colours = ["#ff6b6b", "#f6c945", "#6ee7b7", "#7dd3fc", "#c4b5fd", "#fb923c", "#f9a8d4"];
  return colours[[...routeId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colours.length];
}

export default function MetroMap() {
  const [data, setData] = useState<MapData | null>(null);
  const [showStations, setShowStations] = useState(false);
  const [showLinePicker, setShowLinePicker] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/map", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as MapData;
        if (active) setData(next);
      } catch {
        // The station map remains usable on the next successful refresh.
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const updatedAt = data
    ? new Intl.DateTimeFormat("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Australia/Melbourne",
      }).format(new Date(data.asOf))
    : "Connecting…";
  const lines = [...new Map((data?.vehicles ?? []).map((vehicle) => [vehicle.routeId, vehicle])).values()]
    .sort((first, second) => first.routeName.localeCompare(second.routeName));
  const selectedLine = lines.find((line) => line.routeId === selectedRouteId);
  const visibleVehicles = (data?.vehicles ?? []).filter(
    (vehicle) => !selectedRouteId || vehicle.routeId === selectedRouteId,
  );

  return (
    <div className="map-root">
      <MapContainer center={[-37.8136, 144.9631]} zoom={11} className="metro-map" style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {showStations && data?.stations.map((station) => (
        <CircleMarker
          key={station.id}
          center={[Number(station.latitude), Number(station.longitude)]}
          radius={3}
          pathOptions={{ color: "#06324a", fillColor: "#d5f253", fillOpacity: 0.9, weight: 1 }}
        >
          <Popup>
            <b>{station.name}</b>
            <br />
            Scheduled departures available
          </Popup>
        </CircleMarker>
      ))}

      {visibleVehicles.map((vehicle) => {
        const colour = vehicle.routeColor ? `#${vehicle.routeColor}` : routeColour(vehicle.routeId);
        return (
          <CircleMarker
            key={vehicle.id}
            center={[vehicle.latitude, vehicle.longitude]}
            radius={7}
            pathOptions={{ color: "#071b2b", fillColor: colour, fillOpacity: 1, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -7]} opacity={0.96}>
              {vehicle.headsign}
            </Tooltip>
            <Popup>
              <b>{vehicle.headsign}</b>
              <br />
              {vehicle.routeName} line
              <br />
              {data?.positionSource === "realtime" ? "Official realtime vehicle position" : "Position projected from today&apos;s timetable"}
            </Popup>
          </CircleMarker>
        );
      })}
      </MapContainer>

      <div className="map-controls" aria-label="Map display controls">
        <button
          type="button"
          className={showLinePicker ? "map-toggle is-active" : "map-toggle"}
          onClick={() => setShowLinePicker((visible) => !visible)}
          aria-expanded={showLinePicker}
        >
          <span className="line-dot" style={{ background: selectedLine?.routeColor ? `#${selectedLine.routeColor}` : "#d5f253" }} />
          {selectedLine ? selectedLine.routeName : "All lines"}
        </button>
        <button
          type="button"
          className={showStations ? "map-toggle is-active" : "map-toggle"}
          onClick={() => setShowStations((visible) => !visible)}
          aria-pressed={showStations}
        >
          <span className="station-dot" />
          {showStations ? "Hide stations" : "Show stations"}
        </button>

        {showLinePicker && (
          <div className="line-picker" role="group" aria-label="Filter by line">
            <button
              type="button"
              className={!selectedRouteId ? "line-chip is-active" : "line-chip"}
              onClick={() => { setSelectedRouteId(null); setShowLinePicker(false); }}
            >
              All lines
            </button>
            {lines.map((line) => (
              <button
                type="button"
                key={line.routeId}
                className={selectedRouteId === line.routeId ? "line-chip is-active" : "line-chip"}
                onClick={() => { setSelectedRouteId(line.routeId); setShowLinePicker(false); }}
              >
                <span className="line-dot" style={{ background: line.routeColor ? `#${line.routeColor}` : routeColour(line.routeId) }} />
                {line.routeName}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="map-status" aria-live="polite">
        <span className="status-pulse" />
        <div>
          <b>{data ? `${visibleVehicles.length} ${data.positionSource === "realtime" ? "live positions" : "scheduled services"}` : "Loading services"}</b>
          <small>{data?.positionSource === "realtime" ? "Official live feed" : "Timetable projection"} · Updated {updatedAt}</small>
        </div>
      </div>
    </div>
  );
}
