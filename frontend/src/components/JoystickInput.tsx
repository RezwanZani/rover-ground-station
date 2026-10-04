import { Telemetry } from '../types';

export default function JoystickInput({ joy }: { joy: Telemetry["joy"] }) {
  const deadband = joy?.deadband ?? 0.08;
  const inDeadband = Math.abs(joy?.axis_x ?? 0) < deadband && Math.abs(joy?.axis_y ?? 0) < deadband;

  return (
    <div className="joystick-body">
      <div className="joystick-axis y-axis"><span>+Y</span><span>−Y</span></div>
      <div className="joystick-pad">
        <div className="deadband-ring" style={{ width: `${deadband * 100}%`, height: `${deadband * 100}%` }} />
        <div className="joy-dot" style={{
          left: `${50 + Math.max(-1, Math.min(1, joy.axis_x)) * 43}%`,
          top: `${50 - Math.max(-1, Math.min(1, joy.axis_y)) * 43}%`,
        }} />
      </div>
      <div className="joystick-axis x-axis"><span>−X</span><span>+X</span></div>
      <div className="axis-values">
        <div><span>AXIS X</span><strong>{joy.axis_x.toFixed(3)}</strong></div>
        <div><span>AXIS Y</span><strong>{joy.axis_y.toFixed(3)}</strong></div>
      </div>
      <div className={`deadband-status ${inDeadband ? "active" : ""}`}><i /> DEADBAND {Math.round(deadband * 100)}% <strong>{inDeadband ? "ACTIVE" : "CLEAR"}</strong></div>
    </div>
  );
}
