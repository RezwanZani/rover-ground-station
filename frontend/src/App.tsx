import React from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import { JoystickPad } from './components/JoystickPad';
import { StatusLights } from './components/StatusLights';
import { HardwareTests } from './components/HardwareTests';
import { Camera, Map, Compass, Cpu } from 'lucide-react';

function App() {
  const { telemetry, connected, sendHardwareTest } = useTelemetry();

  // Telemetry fallback defaults
  const joyX = telemetry?.joy?.axis_x ?? 0.0;
  const joyY = telemetry?.joy?.axis_y ?? 0.0;
  const txActive = telemetry?.radio?.tx_active ?? false;
  const rxPingMs = telemetry?.radio?.rx_ping_ms ?? 0;
  const activeFlag = telemetry?.rover_state?.active_flag ?? 0;
  const batteryV = telemetry?.rover_state?.battery_v ?? 24.5;
  const mode = activeFlag > 0 ? 'HARDWARE TEST OVERRIDE' : 'TELEOP (JOYSTICK)';
  
  // Dummy data for left panel
  const motors = telemetry?.rover_state?.motors ?? [
    { current: 1.2, temp: 35 }, { current: 1.1, temp: 34 }, { current: 1.3, temp: 36 },
    { current: 1.2, temp: 35 }, { current: 1.4, temp: 37 }, { current: 1.1, temp: 34 }
  ];
  const pitch = telemetry?.rover_state?.pitch ?? 2.4;
  const roll = telemetry?.rover_state?.roll ?? -1.2;

  return (
    <div className="min-h-screen bg-black text-slate-100 font-sans flex flex-col h-screen overflow-hidden">
      {/* 1. The Critical Status Bar */}
      <StatusLights 
        txActive={txActive} 
        rxPingMs={rxPingMs} 
        batteryV={batteryV}
        mode={mode}
        wsConnected={connected}
      />

      <div className="flex flex-1 p-2 gap-2 overflow-hidden">
        {/* 3. Left Panel: Telemetry Widgets */}
        <aside className="w-64 lg:w-80 flex flex-col gap-2 shrink-0">
          {/* GPS Map Widget */}
          <div className="bg-[#111111] border border-zinc-800 rounded-lg flex-1 flex flex-col overflow-hidden">
            <div className="p-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
              <Map className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">GPS Map</span>
            </div>
            <div className="flex-1 bg-zinc-900/30 flex items-center justify-center relative border-t border-black">
               <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,_#ffffff_1px,_transparent_1px)]" style={{ backgroundSize: '20px 20px' }}></div>
               <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] border border-white absolute top-1/2 left-1/2" />
               <span className="absolute bottom-2 left-2 text-[10px] font-mono text-zinc-500">LAT: 38.4063 LNG: -110.7919</span>
            </div>
          </div>

          {/* Orientation HUD */}
          <div className="bg-[#111111] border border-zinc-800 rounded-lg h-48 flex flex-col shrink-0">
            <div className="p-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
              <Compass className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">IMU Horizon</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
               <div className="w-32 h-1 bg-zinc-700 relative flex items-center justify-center rounded">
                 <div className="w-16 h-1 bg-green-500 transform rounded shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{ rotate: `${roll}deg` }} />
               </div>
               <div className="flex gap-6 font-mono text-sm mt-4">
                 <div className="flex flex-col items-center">
                   <span className="text-[10px] text-zinc-500">PITCH</span>
                   <span className="text-blue-400">{pitch.toFixed(1)}°</span>
                 </div>
                 <div className="flex flex-col items-center">
                   <span className="text-[10px] text-zinc-500">ROLL</span>
                   <span className="text-blue-400">{roll.toFixed(1)}°</span>
                 </div>
               </div>
            </div>
          </div>

          {/* Motor Diagnostics */}
          <div className="bg-[#111111] border border-zinc-800 rounded-lg h-56 flex flex-col shrink-0">
            <div className="p-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Motor Diag</span>
            </div>
            <div className="flex-1 p-2 grid grid-cols-2 gap-2 overflow-y-auto">
              {motors.map((m, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded p-2 flex flex-col justify-center">
                  <span className="text-[10px] text-zinc-500 font-bold mb-1">DRIVE M{i+1}</span>
                  <div className="flex justify-between font-mono text-xs items-center">
                    <span className="text-yellow-500">{m.current.toFixed(1)}A</span>
                    <span className={m.temp > 40 ? 'text-red-500 animate-pulse' : 'text-blue-400'}>{m.temp}°C</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 2. Main Center Views */}
        <main className="flex-1 bg-[#111111] border border-zinc-800 rounded-lg relative flex flex-col overflow-hidden">
          <div className="p-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2 absolute top-0 w-full z-10">
            <Camera className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Primary Feed [FWD]</span>
            <div className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" />
          </div>
          
          {/* Primary Video Feed Placeholder */}
          <div className="flex-1 bg-zinc-900 flex items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle,_#ffffff_2px,_transparent_2px)]" style={{ backgroundSize: '30px 30px' }}></div>
             <span className="text-zinc-700 font-mono text-2xl font-black tracking-widest z-10">NO SIGNAL</span>
          </div>

          {/* Secondary Camera PiP */}
          <div className="absolute bottom-4 right-4 w-64 h-48 bg-black border-2 border-zinc-700 shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center rounded overflow-hidden">
            <div className="absolute top-1 left-1 bg-black/70 px-1 py-0.5 text-[10px] text-zinc-400 font-mono z-10 border border-zinc-800">ARM CAM</div>
            <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle,_#ffffff_1px,_transparent_1px)]" style={{ backgroundSize: '10px 10px' }}></div>
            <span className="text-zinc-700 font-mono text-sm font-bold tracking-widest z-10">NO SIGNAL</span>
          </div>
        </main>

        {/* 4. Right Panel: Control & Overrides */}
        <aside className="w-64 lg:w-80 flex flex-col gap-2 shrink-0">
          <div className="flex-1 min-h-0">
            <JoystickPad x={joyX} y={joyY} />
          </div>
          <div className="flex-1 min-h-0">
            <HardwareTests 
              onTriggerTest={sendHardwareTest} 
              activeFlag={activeFlag} 
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
