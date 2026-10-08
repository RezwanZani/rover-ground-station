import { Telemetry } from '../types';

export default function CenterReadouts({ telemetry, connected }: { telemetry: Telemetry; connected: boolean }) {
  const velocityDirection = telemetry?.velocity?.direction_deg ?? telemetry?.gps?.heading ?? 0;
  const velocitySpeed = telemetry?.velocity?.speed_mps ?? 0;
  const cardinalDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const velocityCardinal = cardinalDirections[Math.round(((velocityDirection % 360) + 360) % 360 / 45) % 8];

  return (
    <div className="border border-[#c5d5dc] bg-[rgba(250,253,254,.98)] grid grid-cols-4">
      <div className="relative p-[12px_15px] border-r border-[#c5d5dc] bg-[#f8fbfc]">
        <span className="block text-[#69828c] font-mono font-[700] text-[7px] tracking-[.1em]">VELOCITY</span>
        <div className="flex items-baseline gap-[5px] mt-[8px]">
          <i className="inline-grid place-items-center w-[20px] h-[20px] text-[#167f9e] bg-[#dceff4] rounded-full font-mono font-[900] text-[14px] leading-[1] origin-center" style={{ transform: `rotate(${velocityDirection}deg)` }}>↑</i>
          <strong className="inline-block font-mono font-[800] text-[17px] leading-[1] text-[#17313b]">{velocitySpeed.toFixed(1)}</strong>
          <small className="ml-[6px] text-[#718a94] font-mono font-[700] text-[7px]">m/s</small>
        </div>
        <b className="absolute right-[12px] bottom-[10px] text-[#3e7183] font-mono font-[800] text-[7px] leading-[1] tracking-[.08em]">{velocityCardinal} · {Math.round(velocityDirection).toString().padStart(3, "0")}°</b>
      </div>
      <div className="p-[12px_15px] border-r border-[#c5d5dc] bg-[#f8fbfc]">
        <span className="block text-[#69828c] font-mono font-[700] text-[7px] tracking-[.1em]">HEADING</span>
        <strong className="inline-block mt-[8px] font-mono font-[800] text-[17px] leading-[1] text-[#17313b]">{Math.round(telemetry.gps.heading).toString().padStart(3, "0")}</strong>
        <small className="ml-[6px] text-[#718a94] font-mono font-[700] text-[7px]">deg</small>
      </div>
      <div className="p-[12px_15px] border-r border-[#c5d5dc] bg-[#f8fbfc]">
        <span className="block text-[#69828c] font-mono font-[700] text-[7px] tracking-[.1em]">LINK QUALITY</span>
        <strong className={`inline-block mt-[8px] font-mono font-[800] text-[17px] leading-[1] ${connected && telemetry.radio.rx_ping_ms !== null ? "text-[#11975a]" : "text-[#dc3340]"}`}>
          {connected ? (telemetry.radio.link_quality ?? (telemetry.radio.rx_ping_ms === null ? "00" : Math.max(0, 100 - telemetry.radio.rx_ping_ms / 10).toFixed(0))) : "00"}
        </strong>
        <small className="ml-[6px] text-[#718a94] font-mono font-[700] text-[7px]">%</small>
      </div>
      <div className="p-[12px_15px] bg-[#f8fbfc]">
        <span className="block text-[#69828c] font-mono font-[700] text-[7px] tracking-[.1em]">MISSION TIME</span>
        <strong className="inline-block mt-[8px] font-mono font-[800] text-[17px] leading-[1] text-[#17313b]">{telemetry.rover_state.mission_time || "—:—:—"}</strong>
        <small className="ml-[6px] text-[#718a94] font-mono font-[700] text-[7px]">UTC</small>
      </div>
    </div>
  );
}
