"use client";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
type Station={id:string;name:string;latitude:number;longitude:number};
export default function MetroMap(){const [stations,setStations]=useState<Station[]>([]);useEffect(()=>{fetch("/api/map").then(r=>r.json()).then(d=>setStations(d.stations))},[]);return <MapContainer center={[-37.8136,144.9631]} zoom={11} className="metro-map" style={{height:"100%",width:"100%"}}><TileLayer attribution='© OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{stations.map(s=><CircleMarker key={s.id} center={[Number(s.latitude),Number(s.longitude)]} radius={5} pathOptions={{color:"#0c75b8",fillColor:"#d5f253",fillOpacity:1}}><Popup><b>{s.name}</b><br/>Scheduled departures available</Popup></CircleMarker>)}</MapContainer>}
