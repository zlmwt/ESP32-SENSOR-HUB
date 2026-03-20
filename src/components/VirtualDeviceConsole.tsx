import React from 'react';
import { Terminal, Cpu } from 'lucide-react';
import { SimulatedData } from '../services/esp32Simulator';
import { format } from 'date-fns';

interface VirtualDeviceConsoleProps {
  logs: SimulatedData[];
  isActive: boolean;
}

export const VirtualDeviceConsole: React.FC<VirtualDeviceConsoleProps> = ({ logs, isActive }) => {
  return (
    <div className="bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[300px]">
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2 text-xs font-mono text-white/50">
          <Cpu size={14} className={isActive ? "text-emerald-500 animate-pulse" : "text-white/20"} />
          <span>VIRTUAL_ESP32_SERIAL_OUT</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/30"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/30"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/30"></div>
        </div>
      </div>
      
      <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 scrollbar-hide">
        {logs.length === 0 ? (
          <div className="text-white/20 italic">Waiting for device output...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-white/30">[{format(log.timestamp, 'HH:mm:ss')}]</span>
              <span className="text-emerald-400">INFO:</span>
              <span className="text-white/80">
                Pushing data: temp={log.temperature.toFixed(2)}°C, gas={log.gas.toFixed(0)}ppm
              </span>
            </div>
          ))
        )}
      </div>
      
      <div className="bg-white/5 px-4 py-2 text-[10px] font-mono text-white/30 flex items-center gap-2">
        <Terminal size={10} />
        <span>BAUD: 115200 | STATUS: {isActive ? 'CONNECTED' : 'DISCONNECTED'}</span>
      </div>
    </div>
  );
};
