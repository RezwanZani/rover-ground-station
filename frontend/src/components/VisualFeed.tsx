import React from 'react';
import CameraView from './CameraView';
import Icon from './Icon';

export default function VisualFeed({ 
  streams, 
  swapped, 
  setSwapped, 
  connected 
}: { 
  streams: { main?: string; pip?: string; mainLabel: string; pipLabel: string }; 
  swapped: boolean; 
  setSwapped: React.Dispatch<React.SetStateAction<boolean>>; 
  connected: boolean;
}) {
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-[#cddce1]">
      <CameraView url={streams.main} label={streams.mainLabel} />
      <div className="absolute z-[4] right-[13px] bottom-[49px] w-[34%] aspect-video border border-[#8d999e] shadow-[0_8px_24px_#000]">
        <CameraView url={streams.pip} label={streams.pipLabel} secondary />
      </div>
      <button className="absolute z-[5] right-[13px] bottom-[18px] flex items-center gap-[6px] p-[6px_10px] border border-[#9bb1ba] text-[#25444f] bg-[#f7fbfc] font-mono font-[800] text-[7px] tracking-[.08em] cursor-pointer hover:border-[#527684] hover:bg-[#e6f0f3]" onClick={() => setSwapped((value) => !value)}>
        <Icon name="swap" className="w-[11px] h-[11px]" /> SWAP FEEDS
      </button>
      <div className="absolute z-[3] inset-x-0 bottom-0 h-[31px] flex items-center gap-[22px] px-[12px] bg-[rgba(245,250,251,.9)] text-[#45636e] font-mono font-[700] text-[7px]">
        <span>LINK <b className="text-[#11975a]">{connected ? "STABLE" : "OFFLINE"}</b></span>
        <span>30 FPS</span><span>H.264</span><span>12.4 Mbps</span>
      </div>
    </div>
  );
}
