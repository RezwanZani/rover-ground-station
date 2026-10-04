export default function FooterBar({ connected }: { connected: boolean }) {
  return (
    <footer className="flex items-center gap-[24px] border-t border-[#c5d5dc] text-[#69818b] font-mono font-[700] text-[6px] tracking-[.08em]">
      <span>
        <i className={`inline-block w-[5px] h-[5px] mr-[5px] rounded-full ${connected ? "bg-[#11975a] shadow-[0_0_5px_#11975a]" : "bg-[#dc3340]"}`} /> 
        BACKEND {connected ? "ONLINE" : "OFFLINE"}
      </span>
      <span>WS://LOCALHOST:8765</span>
      <span>BUILD GS-2.4.1</span>
      <span className="ml-auto">{new Date().toLocaleDateString("en-CA")} / {new Date().toISOString().slice(11, 19)} UTC</span>
    </footer>
  );
}
