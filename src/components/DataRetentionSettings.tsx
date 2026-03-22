import React, { useState, useEffect } from 'react';
import { Database, Trash2, Save, Clock, AlertTriangle, X, Check } from 'lucide-react';
import { LoggingSettings } from '../types';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface DataRetentionSettingsProps {
  settings: LoggingSettings | null;
}

export const DataRetentionSettings: React.FC<DataRetentionSettingsProps> = ({ settings }) => {
  const [localRetention, setLocalRetention] = useState<number>(settings?.retentionDays || 7);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    if (settings?.retentionDays) setLocalRetention(settings.retentionDays);
  }, [settings?.retentionDays]);

  const updateRetention = async () => {
    if (!settings) return;
    setIsUpdating(true);
    try {
      await set(ref(db, 'settings/logging'), {
        ...settings,
        retentionDays: localRetention,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating retention:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const clearAllData = async () => {
    setIsUpdating(true);
    try {
      await set(ref(db, 'sensor_logs'), null);
      setShowConfirmClear(false);
    } catch (err) {
      console.error("Error clearing data:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const retentionOptions = [
    { label: '1 Day', value: 1 },
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
    { label: 'Forever', value: 0 },
  ];

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <Database className="text-red-400" size={24} />
          </div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Data Management</h2>
        </div>
        
        <button
          onClick={() => setShowConfirmClear(true)}
          className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 transition-all glow-red group"
          title="Clear All Data"
        >
          <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium uppercase tracking-wider mb-4">
            <Clock size={16} />
            <span>Retention Period</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {retentionOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setLocalRetention(option.value)}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  localRetention === option.value
                    ? "bg-red-500/20 text-red-400 border-red-500/30 glow-red"
                    : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
              {localRetention === 0 
                ? "Data will be stored indefinitely. This may increase database size over time."
                : `Logs older than ${localRetention} days will be automatically purged from the database.`}
            </p>
          </div>
          <button
            onClick={updateRetention}
            disabled={isUpdating || !settings || localRetention === settings.retentionDays}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-20 glow-red"
          >
            <Save size={16} />
            Save
          </button>
        </div>

        <AnimatePresence>
          {showConfirmClear && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertTriangle className="text-red-400" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Clear All Sensor Data?</h4>
                    <p className="text-[10px] text-white/60 uppercase tracking-widest leading-relaxed">
                      This action is permanent and cannot be undone. All historical logs will be deleted immediately.
                    </p>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={clearAllData}
                        disabled={isUpdating}
                        className="flex-1 bg-red-500 hover:bg-red-400 text-black font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Check size={14} />
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setShowConfirmClear(false)}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {settings?.retentionDays !== undefined && !showConfirmClear && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-[10px] flex items-center gap-3 uppercase tracking-widest font-bold">
            <Trash2 size={16} className="shrink-0" />
            Cleanup runs automatically when the system is active.
          </div>
        )}
      </div>
    </div>
  );
};
