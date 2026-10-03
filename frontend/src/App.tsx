import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import useWebSocketExport from "react-use-websocket";
import "leaflet/dist/leaflet.css";

// Vite 8 currently double-wraps this CommonJS package's default export in
// development, while production receives the function directly.
const useWebSocket = typeof useWebSocketExport === "function"
  ? useWebSocketExport
  : (useWebSocketExport as unknown as { default: typeof useWebSocketExport }).default;

type Motor = {
  name: string;
  current_a: number;
  temp_c: number;
};

type Telemetry = {
  radio: { tx_active: boolean; rx_ping_ms: number; link_quality?: number; port?: string };
  battery: { voltage: number };
  rover_state: { active_flag: string; mission_time?: string };
  gps: { lat: number; lon: number; heading: number };
  velocity: { speed_mps: number; direction_deg: number };
  imu: { pitch: number; roll: number; yaw: number };
  joy: { axis_x: number; axis_y: number; deadband?: number };
  motors: Motor[];
  camera: { primary_url?: string; secondary_url?: string };
};

function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    signal: <><path d="M4 18.5a2 2 0 1 0 0 .01" /><path d="M2.2 13.1a8 8 0 0 1 11.3 0M-1.3 9.6a13 13 0 0 1 18.4 0" /></>,
    battery: <><rect x="1.5" y="5" width="17" height="12" rx="2" /><path d="M21 9v4M5 9h7v4H5z" /></>,
    camera: <><rect x="2" y="5" width="16" height="13" rx="2" /><path d="m18 9 4-2v9l-4-2M7 5l1.3-2h3.4L13 5" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15 8-2 5-5 2 2-5z" /></>,
    crosshair: <><circle cx="12" cy="12" r="8" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></>,
    swap: <><path d="M7 7h12l-3-3m3 3-3 3M17 17H5l3 3m-3-3 3-3" /></>,
    alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v5m0 3v.1" /></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Panel({
  title,
  icon,
  meta,
  children,
  className = "",
}: {
  title: string;
  icon?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      <header className="panel-header">
        <div className="flex items-center gap-2">
          {icon && <Icon name={icon} className="h-3.5 w-3.5 text-[#99a2a7]" />}
          <h2>{title}</h2>
        </div>
        {meta && <div className="panel-meta">{meta}</div>}
      </header>
      {children}
    </section>
  );
}

