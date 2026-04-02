import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ref, 
  onValue, 
  set, 
  push, 
  query as dbQuery, 
  orderByChild, 
  limitToLast,
  serverTimestamp as dbServerTimestamp,
  remove,
  get,
  endAt,
  update,
  off
} from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import { SensorData, LoggingSettings } from './types';
import { SensorChart } from './components/SensorChart';
import { SensorTable } from './components/SensorTable';
import { LoggingControls } from './components/LoggingControls';
import { RiskAnalysis } from './components/RiskAnalysis';
import { LoginPage } from './components/LoginPage';
import { VirtualDeviceConsole } from './components/VirtualDeviceConsole';
import { ESP32Simulator, SimulatedData, SimulationConfig } from './services/esp32Simulator';
import { Activity, Thermometer, Wind, RefreshCw, Cpu, Settings, LogOut, Send, AlertTriangle } from 'lucide-react';
import { ESP32ConnectionGuide } from './components/ESP32ConnectionGuide';
import { SimulationSettings } from './components/SimulationSettings';
import { DataRetentionSettings } from './components/DataRetentionSettings';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('esp32_auth') === 'true';
  });
  const [logs, setLogs] = useState<SensorData[]>([]);
  const [settings, setSettings] = useState<LoggingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [simLogs, setSimLogs] = useState<SimulatedData[]>([]);
  const [simConfig, setSimConfig] = useState<SimulationConfig>({
    tempMin: 22,
    tempMax: 30,
    gasMin: 200,
    gasMax: 6000,
    noise: 0.5
  });
  const [simulator] = useState(() => new ESP32Simulator((data) => {
    setSimLogs(prev => [data, ...prev].slice(0, 20));
  }));
  const [lastNotificationTime, setLastNotificationTime] = useState<Record<string, number>>({});
  const [lastRiskLevel, setLastRiskLevel] = useState<string>('Normal');
  const [lastLoggingState, setLastLoggingState] = useState<boolean | null>(null);
  const [isDeviceConnected, setIsDeviceConnected] = useState<boolean>(false);
  const [manualData, setManualData] = useState({ temperature: 25, gas: 200 });
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  // Initialize Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("[App] Firebase authenticated:", user.uid);
        setIsFirebaseReady(true);
      } else {
        console.log("[App] Firebase unauthenticated");
        setIsFirebaseReady(false);
        // If we are supposed to be authenticated but Firebase says no, try to sign in
        if (isAuthenticated) {
          signInAnonymously(auth).catch(err => console.error("Firebase Auth Error:", err));
        }
      }
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = async () => {
    try {
      await signInAnonymously(auth);
      localStorage.setItem('esp32_auth', 'true');
      setIsAuthenticated(true);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('esp32_auth');
    setIsAuthenticated(false);
    setIsSettingsOpen(false);
  };

  // Update simulator config when state changes
  useEffect(() => {
    simulator.setConfig(simConfig);
  }, [simConfig, simulator]);

  // Helper to check if notification should be sent based on frequency
  const shouldNotify = (type: string, frequency: 'minute' | 'hour' | 'day') => {
    const now = Date.now();
    const lastTime = lastNotificationTime[type] || 0;
    const cooldowns = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000
    };
    return now - lastTime > cooldowns[frequency];
  };

  const sendNotification = async (payload: any) => {
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          timestamp: Date.now(),
          frequency: settings?.notificationFrequency || 'minute'
        })
      });
      setLastNotificationTime(prev => ({ ...prev, [payload.type || 'alert']: Date.now() }));
    } catch (err) {
      console.error("Notification error:", err);
    }
  };

  // Connection Monitor
  useEffect(() => {
    if (logs.length === 0) {
      setIsDeviceConnected(false);
      return;
    }
    const lastLog = logs[0];
    const lastLogTime = lastLog.timestamp?.toMillis ? lastLog.timestamp.toMillis() : (typeof lastLog.timestamp === 'number' ? lastLog.timestamp : Date.now());
    const isConnected = Date.now() - lastLogTime < 30000; // 30 seconds threshold
    
    if (isConnected !== isDeviceConnected) {
      setIsDeviceConnected(isConnected);
      if (isAuthenticated) {
        sendNotification({
          type: 'status',
          level: isConnected ? 'Connected' : 'Disconnected',
          timestamp: Date.now()
        });
      }
    }
  }, [logs, isDeviceConnected, isAuthenticated]);

  // Logging State Monitor
  useEffect(() => {
    if (settings && lastLoggingState !== null && settings.isLogging !== lastLoggingState) {
      console.log(`[App] Logging state changed to: ${settings.isLogging}. Sending notification...`);
      sendNotification({
        type: 'logging',
        level: settings.isLogging ? 'Started' : 'Stopped',
        timestamp: Date.now()
      });
    }
    // Initialize lastLoggingState with the first settings load
    if (settings && lastLoggingState === null) {
      setLastLoggingState(settings.isLogging);
    } else if (settings) {
      setLastLoggingState(settings.isLogging);
    }
  }, [settings?.isLogging]);

  // Risk Analysis Logic
  const getRiskLevel = (temp: number, ppm: number) => {
    const getTempRisk = (t: number) => {
      if (t >= 18 && t <= 30) return 0; // Normal
      if ((t > 30 && t <= 40) || (t >= 10 && t < 18)) return 1; // Low
      if ((t > 40 && t <= 50) || (t >= 0 && t < 10)) return 2; // Medium
      return 3; // Dangerous
    };
    const getGasRisk = (p: number) => {
      if (p < 400) return 0; // Clean Air (200-400)
      if (p >= 400 && p < 1000) return 1; // Normal Indoor (300-800)
      if (p >= 1000 && p < 5000) return 2; // Smoke Detected (1000-5000)
      return 3; // Gas Leak (5000+)
    };
    const levels = ['Normal', 'Low Risk', 'Medium Risk', 'Dangerous'];
    const maxRisk = Math.max(getTempRisk(temp), getGasRisk(ppm));
    return levels[maxRisk];
  };

  // Notification Monitor (Removed client-side alert logic as it's now handled server-side via API)
  // This prevents duplicate notifications and ensures alerts work when tab is closed.

  // Realtime Database listeners
  useEffect(() => {
    if (!isAuthenticated || !isFirebaseReady) {
      if (!isAuthenticated) setIsLoading(false);
      return;
    }

    // Listen to settings
    const settingsRef = ref(db, 'settings/logging');
    const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
      console.log("[App] Settings updated from DB:", snapshot.val());
      if (snapshot.exists()) {
        const data = snapshot.val() as LoggingSettings;
        if (data.retentionDays === undefined) {
          // Add default retention if missing
          set(settingsRef, {
            ...data,
            retentionDays: 7,
            lastUpdated: dbServerTimestamp()
          });
        }
        setSettings(data);
      } else {
        // Initialize settings if they don't exist
        set(settingsRef, {
          isLogging: false,
          interval: 5000,
          notificationFrequency: 'minute',
          retentionDays: 7,
          lastUpdated: dbServerTimestamp()
        });
      }
      setIsLoading(false);
    }, (error) => {
      console.error("[App] Settings listener error:", error);
      setIsLoading(false); // Stop loading even on error
    });

    return () => settingsUnsubscribe();
  }, [isAuthenticated, isFirebaseReady]);

  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());

  // Reset session start time when logging is toggled on
  useEffect(() => {
    if (settings?.isLogging) {
      // Use a 30s buffer to account for clock skew between client and server
      setSessionStartTime(Date.now() - 30000);
    }
  }, [settings?.isLogging]);

  useEffect(() => {
    if (!isAuthenticated || !isFirebaseReady) return;

    // Listen to logs (last 20 to give more context but filterable)
    const logsRef = ref(db, 'sensor_logs');
    const logsQuery = dbQuery(
      logsRef,
      orderByChild('timestamp'),
      limitToLast(20)
    );
    const logsUnsubscribe = onValue(logsQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data: SensorData[] = [];
        snapshot.forEach((childSnapshot) => {
          const val = childSnapshot.val();
          // Filter: If logging is active, only show logs from this session
          // If not logging, show historical data
          if (!settings?.isLogging || (val.timestamp && val.timestamp >= sessionStartTime)) {
            data.push({
              id: childSnapshot.key as string,
              ...val
            });
          }
        });
        const reversedData = data.reverse();
        setLogs(reversedData);
      } else {
        setLogs([]);
      }
    }, (error) => {
      console.error("[App] Logs listener error:", error);
    });

    return () => logsUnsubscribe();
  }, [isAuthenticated, isFirebaseReady, settings?.isLogging, sessionStartTime]);

  // Data Retention Cleanup Logic
  useEffect(() => {
    if (!isAuthenticated || !settings?.retentionDays || settings.retentionDays === 0) return;

    const cleanupOldData = async () => {
      try {
        const retentionMs = settings.retentionDays * 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - retentionMs;
        
        const logsRef = ref(db, 'sensor_logs');
        const oldLogsQuery = dbQuery(
          logsRef,
          orderByChild('timestamp'),
          endAt(cutoffTime)
        );

        const snapshot = await get(oldLogsQuery);
        if (snapshot.exists()) {
          const updatePaths: Record<string, null> = {};
          snapshot.forEach((child) => {
            updatePaths[`sensor_logs/${child.key}`] = null;
          });
          
          // Perform batch deletion using update with null values
          const rootRef = ref(db);
          await update(rootRef, updatePaths);
          
          console.log(`[App] Cleaned up ${Object.keys(updatePaths).length} old logs (older than ${settings.retentionDays} days)`);
        }
      } catch (err) {
        console.error("Error during data cleanup:", err);
      }
    };

    // Run cleanup once on load and then every hour if logging is active
    cleanupOldData();
    const interval = setInterval(cleanupOldData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, settings?.retentionDays]);

  const [isTabActive, setIsTabActive] = useState(true);

  // Tab Lock Logic to prevent multiple simulators
  useEffect(() => {
    const tabId = Math.random().toString(36).substring(7);
    const checkTab = () => {
      const activeTab = localStorage.getItem('esp32_active_tab');
      if (!activeTab || activeTab === tabId) {
        localStorage.setItem('esp32_active_tab', tabId);
        setIsTabActive(true);
      } else {
        setIsTabActive(false);
      }
    };

    checkTab();
    const interval = setInterval(checkTab, 2000);
    window.addEventListener('beforeunload', () => {
      if (localStorage.getItem('esp32_active_tab') === tabId) {
        localStorage.removeItem('esp32_active_tab');
      }
    });

    return () => {
      clearInterval(interval);
      if (localStorage.getItem('esp32_active_tab') === tabId) {
        localStorage.removeItem('esp32_active_tab');
      }
    };
  }, []);

  // Mock Data Simulation (for testing without real ESP32)
  useEffect(() => {
    const interval = settings?.interval;
    const isLogging = settings?.isLogging;
    
    if (isSimulating && isLogging && isAuthenticated && interval && isTabActive) {
      console.log(`[App] Starting simulator with interval: ${interval}ms`);
      simulator.start(interval);
    } else {
      simulator.stop();
    }
    return () => simulator.stop();
  }, [isSimulating, settings?.isLogging, settings?.interval, isAuthenticated, isTabActive]);

  const handleManualInput = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch('/api/esp32/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualData)
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${await response.text()}`);
      }
      
      console.log("[App] Manual data logged via API:", manualData);
    } catch (err) {
      console.error("Error logging manual data:", err);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 20
      }
    }
  };

  const handleTestNotification = () => {
    sendNotification({
      type: 'status',
      level: 'Test Notification',
      timestamp: Date.now()
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <RefreshCw className="text-emerald-500 animate-spin" size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 relative overflow-hidden bg-grid">
      {/* Animated background glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-glow pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[120px] animate-pulse-glow pointer-events-none" />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto relative z-10"
      >
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16">
          <motion.div
            variants={itemVariants}
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 glow-emerald">
                <Activity className="text-emerald-500" size={32} />
              </div>
              <div>
                <h1 className="text-5xl font-black tracking-tighter uppercase italic">
                  ESP32 <span className="text-emerald-500">Sensor Hub</span>
                </h1>
                <p className="text-white/40 font-mono text-xs tracking-[0.3em] uppercase mt-1">
                  Advanced Monitoring System • v2.0
                </p>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            variants={itemVariants}
            className="flex items-center gap-6"
          >
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-500 border ${
                isSimulating 
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30 glow-amber" 
                  : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
              }`}
            >
              {isSimulating ? "Simulation Active" : "Enable Simulation"}
            </button>
            <div className="h-12 w-[1px] bg-white/10 hidden md:block"></div>
            <div className="text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black">System Status</p>
              <div className="flex items-center gap-3 justify-end mt-1">
                <div className={`w-3 h-3 rounded-full ${settings?.isLogging ? 'bg-emerald-500 animate-pulse glow-emerald' : 'bg-red-500 glow-red'}`}></div>
                <span className="text-sm font-mono font-bold tracking-tighter">{settings?.isLogging ? 'ACTIVE' : 'IDLE'}</span>
              </div>
            </div>
            <div className="h-12 w-[1px] bg-white/10 hidden md:block"></div>
            <button
              onClick={handleLogout}
              className="p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl transition-all text-red-400 hover:text-red-300 glow-red group"
              title="Sign Out"
            >
              <LogOut size={24} />
            </button>
          </motion.div>
        </header>

        {/* Tab Lock Warning */}
        {!isTabActive && settings?.isLogging && (
          <motion.div 
            variants={itemVariants}
            className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl mb-8 flex items-center gap-4 glow-amber"
          >
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle className="text-amber-500" size={20} />
            </div>
            <div>
              <p className="text-amber-200 text-sm font-bold tracking-tight">
                Simulation Standby
              </p>
              <p className="text-amber-200/60 text-xs font-mono">
                The simulator is already running in another tab. This tab is paused to prevent duplicate data logs.
              </p>
            </div>
          </motion.div>
        )}

        {/* 1. Logging Status and Interval */}
        <motion.div
          variants={itemVariants}
        >
          <LoggingControls 
            settings={settings} 
            onTestNotification={handleTestNotification}
          />
        </motion.div>

        {/* 2. Temperature and Gas Concentration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            layout
            className="glass-card rounded-3xl p-10 relative overflow-hidden group glow-emerald"
          >
            <div className="absolute top-0 right-0 p-6 opacity-15 group-hover:opacity-30 transition-all duration-700">
              <Thermometer size={160} className="text-emerald-500/40 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-8 bg-emerald-500 rounded-full" />
              <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.3em]">Temperature</p>
            </div>
            <div className="flex items-baseline gap-3">
              {logs[0] ? (
                <>
                  <h2 className="text-8xl font-black font-mono tracking-tighter text-glow text-emerald-400">
                    {logs[0].temperature?.toFixed(1) ?? '0.0'}
                  </h2>
                  <span className="text-3xl text-white/30 font-mono">°C</span>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <img 
                    src="https://picsum.photos/seed/temp/200/100?grayscale&blur=2" 
                    alt="Waiting for data" 
                    className="rounded-2xl opacity-20 h-24 w-48 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-white/20 font-mono text-xl animate-pulse">WAITING...</span>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            layout
            className="glass-card rounded-3xl p-10 relative overflow-hidden group glow-amber"
          >
            <div className="absolute top-0 right-0 p-6 opacity-15 group-hover:opacity-30 transition-all duration-700">
              <Wind size={160} className="text-amber-500/40 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]" />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-8 bg-amber-500 rounded-full" />
              <p className="text-amber-400 text-xs font-black uppercase tracking-[0.3em]">Gas Concentration</p>
            </div>
            <div className="flex items-baseline gap-3">
              {logs[0] ? (
                <>
                  <h2 className="text-8xl font-black font-mono tracking-tighter text-glow text-amber-400">
                    {logs[0].gas?.toFixed(0) ?? '0'}
                  </h2>
                  <span className="text-3xl text-white/30 font-mono">PPM</span>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <img 
                    src="https://picsum.photos/seed/gas/200/100?grayscale&blur=2" 
                    alt="Waiting for data" 
                    className="rounded-2xl opacity-20 h-24 w-48 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-white/20 font-mono text-xl animate-pulse">WAITING...</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Risk Analysis */}
        <motion.div
          variants={itemVariants}
          layout
        >
          <RiskAnalysis currentData={logs[0]} />
        </motion.div>

        {/* 3. Sensor Comparison (Chart) */}
        <motion.div 
          variants={itemVariants}
          className="mb-12"
          layout
        >
          <SensorChart data={logs} />
        </motion.div>

        {/* 4. Last 10 Logs (Table) */}
        <motion.div 
          variants={itemVariants}
          className="mb-12"
          layout
        >
          <SensorTable data={logs} />
        </motion.div>

        {/* 5. Virtual ESP32 Device Output */}
        <AnimatePresence mode="wait">
          {isSimulating && (
            <motion.div 
              key="sim-console"
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              className="mb-12 overflow-hidden"
              layout
            >
              <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3 uppercase tracking-widest">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <Cpu size={24} className="text-emerald-500" />
                </div>
                Virtual ESP32 Console
              </h3>
              <VirtualDeviceConsole logs={simLogs} isActive={settings?.isLogging || false} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Testing Tools Section */}
        <motion.div 
          variants={itemVariants}
          layout
          className="mb-16 glass-card rounded-3xl p-10 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
            <div>
              <h3 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter italic">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <Send size={24} className="text-emerald-500" />
                </div>
                Manual Data Injection
              </h3>
              <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-2">
                Send custom data immediately to test system alerts
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setManualData({ temperature: 25, gas: 300 });
                  setTimeout(handleManualInput, 100);
                }}
                disabled={!settings?.isLogging}
                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-20"
              >
                Clean Air
              </button>
              <button
                onClick={() => {
                  setManualData({ temperature: 26, gas: 600 });
                  setTimeout(handleManualInput, 100);
                }}
                disabled={!settings?.isLogging}
                className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-20"
              >
                Normal Indoor
              </button>
              <button
                onClick={() => {
                  setManualData({ temperature: 35, gas: 2500 });
                  setTimeout(handleManualInput, 100);
                }}
                disabled={!settings?.isLogging}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-20"
              >
                Smoke Detected
              </button>
              <button
                onClick={() => {
                  setManualData({ temperature: 28, gas: 6500 });
                  setTimeout(handleManualInput, 100);
                }}
                disabled={!settings?.isLogging}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-20 glow-red"
              >
                Gas Leak
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Temperature (°C)</label>
              <input
                type="number"
                value={manualData.temperature}
                onChange={(e) => setManualData(prev => ({ ...prev, temperature: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Gas Level (PPM)</label>
              <input
                type="number"
                value={manualData.gas}
                onChange={(e) => setManualData(prev => ({ ...prev, gas: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <button
              onClick={handleManualInput}
              disabled={!settings?.isLogging}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-white/20 text-black font-black py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm glow-emerald"
            >
              <Send size={20} />
              Send Custom
            </button>
          </div>
          {!settings?.isLogging && (
            <p className="text-[10px] text-red-500 mt-6 font-black uppercase tracking-widest animate-pulse">
              Recording is off: Data cannot be sent
            </p>
          )}
        </motion.div>

        {/* Settings Section (Unified at bottom) */}
        <motion.div 
          variants={itemVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mt-32 pt-16 border-t border-white/10"
          layout
        >
          <div className="flex items-center gap-4 mb-12">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
              <Settings className="text-white/60" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">System Settings</h2>
              <p className="text-white/60 text-xs font-mono uppercase tracking-widest mt-1">Hardware & Simulation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <motion.section variants={itemVariants} className="space-y-8">
              <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.4em] flex items-center gap-4">
                Hardware Setup
                <div className="h-[1px] flex-1 bg-white/10" />
              </h3>
              <ESP32ConnectionGuide />
            </motion.section>

            <motion.section variants={itemVariants} className="space-y-8">
              <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.4em] flex items-center gap-4">
                Simulation Mode
                <div className="h-[1px] flex-1 bg-white/10" />
              </h3>
              <SimulationSettings
                config={simConfig}
                onConfigChange={(newConfig) => setSimConfig(prev => ({ ...prev, ...newConfig }))}
                isSimulating={isSimulating}
              />
            </motion.section>

            <motion.section variants={itemVariants} className="space-y-8">
              <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.4em] flex items-center gap-4">
                Data Management
                <div className="h-[1px] flex-1 bg-white/10" />
              </h3>
              <DataRetentionSettings settings={settings} />
            </motion.section>
          </div>
        </motion.div>

        {/* Footer */}
        <footer className="mt-40 pb-12 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-[1px] w-12 bg-white/10" />
            <Activity className="text-white/10" size={20} />
            <div className="h-[1px] w-12 bg-white/10" />
          </div>
          <p className="text-white/20 text-[10px] font-mono uppercase tracking-[0.5em]">
            © 2026 ESP32 Sensor Hub • Advanced Telemetry Interface
          </p>
        </footer>
      </motion.div>
    </div>
  );
}

export default App;
