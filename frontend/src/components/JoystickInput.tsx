import { useMemo } from 'react';
import { Telemetry, ArmState, CmdVel } from '../types';

interface JoystickInputProps {
  joy: Telemetry["joy"];
  cmdVel?: CmdVel;
  arm?: ArmState;
}

// Bi-directional bar centered at 0 in range [-1, 1]
function BiDirectionalBar({
  value,
  min = -1,
  max = 1,
  positiveColor = "#11975a",
  negativeColor = "#e67e22",
  label = "",
  unit = "",
}: {
  value: number;
  min?: number;
  max?: number;
  positiveColor?: string;
  negativeColor?: string;
  label?: string;
  unit?: string;
}) {
  const clamped = Math.max(min, Math.min(max, value));
  const span = max - min;
  const zeroPercent = ((0 - min) / span) * 100;
  
  // Calculate bar geometry from 0 center
  const isPositive = clamped >= 0;
  const leftPercent = isPositive ? zeroPercent : ((clamped - min) / span) * 100;
  const widthPercent = Math.abs((clamped / (span / 2)) * (zeroPercent));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[7px] font-mono font-bold mb-[2px]">
        <span className="text-[#587783] uppercase tracking-wider">{label}</span>
        <span className={`font-extrabold ${Math.abs(clamped) > 0.01 ? (isPositive ? "text-[#11975a]" : "text-[#e67e22]") : "text-[#75909a]"}`}>
          {clamped >= 0 ? "+" : ""}{clamped.toFixed(3)} {unit}
        </span>
      </div>
      <div className="relative w-full h-[10px] bg-[#dbe6ea] rounded-sm overflow-hidden border border-[#c5d5dc]">
        {/* Center Zero Marker */}
        <div
          className="absolute top-0 bottom-0 w-[1.5px] bg-[#75909a] z-[3] translate-x-[-50%]"
          style={{ left: `${zeroPercent}%` }}
        />
        {/* Active Value Bar */}
        {Math.abs(clamped) > 0.005 && (
          <div
            className="absolute top-0 bottom-0 z-[2] transition-all duration-75"
            style={{
              left: `${leftPercent}%`,
              width: `${Math.min(50, widthPercent)}%`,
              backgroundColor: isPositive ? positiveColor : negativeColor,
            }}
          />
        )}
      </div>
    </div>
  );
}

// Arm Channel Status Row (matches xbee_teleop Actuator 1..3, Wrist, Gripper)
function ArmChannelRow({
  channel,
  buttonHint,
  value,
  contractLabel = "CONTRACT",
  expandLabel = "EXPAND",
}: {
  channel: string;
  buttonHint: string;
  value: number;
  contractLabel?: string;
  expandLabel?: string;
}) {
  const state = useMemo(() => {
    if (value > 0.3) {
      return {
        text: expandLabel,
        color: "text-[#11975a] bg-[#11975a]/10 border-[#11975a]/30",
        dot: "bg-[#11975a]",
        indicator: "+1.0",
      };
    }
    if (value < -0.3) {
      return {
        text: contractLabel,
        color: "text-[#e67e22] bg-[#e67e22]/10 border-[#e67e22]/30",
        dot: "bg-[#e67e22]",
        indicator: "-1.0",
      };
    }
    return {
      text: "HOLD",
      color: "text-[#69828c] bg-[#edf4f6] border-[#dbe6ea]",
      dot: "bg-[#8fa8b2]",
      indicator: "0.0",
    };
  }, [value, contractLabel, expandLabel]);

  return (
    <div className="flex items-center justify-between p-[3px_6px] bg-[#f5f9fa] border border-[#dbe6ea] rounded-sm text-[7px] font-mono">
      <div className="flex items-center gap-[6px]">
        <i className={`w-[5px] h-[5px] rounded-full shrink-0 ${state.dot}`} />
        <span className="font-extrabold text-[#17313b] tracking-wider">{channel}</span>
        <span className="text-[#8fa8b2] text-[6px]">({buttonHint})</span>
      </div>
      <div className="flex items-center gap-[6px]">
        <span className="text-[6.5px] font-bold text-[#8fa8b2]">{state.indicator}</span>
        <span className={`px-[5px] py-[1px] rounded text-[6.5px] font-extrabold uppercase border ${state.color}`}>
          {state.text}
        </span>
      </div>
    </div>
  );
}

