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
    <div className="camera-stage">
      <CameraView url={streams.main} label={streams.mainLabel} />
      <div className="pip-wrap"><CameraView url={streams.pip} label={streams.pipLabel} secondary /></div>
      <button className="swap-button" onClick={() => setSwapped((value) => !value)}><Icon name="swap" /> SWAP FEEDS</button>
      <div className="camera-footer"><span>LINK <b>{connected ? "STABLE" : "OFFLINE"}</b></span><span>30 FPS</span><span>H.264</span><span>12.4 Mbps</span></div>
    </div>
  );
}
