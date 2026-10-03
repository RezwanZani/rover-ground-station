import React from 'react';
import { Settings2, AlertTriangle, ChevronRight } from 'lucide-react';

interface HardwareTestsProps {
  onTriggerTest: (testId: number) => void;
  activeFlag: number;
}

export const HardwareTests: React.FC<HardwareTestsProps> = ({ onTriggerTest, activeFlag }) => {
  const tests = [
    { id: 1, label: 'J1-BASE' },
    { id: 2, label: 'J2-SHOULDER' },
    { id: 3, label: 'J3-ELBOW' },
    { id: 4, label: 'J4-WRIST' },
    { id: 5, label: 'L-DRIVE' },
    { id: 6, label: 'R-DRIVE' },
  ];

  return (
    <div className="bg-[#111111] rounded-lg border border-zinc-800 flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Override Panel</h2>
        </div>
        {activeFlag > 0 && (
          <AlertTriangle className="w-4 h-4 text-yellow-500 animate-pulse" />
        )}
      </div>

      <div className="p-4 flex-grow">
        <div className="grid grid-cols-2 gap-2 h-full content-start">
          {tests.map((test) => {
            const isActive = activeFlag === test.id;
            return (
              <button
                key={test.id}
                onClick={() => onTriggerTest(test.id)}
                className={`
                  flex items-center justify-between p-3 rounded font-bold border transition-all text-sm
                  ${isActive 
                    ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]' 
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 active:bg-zinc-700'
                  }
                `}
              >
                <span>{test.label}</span>
                <ChevronRight className={`w-4 h-4 ${isActive ? 'text-black' : 'text-zinc-600'}`} />
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="p-2 border-t border-zinc-800 bg-black text-center">
        <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
          Injects JSON interrupt payload (3s lock)
        </p>
      </div>
    </div>
  );
};
