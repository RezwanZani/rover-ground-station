import { Telemetry } from '../types';

export default function MotorDiagnostics({ motors }: { motors: Telemetry["motors"] }) {
  return (
    <>
      <div className="motor-head"><span>MOTOR</span><span>CURRENT</span><span>TEMP</span></div>
      <div className="motor-list">
        {motors.length === 0 && <div className="p-4 text-center text-[#647179] text-sm">NO MOTORS REPORTING</div>}
        {motors.slice(0, 6).map((motor) => {
          const hot = motor.temp_c >= 70;
          return <div className="motor-row" key={motor.name}><span><i className={hot ? "hot" : ""} />{motor.name}</span><strong>{motor.current_a.toFixed(1)} <small>A</small></strong><strong className={hot ? "hot-text" : ""}>{motor.temp_c.toFixed(0)}°<small>C</small></strong></div>;
        })}
      </div>
    </>
  );
}
