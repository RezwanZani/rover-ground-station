import Icon from './Icon';
import { Telemetry } from '../types';

export default function Topbar({ 
  telemetry, 
  connected, 
  lastPacket 
}: { 
  telemetry: Telemetry | null; 
  connected: boolean; 
  lastPacket: number | null 
}) {
  const battery = telemetry?.battery?.voltage ?? 0;
  const batteryColor = battery > 24 ? "#5bff94" : battery > 22 ? "#ffd45a" : "#ff4d55";
  const batteryPercent = Math.max(0, Math.min(100, ((battery - 18) / 8) * 100));
  const pingCritical = (telemetry?.radio?.rx_ping_ms ?? 0) > 500;
  const mode = String(telemetry?.rover_state?.active_flag || "—").replace(/_/g, " ");

  return (
    <header className="topbar">
      <div className="brand-block">
        <img src="/logo.png" alt="ROVER71" className="logo" />
        <div><h1>AAUB ROVER71</h1><p>GROUND STATION</p></div>
      </div>
      <div className="status-block">
        <span className="status-label">WEBSOCKET</span>
        <strong className={connected ? "ok" : "bad"}><i />{connected ? "CONNECTED" : "RECONNECTING"}</strong>
        <small>{lastPacket ? `PKT ${Math.max(0, Math.round((Date.now() - lastPacket) / 1000))}s` : "NO DATA"}</small>
      </div>
      <div className="status-block">
        <span className="status-label">XBee TX {telemetry?.radio?.tx_active && telemetry?.radio?.port ? `[${telemetry.radio.port}]` : ""}</span>
        <strong className={telemetry?.radio?.tx_active ? "ok" : (!telemetry ? "unknown" : "bad")}><i />{telemetry?.radio?.tx_active ? "ACTIVE" : (!telemetry ? "—" : "PORT OFFLINE")}</strong>
        <small>900 MHz UPLINK</small>
      </div>
      <div className={`status-block ${pingCritical ? "ping-critical" : ""}`}>
        <span className="status-label">XBee RX LATENCY</span>
        <strong className={pingCritical ? "bad" : (telemetry?.radio?.rx_ping_ms ? "ok" : "")}>{telemetry?.radio?.rx_ping_ms || "—"} <em>ms</em></strong>
        <small>WATCHDOG 500ms</small>
      </div>
      <div className="battery-block">
        <div><span className="status-label">MAIN BATTERY</span><strong style={{ color: batteryColor }}>{telemetry ? battery.toFixed(1) : "—"} <em>V</em></strong></div>
        <Icon name="battery" />
        <div className="battery-track"><span style={{ width: `${batteryPercent}%`, background: batteryColor, boxShadow: `0 0 10px ${batteryColor}` }} /></div>
      </div>
      <div className="mode-block">
        <span>OPERATIONAL MODE</span>
        <strong>{mode}</strong>
      </div>
    </header>
  );
}
