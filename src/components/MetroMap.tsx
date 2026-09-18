"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Point = { latitude: number; longitude: number };
type Station = Point & { id: string; name: string };
type Vehicle = Point & { id: string; routeId: string; routeName: string; routeColor: string | null; headsign: string };
type MapData = { stations: Station[]; vehicles: Vehicle[]; asOf: string; positionSource: "scheduled" | "realtime" };
type TripPath = { destination: string; stops: Array<Point & { name: string; sequence: number }> };

function routeColour(routeId: string) {
  const colours = ["#ff6b6b", "#f6c945", "#6ee7b7", "#7dd3fc", "#c4b5fd", "#fb923c", "#f9a8d4"];
  return colours[[...routeId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colours.length];
}

function distanceKm(first: Point, second: Point) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitude = radians(second.latitude - first.latitude);
  const longitude = radians(second.longitude - first.longitude);
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function RecenterMap({ position }: { position: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.latitude, position.longitude], 13, { duration: 0.8 });
  }, [map, position]);
  return null;
}

export default function MetroMap() {
  const [data, setData] = useState<MapData | null>(null);
  const [showStations, setShowStations] = useState(false);
  const [showLinePicker, setShowLinePicker] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripPath | null>(null);
  const [location, setLocation] = useState<Point | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showNearby, setShowNearby] = useState(false);

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
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const updatedAt = data
    ? new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Australia/Melbourne" }).format(new Date(data.asOf))
    : "Connecting…";
  const lines = [...new Map((data?.vehicles ?? []).map((vehicle) => [vehicle.routeId, vehicle])).values()]
    .sort((first, second) => first.routeName.localeCompare(second.routeName));
  const selectedLine = lines.find((line) => line.routeId === selectedRouteId);
  const visibleVehicles = (data?.vehicles ?? []).filter((vehicle) => !selectedRouteId || vehicle.routeId === selectedRouteId);
  const selectedVehicle = (data?.vehicles ?? []).find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const remainingStops = selectedVehicle && selectedTrip
    ? selectedTrip.stops.slice(selectedTrip.stops.reduce((closest, stop, index) =>
        distanceKm(stop, selectedVehicle) < distanceKm(selectedTrip.stops[closest], selectedVehicle) ? index : closest, 0))
    : [];
  const nearbyVehicles = location
    ? visibleVehicles.map((vehicle) => ({ vehicle, distance: distanceKm(location, vehicle) })).sort((first, second) => first.distance - second.distance).slice(0, 3)
    : [];

  async function selectVehicle(vehicle: Vehicle) {
    setSelectedVehicleId(vehicle.id);
    setSelectedTrip(null);
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(vehicle.id)}`);
      if (response.ok) setSelectedTrip((await response.json()) as TripPath);
    } catch {
      // A realtime vehicle without a matching schedule can still show its headsign.
    }
  }

  function locateMe() {
    if (location) { setShowNearby(true); return; }
    if (!navigator.geolocation) { setLocationError("Location is not supported by this browser."); return; }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocation({ latitude: coords.latitude, longitude: coords.longitude }); setShowNearby(true); },
      () => setLocationError("Location permission was not granted."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="map-root">
      <MapContainer center={[-37.8136, 144.9631]} zoom={11} className="metro-map" style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <RecenterMap position={location} />

        {showStations && data?.stations.map((station) => (
          <CircleMarker key={station.id} center={[station.latitude, station.longitude]} radius={3} pathOptions={{ color: "#06324a", fillColor: "#d5f253", fillOpacity: 0.9, weight: 1 }}>
            <Popup><b>{station.name}</b><br />Scheduled departures available</Popup>
          </CircleMarker>
        ))}

        {selectedVehicle && remainingStops.length > 0 && (
          <Polyline positions={[[selectedVehicle.latitude, selectedVehicle.longitude], ...remainingStops.map((stop) => [stop.latitude, stop.longitude] as [number, number])]} pathOptions={{ color: selectedVehicle.routeColor ? `#${selectedVehicle.routeColor}` : routeColour(selectedVehicle.routeId), weight: 5, opacity: 0.85 }} />
        )}

        {location && <CircleMarker center={[location.latitude, location.longitude]} radius={9} pathOptions={{ color: "#fff", fillColor: "#0c75b8", fillOpacity: 1, weight: 3 }}><Tooltip permanent direction="top">You are here</Tooltip></CircleMarker>}

        {visibleVehicles.map((vehicle) => {
          const colour = vehicle.routeColor ? `#${vehicle.routeColor}` : routeColour(vehicle.routeId);
          const isSelected = selectedVehicleId === vehicle.id;
          const isDimmed = Boolean(selectedVehicleId) && !isSelected;
          return (
            <CircleMarker key={vehicle.id} center={[vehicle.latitude, vehicle.longitude]} radius={isSelected ? 10 : 7} eventHandlers={{ click: () => { void selectVehicle(vehicle); } }} pathOptions={{ color: isSelected ? "#fff" : "#071b2b", fillColor: colour, fillOpacity: isDimmed ? 0.18 : 1, opacity: isDimmed ? 0.18 : 1, weight: isSelected ? 3 : 2 }}>
              <Tooltip direction="top" offset={[0, -7]} opacity={0.96}>{vehicle.headsign}</Tooltip>
              <Popup>
                <b>Destination: {selectedVehicleId === vehicle.id && selectedTrip ? selectedTrip.destination : vehicle.headsign}</b><br />
                {vehicle.routeName} line<br />
                {selectedVehicleId === vehicle.id && selectedTrip ? `${remainingStops.length} stops remaining · highlighted on map` : "Click to highlight its route"}<br />
                {data?.positionSource === "realtime" ? "Official realtime vehicle position" : "Position projected from today&apos;s timetable"}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="map-controls" aria-label="Map display controls">
        <button type="button" className={location ? "map-toggle is-active" : "map-toggle"} onClick={locateMe}><span className="location-dot" />{location ? "Nearby trains" : "Locate me"}</button>
        <button type="button" className={showLinePicker ? "map-toggle is-active" : "map-toggle"} onClick={() => setShowLinePicker((visible) => !visible)} aria-expanded={showLinePicker}>
          <span className="line-dot" style={{ background: selectedLine?.routeColor ? `#${selectedLine.routeColor}` : "#d5f253" }} />{selectedLine ? selectedLine.routeName : "All lines"}
        </button>
        <button type="button" className={showStations ? "map-toggle is-active" : "map-toggle"} onClick={() => setShowStations((visible) => !visible)} aria-pressed={showStations}><span className="station-dot" />{showStations ? "Hide stations" : "Show stations"}</button>

        {showLinePicker && <div className="line-picker" role="group" aria-label="Filter by line">
          <button type="button" className={!selectedRouteId ? "line-chip is-active" : "line-chip"} onClick={() => { setSelectedRouteId(null); setShowLinePicker(false); }}>All lines</button>
          {lines.map((line) => <button type="button" key={line.routeId} className={selectedRouteId === line.routeId ? "line-chip is-active" : "line-chip"} onClick={() => { setSelectedRouteId(line.routeId); setShowLinePicker(false); }}><span className="line-dot" style={{ background: line.routeColor ? `#${line.routeColor}` : routeColour(line.routeId) }} />{line.routeName}</button>)}
        </div>}
      </div>

      {selectedVehicle && <div className="trip-panel">
        <span className="line-dot" style={{ background: selectedVehicle.routeColor ? `#${selectedVehicle.routeColor}` : routeColour(selectedVehicle.routeId) }} />
        <div><small>SELECTED TRAIN</small><b>To {selectedTrip?.destination ?? selectedVehicle.headsign}</b><p>{selectedTrip ? `${remainingStops.length} scheduled stops remaining` : "Loading its route…"}</p><button type="button" className="overview-button" onClick={() => { setSelectedVehicleId(null); setSelectedTrip(null); }}>← Back to overview</button></div>
      </div>}

      {location && showNearby && <div className="nearby-panel"><button type="button" className="nearby-close" onClick={() => setShowNearby(false)} aria-label="Hide nearby trains">×</button><small>NEAREST {data?.positionSource === "realtime" ? "LIVE" : "SCHEDULED"} TRAINS</small>{nearbyVehicles.map(({ vehicle, distance }) => <button type="button" key={vehicle.id} onClick={() => { void selectVehicle(vehicle); }}><span className="line-dot" style={{ background: vehicle.routeColor ? `#${vehicle.routeColor}` : routeColour(vehicle.routeId) }} /><b>To {vehicle.headsign}</b><em>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</em></button>)}<p>Location is used only in this browser.</p></div>}
      {locationError && <div className="location-error" role="status">{locationError}</div>}

      <div className="map-status" aria-live="polite"><span className="status-pulse" /><div><b>{data ? `${visibleVehicles.length} ${data.positionSource === "realtime" ? "live positions" : "scheduled services"}` : "Loading services"}</b><small>{data?.positionSource === "realtime" ? "Official live feed" : "Timetable projection"} · Updated {updatedAt}</small></div></div>
    </div>
  );
}
