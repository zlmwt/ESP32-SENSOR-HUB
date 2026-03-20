import React from 'react';
import { format } from 'date-fns';
import { SensorData } from '../types';
import { Thermometer, Wind } from 'lucide-react';

interface SensorTableProps {
  data: SensorData[];
}

export const SensorTable: React.FC<SensorTableProps> = ({ data }) => {
  return (
    <div className="w-full bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 shadow-xl">
      <div className="p-6 border-bottom border-white/10">
        <h3 className="text-lg font-semibold text-white">Last 10 Logs</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 font-medium">Timestamp</th>
              <th className="px-6 py-3 font-medium">
                <div className="flex items-center gap-2">
                  <Thermometer size={14} className="text-emerald-400" />
                  Temp (°C)
                </div>
              </th>
              <th className="px-6 py-3 font-medium">
                <div className="flex items-center gap-2">
                  <Wind size={14} className="text-amber-400" />
                  Gas Level
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-white/30 italic">
                  No data logged yet...
                </td>
              </tr>
            ) : (
              data.map((log, idx) => (
                <tr key={log.id || idx} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm text-white/70">
                    {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'Pending...'}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-emerald-400">
                    {log.temperature.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-amber-400">
                    {log.gas.toFixed(0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
