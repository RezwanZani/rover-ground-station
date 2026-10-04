import Icon from './Icon';
import { Telemetry } from '../types';

export default function Horizon({ imu }: { imu: Telemetry["imu"] }) {
  const hazardous = Math.abs(imu.roll) >= 25 || Math.abs(imu.pitch) >= 25;
  return (
    <div className={`horizon-wrap ${hazardous ? "is-hazard" : ""}`}>
      <div className="horizon" style={{ transform: `rotate(${-imu.roll}deg) translateY(${imu.pitch * 1.3}px)` }}>
        <div className="sky" />
        <div className="ground" />
        <div className="pitch-lines">
          {[20, 10, 0, -10, -20].map((degree) => <span key={degree} style={{ top: `${50 - degree * 1.5}%` }}>{degree !== 0 && Math.abs(degree)}</span>)}
        </div>
      </div>
      <div className="aircraft-mark"><i /><b /><i /></div>
      <div className="horizon-values">
        <div><span>PITCH</span><strong>{imu.pitch.toFixed(1)}°</strong></div>
        <div><span>ROLL</span><strong>{imu.roll.toFixed(1)}°</strong></div>
        <div><span>YAW</span><strong>{Math.round(imu.yaw)}°</strong></div>
      </div>
      {hazardous && <div className="hazard-label"><Icon name="alert" /> ROLLOVER RISK</div>}
    </div>
  );
}
