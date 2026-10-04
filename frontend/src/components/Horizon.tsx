import Icon from './Icon';
import { Telemetry } from '../types';

export default function Horizon({ imu }: { imu: Telemetry["imu"] }) {
  const hazardous = Math.abs(imu.roll) >= 25 || Math.abs(imu.pitch) >= 25;
  return (
    <div className={`flex-1 min-h-0 relative overflow-hidden bg-[#dce8ec] ${hazardous ? "shadow-[inset_0_0_30px_rgba(220,51,64,.3)]" : ""}`}>
      <div className="absolute w-[160%] h-[160%] left-[-30%] top-[-30%] transition-transform duration-[150ms] ease-linear" style={{ transform: `rotate(${-imu.roll}deg) translateY(${imu.pitch * 1.3}px)` }}>
        <div className="absolute left-0 w-full h-[50%] top-0 bg-[linear-gradient(#8dc7dd,#d5eaf2)]" />
        <div className="absolute left-0 w-full h-[50%] top-[50%] bg-[linear-gradient(#b9c2bc,#8e9f99)] border-t-[2px] border-[#f7fbfc]" />
        <div className="absolute inset-0">
          {[20, 10, 0, -10, -20].map((degree) => (
            <span key={degree} className="absolute left-[43%] w-[14%] border-t border-[rgba(255,255,255,.65)] text-center text-white font-mono text-[7px]" style={{ top: `${50 - degree * 1.5}%` }}>
              {degree !== 0 && Math.abs(degree)}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute left-[50%] top-[48%] w-[48%] translate-x-[-50%] translate-y-[-50%] flex items-center gap-[4px]">
        <i className="h-[3px] flex-1 bg-[#e38d13] shadow-[0_0_0_1px_#111]" />
        <b className="w-[7px] h-[7px] border-[2px] border-[#e38d13] rounded-full" />
        <i className="h-[3px] flex-1 bg-[#e38d13] shadow-[0_0_0_1px_#111]" />
      </div>
      <div className="absolute inset-[auto_8px_7px] grid grid-cols-3 gap-[5px]">
        {[['PITCH', imu.pitch], ['ROLL', imu.roll], ['YAW', imu.yaw]].map(([label, val]) => (
          <div key={label as string} className="p-[5px_7px] bg-[rgba(248,252,253,.88)] flex justify-between items-center text-[#183640]">
            <span className="text-[#607b86] font-mono text-[6px]">{label as string}</span>
            <strong className="font-mono font-[800] text-[9px]">{(val as number).toFixed(label === 'YAW' ? 0 : 1)}°</strong>
          </div>
        ))}
      </div>
      {hazardous && (
        <div className="absolute top-[8px] left-[50%] translate-x-[-50%] flex items-center gap-[5px] text-[#dc3340] bg-[#18090a] p-[4px_6px] font-mono font-[900] text-[8px]">
          <Icon name="alert" className="w-[10px] h-[10px]" /> ROLLOVER RISK
        </div>
      )}
    </div>
  );
}
