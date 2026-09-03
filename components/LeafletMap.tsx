"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup } from "react-leaflet";

export type AccidentPointMarker = {
  id: string;
  lat: number;
  lng: number;
  branch: string;
  city: string;
  accidentDate: string;
  severity: string;
  vehicleType: string;
  casualtyCount: number;
  description: string;
};

export type ClusterMarker = {
  centerLat: number;
  centerLng: number;
  count: number;
  radiusMeters: number;
  branch: string | null;
  city: string | null;
};

const SEVERITY_COLORS: Record<string, string> = {
  ringan: "#22c55e",
  sedang: "#f59e0b",
  berat: "#ef4444",
  meninggal_dunia: "#7c2d12",
};

export default function LeafletMap({
  points,
  clusters,
  center,
  zoom,
}: {
  points: AccidentPointMarker[];
  clusters: ClusterMarker[];
  center: [number, number];
  zoom: number;
}) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {clusters.map((c, i) => (
        <Circle
          key={`cluster-${i}`}
          center={[c.centerLat, c.centerLng]}
          radius={c.radiusMeters}
          pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.15, weight: 2 }}
        >
          <Popup>
            <strong>Titik Rawan (Blackspot)</strong>
            <br />
            {c.city ?? "-"} ({c.branch ?? "-"})
            <br />
            {c.count} kecelakaan dalam radius {c.radiusMeters}m
          </Popup>
        </Circle>
      ))}

      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={6}
          pathOptions={{
            color: SEVERITY_COLORS[p.severity] ?? "#6b7280",
            fillColor: SEVERITY_COLORS[p.severity] ?? "#6b7280",
            fillOpacity: 0.8,
            weight: 1,
          }}
        >
          <Popup>
            <strong>{p.city}</strong> ({p.branch})
            <br />
            {new Date(p.accidentDate).toLocaleDateString("id-ID")}
            <br />
            Tingkat keparahan: {p.severity}
            <br />
            Jenis kendaraan: {p.vehicleType}
            <br />
            Korban: {p.casualtyCount}
            <br />
            {p.description}
            <br />
            <em style={{ fontSize: 11 }}>Data mock - belum terintegrasi Korlantas Polri</em>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
