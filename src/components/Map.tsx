"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DARKHAN_CENTER, approachMs, haversineKm } from "@/lib/geo";
import { spawnCars, stepCars, type DemoCar, type Pt } from "@/lib/demoCars";

const passengerIcon = L.divIcon({
  className: "",
  html: `<div style="display:flex;flex-direction:column;align-items:center;width:160px">
    <div style="width:22px;height:22px;border-radius:50%;background:#1D4ED8;border:4px solid #fff;box-shadow:0 0 0 8px rgba(29,78,216,.25)"></div>
    <div style="margin-top:6px;background:#fff;color:#0B2545;font-weight:800;font-size:18px;line-height:1.2;padding:4px 10px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 8px rgba(11,37,69,.18)">Таны байршил</div>
  </div>`,
  iconSize: [160, 70],
  iconAnchor: [80, 15],
});

const destIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#FFC300;border:3px solid #0B2545"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const carSvg = `<svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true"><path fill="#0B2545" d="M3.5 10.5 6 5h14l2.5 5.5H3.5zM6 12a2 2 0 1 0 .001 4.001A2 2 0 0 0 6 12zm14 0a2 2 0 1 0 .001 4.001A2 2 0 0 0 20 12z"/></svg>`;

const carIcon = L.divIcon({
  className: "",
  html: `<div style="background:#FFC300;border:3px solid #0B2545;border-radius:10px;padding:5px 7px;line-height:0">${carSvg}</div>`,
  iconSize: [44, 32],
  iconAnchor: [22, 16],
});

const idleCarIcon = L.divIcon({
  className: "",
  html: `<div style="background:#fff;border:2px solid #0B2545;border-radius:8px;padding:3px 5px;line-height:0;opacity:.95">${carSvg}</div>`,
  iconSize: [36, 26],
  iconAnchor: [18, 13],
});

function stopClick(e: L.LeafletMouseEvent) {
  L.DomEvent.stopPropagation(e);
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join("|");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
      map.panBy([0, -60], { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points.map(([a, b]) => L.latLng(a, b))), {
      paddingTopLeft: [28, 72],
      paddingBottomRight: [28, 220],
      maxZoom: 15,
      animate: false,
    });
  }, [map, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickHandler({ onPickDest }: { onPickDest?: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onPickDest) return;
    const handler = (e: L.LeafletMouseEvent) => onPickDest(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onPickDest]);
  return null;
}

function MovingMarker({ position, icon, z }: { position: Pt; icon: L.DivIcon; z?: number }) {
  const markerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    markerRef.current?.setLatLng([position.lat, position.lng]);
  }, [position.lat, position.lng]);
  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={icon}
      zIndexOffset={z || 0}
      eventHandlers={{ click: stopClick }}
    />
  );
}

function DemoCars({ origin }: { origin: Pt }) {
  const originRef = useRef(origin);
  originRef.current = origin;
  const key = `${origin.lat.toFixed(2)},${origin.lng.toFixed(2)}`;
  const [cars, setCars] = useState<DemoCar[]>(() => spawnCars(origin));
  useEffect(() => {
    setCars(spawnCars(originRef.current));
    const id = window.setInterval(() => {
      setCars((prev) => stepCars(prev, originRef.current));
    }, 1400);
    return () => window.clearInterval(id);
  }, [key]);
  return (
    <>
      {cars.map((c) => (
        <MovingMarker key={c.id} position={c} icon={idleCarIcon} />
      ))}
    </>
  );
}

function ApproachCar({ to, hint }: { to: Pt; hint?: Pt | null }) {
  const toLat = to.lat;
  const toLng = to.lng;
  const hintLat = hint?.lat;
  const hintLng = hint?.lng;
  const from = useMemo(() => {
    const target = { lat: toLat, lng: toLng };
    const h = hintLat != null && hintLng != null ? { lat: hintLat, lng: hintLng } : null;
    if (h && haversineKm(h, target) > 0.2) return h;
    return { lat: toLat + 0.011, lng: toLng - 0.008 };
  }, [toLat, toLng, hintLat, hintLng]);
  const [pos, setPos] = useState<Pt>(from);
  useEffect(() => {
    setPos(from);
    const start = performance.now();
    const ms = approachMs(haversineKm(from, { lat: toLat, lng: toLng }));
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - t) ** 2;
      setPos({
        lat: from.lat + (toLat - from.lat) * e,
        lng: from.lng + (toLng - from.lng) * e,
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, toLat, toLng]);
  return <MovingMarker position={pos} icon={carIcon} z={800} />;
}

export type MapProps = {
  pickup?: Pt | null;
  dest?: Pt | null;
  driver?: Pt | null;
  /** Real cars already on the server (admin). */
  cars?: { id: string; lat: number; lng: number }[];
  /** Wander fake cars around this point. */
  demoOrigin?: Pt | null;
  approach?: { id: string; to: Pt; hint?: Pt | null } | null;
  onPickDest?: (lat: number, lng: number) => void;
};

export default function TaxiMap({ pickup, dest, driver, cars, demoOrigin, approach, onPickDest }: MapProps) {
  const center = pickup || driver || demoOrigin || DARKHAN_CENTER;
  const fitPoints = useMemo(() => {
    const pts: [number, number][] = [];
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (dest) pts.push([dest.lat, dest.lng]);
    if (approach?.hint) pts.push([approach.hint.lat, approach.hint.lng]);
    if (approach?.to) pts.push([approach.to.lat, approach.to.lng]);
    if (driver && !approach) pts.push([driver.lat, driver.lng]);
    if (!pickup && !dest && cars?.length) {
      for (const c of cars) pts.push([c.lat, c.lng]);
    }
    return pts;
  }, [pickup, dest, driver, approach, cars]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPickDest={onPickDest} />
        <FitBounds points={fitPoints} />
        {pickup && dest && (
          <Polyline
            positions={[[pickup.lat, pickup.lng], [dest.lat, dest.lng]]}
            pathOptions={{ color: "#0B2545", weight: 4, opacity: 0.8 }}
          />
        )}
        {approach?.hint && (
          <Polyline
            positions={[[approach.hint.lat, approach.hint.lng], [approach.to.lat, approach.to.lng]]}
            pathOptions={{ color: "#16733A", weight: 4, dashArray: "8 10" }}
          />
        )}
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={passengerIcon} eventHandlers={{ click: stopClick }} />}
        {dest && <Marker position={[dest.lat, dest.lng]} icon={destIcon} eventHandlers={{ click: stopClick }} />}
        {driver && !approach && <MovingMarker position={driver} icon={carIcon} z={600} />}
        {cars?.map((c) => (
          <MovingMarker key={c.id} position={c} icon={carIcon} z={400} />
        ))}
        {demoOrigin && <DemoCars origin={demoOrigin} />}
        {approach && <ApproachCar key={approach.id} to={approach.to} hint={approach.hint} />}
      </MapContainer>
    </div>
  );
}
