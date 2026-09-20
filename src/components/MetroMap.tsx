"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { divIcon } from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Point = { latitude: number; longitude: number };
type Station = Point & { id: string; name: string };
type Network = "metro" | "vline" | "tram" | "bus";
type Vehicle = Point & { id: string; routeId: string; routeName: string; routeColor: string | null; headsign: string; heading: number; network: Network };
type Bounds = { south: number; north: number; west: number; east: number };
type MapData = { stations: Station[]; vehicles: Vehicle[]; asOf: string; positionSource: "scheduled" | "realtime" };
type TripPath = { destination: string; stops: Array<Point & { name: string; sequence: number; arrival: number; departure: number }>; shape: Array<Point & { sequence: number }> };
type Departure = { departure: number; platform_code: string | null; headsign: string; route_name: string | null; route_color: string | null };

function routeColour(routeId: string) {
  const colours = ["#ff6b6b", "#f6c945", "#6ee7b7", "#7dd3fc", "#c4b5fd", "#fb923c", "#f9a8d4"];
  return colours[[...routeId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colours.length];
}

function routeLabel(vehicle: Pick<Vehicle, "network" | "routeName">) {
  const name = vehicle.routeName.trim();
  if (!/^\d+[a-z]?$/i.test(name)) return name;
  if (vehicle.network === "tram") return `Tram ${name}`;
  if (vehicle.network === "bus") return `Bus ${name}`;
  return name;
}

function serviceLabel(vehicle: Pick<Vehicle, "network" | "routeName">) {
  const route = routeLabel(vehicle);
  if (vehicle.network === "metro") return `Train ${route}`;
  if (vehicle.network === "vline") return `V/Line ${route}`;
  return route;
}

function serviceBadgeStyle(vehicle: Pick<Vehicle, "routeColor" | "routeId">) {
  const colour = vehicle.routeColor && /^[0-9a-f]{6}$/i.test(vehicle.routeColor) ? `#${vehicle.routeColor}` : routeColour(vehicle.routeId);
  const red = Number.parseInt(colour.slice(1, 3), 16);
  const green = Number.parseInt(colour.slice(3, 5), 16);
  const blue = Number.parseInt(colour.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return { backgroundColor: colour, borderColor: colour, color: luminance > 155 ? "#153147" : "#ffffff" };
}

function trainIcon(colour: string, heading: number, selected: boolean) {
  const size = selected ? 26 : 21;
  const safeColour = /^#[0-9a-f]{6}$/i.test(colour) ? colour : "#0c75b8";
  const safeHeading = Number.isFinite(heading) ? heading : 0;
  return divIcon({
    className: "train-arrow-icon",
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${safeColour}" stroke="${selected ? "#ffffff" : "#071b2b"}" stroke-width="${selected ? 3 : 2}"/><path d="M12 4 L17 17 L12 14 L7 17 Z" fill="#fff" transform="rotate(${safeHeading} 12 12)"/></svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const VehicleMarker = memo(function VehicleMarker({
  vehicle, iconHeading, isSelected, isDimmed, onSelect, positionSource, trip, remainingStopCount,
}: {
  vehicle: Vehicle;
  iconHeading: number;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: (vehicleId: string) => void;
  positionSource: MapData["positionSource"] | undefined;
  trip: TripPath | null;
  remainingStopCount: number;
}) {
  const colour = vehicle.routeColor ? `#${vehicle.routeColor}` : routeColour(vehicle.routeId);
  const eventHandlers = useMemo(() => ({ click: () => onSelect(vehicle.id) }), [onSelect, vehicle.id]);
  return (
    <Marker position={[vehicle.latitude, vehicle.longitude]} icon={trainIcon(colour, iconHeading, isSelected)} opacity={isDimmed ? 0.18 : 1} eventHandlers={eventHandlers}>
      <Tooltip direction="top" offset={[0, -7]} opacity={0.96}>{vehicle.headsign}</Tooltip>
      <Popup autoPan={false}>
        <span className="popup-service-meta"><span className="service-badge" style={serviceBadgeStyle(vehicle)}>{serviceLabel(vehicle)}</span>{positionSource === "realtime" ? <span className="position-badge is-live">Live position</span> : <span className="position-badge">Timetable estimate</span>}</span><br />
        <b>Destination: {isSelected && trip ? trip.destination : vehicle.headsign}</b><br />
        {isSelected && trip && <>{remainingStopCount} stops remaining · full trip highlighted on map<br /></>}
      </Popup>
    </Marker>
  );
});

function formatGtfsTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}${hours >= 24 ? " +1" : ""}`;
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

function MapViewportReporter({ onChange }: { onChange: (bounds: Bounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onChange({ south: bounds.getSouth(), north: bounds.getNorth(), west: bounds.getWest(), east: bounds.getEast() });
    },
  });
  useEffect(() => {
    const bounds = map.getBounds();
    onChange({ south: bounds.getSouth(), north: bounds.getNorth(), west: bounds.getWest(), east: bounds.getEast() });
  }, [map, onChange]);
  return null;
}

export default function MetroMap() {
  const [data, setData] = useState<MapData | null>(null);
  const [showStations, setShowStations] = useState(true);
  const [showMetro, setShowMetro] = useState(true);
  const [showVline, setShowVline] = useState(true);
  const [showTrams, setShowTrams] = useState(true);
  const [showBuses, setShowBuses] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isRouteFinderOpen, setIsRouteFinderOpen] = useState(false);
  const [routeQuery, setRouteQuery] = useState("");
  const [bounds, setBounds] = useState<Bounds>({ south: -38.15, north: -37.45, west: 144.45, east: 145.5 });
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripPath | null>(null);
  const [isTimetableExpanded, setIsTimetableExpanded] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [stationDepartures, setStationDepartures] = useState<Departure[] | null>(null);
  const [location, setLocation] = useState<Point | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showNearby, setShowNearby] = useState(false);

  const updateBounds = useCallback((next: Bounds) => {
    setBounds((current) => Math.abs(current.south - next.south) < 0.01 && Math.abs(current.north - next.north) < 0.01 && Math.abs(current.west - next.west) < 0.01 && Math.abs(current.east - next.east) < 0.01 ? current : next);
  }, []);

  useEffect(() => {
    const toggleControls = () => setShowControls((open) => !open);
    window.addEventListener("toggle-transit-controls", toggleControls);
    return () => window.removeEventListener("toggle-transit-controls", toggleControls);
  }, []);

  // The API only uses viewport bounds to limit the optional bus layer. Keep
  // train and tram timetable animation independent of pan/zoom events.
  const mapQuery = useMemo(() => showBuses
    ? `?${new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]))}`
    : "", [bounds, showBuses]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/map${mapQuery}`, { cache: "no-store" });
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
  }, [mapQuery]);

  const updatedAt = data
    ? new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Australia/Melbourne" }).format(new Date(data.asOf))
    : "Connecting…";
  const displayedVehicles = data?.vehicles ?? [];
  const baseVehicleHeadings = new Map((data?.vehicles ?? []).map((vehicle) => [vehicle.id, vehicle.heading]));
  const networkVehicles = displayedVehicles.filter((vehicle) =>
    (showMetro || vehicle.network !== "metro") && (showVline || vehicle.network !== "vline") && (showTrams || vehicle.network !== "tram") && (showBuses || vehicle.network !== "bus"),
  );
  const lines = [...new Map(networkVehicles.map((vehicle) => [vehicle.routeId, vehicle])).values()]
    .sort((first, second) => routeLabel(first).localeCompare(routeLabel(second)));
  const selectedLine = lines.find((line) => line.routeId === selectedRouteId);
  const matchingLines = lines.filter((line) => routeLabel(line).toLocaleLowerCase().includes(routeQuery.trim().toLocaleLowerCase()));
  const visibleVehicles = networkVehicles.filter((vehicle) => !selectedRouteId || vehicle.routeId === selectedRouteId);
  const selectedVehicle = displayedVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const pointsFromCurrentPosition = <T extends Point>(points: T[]) => {
    if (!selectedVehicle || points.length === 0) return [];
    const closest = points.reduce((closestIndex, point, index) =>
      distanceKm(point, selectedVehicle) < distanceKm(points[closestIndex], selectedVehicle) ? index : closestIndex, 0);
    return points.slice(closest);
  };
  const remainingStops = selectedTrip ? pointsFromCurrentPosition(selectedTrip.stops) : [];
  const selectedTrack = selectedTrip ? (selectedTrip.shape.length ? selectedTrip.shape : selectedTrip.stops) : [];
  const selectedTrackIndex = selectedVehicle && selectedTrack.length
    ? selectedTrack.reduce((closestIndex, point, index) => distanceKm(point, selectedVehicle) < distanceKm(selectedTrack[closestIndex], selectedVehicle) ? index : closestIndex, 0)
    : 0;
  const travelledTrack = selectedTrack.slice(0, selectedTrackIndex + 1);
  const remainingTrack = selectedTrack.slice(selectedTrackIndex);
  const nearbyVehicles = location
    ? visibleVehicles.map((vehicle) => ({ vehicle, distance: distanceKm(location, vehicle) })).sort((first, second) => first.distance - second.distance).slice(0, 3)
    : [];

  const selectVehicle = useCallback(async (vehicle: Vehicle) => {
    setSelectedVehicleId(vehicle.id);
    setSelectedTrip(null);
    setIsTimetableExpanded(false);
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(vehicle.id)}`);
      if (response.ok) setSelectedTrip((await response.json()) as TripPath);
    } catch {
      // A realtime vehicle without a matching schedule can still show its headsign.
    }
  }, []);

  const selectVehicleById = useCallback((vehicleId: string) => {
    const vehicle = data?.vehicles.find((candidate) => candidate.id === vehicleId);
    if (vehicle) void selectVehicle(vehicle);
  }, [data?.vehicles, selectVehicle]);

  async function selectStation(station: Station) {
    setSelectedStationId(station.id);
    setStationDepartures(null);
    try {
      const response = await fetch(`/api/stations/${encodeURIComponent(station.id)}/departures`);
      if (response.ok) setStationDepartures(((await response.json()) as { departures: Departure[] }).departures);
    } catch {
      setStationDepartures([]);
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
      <MapContainer center={[-37.8136, 144.9631]} zoom={11} zoomControl={false} className="metro-map" style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ZoomControl position="bottomright" />
        <RecenterMap position={location} />
        <MapViewportReporter onChange={updateBounds} />

        {showStations && data?.stations.map((station) => (
          <CircleMarker key={station.id} center={[station.latitude, station.longitude]} radius={4} eventHandlers={{ click: () => { void selectStation(station); } }} pathOptions={{ color: "#06324a", fillColor: "#d5f253", fillOpacity: 0.9, weight: 1 }}>
            <Popup autoPan={false}>
              <b>{station.name}</b><br />
              {selectedStationId !== station.id || stationDepartures === null ? "Loading departures…" : stationDepartures.length === 0 ? "No scheduled departures soon." : stationDepartures.map((departure, index) => <span key={`${departure.departure}-${index}`}><b>{formatGtfsTime(Number(departure.departure))}</b> · {departure.headsign} · Platform {departure.platform_code ?? "—"}<br /></span>)}
            </Popup>
          </CircleMarker>
        ))}

        {selectedVehicle && travelledTrack.length > 1 && <Polyline positions={travelledTrack.map((point) => [point.latitude, point.longitude] as [number, number])} pathOptions={{ color: selectedVehicle.routeColor ? `#${selectedVehicle.routeColor}` : routeColour(selectedVehicle.routeId), weight: 6, opacity: 0.52 }} />}
        {selectedVehicle && remainingTrack.length > 1 && <Polyline positions={[[selectedVehicle.latitude, selectedVehicle.longitude], ...remainingTrack.map((point) => [point.latitude, point.longitude] as [number, number])]} pathOptions={{ color: selectedVehicle.routeColor ? `#${selectedVehicle.routeColor}` : routeColour(selectedVehicle.routeId), weight: 5, opacity: 0.88 }} />}

        {location && <CircleMarker center={[location.latitude, location.longitude]} radius={9} pathOptions={{ color: "#fff", fillColor: "#0c75b8", fillOpacity: 1, weight: 3 }}><Tooltip permanent direction="top">You are here</Tooltip></CircleMarker>}

        {visibleVehicles.map((vehicle) => <VehicleMarker key={vehicle.id} vehicle={vehicle} iconHeading={baseVehicleHeadings.get(vehicle.id) ?? vehicle.heading} isSelected={selectedVehicleId === vehicle.id} isDimmed={Boolean(selectedVehicleId) && selectedVehicleId !== vehicle.id} onSelect={selectVehicleById} positionSource={data?.positionSource} trip={selectedTrip} remainingStopCount={remainingStops.length} />)}
      </MapContainer>

      {showControls && <div className="map-controls" aria-label="Map display controls">
        <button type="button" className={location ? "map-toggle is-active" : "map-toggle"} onClick={locateMe}><span className="location-dot" />{location ? "Nearby services" : "Locate me"}</button>
        <button type="button" className={showMetro ? "map-toggle is-active" : "map-toggle"} onClick={() => { setShowMetro((visible) => !visible); setSelectedRouteId(null); }} aria-pressed={showMetro}><span className="metro-dot" />{showMetro ? "Hide Metro trains" : "Show Metro trains"}</button>
        <button type="button" className={showVline ? "map-toggle is-active" : "map-toggle"} onClick={() => { setShowVline((visible) => !visible); setSelectedRouteId(null); }} aria-pressed={showVline}><span className="vline-dot" />{showVline ? "Hide V/Line" : "Show V/Line"}</button>
        <button type="button" className={showTrams ? "map-toggle is-active" : "map-toggle"} onClick={() => { setShowTrams((visible) => !visible); setSelectedRouteId(null); }} aria-pressed={showTrams}><span className="tram-dot" />{showTrams ? "Hide trams" : "Show trams"}</button>
        <button type="button" className={showBuses ? "map-toggle is-active" : "map-toggle"} onClick={() => { setShowBuses((visible) => !visible); setSelectedRouteId(null); }} aria-pressed={showBuses}><span className="bus-dot" />{showBuses ? "Hide buses" : "Show buses"}</button>
        <div className="route-finder">
          <button type="button" className={isRouteFinderOpen ? "map-toggle is-active" : "map-toggle"} onClick={() => setIsRouteFinderOpen((open) => !open)} aria-expanded={isRouteFinderOpen}><span className="line-dot" style={{ background: selectedLine?.routeColor ? `#${selectedLine.routeColor}` : "#9bea47" }} />{selectedLine ? routeLabel(selectedLine) : "Find a route"}</button>
          {isRouteFinderOpen && <div className="route-popover" role="dialog" aria-label="Find a route">
            <input autoFocus value={routeQuery} onChange={(event) => setRouteQuery(event.target.value)} placeholder="Search routes" aria-label="Search routes" />
            <button type="button" className={!selectedRouteId ? "route-option is-active" : "route-option"} onClick={() => { setSelectedRouteId(null); setRouteQuery(""); setIsRouteFinderOpen(false); }}><span className="line-dot" style={{ background: "#9bea47" }} />All lines</button>
            <div className="route-results">{matchingLines.map((line) => <button type="button" key={line.routeId} className={selectedRouteId === line.routeId ? "route-option is-active" : "route-option"} onClick={() => { setSelectedRouteId(line.routeId); setRouteQuery(""); setIsRouteFinderOpen(false); }}><span className="line-dot" style={{ background: line.routeColor ? `#${line.routeColor}` : routeColour(line.routeId) }} />{routeLabel(line)}</button>)}{matchingLines.length === 0 && <p>No matching route</p>}</div>
          </div>}
        </div>
        <button type="button" className={showStations ? "map-toggle is-active" : "map-toggle"} onClick={() => setShowStations((visible) => !visible)} aria-pressed={showStations}><span className="station-dot" />{showStations ? "Hide stations" : "Show stations"}</button>
      </div>}

      {selectedVehicle && <section className={isTimetableExpanded ? "trip-panel is-expanded" : "trip-panel"} aria-label="Selected service timetable">
        <div className="trip-panel-content">
          <span className="service-badge" style={serviceBadgeStyle(selectedVehicle)}>{serviceLabel(selectedVehicle)}</span>
          <b>Destination: {selectedTrip?.destination ?? selectedVehicle.headsign}</b>
          <p>{selectedTrip ? `${remainingStops.length} scheduled stops remaining` : "Loading its route…"}</p>
          {selectedTrip && <ol className="remaining-timetable" aria-label="Remaining station times">
            {remainingStops.map((stop, index) => <li key={`${stop.sequence}-${stop.name}`}>
              <time dateTime={`PT${stop.departure}S`}>{formatGtfsTime(stop.departure)}</time>
              <span>{stop.name.replace(/ Station$/, "")}</span>
              {index === 0 && <em>Next</em>}
            </li>)}
          </ol>}
          {selectedTrip && remainingStops.length > 3 && <button type="button" className="mobile-timetable-toggle" onClick={() => setIsTimetableExpanded((expanded) => !expanded)}>{isTimetableExpanded ? "Show less" : `View all ${remainingStops.length} stops`}</button>}
          <button type="button" className="overview-button" onClick={() => { setSelectedVehicleId(null); setSelectedTrip(null); setIsTimetableExpanded(false); }}>← Back to overview</button>
        </div>
      </section>}

      {location && showNearby && <div className="nearby-panel"><button type="button" className="nearby-close" onClick={() => setShowNearby(false)} aria-label="Hide nearby services">×</button><small>NEAREST {data?.positionSource === "realtime" ? "LIVE" : "SCHEDULED"} SERVICES</small>{nearbyVehicles.map(({ vehicle, distance }) => <button type="button" key={vehicle.id} onClick={() => { void selectVehicle(vehicle); }}><span className="line-dot" style={{ background: vehicle.routeColor ? `#${vehicle.routeColor}` : routeColour(vehicle.routeId) }} /><b>To {vehicle.headsign}</b><em>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</em></button>)}<p>Location is used only in this browser.</p></div>}
      {locationError && <div className="location-error" role="status">{locationError}</div>}

      <div className="map-status" aria-live="polite"><span className="status-pulse" /><div><b>{data ? `${visibleVehicles.length} ${data.positionSource === "realtime" ? "live positions" : "scheduled services"}` : "Loading services"}</b><small>{data?.positionSource === "realtime" ? "Official live feed" : "Timetable projection"} · Updated {updatedAt}</small></div></div>
    </div>
  );
}
