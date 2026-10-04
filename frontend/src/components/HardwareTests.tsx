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
      <div className="flex items-center gap-[8px] m-[9px_9px_0] p-[7px_8px] border border-[#e1c58e] bg-[#fff7e6] text-[#17313b] max-h-[720px]:hidden">
        <Icon name="alert" className="w-[13px] flex-none text-[#e8b55d]" />
        <p className="m-0 text-[#947b57] font-mono font-[600] text-[6px] leading-[1.45]">
          <strong className="block text-[#e8b55d] text-[7px]">SAFETY INTERLOCK</strong>
          Tests lock out joystick input until complete.
        </p>
      </div>
      <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-[6px] p-[8px_9px] min-h-0">
        {[
          [1, "WHEEL", "SWEEP"],
          [2, "STEERING", "CAL"],
          [3, "ARM", "TEST"],
          [4, "BRAKE", "CHECK"],
          [5, "LIGHTS", "CYCLE"],
          [6, "RADIO", "PING"],
        ].map(([id, line1, line2]) => {
          const isTriggered = triggeredTest === id;
          return (
            <button key={id as number} onClick={() => triggerTest(id as number)} disabled={!connected} 
              className={`relative flex items-center gap-[8px] min-h-0 border text-left p-[7px] transition-colors duration-[150ms] 
                ${isTriggered ? "border-[#11975a] shadow-[inset_0_0_15px_rgba(86,245,139,.15)] text-[#11975a] bg-[#f3f8fa]" : "border-[#c5d4da] text-[#294752] bg-[#f3f8fa] hover:not(:disabled):border-[#638692] hover:not(:disabled):text-[#17313b] hover:not(:disabled):bg-[#e5f0f3]"} 
                disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer`}>
              <span className={`font-mono font-[800] text-[7px] self-start ${isTriggered ? "text-[#11975a]" : "text-[#596368]"}`}>0{id as number}</span>
              <strong className="font-mono font-[800] text-[8px] leading-[1.3] tracking-[.04em]">{line1 as string}<br />{line2 as string}</strong>
              <i className={`absolute right-[6px] bottom-[6px] w-[4px] h-[4px] rounded-full ${isTriggered ? "bg-[#11975a] shadow-[0_0_5px_#11975a]" : "bg-[#505a5f]"}`} />
            </button>
          );
        })}
      </div>
      <div className="h-[28px] flex justify-between items-center px-[10px] border-t border-[#c5d5dc] text-[#69818b] font-mono font-[700] text-[6px]">
        <span>COMMAND CHANNEL</span>
        <strong className={connected ? "text-[#11975a]" : "text-[#dc3340]"}>
          <i className={`inline-block w-[7px] h-[7px] mr-[7px] rounded-full ${connected ? "bg-[#11975a] shadow-[0_0_5px_#11975a]" : "bg-[#dc3340]"}`} />
          {connected ? "ARMED" : "DISABLED"}
        </strong>
      </div>
    </>
  );
}
