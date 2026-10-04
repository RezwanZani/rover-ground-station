import Icon from './Icon';
import { Telemetry } from '../types';

export default function Topbar({ 
  telemetry, 
  connected, 
  lastPacket,
  setPort
}: { 
  telemetry: Telemetry | null; 
  connected: boolean; 
  lastPacket: number | null;
  setPort?: (port: string) => void;
}) {
  const battery = telemetry?.battery?.voltage ?? 0;
  const batteryColor = battery > 24 ? "#11975a" : battery > 22 ? "#ffd45a" : "#dc3340";
  const batteryPercent = Math.max(0, Math.min(100, ((battery - 18) / 8) * 100));
  const pingCritical = (telemetry?.radio?.rx_ping_ms ?? 0) > 500;
  const mode = String(telemetry?.rover_state?.active_flag || "—").replace(/_/g, " ");

  return (
    <header className="grid grid-cols-[1.45fr_.8fr_.8fr_.78fr_1fr_1.45fr] min-w-0 border border-[#c5d5dc] border-b-[2px] border-b-[#8ba5af] bg-[rgba(250,253,254,.98)] shadow-[0_3px_12px_rgba(31,70,84,.08)]">
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
      <div className="flex flex-col justify-center px-[13px] min-w-0 border-r border-[#c5d5dc]">
        <span className="font-mono font-[700] text-[8px] leading-[1.1] tracking-[.12em] text-[#69828c]">
          XBee TX 
          {telemetry?.radio?.available_ports && telemetry.radio.available_ports.length > 0 ? (
            <select 
              className="ml-[4px] bg-transparent outline-none cursor-pointer text-[#3b606f] font-bold hover:text-[#102b35] transition-colors"
              value={telemetry?.radio?.port || ""} 
              onChange={(e) => setPort?.(e.target.value)}
            >
              <option value="" disabled>SELECT PORT</option>
              {telemetry.radio.available_ports.map(p => <option key={p} value={p}>[{p}]</option>)}
              {!telemetry.radio.available_ports.includes(telemetry.radio.port || "") && telemetry.radio.port && (
                <option value={telemetry.radio.port}>[{telemetry.radio.port}]</option>
              )}
            </select>
          ) : (
            telemetry?.radio?.port ? ` [${telemetry.radio.port}]` : ""
          )}
        </span>
        <strong className={`mt-[6px] font-mono font-[800] text-[11px] leading-[1] tracking-[.06em] whitespace-nowrap ${telemetry?.radio?.tx_active ? "text-[#11975a]" : "text-[#dc3340]"}`}>
          <i className={`inline-block w-[7px] h-[7px] mr-[7px] rounded-full ${telemetry?.radio?.tx_active ? "bg-[#11975a] shadow-[0_0_9px_#11975a]" : "bg-[#dc3340] shadow-[0_0_9px_#dc3340]"}`} />
          {telemetry?.radio?.tx_active ? "ACTIVE" : (!telemetry ? "—" : "PORT OFFLINE")}
        </strong>
        <small className="mt-[6px] font-mono font-[600] text-[7px] leading-[1] tracking-[.09em] text-[#69828c]">900 MHz UPLINK</small>
      </div>
      <div className={`flex flex-col justify-center px-[13px] min-w-0 border-r border-[#c5d5dc] ${pingCritical ? "animate-[alert-pulse_.7s_infinite_alternate]" : ""}`}>
        <span className="font-mono font-[700] text-[8px] leading-[1.1] tracking-[.12em] text-[#69828c]">XBee RX LATENCY</span>
        <strong className={`mt-[6px] font-mono font-[800] text-[11px] leading-[1] tracking-[.06em] whitespace-nowrap ${pingCritical ? "text-[#dc3340]" : (telemetry?.radio?.rx_ping_ms !== undefined ? "text-[#11975a]" : "")}`}>
          {telemetry?.radio?.rx_ping_ms ?? "—"} <em className="not-italic text-[9px] text-[#78909a]">ms</em>
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
