import React from 'react';
import { format } from 'date-fns';
import { SensorData } from '../types';
import { Thermometer, Wind } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SensorTableProps {
  data: SensorData[];
}

export const SensorTable: React.FC<SensorTableProps> = ({ data }) => {
  return (
    <div className="w-full glass-card rounded-3xl overflow-hidden relative group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/20 via-amber-500/20 to-emerald-500/20" />
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Recent Readings</h3>
          <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-1">Last 10 System Snapshots</p>
        </div>
        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-black text-white/60 uppercase tracking-widest">
          {data.length} Records
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-white/[0.02] text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
            <tr>
              <th className="px-8 py-5 font-black">Time</th>
              <th className="px-8 py-5 font-black">
                <div className="flex items-center gap-2">
                  <Thermometer size={14} className="text-emerald-400" />
                  Temperature
                </div>
              </th>
              <th className="px-8 py-5 font-black">
                <div className="flex items-center gap-2">
                  <Wind size={14} className="text-amber-400" />
                  Gas Level
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
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
                        <img 
                          src="https://picsum.photos/seed/sensor-data/400/200?blur=2" 
                          alt="No data" 
                          className="rounded-2xl opacity-20 grayscale relative z-10"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <p className="text-white/20 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Awaiting System Initialization...</p>
                    </div>
                  </td>
                </motion.tr>
              ) : (
                data.map((log, idx) => (
                  <motion.tr 
                    key={log.id || idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 100, 
                      damping: 15,
                      delay: idx * 0.05 
                    }}
                    layout
                    className="hover:bg-white/[0.03] transition-colors group/row"
                  >
                    <td className="px-8 py-5 text-xs font-mono text-white/50 group-hover/row:text-white/80 transition-colors">
                      {log.timestamp ? (
                        typeof log.timestamp === 'number' 
                          ? format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')
                          : log.timestamp.toDate 
                            ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss')
                            : 'Invalid Date'
                      ) : 'Pending...'}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black font-mono text-emerald-400 text-glow">
                          {log.temperature?.toFixed(2) ?? '0.00'}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono">°C</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black font-mono text-amber-400 text-glow">
                          {log.gas?.toFixed(0) ?? '0'}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono">PPM</span>
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
