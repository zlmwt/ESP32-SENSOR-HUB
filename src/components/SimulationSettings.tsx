import React from 'react';
import { Settings2, Thermometer, Wind } from 'lucide-react';
import { SimulationConfig } from '../services/esp32Simulator';

interface SimulationSettingsProps {
  config: SimulationConfig;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
  isSimulating: boolean;
}

export const SimulationSettings: React.FC<SimulationSettingsProps> = ({ config, onConfigChange, isSimulating }) => {
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <Settings2 className="text-indigo-400" size={24} />
        </div>
        <h2 className="text-xl font-bold text-white">Simulation Customization</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Temperature Range */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium uppercase tracking-wider">
            <Thermometer size={16} />
            <span>Temperature Range (°C)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] text-white/30 mb-1 uppercase">Min</label>
              <input
                type="number"
                value={config.tempMin}
                onChange={(e) => onConfigChange({ tempMin: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-white/30 mb-1 uppercase">Max</label>
              <input
                type="number"
                value={config.tempMax}
                onChange={(e) => onConfigChange({ tempMax: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Gas Range */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium uppercase tracking-wider">
            <Wind size={16} />
            <span>Gas Range (PPM)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] text-white/30 mb-1 uppercase">Min</label>
              <input
                type="number"
                value={config.gasMin}
                onChange={(e) => onConfigChange({ gasMin: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-white/30 mb-1 uppercase">Max</label>
              <input
                type="number"
                value={config.gasMax}
                onChange={(e) => onConfigChange({ gasMax: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {!isSimulating && (
        <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-300 text-xs flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          Simulation is currently inactive. Start simulation above to see these ranges in action.
        </div>
      )}
    </div>
  );
};
