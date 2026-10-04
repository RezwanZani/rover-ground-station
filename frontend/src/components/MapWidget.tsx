import { useEffect, useRef } from "react";
import L from "leaflet";
import { Telemetry } from "../types";

export default function MapWidget({ gps }: { gps: Telemetry["gps"] }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;
    const map = L.map(nodeRef.current, { zoomControl: false, attributionControl: false }).setView([gps.lat, gps.lon], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      className: "dark-map-tiles",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const icon = L.divIcon({
      className: "rover-marker",
      html: `<div style="transform:rotate(${gps.heading}deg)"><span></span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    if (!markerRef.current) markerRef.current = L.marker([gps.lat, gps.lon], { icon }).addTo(mapRef.current);
    markerRef.current.setLatLng([gps.lat, gps.lon]).setIcon(icon);
    mapRef.current.panTo([gps.lat, gps.lon], { animate: true, duration: 0.5 });
  }, [gps.lat, gps.lon, gps.heading]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div ref={nodeRef} className="absolute inset-0" />
      <div className="map-readout">
        <span>{gps.lat.toFixed(5)}° N</span>
        <span>{Math.abs(gps.lon).toFixed(5)}° W</span>
      </div>
      <div className="heading-chip"><span>HDG</span> {Math.round(gps.heading).toString().padStart(3, "0")}°</div>
    </div>
  );
}
