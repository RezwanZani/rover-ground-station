import { ConnectionStatus } from '../types';
import Icon from './Icon';

interface Props {
  connection?: ConnectionStatus;
}

export default function ConnectionDiagnostics({ connection }: Props) {
  const conn = connection || {};
  const channel = conn.active_channel || "OFFLINE";

  // Channel styling
  const channelConfig = {
    DUAL_ACTIVE: {
      label: "DUAL ACTIVE (Wi-Fi + 900MHz RF)",
      subtext: "Full Redundancy Link Active",
      badgeColor: "bg-[#11975a] text-white",
      border: "border-[#11975a]/30",
      dot: "bg-[#11975a] shadow-[0_0_8px_#11975a]",
    },
    UDP: {
      label: "WI-FI PRIMARY (UDP)",
      subtext: "High-Bandwidth LAN Link",
      badgeColor: "bg-[#2980b9] text-white",
      border: "border-[#2980b9]/30",
      dot: "bg-[#2980b9] shadow-[0_0_8px_#2980b9]",
    },
    XBEE: {
      label: "900MHz RF (XBEE LIFELINE)",
      subtext: "Long-Range Fallback Active",
      badgeColor: "bg-[#f39c12] text-white",
      border: "border-[#f39c12]/30",
      dot: "bg-[#f39c12] shadow-[0_0_8px_#f39c12]",
    },
    OFFLINE: {
      label: "NO TELEMETRY CARRIER",
      subtext: "Awaiting Radio or Network Data",
      badgeColor: "bg-[#dc3340] text-white",
      border: "border-[#dc3340]/30",
      dot: "bg-[#dc3340]",
    },
  }[channel];

  const xbeeOk = conn.xbee_connected ?? false;
  const gpsOk = conn.gps_connected ?? false;
  const rtcmOk = conn.rtcm_received ?? false;
  const rtcmCount = conn.rtcm_count ?? 0;
  const rtcmAge = conn.rtcm_age_s;

  const fixLabel = conn.gps_fix || (gpsOk ? "3D FIX" : "NO FIX");
  const fixColor =
    fixLabel.includes("RTK FIXED") ? "text-[#11975a] bg-[#11975a]/10 border-[#11975a]/30" :
    fixLabel.includes("RTK FLOAT") ? "text-[#2980b9] bg-[#2980b9]/10 border-[#2980b9]/30" :
    fixLabel.includes("3D") ? "text-[#f39c12] bg-[#f39c12]/10 border-[#f39c12]/30" :
    "text-[#dc3340] bg-[#dc3340]/10 border-[#dc3340]/30";

  return (
    <div className="flex flex-col h-full justify-between p-[8px_10px] gap-[6px] font-mono text-[9px]">
      {/* 1. Active Channel Banner */}
      <div className={`flex flex-col rounded p-[6px_8px] border bg-[#f3f8fa] ${channelConfig.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[6px]">
            <span className={`w-[7px] h-[7px] rounded-full ${channelConfig.dot}`} />
            <span className="font-bold text-[#17313b] tracking-wider text-[10px]">
              {channelConfig.label}
            </span>
          </div>
          <span className={`text-[7px] px-[5px] py-[1px] rounded font-bold uppercase ${channelConfig.badgeColor}`}>
            {channel === "DUAL_ACTIVE" ? "REDUNDANT" : channel}
          </span>
        </div>
        <div className="text-[7.5px] text-[#718993] mt-[2px] pl-[13px]">
          {channelConfig.subtext} {conn.last_channel ? `· Last rx: ${conn.last_channel}` : ""}
        </div>
      </div>

      {/* 2. Hardware Modules Grid */}
      <div className="flex-1 grid grid-rows-3 gap-[4px]">
        {/* Module A: Rover XBee Radio */}
        <div className="flex items-center justify-between px-[8px] py-[4px] rounded border border-[#dbe6ea] bg-white">
          <div className="flex items-center gap-[6px]">
            <span className={`w-[6px] h-[6px] rounded-full ${xbeeOk ? "bg-[#11975a] shadow-[0_0_5px_#11975a]" : "bg-[#dc3340]"}`} />
            <div className="flex flex-col">
              <span className="font-bold text-[#17313b]">XBEE 900MHz RF</span>
              <span className="text-[7px] text-[#718993]">{conn.xbee_port || "/dev/rover_900mhz"}</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[8px] font-bold px-[4px] py-[1px] rounded ${xbeeOk ? "text-[#11975a] bg-[#11975a]/10" : "text-[#dc3340] bg-[#dc3340]/10"}`}>
              {xbeeOk ? "CONNECTED" : "OFFLINE"}
            </span>
            {conn.xbee_rx_pkts !== undefined && conn.xbee_rx_pkts > 0 && (
              <div className="text-[7px] text-[#718993]">{conn.xbee_rx_pkts} pkts</div>
            )}
          </div>
        </div>

        {/* Module B: Rover Quectel RTK GPS */}
        <div className="flex items-center justify-between px-[8px] py-[4px] rounded border border-[#dbe6ea] bg-white">
          <div className="flex items-center gap-[6px]">
            <span className={`w-[6px] h-[6px] rounded-full ${gpsOk ? "bg-[#11975a] shadow-[0_0_5px_#11975a]" : "bg-[#dc3340]"}`} />
            <div className="flex flex-col">
              <span className="font-bold text-[#17313b]">QUECTEL LC29H GPS</span>
              <span className="text-[7px] text-[#718993]">/dev/rover_rtk @ 115200</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[8px] font-bold px-[4px] py-[1px] rounded border ${fixColor}`}>
              {fixLabel}
            </span>
          </div>
        </div>

        {/* Module C: RTCM Corrections Received */}
        <div className="flex items-center justify-between px-[8px] py-[4px] rounded border border-[#dbe6ea] bg-white">
          <div className="flex items-center gap-[6px]">
            <span className={`w-[6px] h-[6px] rounded-full ${rtcmOk ? "bg-[#11975a] shadow-[0_0_5px_#11975a]" : (rtcmCount > 0 ? "bg-[#f39c12]" : "bg-[#95a5a6]")}`} />
            <div className="flex flex-col">
              <span className="font-bold text-[#17313b]">RTCM3 CORRECTIONS</span>
              <span className="text-[7px] text-[#718993]">
                {rtcmCount > 0 ? `${rtcmCount} frames injected` : "Awaiting Base GPS survey"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[8px] font-bold px-[4px] py-[1px] rounded ${
              rtcmOk ? "text-[#11975a] bg-[#11975a]/10" : (rtcmCount > 0 ? "text-[#f39c12] bg-[#f39c12]/10" : "text-[#718993] bg-gray-100")
            }`}>
              {rtcmOk ? "RECEIVING" : (rtcmCount > 0 ? (rtcmAge !== null && rtcmAge !== undefined ? `${rtcmAge}s ago` : "STALE") : "IDLE")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