function MapWidget({ gps }: { gps: Telemetry["gps"] }) {
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

function Horizon({ imu }: { imu: Telemetry["imu"] }) {
  const hazardous = Math.abs(imu.roll) >= 25 || Math.abs(imu.pitch) >= 25;
  return (
    <div className={`horizon-wrap ${hazardous ? "is-hazard" : ""}`}>
      <div className="horizon" style={{ transform: `rotate(${-imu.roll}deg) translateY(${imu.pitch * 1.3}px)` }}>
        <div className="sky" />
        <div className="ground" />
        <div className="pitch-lines">
          {[20, 10, 0, -10, -20].map((degree) => <span key={degree} style={{ top: `${50 - degree * 1.5}%` }}>{degree !== 0 && Math.abs(degree)}</span>)}
        </div>
      </div>
      <div className="aircraft-mark"><i /><b /><i /></div>
      <div className="horizon-values">
        <div><span>PITCH</span><strong>{imu.pitch.toFixed(1)}°</strong></div>
        <div><span>ROLL</span><strong>{imu.roll.toFixed(1)}°</strong></div>
        <div><span>YAW</span><strong>{Math.round(imu.yaw)}°</strong></div>
      </div>
      {hazardous && <div className="hazard-label"><Icon name="alert" /> ROLLOVER RISK</div>}
    </div>
  );
}

function CameraView({ url, label, secondary = false }: { url?: string; label: string; secondary?: boolean }) {
  return (
    <div className={`camera-view ${secondary ? "secondary" : ""}`}>
      {url ? (
        <img src={url} alt={`${label} live stream`} />
      ) : (
        <div className="camera-fallback">
          <div className="reticle"><span /><span /><span /><span /></div>
          <div className="terrain-line" />
          <Icon name="camera" className="h-6 w-6" />
          <strong>AWAITING VIDEO</strong>
          <small>STREAM CHANNEL READY</small>
        </div>
      )}
      <div className="feed-label"><span className="live-dot" />{label}</div>
      <div className="feed-time">{new Date().toISOString().slice(11, 19)} UTC</div>
    </div>
  );
}

export default function App() {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [swapped, setSwapped] = useState(false);
  const [lastPacket, setLastPacket] = useState<number | null>(null);
  const [triggeredTest, setTriggeredTest] = useState<number | null>(null);

  const { lastJsonMessage, readyState, sendJsonMessage } = useWebSocket("ws://localhost:8765", {
    shouldReconnect: () => true,
    reconnectAttempts: Infinity,
    reconnectInterval: 2000,
    share: true,
  });

  useEffect(() => {
    if (!lastJsonMessage || typeof lastJsonMessage !== "object") return;
    const incoming = lastJsonMessage as Partial<Telemetry>;
    setTelemetry((current) => {
      const base: Telemetry = current || {
        radio: { tx_active: false, rx_ping_ms: 0 },
        battery: { voltage: 0 },
        rover_state: { active_flag: "STANDBY" },
        gps: { lat: 0, lon: 0, heading: 0 },
        velocity: { speed_mps: 0, direction_deg: 0 },
        imu: { pitch: 0, roll: 0, yaw: 0 },
        joy: { axis_x: 0, axis_y: 0, deadband: 0.08 },
        motors: [],
        camera: {},
      };
      
      return {
        ...base,
        ...incoming,
        radio: { ...base.radio, ...incoming.radio },
        battery: { ...base.battery, ...incoming.battery },
        rover_state: { ...base.rover_state, ...incoming.rover_state },
        gps: { ...base.gps, ...incoming.gps },
        velocity: { ...base.velocity, ...incoming.velocity },
        imu: { ...base.imu, ...incoming.imu },
        joy: { ...base.joy, ...incoming.joy },
        camera: { ...base.camera, ...incoming.camera },
        motors: Array.isArray(incoming.motors) ? incoming.motors : base.motors,
      };
    });
    setLastPacket(Date.now());
  }, [lastJsonMessage]);

  const connected = readyState === 1;
  const battery = telemetry?.battery?.voltage ?? 0;
  const batteryColor = battery > 24 ? "#5bff94" : battery > 22 ? "#ffd45a" : "#ff4d55";
  const batteryPercent = Math.max(0, Math.min(100, ((battery - 18) / 8) * 100));
  const pingCritical = (telemetry?.radio?.rx_ping_ms ?? 0) > 500;
  const deadband = telemetry?.joy?.deadband ?? 0.08;
  const inDeadband = Math.abs(telemetry?.joy?.axis_x ?? 0) < deadband && Math.abs(telemetry?.joy?.axis_y ?? 0) < deadband;
  const mode = String(telemetry?.rover_state?.active_flag || "—").replace(/_/g, " ");
  const velocityDirection = telemetry?.velocity?.direction_deg ?? telemetry?.gps?.heading ?? 0;
  const velocitySpeed = telemetry?.velocity?.speed_mps ?? 0;
  const cardinalDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const velocityCardinal = cardinalDirections[Math.round(((velocityDirection % 360) + 360) % 360 / 45) % 8];
  const streams = useMemo(() => swapped
    ? { main: telemetry?.camera?.secondary_url, pip: telemetry?.camera?.primary_url, mainLabel: "AUX / REAR", pipLabel: "DRIVE CAM 01" }
    : { main: telemetry?.camera?.primary_url, pip: telemetry?.camera?.secondary_url, mainLabel: "DRIVE CAM 01", pipLabel: "AUX / REAR" },
  [swapped, telemetry?.camera]);

  const triggerTest = (id: number) => {
    sendJsonMessage({ action: "TRIGGER_TEST", test_id: id });
    setTriggeredTest(id);
    window.setTimeout(() => setTriggeredTest((current) => current === id ? null : current), 1600);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark"><span>R</span></div>
          <div><h1>ROVER CONTROL</h1><p>GROUND STATION <b>/</b> ALPHA-01</p></div>
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

      <div className="dashboard-grid relative">
        {!telemetry ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 rounded-xl" style={{ backgroundColor: 'rgba(10, 14, 20, 0.85)', backdropFilter: 'blur(8px)' }}>
            <Icon name="alert" className="h-16 w-16 text-[#4a555e] mb-4" />
            <h2 className="text-2xl font-bold text-[#8a98a1] mb-2 tracking-widest">NO TELEMETRY DATA</h2>
            <p className="text-[#647179] font-mono">Awaiting first packet from backend on ws://localhost:8765...</p>
          </div>
        ) : (
          <>
            <aside className="left-column">
              <Panel title="POSITION / GPS" icon="compass" meta={<span className="signal-text"><Icon name="signal" /> RTK FIX</span>} className="map-panel">
                <MapWidget gps={telemetry.gps} />
              </Panel>
              <Panel title="ATTITUDE / IMU" meta="6-AXIS" className="horizon-panel">
                <Horizon imu={telemetry.imu} />
              </Panel>
              <Panel title="MOTOR DIAGNOSTICS" meta="6 CHANNELS" className="motor-panel">
                <div className="motor-head"><span>MOTOR</span><span>CURRENT</span><span>TEMP</span></div>
                <div className="motor-list">
                  {telemetry.motors.length === 0 && <div className="p-4 text-center text-[#647179] text-sm">NO MOTORS REPORTING</div>}
                  {telemetry.motors.slice(0, 6).map((motor) => {
                    const hot = motor.temp_c >= 70;
                    return <div className="motor-row" key={motor.name}><span><i className={hot ? "hot" : ""} />{motor.name}</span><strong>{motor.current_a.toFixed(1)} <small>A</small></strong><strong className={hot ? "hot-text" : ""}>{motor.temp_c.toFixed(0)}°<small>C</small></strong></div>;
                  })}
                </div>
              </Panel>
            </aside>

            <section className="center-column">
              <Panel title="VISUAL FEED" icon="camera" meta={<><span className="record-dot" /> LIVE · 1080P</>} className="camera-panel">
                <div className="camera-stage">
                  <CameraView url={streams.main} label={streams.mainLabel} />
                  <div className="pip-wrap"><CameraView url={streams.pip} label={streams.pipLabel} secondary /></div>
                  <button className="swap-button" onClick={() => setSwapped((value) => !value)}><Icon name="swap" /> SWAP FEEDS</button>
                  <div className="camera-footer"><span>LINK <b>{connected ? "STABLE" : "OFFLINE"}</b></span><span>30 FPS</span><span>H.264</span><span>12.4 Mbps</span></div>
                </div>
              </Panel>
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
            </section>

            <aside className="right-column">
              <Panel title="JOYSTICK INPUT" icon="crosshair" meta="10–20 HZ" className="joystick-panel">
                <div className="joystick-body">
                  <div className="joystick-axis y-axis"><span>+Y</span><span>−Y</span></div>
                  <div className="joystick-pad">
                    <div className="deadband-ring" style={{ width: `${deadband * 100}%`, height: `${deadband * 100}%` }} />
                    <div className="joy-dot" style={{
                      left: `${50 + Math.max(-1, Math.min(1, telemetry.joy.axis_x)) * 43}%`,
                      top: `${50 - Math.max(-1, Math.min(1, telemetry.joy.axis_y)) * 43}%`,
                    }} />
                  </div>
                  <div className="joystick-axis x-axis"><span>−X</span><span>+X</span></div>
                  <div className="axis-values">
                    <div><span>AXIS X</span><strong>{telemetry.joy.axis_x.toFixed(3)}</strong></div>
                    <div><span>AXIS Y</span><strong>{telemetry.joy.axis_y.toFixed(3)}</strong></div>
                  </div>
                  <div className={`deadband-status ${inDeadband ? "active" : ""}`}><i /> DEADBAND {Math.round(deadband * 100)}% <strong>{inDeadband ? "ACTIVE" : "CLEAR"}</strong></div>
                </div>
              </Panel>
              <Panel title="HARDWARE TESTS" meta="MANUAL OVERRIDE" className="tests-panel">
                <div className="safety-note"><Icon name="alert" /><p><strong>SAFETY INTERLOCK</strong>Tests lock out joystick input until complete.</p></div>
                <div className="test-grid">
                  {[
                    [1, "WHEEL", "SWEEP"],
                    [2, "STEERING", "CAL"],
                    [3, "ARM", "TEST"],
                    [4, "BRAKE", "CHECK"],
                    [5, "LIGHTS", "CYCLE"],
                    [6, "RADIO", "PING"],
                  ].map(([id, line1, line2]) => (
                    <button key={id} onClick={() => triggerTest(id as number)} disabled={!connected} className={triggeredTest === id ? "triggered" : ""}>
                      <span>0{id}</span><strong>{line1 as string}<br />{line2 as string}</strong><i />
                    </button>
                  ))}
                </div>
                <div className="command-status"><span>COMMAND CHANNEL</span><strong className={connected ? "online" : ""}><i />{connected ? "ARMED" : "DISABLED"}</strong></div>
              </Panel>
            </aside>
          </>
        )}
      </div>
      <footer className="footer-bar">
        <span><i className={connected ? "online" : ""} /> BACKEND {connected ? "ONLINE" : "OFFLINE"}</span>
        <span>WS://LOCALHOST:8765</span>
        <span>BUILD GS-2.4.1</span>
        <span className="footer-clock">{new Date().toLocaleDateString("en-CA")} / {new Date().toISOString().slice(11, 19)} UTC</span>
      </footer>
    </main>
  );
}
