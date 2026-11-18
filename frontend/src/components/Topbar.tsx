import Icon from './Icon';
import { Telemetry } from '../types';

export default function Topbar({ 
  telemetry, 
  connected, 
  lastPacket,
  setPort,
  setBaud,
}: { 
  telemetry: Telemetry | null; 
  connected: boolean; 
  lastPacket: number | null;
  setPort?: (port: string) => void;
  setBaud?: (baud: number) => void;
}) {
  const battery = telemetry?.battery?.voltage ?? 0;
  const batteryColor = battery > 24 ? "#11975a" : battery > 22 ? "#ffd45a" : "#dc3340";
  const batteryPercent = Math.max(0, Math.min(100, ((battery - 18) / 8) * 100));
  const isPingNull = telemetry?.radio?.rx_ping_ms === null || telemetry?.radio?.rx_ping_ms === undefined;
  const pingCritical = isPingNull || (telemetry?.radio?.rx_ping_ms ?? 0) > 500;
  const mode = String(telemetry?.rover_state?.active_flag || "—").replace(/_/g, " ");

  const activePort = telemetry?.radio?.port || "";
  const activeBaud = telemetry?.radio?.baud || 115200;
  const availablePorts = telemetry?.radio?.available_ports && telemetry.radio.available_ports.length > 0
    ? telemetry.radio.available_ports
    : (activePort ? [activePort] : []);
  const availableBauds = telemetry?.radio?.available_bauds || [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  return (
    <header className="grid grid-cols-[1.3fr_.75fr_1.25fr_.75fr_.85fr_1.2fr] min-w-0 border border-[#c5d5dc] border-b-[2px] border-b-[#8ba5af] bg-[rgba(250,253,254,.98)] shadow-[0_3px_12px_rgba(31,70,84,.08)]">
      <div className="flex items-center gap-[12px] px-[16px] min-w-0 border-r border-[#c5d5dc]">
        <img src="/logo.png" alt="ROVER71" className="w-[40px] h-auto" />
        <div>
          <h1 className="m-0 font-mono font-[800] text-[16px] leading-[1.15] tracking-[.12em] text-[#102b35]">AAUB ROVER71</h1>
          <p className="m-[5px_0_0] font-mono font-[600] text-[9px] leading-[1] tracking-[.13em] text-[#69828c]">
            GROUND STATION <b className="text-[#3b606f]"></b>
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-[13px] min-w-0 border-r border-[#c5d5dc]">
        <span className="font-mono font-[700] text-[8px] leading-[1.1] tracking-[.12em] text-[#69828c]">WEBSOCKET</span>
        <strong className={`mt-[6px] font-mono font-[800] text-[11px] leading-[1] tracking-[.06em] whitespace-nowrap ${connected ? "text-[#11975a]" : "text-[#dc3340]"}`}>
          <i className={`inline-block w-[7px] h-[7px] mr-[7px] rounded-full ${connected ? "bg-[#11975a] shadow-[0_0_9px_#11975a]" : "bg-[#dc3340] shadow-[0_0_9px_#dc3340]"}`} />
          {connected ? "CONNECTED" : "RECONNECTING"}
        </strong>
        <small className="mt-[6px] font-mono font-[600] text-[7px] leading-[1] tracking-[.09em] text-[#69828c]">
          {lastPacket ? `PKT ${Math.max(0, Math.round((Date.now() - lastPacket) / 1000))}s` : "NO DATA"}
        </small>
      </div>
      <div className="flex flex-col justify-center px-[10px] min-w-0 border-r border-[#c5d5dc]">
        <div className="flex items-center justify-between gap-[4px]">
          <span className="font-mono font-[700] text-[8px] leading-[1.1] tracking-[.12em] text-[#69828c]">
            XBEE RADIO LINK
          </span>
          <div className="flex items-center gap-[4px]">
            {/* Serial Port Dropdown */}
            <select 
              className="bg-[#edf4f6] text-[7.5px] font-mono font-bold text-[#102b35] border border-[#c5d5dc] rounded px-[3px] py-[1px] outline-none cursor-pointer max-w-[95px] truncate hover:border-[#8ba5af]"
              value={activePort} 
              onChange={(e) => setPort?.(e.target.value)}
              title="Select Serial / Radio Port"
            >
              <option value="" disabled>PORT</option>
              {availablePorts.map(p => (
                <option key={p} value={p}>
                  {p.replace('/dev/', '').replace('/tmp/', '')}
                </option>
              ))}
              {!availablePorts.includes(activePort) && activePort && (
                <option value={activePort}>{activePort.replace('/dev/', '').replace('/tmp/', '')}</option>
              )}
            </select>

            {/* Baud Rate Dropdown */}
            <select
              className="bg-[#edf4f6] text-[7.5px] font-mono font-bold text-[#102b35] border border-[#c5d5dc] rounded px-[3px] py-[1px] outline-none cursor-pointer hover:border-[#8ba5af]"
              value={activeBaud}
              onChange={(e) => setBaud?.(Number(e.target.value))}
              title="Select Baud Rate"
            >
              {availableBauds.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <strong className={`mt-[4px] font-mono font-[800] text-[11px] leading-[1] tracking-[.06em] whitespace-nowrap ${telemetry?.radio?.tx_active ? "text-[#11975a]" : "text-[#dc3340]"}`}>
          <i className={`inline-block w-[7px] h-[7px] mr-[7px] rounded-full ${telemetry?.radio?.tx_active ? "bg-[#11975a] shadow-[0_0_9px_#11975a]" : "bg-[#dc3340] shadow-[0_0_9px_#dc3340]"}`} />
          {telemetry?.radio?.tx_active ? "ACTIVE" : (!telemetry ? "—" : "OFFLINE")}
        </strong>
        <small className="mt-[4px] font-mono font-[600] text-[7px] leading-[1] tracking-[.09em] text-[#69828c] truncate">
          {activePort ? `${activePort} @ ${activeBaud}` : "NO PORT SELECTED"}
        </small>
      </div>
      <div className={`flex flex-col justify-center px-[13px] min-w-0 border-r border-[#c5d5dc] ${pingCritical ? "animate-[alert-pulse_.7s_infinite_alternate]" : ""}`}>
        <span className="font-mono font-[700] text-[8px] leading-[1.1] tracking-[.12em] text-[#69828c]">XBee RX LATENCY</span>
        <strong className={`mt-[6px] font-mono font-[800] text-[11px] leading-[1] tracking-[.06em] whitespace-nowrap ${pingCritical ? "text-[#dc3340]" : "text-[#11975a]"}`}>
          {isPingNull ? "ERR" : telemetry?.radio?.rx_ping_ms} <em className="not-italic text-[9px] text-[#78909a]">ms</em>
        </strong>
        <small className="mt-[6px] font-mono font-[600] text-[7px] leading-[1] tracking-[.09em] text-[#69828c]">WATCHDOG 500ms</small>
        <style>{`@keyframes alert-pulse { to { background: rgba(220,51,64,.2); } }`}</style>
      </div>
      <div className="relative grid grid-cols-[1fr_auto] items-center gap-[5px_12px] px-[14px] py-[9px] min-w-0 border-r border-[#c5d5dc]">
        <div>
          <span className="font-mono font-[700] text-[8px] leading-[1.1] tracking-[.12em] text-[#69828c]">MAIN BATTERY</span>
          <strong className="block mt-[5px] font-mono font-[900] text-[17px] leading-[1]" style={{ color: batteryColor }}>
            {telemetry ? battery.toFixed(1) : "—"} <em className="not-italic text-[9px] text-[#78909a]">V</em>
          </strong>
        </div>
        <Icon name="battery" className="text-[#8a9498] h-4 w-4" />
        <div className="col-span-full h-[4px] bg-[#d7e3e8] overflow-hidden">
          <span className="block h-full transition-[width] duration-300" style={{ width: `${batteryPercent}%`, background: batteryColor, boxShadow: `0 0 10px ${batteryColor}` }} />
        </div>
      </div>
      <div className="flex flex-col justify-center px-[18px] min-w-0 bg-[linear-gradient(90deg,rgba(83,139,158,.08),transparent)]">
        <span className="font-mono font-[700] text-[8px] leading-[1] tracking-[.13em] text-[#69828c]">OPERATIONAL MODE</span>
        <strong className="mt-[8px] font-mono font-[900] text-[13px] leading-[1] tracking-[.05em] text-[#102b35]">{mode}</strong>
      </div>
    </header>
  );
}
