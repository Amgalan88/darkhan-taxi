"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DARKHAN_CENTER } from "@/lib/geo";

const passengerIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#1D4ED8;border:4px solid #fff;box-shadow:0 0 0 8px rgba(29,78,216,.25)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const destIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#FFC300;border:3px solid #0B2545"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const carIcon = L.divIcon({
  className: "",
  html: `<div style="background:#FFC300;border:3px solid #0B2545;border-radius:10px;padding:4px 6px;font-size:16px;line-height:1">🚕</div>`,
  iconSize: [36, 28],
  iconAnchor: [18, 14],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map(([a, b]) => L.latLng(a, b))), { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export type MapProps = {
  pickup?: { lat: number; lng: number } | null;
  dest?: { lat: number; lng: number } | null;
  driver?: { lat: number; lng: number } | null;
  onPickDest?: (lat: number, lng: number) => void;
  className?: string;
};

function ClickHandler({ onPickDest }: { onPickDest?: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onPickDest) return;
    const handler = (e: L.LeafletMouseEvent) => onPickDest(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, onPickDest]);
  return null;
}

export default function TaxiMap({ pickup, dest, driver, onPickDest, className }: MapProps) {
  const center = pickup || DARKHAN_CENTER;
  const points = useMemo(() => {
    const p: [number, number][] = [];
    if (pickup) p.push([pickup.lat, pickup.lng]);
    if (dest) p.push([dest.lat, dest.lng]);
    if (driver) p.push([driver.lat, driver.lng]);
    return p;
  }, [pickup, dest, driver]);

  return (
    <div className={className} style={{ position: "absolute", inset: 0 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPickDest={onPickDest} />
        <FitBounds points={points} />
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={passengerIcon}>
            <Popup>Таны байршил</Popup>
          </Marker>
        )}
        {dest && <Marker position={[dest.lat, dest.lng]} icon={destIcon} />}
        {driver && <Marker position={[driver.lat, driver.lng]} icon={carIcon} />}
        {!pickup && (
          <CircleMarker
            center={[DARKHAN_CENTER.lat, DARKHAN_CENTER.lng]}
            radius={8}
            pathOptions={{ color: "#1D4ED8", fillColor: "#1D4ED8", fillOpacity: 0.8 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
