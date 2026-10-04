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
    <main className="grid grid-rows-[74px_minmax(0,1fr)_28px] max-h-[720px]:grid-rows-[66px_minmax(0,1fr)_24px] h-screen p-[8px_10px_0] overflow-hidden bg-[linear-gradient(rgba(78,116,130,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(78,116,130,.045)_1px,transparent_1px),#eaf2f5] bg-[length:28px_28px] text-[#17313b]">
      <Topbar telemetry={telemetry} connected={connected} lastPacket={lastPacket} setPort={(port) => sendJsonMessage({ action: "SET_PORT", port })} />

      <div className="min-h-0 grid grid-cols-[minmax(270px,22%)_minmax(500px,1fr)_minmax(285px,23%)] gap-[8px] py-[8px] relative">
        {!telemetry ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 rounded-xl" style={{ backgroundColor: 'rgba(234,242,245,0.85)', backdropFilter: 'blur(8px)' }}>
            <Icon name="alert" className="h-16 w-16 text-[#69828c] mb-4" />
            <h2 className="text-2xl font-bold text-[#102b35] mb-2 tracking-widest">NO TELEMETRY DATA</h2>
            <p className="text-[#69828c] font-mono">Awaiting first packet from backend on ws://localhost:8765...</p>
          </div>
        ) : (
          <>
            <aside className="grid gap-[8px] min-w-0 min-h-0 grid-rows-[1.15fr_.9fr_1.15fr]">
              <Panel title="POSITION / GPS" icon="compass" meta={<span className="flex items-center gap-[4px] text-[#11975a]"><Icon name="signal" className="w-[11px] h-[11px]" /> RTK FIX</span>} className="[&_.panel-header]:!bg-[#eff6f8]">
                <MapWidget gps={telemetry.gps} />
              </Panel>
              <Panel title="ATTITUDE / IMU" meta="6-AXIS">
                <Horizon imu={telemetry.imu} />
              </Panel>
              <Panel title="MOTOR DIAGNOSTICS" meta="6 CHANNELS">
                <MotorDiagnostics motors={telemetry.motors} />
              </Panel>
            </aside>

            <section className="grid gap-[8px] min-w-0 min-h-0 grid-rows-[minmax(0,1fr)_72px] max-h-[720px]:grid-rows-[minmax(0,1fr)_62px]">
              <Panel title="VISUAL FEED" icon="camera" meta={<><span className="inline-block w-[6px] h-[6px] rounded-full bg-[#dc3340] shadow-[0_0_6px_#dc3340]" /> LIVE · 1080P</>}>
                <VisualFeed streams={streams} swapped={swapped} setSwapped={setSwapped} connected={connected} />
              </Panel>
              <CenterReadouts telemetry={telemetry} connected={connected} />
            </section>

            <aside className="grid gap-[8px] min-w-0 min-h-0 grid-rows-[1.05fr_.95fr]">
              <Panel title="JOYSTICK INPUT" icon="crosshair" meta={<><span className={telemetry.joy.connected ? "text-[#11975a]" : "text-[#dc3340]"}>{telemetry.joy.connected ? "CONNECTED" : "DISCONNECTED"}</span><span style={{ marginLeft: "8px", color: "#69828c" }}>{telemetry.joy.connected ? (telemetry.joy.name || "UNKNOWN DEVICE") : "WASD FALLBACK"}</span></>}>
                <JoystickInput joy={telemetry.joy} />
              </Panel>
              <Panel title="HARDWARE TESTS" meta="MANUAL OVERRIDE">
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
