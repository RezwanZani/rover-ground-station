import { Telemetry } from '../types';

export default function MotorDiagnostics({ motors }: { motors: Telemetry["motors"] }) {
  return (
    <>
      <div className="grid grid-cols-[1.5fr_.8fr_.65fr] items-center h-[24px] px-[10px] text-[#718993] bg-[#edf4f6] font-mono font-[700] text-[6px] tracking-[.08em]">
        <span>MOTOR</span><span className="text-right">CURRENT</span><span className="text-right">TEMP</span>
      </div>
      <div className="flex-1 grid grid-rows-6">
        {motors.length === 0 && <div className="p-4 text-center text-[#647179] text-sm">NO MOTORS REPORTING</div>}
        {motors.slice(0, 6).map((motor) => {
          const hot = motor.temp_c >= 70;
          return (
            <div className="grid grid-cols-[1.5fr_.8fr_.65fr] items-center min-h-0 px-[10px] border-t border-[#dbe6ea] font-mono font-[700] text-[8px]" key={motor.name}>
              <span className="flex items-center gap-[7px] text-[#3f5d68]">
                <i className={`w-[5px] h-[5px] rounded-full ${hot ? "bg-[#dc3340]" : "bg-[#11975a] shadow-[0_0_5px_#11975a]"}`} />
                {motor.name}
              </span>
              <strong className="text-right text-[9px] text-[#17313b]">{motor.current_a.toFixed(1)} <small className="text-[#78909a] text-[6px]">A</small></strong>
              <strong className={`text-right text-[9px] ${hot ? "text-[#dc3340]" : "text-[#17313b]"}`}>{motor.temp_c.toFixed(0)}°<small className="text-[#78909a] text-[6px]">C</small></strong>
            </div>
          );
        })}
      </div>
    </>
  );
}
