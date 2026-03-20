import React, { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';
import { SensorData } from '../types';

interface SensorChartProps {
  data: SensorData[];
}

export const SensorChart: React.FC<SensorChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const formatted = data.map(d => ({
      ...d,
      time: d.timestamp?.toDate ? format(d.timestamp.toDate(), 'HH:mm:ss') : '...',
      temperature: d.temperature,
      gas: d.gas
    })).reverse(); // Show chronological order
    setChartData(formatted);
  }, [data]);

  return (
    <div className="w-full h-[400px] bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4">Sensor Comparison</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="time" 
            stroke="rgba(255,255,255,0.5)" 
            fontSize={12}
          />
          <YAxis 
            yAxisId="left"
            stroke="#10b981" 
            fontSize={12}
            label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 12 }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#f59e0b" 
            fontSize={12}
            label={{ value: 'Gas Level', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="temperature" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="DS18B20 Temp"
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="gas" 
            stroke="#f59e0b" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="MQ2 Gas"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
