import React, { useState } from 'react';
import { Play, Square, Timer, Save } from 'lucide-react';
import { LoggingSettings } from '../types';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface LoggingControlsProps {
  settings: LoggingSettings | null;
}

export const LoggingControls: React.FC<LoggingControlsProps> = ({ settings }) => {
  const [localInterval, setLocalInterval] = useState<number>(settings?.interval || 5000);
  const [isUpdating, setIsUpdating] = useState(false);

  const toggleLogging = async () => {
    if (!settings) return;
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'settings', 'logging'), {
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
      await setDoc(doc(db, 'settings', 'logging'), {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Logging Status Card */}
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Logging Status</h3>
          <p className="text-sm text-white/50 mt-1">
            {settings?.isLogging ? "Currently recording data" : "Logging is paused"}
          </p>
        </div>
        <button
          onClick={toggleLogging}
          disabled={isUpdating || !settings}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-lg ${
            settings?.isLogging 
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" 
              : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
          } disabled:opacity-50`}
        >
          {settings?.isLogging ? (
            <><Square size={18} fill="currentColor" /> Stop</>
          ) : (
            <><Play size={18} fill="currentColor" /> Start</>
          )}
        </button>
      </div>

      {/* Interval Setting Card */}
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl flex items-center gap-6">
        <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <Timer size={24} className="text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Logging Interval</h3>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="number"
              value={localInterval}
              onChange={(e) => setLocalInterval(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white w-24 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              min="1000"
              step="1000"
            />
            <span className="text-white/50 text-sm">ms</span>
            <button
              onClick={updateInterval}
              disabled={isUpdating || !settings || localInterval === settings.interval}
              className="ml-auto p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all disabled:opacity-30"
              title="Save Interval"
            >
              <Save size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
