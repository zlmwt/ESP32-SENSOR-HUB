import React from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { SensorData } from '../types';

interface RiskAnalysisProps {
  currentData: SensorData | undefined;
}

type RiskLevel = 'Normal' | 'Low Risk' | 'Medium Risk' | 'Dangerous';

interface RiskInfo {
  level: RiskLevel;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  message: string;
}

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ currentData }) => {
  if (!currentData) return null;

  const { temperature, gas } = currentData;

  const getTemperatureRisk = (temp: number): RiskLevel => {
    if (temp >= 18 && temp <= 30) return 'Normal';
    if ((temp > 30 && temp <= 40) || (temp >= 10 && temp < 18)) return 'Low Risk';
    if ((temp > 40 && temp <= 50) || (temp >= 0 && temp < 10)) return 'Medium Risk';
    return 'Dangerous';
  };

  const getGasRisk = (ppm: number): RiskLevel => {
    if (ppm < 200) return 'Normal';
    if (ppm >= 200 && ppm < 400) return 'Low Risk';
    if (ppm >= 400 && ppm < 800) return 'Medium Risk';
    return 'Dangerous';
  };

  const tempRisk = getTemperatureRisk(temperature);
  const gasRisk = getGasRisk(gas);

  const riskPriority: Record<RiskLevel, number> = {
    'Normal': 0,
    'Low Risk': 1,
    'Medium Risk': 2,
    'Dangerous': 3,
  };

  const overallRiskLevel: RiskLevel = riskPriority[tempRisk] >= riskPriority[gasRisk] ? tempRisk : gasRisk;

  const riskConfig: Record<RiskLevel, RiskInfo> = {
    'Normal': {
      level: 'Normal',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      icon: <CheckCircle className="text-emerald-400" size={24} />,
      message: 'All systems are within safe operating parameters. No action required.',
    },
    'Low Risk': {
      level: 'Low Risk',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      icon: <AlertCircle className="text-amber-400" size={24} />,
      message: 'Minor deviation detected. Monitor the situation closely.',
    },
    'Medium Risk': {
      level: 'Medium Risk',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
      icon: <AlertTriangle className="text-orange-400" size={24} />,
      message: 'Significant deviation from normal levels. Investigate potential causes.',
    },
    'Dangerous': {
      level: 'Dangerous',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      icon: <ShieldAlert className="text-red-400" size={24} />,
      message: 'CRITICAL: Levels are outside safe limits. Immediate action may be required!',
    },
  };

  const config = riskConfig[overallRiskLevel];

  return (
    <div className={`rounded-2xl p-6 border ${config.borderColor} ${config.bgColor} backdrop-blur-md shadow-xl mb-8 transition-all duration-500`}>
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          {config.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-xl font-bold ${config.color} uppercase tracking-wider`}>
              Overall Status: {config.level}
            </h3>
            <div className="flex gap-2">
              <span className={`text-[10px] px-2 py-1 rounded-full border ${tempRisk === 'Normal' ? 'border-emerald-500/30 text-emerald-400' : tempRisk === 'Low Risk' ? 'border-amber-500/30 text-amber-400' : tempRisk === 'Medium Risk' ? 'border-orange-500/30 text-orange-400' : 'border-red-500/30 text-red-400'} bg-black/20`}>
                TEMP: {tempRisk}
              </span>
              <span className={`text-[10px] px-2 py-1 rounded-full border ${gasRisk === 'Normal' ? 'border-emerald-500/30 text-emerald-400' : gasRisk === 'Low Risk' ? 'border-amber-500/30 text-amber-400' : gasRisk === 'Medium Risk' ? 'border-orange-500/30 text-orange-400' : 'border-red-500/30 text-red-400'} bg-black/20`}>
                GAS: {gasRisk}
              </span>
            </div>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            {config.message}
          </p>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] text-white/30 uppercase font-bold mb-1">Temperature Analysis</p>
              <p className="text-xs text-white/60">
                {temperature.toFixed(1)}°C is {tempRisk.toLowerCase()}. 
                {tempRisk === 'Normal' ? ' Ideal for standard operation.' : ' Check environmental controls.'}
              </p>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] text-white/30 uppercase font-bold mb-1">Gas Analysis</p>
              <p className="text-xs text-white/60">
                {gas.toFixed(0)} PPM is {gasRisk.toLowerCase()}.
                {gasRisk === 'Normal' ? ' Air quality is clean.' : ' Ensure proper ventilation.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
