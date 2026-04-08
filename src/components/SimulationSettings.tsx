import React from 'react';
import { Settings2, Thermometer, Wind, Droplets } from 'lucide-react';
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
        <h2 className="text-xl font-bold text-white">Test Mode Settings</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Temperature Range */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium uppercase tracking-wider">
            <Thermometer size={16} />
            <span>Temperature (°C)</span>
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

        {/* Humidity Range */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium uppercase tracking-wider">
            <Droplets size={16} />
            <span>Humidity (%)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] text-white/30 mb-1 uppercase">Min</label>
              <input
                type="number"
                value={config.humidityMin}
                onChange={(e) => onConfigChange({ humidityMin: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-white/30 mb-1 uppercase">Max</label>
              <input
                type="number"
                value={config.humidityMax}
                onChange={(e) => onConfigChange({ humidityMax: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Soil Moisture Range */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium uppercase tracking-wider">
            <Droplets size={16} />
            <span>Soil Moisture (%)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] text-white/30 mb-1 uppercase">Min</label>
              <input
                type="number"
                value={config.soilMin}
                onChange={(e) => onConfigChange({ soilMin: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-white/30 mb-1 uppercase">Max</label>
              <input
                type="number"
                value={config.soilMax}
                onChange={(e) => onConfigChange({ soilMax: Number(e.target.value) })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Noise / Variability Control */}
      <div className="mt-8 pt-8 border-t border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium uppercase tracking-wider">
            <Settings2 size={16} />
            <span>Data Randomness</span>
          </div>
          <span className="text-indigo-400 font-mono text-sm">{(config.noise * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={config.noise}
          onChange={(e) => onConfigChange({ noise: Number(e.target.value) })}
          className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between mt-2 text-[10px] text-white/30 uppercase tracking-tighter">
          <span>Steady</span>
          <span>Normal</span>
          <span>High Variation</span>
        </div>
      </div>

      {!isSimulating && (
        <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-300 text-xs flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          Test mode is currently off. Start it above to see these ranges in action.
        </div>
      )}
    </div>
  );
};