export default function JoystickInput({ joy, cmdVel, arm }: JoystickInputProps) {
  const deadband = joy?.deadband ?? 0.08;
  const inDeadband = Math.abs(joy?.axis_x ?? 0) < deadband && Math.abs(joy?.axis_y ?? 0) < deadband;

  // Derive velocities (prioritize cmdVel if provided, otherwise joy axes)
  const vx = cmdVel?.linear_x ?? joy?.axis_y ?? 0.0;
  const wz = cmdVel?.angular_z ?? joy?.axis_x ?? 0.0;

  // Arm channels default to 0.0
  const a1 = arm?.act1 ?? 0.0;
  const a2 = arm?.act2 ?? 0.0;
  const a3 = arm?.act3 ?? 0.0;
  const wrist = arm?.wrist ?? 0.0;
  const gripper = arm?.gripper ?? 0.0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-[8px_10px] gap-[8px] select-none text-[#17313b]">
      {/* ------------------------------------------------------------- */}
      {/* 1. COMPACT 2D JOYSTICK PAD                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-[10px] bg-[#f5f9fa] border border-[#dbe6ea] p-[6px_8px] rounded-sm">
        {/* 2D Coordinate Reticle */}
        <div className="relative w-[70px] h-[70px] shrink-0 border border-[#8fa8b2] rounded-full bg-[radial-gradient(circle,#ffffff,#d9e6ea)] shadow-[inset_0_0_12px_rgba(46,83,95,.15)] before:content-[''] before:absolute before:bg-[#b7c9d0] before:left-[50%] before:top-[6%] before:bottom-[6%] before:w-[1px] after:content-[''] after:absolute after:bg-[#b7c9d0] after:top-[50%] after:left-[6%] after:right-[6%] after:h-[1px]">
          {/* Deadband Circle */}
          <div
            className="absolute z-[2] left-[50%] top-[50%] min-w-[12px] min-h-[12px] translate-x-[-50%] translate-y-[-50%] border border-dashed border-[#6f8993] rounded-full bg-[rgba(62,112,130,.06)]"
            style={{ width: `${deadband * 100}%`, height: `${deadband * 100}%` }}
          />
          {/* Active Joystick Puck */}
          <div
            className="absolute z-[3] w-[10px] h-[10px] translate-x-[-50%] translate-y-[-50%] border-[2px] border-[#d9ffdf] rounded-full bg-[#11975a] shadow-[0_0_8px_#11975a] transition-[left,top] duration-[50ms] ease-linear"
            style={{
              left: `${50 + Math.max(-1, Math.min(1, joy?.axis_x ?? 0)) * 43}%`,
              top: `${50 - Math.max(-1, Math.min(1, joy?.axis_y ?? 0)) * 43}%`,
            }}
          />
        </div>

        {/* Axis Readouts & Deadband Badge */}
        <div className="flex-1 flex flex-col justify-between h-[70px] gap-[3px]">
          <div className="grid grid-cols-2 gap-[4px]">
            <div className="p-[3px_5px] bg-[#edf4f6] border border-[#dbe6ea] rounded-xs">
              <span className="block text-[#69828c] font-mono font-bold text-[6px]">STICK X</span>
              <strong className="font-mono font-extrabold text-[8px] text-[#17313b]">
                {(joy?.axis_x ?? 0).toFixed(3)}
              </strong>
            </div>
            <div className="p-[3px_5px] bg-[#edf4f6] border border-[#dbe6ea] rounded-xs">
              <span className="block text-[#69828c] font-mono font-bold text-[6px]">STICK Y</span>
              <strong className="font-mono font-extrabold text-[8px] text-[#17313b]">
                {(joy?.axis_y ?? 0).toFixed(3)}
              </strong>
            </div>
          </div>

          <div className={`p-[3px_6px] rounded-xs font-mono font-bold text-[6px] tracking-wider border ${
            inDeadband
              ? "bg-[#11975a]/10 border-[#11975a]/30 text-[#11975a]"
              : "bg-[#edf4f6] border-[#dbe6ea] text-[#69828c]"
          }`}>
            <i className={`inline-block w-[4px] h-[4px] mr-[4px] rounded-full ${
              inDeadband ? "bg-[#11975a] shadow-[0_0_4px_#11975a]" : "bg-[#8fa8b2]"
            }`} />
            DEADBAND {Math.round(deadband * 100)}%
            <strong className="float-right uppercase">{inDeadband ? "ACTIVE" : "CLEAR"}</strong>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. DRIVE VELOCITY STATUS (/cmd_vel)                           */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-[5px] bg-[#f5f9fa] border border-[#dbe6ea] p-[6px_8px] rounded-sm">
        <div className="flex items-center justify-between border-b border-[#dbe6ea] pb-[3px]">
          <span className="font-mono font-extrabold text-[7.5px] tracking-widest text-[#102b35] flex items-center gap-[4px]">
            <span className="inline-block w-[2px] h-[7px] bg-[#11975a]" />
            DRIVE COMMAND (/cmd_vel)
          </span>
          <span className="font-mono text-[6.5px] font-bold text-[#69828c]">
            {Math.abs(vx) > 0.01 || Math.abs(wz) > 0.01 ? (
              <span className="text-[#11975a] font-extrabold">TRANSMITTING</span>
            ) : (
              <span>IDLE</span>
            )}
          </span>
        </div>

        {/* Linear X (vx) Bi-directional Bar */}
        <BiDirectionalBar
          label="Linear X (vx) - Fwd / Rev"
          value={vx}
          min={-1.0}
          max={1.0}
          unit="m/s"
          positiveColor="#11975a"
          negativeColor="#e67e22"
        />

        {/* Angular Z (wz) Bi-directional Bar */}
        <BiDirectionalBar
          label="Angular Z (wz) - Left / Right"
          value={wz}
          min={-1.5}
          max={1.5}
          unit="rad/s"
          positiveColor="#2980b9"
          negativeColor="#2980b9"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. 5-DOF ARM CONTROL STATUS (/arm_vel)                        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-[4px] bg-[#f5f9fa] border border-[#dbe6ea] p-[6px_8px] rounded-sm">
        <div className="flex items-center justify-between border-b border-[#dbe6ea] pb-[3px]">
          <span className="font-mono font-extrabold text-[7.5px] tracking-widest text-[#102b35] flex items-center gap-[4px]">
            <span className="inline-block w-[2px] h-[7px] bg-[#2980b9]" />
            ARM ACTUATORS (/arm_vel)
          </span>
          <span className="font-mono text-[6.5px] font-bold text-[#69828c]">
            {a1 !== 0 || a2 !== 0 || a3 !== 0 || wrist !== 0 || gripper !== 0 ? (
              <span className="text-[#e67e22] font-extrabold animate-pulse">ENGAGED</span>
            ) : (
              <span>HOLD ALL</span>
            )}
          </span>
        </div>

        {/* 5 Actuator Rows */}
        <div className="flex flex-col gap-[3px]">
          <ArmChannelRow
            channel="ACTUATOR 1"
            buttonHint="A + LT/RT"
            value={a1}
            contractLabel="CONTRACT"
            expandLabel="EXPAND"
          />
          <ArmChannelRow
            channel="ACTUATOR 2"
            buttonHint="B + LT/RT"
            value={a2}
            contractLabel="CONTRACT"
            expandLabel="EXPAND"
          />
          <ArmChannelRow
            channel="ACTUATOR 3"
            buttonHint="X + LT/RT"
            value={a3}
            contractLabel="CONTRACT"
            expandLabel="EXPAND"
          />
          <ArmChannelRow
            channel="WRIST"
            buttonHint="Y + LT/RT"
            value={wrist}
            contractLabel="CCW"
            expandLabel="CW"
          />
          <ArmChannelRow
            channel="GRIPPER"
            buttonHint="D-PAD UP/DN"
            value={gripper}
            contractLabel="CLOSE"
            expandLabel="OPEN"
          />
        </div>
      </div>
    </div>
  );
}
