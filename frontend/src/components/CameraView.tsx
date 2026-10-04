import Icon from './Icon';

export default function CameraView({ url, label, secondary = false }: { url?: string; label: string; secondary?: boolean }) {
  return (
    <div className={`absolute inset-0 overflow-hidden bg-[#cddce1] ${secondary ? "[&_.camera-fallback_strong]:hidden [&_.camera-fallback_small]:hidden [&_.feed-time]:hidden [&_.camera-fallback_svg]:w-[16px] [&_.camera-fallback_svg]:h-[16px] [&_.feed-label]:top-[5px] [&_.feed-label]:left-[5px] [&_.feed-label]:text-[6px] [&_.feed-label]:p-[4px_5px]" : ""}`}>
      {url ? (
        <img src={url} alt={`${label} live stream`} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#66808b] bg-[radial-gradient(circle_at_50%_60%,#e4eef1,#bdcfd6_72%)] before:content-[''] before:absolute before:inset-0 before:opacity-[.1] before:bg-[repeating-linear-gradient(0deg,transparent_0_4px,#9da6a9_5px)]">
          <div className="absolute left-[50%] top-[48%] w-[95px] h-[95px] translate-x-[-50%] translate-y-[-50%] border border-[rgba(216,228,231,.18)] rounded-full before:content-[''] before:absolute before:bg-[rgba(216,228,231,.18)] before:w-[130px] before:h-[1px] before:left-[-18px] before:top-[47px] after:content-[''] after:absolute after:bg-[rgba(216,228,231,.18)] after:h-[130px] after:w-[1px] after:left-[47px] after:top-[-18px]" />
          <div className="absolute w-[150%] h-[32%] left-[-20%] bottom-[-11%] rotate-[-3deg] border-t-[2px] border-[rgba(54,93,102,.2)] bg-[#b5c8c6]" />
          <Icon name="camera" className="h-6 w-6 z-10" />
          <strong className="mt-[10px] text-[#496a76] font-mono font-[800] text-[10px] tracking-[.15em] z-10">AWAITING VIDEO</strong>
          <small className="mt-[5px] font-mono font-[700] text-[7px] tracking-[.1em] z-10">STREAM CHANNEL READY</small>
        </div>
      )}
      <div className="absolute top-[11px] left-[11px] p-[6px_8px] bg-[rgba(245,250,251,.9)] text-[#45636e] font-mono font-[800] text-[8px] tracking-[.08em] z-10">
        <span className="inline-block w-[5px] h-[5px] mr-[6px] rounded-full bg-[#dc3340]" />
        {label}
      </div>
      <div className="absolute top-[11px] right-[11px] p-[6px_8px] bg-[rgba(245,250,251,.9)] text-[#45636e] font-mono font-[800] text-[8px] tracking-[.08em] z-10">
        {new Date().toISOString().slice(11, 19)} UTC
      </div>
    </div>
  );
}
