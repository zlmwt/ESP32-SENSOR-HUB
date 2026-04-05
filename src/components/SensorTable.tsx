import React from 'react';
import { format } from 'date-fns';
import { SensorData } from '../types';
import { Droplets, Thermometer, Wind, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SensorTableProps {
  data: SensorData[];
}

export const SensorTable: React.FC<SensorTableProps> = ({ data }) => {
  return (
    <div className="w-full glass-card rounded-[2.5rem] overflow-hidden relative group border border-white/5 shadow-2xl">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/40 via-blue-500/40 to-amber-500/40" />
      <div className="p-10 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/[0.01]">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">System Logs</h3>
          <p className="text-[10px] text-white/40 font-mono uppercase tracking-[0.3em] mt-1">Real-time Data Stream • Last 20 Snapshots</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-5 py-2.5 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {data.length} Records Active
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/[0.03] text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">
            <tr>
              <th className="px-10 py-6 font-black border-b border-white/5">Time Sequence</th>
              <th className="px-10 py-6 font-black border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Thermometer size={14} className="text-emerald-400" />
                  Temp
                </div>
              </th>
              <th className="px-10 py-6 font-black border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Droplets size={14} className="text-blue-400" />
                  Hum
                </div>
              </th>
              <th className="px-10 py-6 font-black border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Wind size={14} className="text-amber-400" />
                  Gas
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {data.length === 0 ? (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td colSpan={4} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center gap-8">
                      <div className="relative group/empty">
                        <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full group-hover/empty:bg-emerald-500/20 transition-all duration-1000" />
                        <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative z-10">
                          <RefreshCw className="text-white/20 animate-spin-slow" size={40} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-white/40 font-black text-sm uppercase tracking-[0.4em]">Awaiting Data Stream</p>
                        <p className="text-white/20 font-mono text-[10px] uppercase tracking-widest">Connect your ESP32 or enable simulation mode</p>
                      </div>
                    </div>
                  </td>
                </motion.tr>
              ) : (
                data.map((log, idx) => (
                  <motion.tr 
                    key={log.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ 
                      duration: 0.4,
                      delay: idx * 0.03 
                    }}
                    layout
                    className="hover:bg-white/[0.04] transition-all duration-300 group/row"
                  >
                    <td className="px-10 py-6 text-xs font-mono text-white/40 group-hover/row:text-white/80 transition-colors">
                      {log.timestamp ? (
                        typeof log.timestamp === 'string'
                          ? log.timestamp
                          : typeof log.timestamp === 'number' 
                            ? format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')
                            : log.timestamp.toDate 
                              ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss')
                              : 'Invalid Date'
                      ) : 'Pending...'}
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-mono text-emerald-400 text-glow group-hover/row:scale-110 transition-transform origin-left">
                          {log.temperature?.toFixed(1) ?? '0.0'}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono uppercase">°C</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-mono text-blue-400 text-glow group-hover/row:scale-110 transition-transform origin-left">
                          {log.humidity?.toFixed(1) ?? '0.0'}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono uppercase">%</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-mono text-amber-400 text-glow group-hover/row:scale-110 transition-transform origin-left">
                          {log.gas?.toFixed(0) ?? '0'}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono uppercase">PPM</span>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
};
