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
import { getTimestamp, parseSensorValue } from '../utils/sensorUtils';

interface SensorChartProps {
  data: SensorData[];
  dataKey: keyof SensorData;
  color: string;
  title: string;
  unit: string;
  icon: React.ReactNode;
}

const CustomTooltip = ({ active, payload, label, unit, icon }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-4 rounded-xl border border-white/10 shadow-2xl backdrop-blur-2xl">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-3">
              {icon && (
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  {React.cloneElement(icon as React.ReactElement, { size: 14, style: { color: entry.color } })}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{entry.name}</span>
                <span className="text-sm font-mono font-black" style={{ color: entry.color }}>
                  {entry.value?.toFixed(1) ?? '0.0'}{unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const SensorChart: React.FC<SensorChartProps> = ({ data, dataKey, color, title, unit, icon }) => {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const formatted = data.map(d => {
      const ts = getTimestamp(d.timestamp);
      const timeStr = ts ? format(new Date(ts), 'HH:mm:ss') : '...';
      
      return {
        ...d,
        time: timeStr,
        value: parseSensorValue(d[dataKey])
      };
    }).reverse();
    setChartData(formatted);
  }, [data, dataKey]);

  const gradientId = `color-${dataKey}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full h-[350px] glass-card rounded-[2.5rem] p-8 relative overflow-hidden group border border-white/5 hover:border-white/20 transition-all duration-500"
    >
      {/* Background Glow */}
      <div 
        className="absolute -top-24 -right-24 w-64 h-64 blur-[120px] opacity-20 pointer-events-none transition-all duration-700 group-hover:opacity-30"
        style={{ backgroundColor: color }}
      />
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
            {React.cloneElement(icon as React.ReactElement, { size: 20, style: { color } })}
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter italic leading-none">{title}</h3>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-[0.2em] mt-1">Historical Analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Live</span>
        </div>
      </div>
      
      <div className="h-[200px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="time" 
              stroke="rgba(255,255,255,0.3)" 
              fontSize={9}
              tickLine={false}
              axisLine={false}
              dy={10}
              fontFamily="JetBrains Mono"
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="rgba(255,255,255,0.3)" 
              fontSize={9}
              tickLine={false}
              axisLine={false}
              fontFamily="JetBrains Mono"
              tickFormatter={(val) => `${val}${unit === ' PPM' ? '' : unit}`}
            />
            <Tooltip 
              content={<CustomTooltip unit={unit} icon={icon} />} 
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }} 
              isAnimationActive={false}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={4}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              name={title}
              animationDuration={1500}
              animationEasing="ease-in-out"
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
