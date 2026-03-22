import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { SensorData } from '../types';

interface SensorChartProps {
  data: SensorData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-4 rounded-xl border border-white/10 shadow-2xl">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs font-bold text-white/80">{entry.name}:</span>
              <span className="text-xs font-mono font-bold" style={{ color: entry.color }}>
                {entry.value?.toFixed(1) ?? '0.0'}
                {entry.name.includes('Temp') ? '°C' : ' PPM'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const SensorChart: React.FC<SensorChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const formatted = data.map(d => ({
      ...d,
      time: d.timestamp ? (
        typeof d.timestamp === 'number' 
          ? format(new Date(d.timestamp), 'HH:mm:ss')
          : d.timestamp.toDate 
            ? format(d.timestamp.toDate(), 'HH:mm:ss')
            : '...'
      ) : '...',
      temperature: d.temperature,
      gas: d.gas
    })).reverse();
    setChartData(formatted);
  }, [data]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full h-[500px] glass-card rounded-3xl p-8 relative overflow-hidden group"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 bg-emerald-500 rounded-full" />
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Sensor History</h3>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 glow-emerald" />
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Temperature</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 glow-amber" />
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Gas Level</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="time" 
            stroke="rgba(255,255,255,0.5)" 
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={10}
            fontFamily="JetBrains Mono"
          />
          <YAxis 
            yAxisId="left"
            stroke="rgba(255,255,255,0.5)" 
            fontSize={10}
            tickLine={false}
            axisLine={false}
            fontFamily="JetBrains Mono"
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="rgba(255,255,255,0.5)" 
            fontSize={10}
            tickLine={false}
            axisLine={false}
            fontFamily="JetBrains Mono"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
          <Area 
            yAxisId="left"
            type="monotone" 
            dataKey="temperature" 
            stroke="#10b981" 
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorTemp)"
            name="Temperature"
            animationDuration={1000}
            animationEasing="ease-in-out"
            isAnimationActive={true}
          />
          <Area 
            yAxisId="right"
            type="monotone" 
            dataKey="gas" 
            stroke="#f59e0b" 
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorGas)"
            name="Gas Level"
            animationDuration={1000}
            animationEasing="ease-in-out"
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};
