import { Telemetry } from '../types';

export default function CenterReadouts({ telemetry, connected }: { telemetry: Telemetry; connected: boolean }) {
  const velocityDirection = telemetry?.velocity?.direction_deg ?? telemetry?.gps?.heading ?? 0;
  const velocitySpeed = telemetry?.velocity?.speed_mps ?? 0;
  const cardinalDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const velocityCardinal = cardinalDirections[Math.round(((velocityDirection % 360) + 360) % 360 / 45) % 8];

  return (
    <div className="center-readouts">
      <div className="velocity-readout">
        <span>VELOCITY</span>
        <div className="velocity-value">
          <i style={{ transform: `rotate(${velocityDirection}deg)` }}>↑</i>
          <strong>{velocitySpeed.toFixed(1)}</strong>
          <small>m/s</small>
        </div>
        <b>{velocityCardinal} · {Math.round(velocityDirection).toString().padStart(3, "0")}°</b>
      </div>
      <div><span>HEADING</span><strong>{Math.round(telemetry.gps.heading).toString().padStart(3, "0")}</strong><small>deg</small></div>
      <div><span>LINK QUALITY</span><strong className={connected ? "green" : "red"}>{connected ? (telemetry.radio.link_quality ?? Math.max(0, 100 - telemetry.radio.rx_ping_ms / 10).toFixed(0)) : "00"}</strong><small>%</small></div>
      <div><span>MISSION TIME</span><strong>{telemetry.rover_state.mission_time || "—:—:—"}</strong><small>UTC</small></div>
    </div>
  );
}
