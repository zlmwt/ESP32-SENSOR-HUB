import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, LogOut } from 'lucide-react';
import { ESP32ConnectionGuide } from './ESP32ConnectionGuide';
import { SimulationSettings } from './SimulationSettings';
import { SimulationConfig } from '../services/esp32Simulator';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  simConfig: SimulationConfig;
  onSimConfigChange: (config: Partial<SimulationConfig>) => void;
  isSimulating: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  onLogout,
  simConfig,
  onSimConfigChange,
  isSimulating
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-[#0f0f0f] border-l border-white/10 shadow-2xl z-50 overflow-y-auto"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-xl">
                    <Settings className="text-white/60" size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-white">System Settings</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onLogout}
                    className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-400 hover:text-red-300 flex items-center gap-2 text-sm font-bold mr-4"
                  >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="space-y-10">
                <section>
                  <h3 className="text-sm font-bold text-white/30 uppercase tracking-[0.2em] mb-6">Hardware Integration</h3>
                  <ESP32ConnectionGuide />
                </section>

                <section>
                  <h3 className="text-sm font-bold text-white/30 uppercase tracking-[0.2em] mb-6">Simulation Controls</h3>
                  <SimulationSettings
                    config={simConfig}
                    onConfigChange={onSimConfigChange}
                    isSimulating={isSimulating}
                  />
                </section>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
