import React, { useState, useEffect } from 'react';
import { Play, Square, Timer, Save, Bell, Send } from 'lucide-react';
import { LoggingSettings, NotificationFrequency } from '../types';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';
import { motion } from 'motion/react';

interface LoggingControlsProps {
  settings: LoggingSettings | null;
  onTestNotification: () => void;
}

export const LoggingControls: React.FC<LoggingControlsProps> = ({ settings, onTestNotification }) => {
  const [localInterval, setLocalInterval] = useState<number>(settings?.interval || 5000);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (settings?.interval) setLocalInterval(settings.interval);
  }, [settings?.interval]);

  const toggleLogging = async () => {
    if (!settings) return;
    setIsUpdating(true);
    try {
      await set(ref(db, 'settings/logging'), {
        ...settings,
        isLogging: !settings.isLogging,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      console.error("Error toggling logging:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateInterval = async () => {
    if (!settings) return;
    setIsUpdating(true);
    try {
      await set(ref(db, 'settings/logging'), {
        ...settings,
        interval: localInterval,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating interval:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateFrequency = async (freq: NotificationFrequency) => {
    if (!settings) return;
    setIsUpdating(true);
    try {
      await set(ref(db, 'settings/logging'), {
        ...settings,
        notificationFrequency: freq,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating frequency:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
      {/* Logging Status Card */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="glass-card rounded-3xl p-8 flex items-center justify-between relative overflow-hidden group"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50 group-hover:bg-emerald-500 transition-colors" />
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Data Recording</h3>
          <p className="text-xs text-white/60 font-mono uppercase tracking-widest mt-1">
            {settings?.isLogging ? "Recording data live" : "Recording paused"}
          </p>
        </div>
        <button
          onClick={toggleLogging}
          disabled={isUpdating || !settings}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-500 shadow-2xl ${
            settings?.isLogging 
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 glow-red" 
              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 glow-emerald"
          } disabled:opacity-50`}
        >
          {settings?.isLogging ? (
            <><Square size={18} fill="currentColor" /> Stop</>
          ) : (
            <><Play size={18} fill="currentColor" /> Start</>
          )}
        </button>
      </motion.div>

      {/* Interval Setting Card */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="glass-card rounded-3xl p-8 flex items-center gap-8 relative overflow-hidden group"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 group-hover:bg-amber-500 transition-colors" />
        <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 glow-amber">
          <Timer size={28} className="text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter text-nowrap">Logging Interval</h3>
          <div className="flex items-center gap-4 mt-2">
            <div className="relative">
              <input
                type="number"
                value={localInterval}
                onChange={(e) => setLocalInterval(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-lg w-28 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                min="1000"
                step="1000"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/40 uppercase tracking-widest pointer-events-none">MS</span>
            </div>
            <button
              onClick={updateInterval}
              disabled={isUpdating || !settings || localInterval === settings.interval}
              className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all disabled:opacity-20 group/btn"
              title="Save Changes"
            >
              <Save size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Notification Frequency Card */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="glass-card rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden group"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50 group-hover:bg-blue-500 transition-colors" />
        <div className="flex items-center gap-4 mb-4">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 glow-blue">
            <Bell size={20} className="text-blue-400" />
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Alert Frequency</h3>
        </div>
        <div className="flex gap-2">
          {(['minute', 'hour', 'day'] as NotificationFrequency[]).map((freq) => (
            <button
              key={freq}
              onClick={() => updateFrequency(freq)}
              disabled={isUpdating || !settings}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                settings?.notificationFrequency === freq
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30 glow-blue"
                  : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
              }`}
            >
              {freq}
            </button>
          ))}
        </div>
        <button
          onClick={onTestNotification}
          disabled={isUpdating || !settings}
          className="mt-4 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center justify-center gap-2"
        >
          <Send size={14} />
          Test Telegram
        </button>
      </motion.div>
    </div>
  );
};
