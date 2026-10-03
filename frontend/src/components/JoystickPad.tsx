import React from 'react';
import { Crosshair } from 'lucide-react';

interface JoystickPadProps {
  x: number;
  y: number;
}

export const JoystickPad: React.FC<JoystickPadProps> = ({ x, y }) => {
  const visualX = ((x + 1) / 2) * 100;
  const visualY = ((-y + 1) / 2) * 100;

  return (
    <div className="bg-[#111111] rounded-lg border border-zinc-800 flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800 flex items-center gap-2 bg-zinc-900/50">
        <Crosshair className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Drive Joystick</h2>
      </div>
      
      <div className="p-4 flex-grow flex flex-col items-center justify-center relative">
        <div className="relative w-48 h-48 bg-black rounded-full border-2 border-zinc-700 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
          {/* Axis markers */}
          <div className="absolute w-full h-px bg-zinc-700/50"></div>
          <div className="absolute h-full w-px bg-zinc-700/50"></div>
          <div className="absolute w-1/2 h-1/2 rounded-full border border-zinc-700/30"></div>
          
          {/* The joystick dot */}
          <div 
            className="absolute w-6 h-6 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] z-10"
            style={{
              left: `calc(${visualX}% - 12px)`,
              top: `calc(${visualY}% - 12px)`
            }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 divide-x divide-zinc-800 border-t border-zinc-800">
        <div className="p-2 text-center bg-zinc-900/30">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Angular (X)</p>
          <p className="text-lg font-black text-blue-400 font-mono">{x.toFixed(3)}</p>
        </div>
        <div className="p-2 text-center bg-zinc-900/30">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Linear (Y)</p>
          <p className="text-lg font-black text-blue-400 font-mono">{y.toFixed(3)}</p>
        </div>
      </div>
    </div>
  );
};
