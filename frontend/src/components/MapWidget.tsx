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
      className: "filter grayscale-[65%] hue-rotate-[145deg] brightness-[107%] contrast-[88%] saturate-[65%]",
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
      html: `<div class="relative w-[34px] h-[34px] border border-[rgba(17,151,90,.55)] rounded-full grid place-items-center" style="transform:rotate(${gps.heading}deg)"><span class="block w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[18px] border-b-[#11975a] drop-shadow-[0_0_5px_#11975a]"></span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    if (!markerRef.current) markerRef.current = L.marker([gps.lat, gps.lon], { icon }).addTo(mapRef.current);
    markerRef.current.setLatLng([gps.lat, gps.lon]).setIcon(icon);
    mapRef.current.panTo([gps.lat, gps.lon], { animate: true, duration: 0.5 });
  }, [gps.lat, gps.lon, gps.heading]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden [&_.leaflet-container]:bg-[#d9e7eb] [&_.leaflet-container]:font-mono [&_.leaflet-control-zoom_a]:!text-[#24434f] [&_.leaflet-control-zoom_a]:!bg-[#f7fbfc] [&_.leaflet-control-zoom_a]:!border-[#bfd0d7]">
      <div ref={nodeRef} className="absolute inset-0" />
      <div className="absolute z-[500] left-[8px] bottom-[8px] flex flex-col gap-[3px] p-[6px_8px] bg-[rgba(248,252,253,.88)] border-l-[2px] border-[#11975a] text-[#183640] font-mono font-[700] text-[8px] leading-[1]">
        <span>{gps.lat.toFixed(5)}° N</span>
        <span>{Math.abs(gps.lon).toFixed(5)}° W</span>
      </div>
      <div className="absolute z-[500] right-[8px] top-[8px] p-[6px_8px] bg-[rgba(248,252,253,.88)] text-[#183640] font-mono font-[800] text-[9px] leading-[1]">
        <span className="text-[#607b86] text-[7px] mr-[4px]">HDG</span> {Math.round(gps.heading).toString().padStart(3, "0")}°
      </div>
    </div>
  );
}
