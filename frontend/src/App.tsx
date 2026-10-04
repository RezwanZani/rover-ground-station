import { useEffect, useMemo, useState } from "react";
import useWebSocketExport from "react-use-websocket";
import "leaflet/dist/leaflet.css";
import { Telemetry } from "./types";
import Icon from "./components/Icon";
import Panel from "./components/Panel";
import MapWidget from "./components/MapWidget";
import Horizon from "./components/Horizon";
import Topbar from "./components/Topbar";
import MotorDiagnostics from "./components/MotorDiagnostics";
import VisualFeed from "./components/VisualFeed";
import CenterReadouts from "./components/CenterReadouts";
import JoystickInput from "./components/JoystickInput";
import HardwareTests from "./components/HardwareTests";
import FooterBar from "./components/FooterBar";

// Vite 8 currently double-wraps this CommonJS package's default export in
// development, while production receives the function directly.
const useWebSocket = typeof useWebSocketExport === "function"
  ? useWebSocketExport
  : (useWebSocketExport as unknown as { default: typeof useWebSocketExport }).default;

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
      <Topbar telemetry={telemetry} connected={connected} lastPacket={lastPacket} />

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
                <MotorDiagnostics motors={telemetry.motors} />
              </Panel>
            </aside>

            <section className="center-column">
              <Panel title="VISUAL FEED" icon="camera" meta={<><span className="record-dot" /> LIVE · 1080P</>} className="camera-panel">
                <VisualFeed streams={streams} swapped={swapped} setSwapped={setSwapped} connected={connected} />
              </Panel>
              <CenterReadouts telemetry={telemetry} connected={connected} />
            </section>

            <aside className="right-column">
              <Panel title="JOYSTICK INPUT" icon="crosshair" meta={<><span className={telemetry.joy.connected ? "green" : "red"}>{telemetry.joy.connected ? "CONNECTED" : "DISCONNECTED"}</span><span style={{ marginLeft: "8px", color: "#586267" }}>{telemetry.joy.connected ? (telemetry.joy.name || "UNKNOWN DEVICE") : "WASD FALLBACK"}</span></>} className="joystick-panel">
                <JoystickInput joy={telemetry.joy} />
              </Panel>
              <Panel title="HARDWARE TESTS" meta="MANUAL OVERRIDE" className="tests-panel">
                <HardwareTests connected={connected} triggeredTest={triggeredTest} triggerTest={triggerTest} />
              </Panel>
            </aside>
          </>
        )}
      </div>
      <FooterBar connected={connected} />
    </main>
  );
}
