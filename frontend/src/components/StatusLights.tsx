import React from 'react';
import { Activity, Radio, Battery, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface StatusLightsProps {
  txActive: boolean;
  rxPingMs: number;
  batteryV: number;
  mode: string;
  wsConnected: boolean;
}

export const StatusLights: React.FC<StatusLightsProps> = ({ txActive, rxPingMs, batteryV, mode, wsConnected }) => {
  const isHighLatency = rxPingMs > 500 || !txActive || !wsConnected;
  
  // Battery color logic
  let batColor = 'text-green-500';
  let batBar = 'bg-green-500';
  if (batteryV < 21.5) {
    batColor = 'text-red-500 animate-pulse';
    batBar = 'bg-red-500';
  } else if (batteryV <= 22.0) {
    batColor = 'text-yellow-500';
    batBar = 'bg-yellow-500';
  }
  
  const batPercent = Math.min(100, Math.max(0, ((batteryV - 20) / 6) * 100)); // Rough calc between 20V and 26V

  return (
    <div className="bg-[#111111] border-b-2 border-zinc-800 p-2 flex items-center justify-between shadow-2xl h-16 w-full shrink-0 px-6">
      
      {/* WS Connection Status */}
      <div className={`flex items-center gap-2 px-3 py-1 rounded-sm border ${
        wsConnected ? 'border-green-500/30 bg-green-900/20 text-green-400' : 'border-red-500/30 bg-red-900/20 text-red-500 animate-pulse'
      }`}>
        {wsConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
        <span className="font-bold text-sm tracking-widest">{wsConnected ? 'SYS CONN' : 'SYS OFFLINE'}</span>
      </div>

      {/* Battery Status */}
      <div className="flex items-center gap-3 bg-black/50 px-4 py-2 rounded border border-zinc-800">
        <Battery className={`w-6 h-6 ${batColor}`} />
        <div className="flex flex-col">
          <div className="flex justify-between items-baseline w-32">
            <span className="text-xs text-zinc-400 font-bold tracking-widest">BATT</span>
            <span className={`text-lg font-black font-mono leading-none ${batColor}`}>{batteryV.toFixed(1)}V</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 mt-1 rounded overflow-hidden">
            <div className={`h-full ${batBar}`} style={{ width: `${batPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Mode Indicator */}
      <div className={`px-6 py-1.5 rounded-sm flex items-center gap-2 border-2 ${
        mode === 'HARDWARE TEST OVERRIDE' ? 'bg-yellow-900/20 border-yellow-500/50 text-yellow-500 animate-pulse' : 'bg-blue-900/20 border-blue-500/30 text-blue-400'
      }`}>
        {mode === 'HARDWARE TEST OVERRIDE' && <AlertCircle className="w-5 h-5" />}
        <span className="text-xl font-black tracking-widest">{mode}</span>
      </div>

      {/* RF Link Status */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded border border-zinc-800">
          <Radio className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-bold text-zinc-400">TX</span>
          <div className={`w-3 h-3 rounded-full ${txActive ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500'}`} />
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded border ${isHighLatency ? 'bg-red-900/30 border-red-500/50' : 'bg-black/50 border-zinc-800'}`}>
          <Activity className={`w-4 h-4 ${isHighLatency ? 'text-red-500' : 'text-zinc-500'}`} />
          <span className="text-xs font-bold text-zinc-400">RX PING</span>
          <span className={`text-lg font-black font-mono leading-none ${isHighLatency ? 'text-red-500' : 'text-green-400'}`}>
            {rxPingMs} <span className="text-sm">ms</span>
          </span>
        </div>
      </div>
      
    </div>
  );
};
