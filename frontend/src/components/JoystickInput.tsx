import { Telemetry } from '../types';

export default function JoystickInput({ joy }: { joy: Telemetry["joy"] }) {
  const deadband = joy?.deadband ?? 0.08;
  const inDeadband = Math.abs(joy?.axis_x ?? 0) < deadband && Math.abs(joy?.axis_y ?? 0) < deadband;

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center min-h-0 p-[10px_14px_8px]">
      <div className="absolute top-[12px] bottom-[65px] left-[50%] translate-x-[-50%] flex flex-col justify-between text-[#75909a] font-mono font-[700] text-[6px]"><span>+Y</span><span>−Y</span></div>
      <div className="relative w-[min(52%,170px)] aspect-square border border-[#8fa8b2] rounded-full bg-[radial-gradient(circle,#f9fcfd,#d9e6ea)] shadow-[inset_0_0_24px_rgba(46,83,95,.13)] before:content-[''] before:absolute before:bg-[#b7c9d0] before:left-[50%] before:top-[6%] before:bottom-[6%] before:w-[1px] after:content-[''] after:absolute after:bg-[#b7c9d0] after:top-[50%] after:left-[6%] after:right-[6%] after:h-[1px]">
        <div className="absolute z-[2] left-[50%] top-[50%] min-w-[18px] min-h-[18px] translate-x-[-50%] translate-y-[-50%] border border-dashed border-[#6f8993] rounded-full bg-[rgba(62,112,130,.04)]" style={{ width: `${deadband * 100}%`, height: `${deadband * 100}%` }} />
        <div className="absolute z-[3] w-[12px] h-[12px] translate-x-[-50%] translate-y-[-50%] border-[2px] border-[#d9ffdf] rounded-full bg-[#11975a] shadow-[0_0_14px_#11975a] transition-[left,top] duration-[50ms] ease-linear" style={{
          left: `${50 + Math.max(-1, Math.min(1, joy.axis_x)) * 43}%`,
          top: `${50 - Math.max(-1, Math.min(1, joy.axis_y)) * 43}%`,
        }} />
      </div>
      <div className="absolute top-[45%] left-[15%] right-[15%] flex justify-between text-[#75909a] font-mono font-[700] text-[6px]"><span>−X</span><span>+X</span></div>
      <div className="w-full grid grid-cols-2 gap-[7px] mt-[9px]">
        <div className="flex items-center justify-between p-[6px_8px] bg-[#edf4f6] border border-[#dbe6ea]">
          <span className="text-[#69828c] font-mono font-[700] text-[6px]">AXIS X</span>
          <strong className="font-mono font-[800] text-[9px] text-[#17313b]">{joy.axis_x.toFixed(3)}</strong>
        </div>
        <div className="flex items-center justify-between p-[6px_8px] bg-[#edf4f6] border border-[#dbe6ea]">
          <span className="text-[#69828c] font-mono font-[700] text-[6px]">AXIS Y</span>
          <strong className="font-mono font-[800] text-[9px] text-[#17313b]">{joy.axis_y.toFixed(3)}</strong>
        </div>
      </div>
      <div className={`w-full mt-[6px] p-[5px_8px] bg-[#edf4f6] font-mono font-[700] text-[6px] tracking-[.05em] ${inDeadband ? "text-[#11975a]" : "text-[#69828c]"}`}>
        <i className={`inline-block w-[5px] h-[5px] mr-[5px] rounded-full ${inDeadband ? "bg-[#11975a] shadow-[0_0_5px_#11975a]" : "bg-[#687278]"}`} /> 
        DEADBAND {Math.round(deadband * 100)}% 
        <strong className="float-right">{inDeadband ? "ACTIVE" : "CLEAR"}</strong>
      </div>
    </div>
  );
}
