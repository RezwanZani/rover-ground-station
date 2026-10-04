import Icon from './Icon';

export default function HardwareTests({
  connected,
  triggeredTest,
  triggerTest
}: {
  connected: boolean;
  triggeredTest: number | null;
  triggerTest: (id: number) => void;
}) {
  return (
    <>
      <div className="safety-note"><Icon name="alert" /><p><strong>SAFETY INTERLOCK</strong>Tests lock out joystick input until complete.</p></div>
      <div className="test-grid">
        {[
          [1, "WHEEL", "SWEEP"],
          [2, "STEERING", "CAL"],
          [3, "ARM", "TEST"],
          [4, "BRAKE", "CHECK"],
          [5, "LIGHTS", "CYCLE"],
          [6, "RADIO", "PING"],
        ].map(([id, line1, line2]) => (
          <button key={id as number} onClick={() => triggerTest(id as number)} disabled={!connected} className={triggeredTest === id ? "triggered" : ""}>
            <span>0{id as number}</span><strong>{line1 as string}<br />{line2 as string}</strong><i />
          </button>
        ))}
      </div>
      <div className="command-status"><span>COMMAND CHANNEL</span><strong className={connected ? "online" : ""}><i />{connected ? "ARMED" : "DISABLED"}</strong></div>
    </>
  );
}
