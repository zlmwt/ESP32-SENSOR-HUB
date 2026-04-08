import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { SimulatedData } from '../services/esp32Simulator';
import { format } from 'date-fns';

interface VirtualDeviceConsoleProps {
  logs: SimulatedData[];
  isActive: boolean;
}

export const VirtualDeviceConsole: React.FC<VirtualDeviceConsoleProps> = ({ logs, isActive }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-card rounded-3xl overflow-hidden border-white/5 shadow-2xl group flex flex-col h-[400px]">
      <div className="bg-white/[0.02] px-8 py-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
          </div>
          <div className="h-4 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-emerald-400" />
            <h3 className="text-xs font-black text-white/60 uppercase tracking-widest">Device Output</h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500 ${isActive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isActive ? 'Live Link' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 font-mono text-sm bg-black/40 relative"
      >
        {/* Scanline overlay */}
        <div className="absolute inset-0 bg-scanline pointer-events-none opacity-5" />
        
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/10">
            <Terminal size={48} className="mb-4 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">Initializing Kernel...</p>
          </div>
        ) : (
          <div className="space-y-2 relative z-10">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-4 group/line">
                <span className="text-white/20 select-none w-8 text-right text-[10px] pt-1">{idx + 1}</span>
                <div className="flex-1">
                  <span className="text-emerald-500/50 mr-2">[{format(log.timestamp, 'HH:mm:ss.SSS')}]</span>
                  <span className="text-emerald-400 mr-2">INFO:</span>
                  <span className="text-white/80 group-hover/line:text-white transition-colors leading-relaxed">
                    Pushing data: temp={Number(log.temperature || 0).toFixed(2)}°C, hum={Number(log.humidity || 0).toFixed(1)}%, soil={Number(log.soil || 0).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
            <div className="flex gap-4 animate-pulse">
              <span className="text-white/20 select-none w-8 text-right text-[10px] pt-1">{logs.length + 1}</span>
              <div className="flex-1">
                <span className="text-emerald-400">_</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white/[0.02] px-8 py-3 border-t border-white/5 flex justify-between items-center">
        <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">System Architecture: XTENSA LX6</p>
        <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Baud: 115200 | Memory: 520KB SRAM</p>
      </div>
    </div>
  );
};
