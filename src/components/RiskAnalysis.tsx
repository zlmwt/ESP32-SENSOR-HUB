import React from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, ShieldAlert, Thermometer, Wind } from 'lucide-react';
import { SensorData } from '../types';
import { motion, AnimatePresence } from 'motion/react';

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
    <AnimatePresence mode="wait">
      <motion.div 
        key={overallRiskLevel}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className={`rounded-3xl p-8 border ${config.borderColor} ${config.bgColor} glass-card shadow-2xl mb-12 relative overflow-hidden group transition-all duration-700`}
      >
        {/* Animated scanline effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent h-[200%] w-full animate-scanline pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start gap-8 relative z-10">
          <motion.div 
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            className={`p-5 rounded-2xl bg-white/5 border border-white/10 ${config.color.replace('text-', 'glow-')} shadow-lg`}
          >
            {config.icon}
          </motion.div>
          <div className="flex-1 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className={`text-3xl font-black ${config.color} uppercase tracking-tighter italic`}>
                  {config.level} <span className="text-white/40 not-italic font-normal ml-2">Status</span>
                </h3>
                <p className="text-white/60 text-xs font-mono uppercase tracking-[0.3em] mt-1">
                  Safety Status
                </p>
              </div>
              <div className="flex gap-3">
                <motion.div 
                  layout
                  className={`flex flex-col items-end px-4 py-2 rounded-xl border ${tempRisk === 'Normal' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'}`}
                >
                  <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Temperature</span>
                  <span className={`text-xs font-mono font-bold ${tempRisk === 'Normal' ? 'text-emerald-400' : 'text-red-400'}`}>{tempRisk}</span>
                </motion.div>
                <motion.div 
                  layout
                  className={`flex flex-col items-end px-4 py-2 rounded-xl border ${gasRisk === 'Normal' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'}`}
                >
                  <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Gas Level</span>
                  <span className={`text-xs font-mono font-bold ${gasRisk === 'Normal' ? 'text-emerald-400' : 'text-red-400'}`}>{gasRisk}</span>
                </motion.div>
              </div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card bg-black/40 rounded-2xl p-6 border-white/10 mb-8"
            >
              <p className="text-white/90 text-lg font-medium leading-relaxed italic">
                "{config.message}"
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div 
                whileHover={{ scale: 1.02, x: 5 }}
                className="glass-card bg-white/5 rounded-2xl p-5 border-white/10 group/card hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Thermometer size={16} className="text-emerald-400" />
                  <p className="text-[10px] text-white/60 uppercase font-black tracking-widest">Temperature</p>
                </div>
                <p className="text-sm text-white/80 font-medium">
                  Current reading <span className="text-emerald-400 font-mono font-bold">{temperature?.toFixed(1) ?? '0.0'}°C</span> is {tempRisk.toLowerCase()}. 
                  {tempRisk === 'Normal' ? ' Temperature is stable and safe.' : ' Please check the room temperature.'}
                </p>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.02, x: 5 }}
                className="glass-card bg-white/5 rounded-2xl p-5 border-white/10 group/card hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Wind size={16} className="text-amber-400" />
                  <p className="text-[10px] text-white/60 uppercase font-black tracking-widest">Gas Level</p>
                </div>
                <p className="text-sm text-white/80 font-medium">
                  Gas level <span className="text-amber-400 font-mono font-bold">{gas?.toFixed(0) ?? '0'} PPM</span> is {gasRisk.toLowerCase()}.
                  {gasRisk === 'Normal' ? ' Air quality is clean and safe.' : ' Please ensure proper ventilation.'}
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
