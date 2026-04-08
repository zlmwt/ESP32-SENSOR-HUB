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
import { Activity, Thermometer, Wind, RefreshCw, Cpu, Settings, LogOut, Send, AlertTriangle, Droplets } from 'lucide-react';
import { ESP32ConnectionGuide } from './components/ESP32ConnectionGuide';
import { SimulationSettings } from './components/SimulationSettings';
import { DataRetentionSettings } from './components/DataRetentionSettings';
import { getTimestamp, parseSensorValue } from './utils/sensorUtils';

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
    humidityMin: 40,
    humidityMax: 80,
    soilMin: 0,
    soilMax: 100,
    noise: 0.5
  });
  const [simulator] = useState(() => new ESP32Simulator((data) => {
    setSimLogs(prev => [data, ...prev].slice(0, 20));
  }));
  const [lastNotificationTime, setLastNotificationTime] = useState<Record<string, number>>({});
  const [lastRiskLevel, setLastRiskLevel] = useState<string>('Normal');
  const [lastLoggingState, setLastLoggingState] = useState<boolean | null>(null);
  const [isDeviceConnected, setIsDeviceConnected] = useState<boolean>(false);
  const [manualData, setManualData] = useState({ temperature: 25, humidity: 50, soil: 50 });
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    show: false,
    message: '',
    type: 'info'
  });

  // Auto-hide notifications
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

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
    if (settings) {
      setLastLoggingState(settings.isLogging);
    }
  }, [settings?.isLogging]);

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
        setIsLoading(false); // Only set loading false when data is actually here
      } else {
        // Initialize settings if they don't exist
        set(settingsRef, {
          isLogging: false,
          interval: 5000,
          notificationFrequency: 'minute',
          retentionDays: 7,
          lastUpdated: dbServerTimestamp()
        });
        // Don't set isLoading(false) here, wait for the next fire with data
      }
    }, (error) => {
      console.error("[App] Settings listener error:", error);
      setIsLoading(false); // Stop loading even on error
    });

    return () => settingsUnsubscribe();
  }, [isAuthenticated, isFirebaseReady]);

  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());

  // Statistics Calculation
  const filteredLogs = React.useMemo(() => {
    if (!settings?.isLogging) return logs;
    return logs.filter(log => {
      const ts = getTimestamp(log.timestamp);
      return ts > 0 && ts >= sessionStartTime;
    });
  }, [logs, settings?.isLogging, sessionStartTime]);

  const stats = React.useMemo(() => {
    if (logs.length === 0) return null;
    
    const calculate = (key: 'temperature' | 'humidity' | 'soil') => {
      // Current is ALWAYS the absolute latest value from the logs array
      const current = parseSensorValue(logs[0][key]);
      
      const sessionValues = filteredLogs.map(l => parseSensorValue(l[key])).filter(v => !isNaN(v));
      
      // If no data in current session yet, fallback to current value for all stats
      if (sessionValues.length === 0) return { current, avg: current, max: current };
      
      const sum = sessionValues.reduce((a, b) => a + b, 0);
      const avg = sum / sessionValues.length;
      const max = Math.max(...sessionValues);
      
      return {
        current,
        avg: isNaN(avg) ? 0 : avg,
        max: isNaN(max) ? 0 : max
      };
    };

    return {
      temp: calculate('temperature'),
      hum: calculate('humidity'),
      soil: calculate('soil')
    };
  }, [logs, filteredLogs]);

  // Reset session start time when logging is toggled on
  useEffect(() => {
    if (settings?.isLogging) {
      // Use settings.lastUpdated as the session start time if available, 
      // otherwise fallback to current time minus buffer
      const lastUpdated = getTimestamp(settings.lastUpdated) || Date.now();
      setSessionStartTime(lastUpdated - 30000);
    }
  }, [settings?.isLogging, settings?.lastUpdated]);

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
          data.push({
            id: childSnapshot.key as string,
            ...val
          });
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
      const now = Date.now();
      const rawData = localStorage.getItem('esp32_active_tab_data');
      
      try {
        const data = rawData ? JSON.parse(rawData) : null;
        
        // If no active tab, or it's us, or the last heartbeat was more than 5 seconds ago
        if (!data || data.tabId === tabId || (now - data.lastSeen > 5000)) {
          localStorage.setItem('esp32_active_tab_data', JSON.stringify({
            tabId,
            lastSeen: now
          }));
          setIsTabActive(true);
        } else {
          setIsTabActive(false);
        }
      } catch (e) {
        // If data is corrupted, just take over
        localStorage.setItem('esp32_active_tab_data', JSON.stringify({
          tabId,
          lastSeen: now
        }));
        setIsTabActive(true);
      }
    };

    checkTab();
    const interval = setInterval(checkTab, 2000);

    const cleanup = () => {
      const rawData = localStorage.getItem('esp32_active_tab_data');
      if (rawData) {
        try {
          const data = JSON.parse(rawData);
          if (data.tabId === tabId) {
            localStorage.removeItem('esp32_active_tab_data');
          }
        } catch (e) {}
      }
    };

    window.addEventListener('beforeunload', cleanup);

    return () => {
      clearInterval(interval);
      cleanup();
      window.removeEventListener('beforeunload', cleanup);
    };
  }, []);

  // Mock Data Simulation (for testing without real ESP32)
  useEffect(() => {
    const interval = settings?.interval || 5000;
    
    if (isSimulating && isAuthenticated && interval && isTabActive) {
      console.log(`[App] Starting simulator with interval: ${interval}ms`);
      simulator.start(interval);
      setNotification({
        show: true,
        message: "Simulator started",
        type: 'info'
      });
    } else {
      simulator.stop();
      if (isSimulating && !isTabActive) {
        console.log("[App] Simulator paused (inactive tab)");
      }
    }
    return () => simulator.stop();
  }, [isSimulating, settings?.interval, isAuthenticated, isTabActive]);

  const handleManualInput = async (dataOverride?: any) => {
    if (!isAuthenticated) {
      console.warn("[App] Manual input ignored: Not authenticated");
      setNotification({
        show: true,
        message: "Please wait for authentication to complete.",
        type: 'warning'
      });
      return;
    }
    
    // If dataOverride is an event object (from onClick), ignore it and use manualData
    const isEvent = dataOverride && (dataOverride.nativeEvent || dataOverride.target);
    const dataToSend = (dataOverride && !isEvent) ? dataOverride : manualData;
    
    console.log("[App] Attempting manual data injection:", dataToSend);
    setIsInjecting(true);
    
    try {
      const response = await fetch('/api/esp32/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dataToSend, manual: true })
      });
      
      const result = await response.json();
      console.log("[App] Manual data injection response:", result);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${JSON.stringify(result)}`);
      }
      
      if (result.ignored) {
        setNotification({
          show: true,
          message: result.message || "Data ignored by server (too frequent)",
          type: 'warning'
        });
      } else {
        setNotification({
          show: true,
          message: "Data injected successfully!",
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error("Error logging manual data:", err);
      setNotification({
        show: true,
        message: `Failed to inject data: ${err.message}`,
        type: 'error'
      });
    } finally {
      setIsInjecting(false);
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

  const handleClearLogs = async () => {
    if (!isAuthenticated || !isFirebaseReady) return;
    if (!window.confirm("Are you sure you want to clear all sensor logs? This action cannot be undone.")) return;
    
    setIsLoading(true);
    try {
      const logsRef = ref(db, 'sensor_logs');
      await remove(logsRef);
      setLogs([]);
      setNotification({
        show: true,
        message: "All logs cleared successfully",
        type: 'success'
      });
    } catch (err: any) {
      console.error("Error clearing logs:", err);
      setNotification({
        show: true,
        message: `Failed to clear logs: ${err.message}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
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
            {/* Tab Status Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <div className={`w-1.5 h-1.5 rounded-full ${isTabActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`} />
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                {isTabActive ? 'Primary Tab' : 'Secondary Tab'}
              </span>
              {!isTabActive && (
                <button 
                  onClick={() => {
                    const tabId = Math.random().toString(36).substring(7);
                    localStorage.setItem('esp32_active_tab_data', JSON.stringify({
                      tabId,
                      lastSeen: Date.now()
                    }));
                    window.location.reload();
                  }}
                  className="ml-2 text-[9px] font-black text-amber-400 hover:text-amber-300 uppercase underline decoration-amber-400/30 underline-offset-2"
                >
                  Takeover
                </button>
              )}
            </div>

            <button
              onClick={() => {
                if (!settings) return; // Prevent crash if settings not loaded
                const nextSimState = !isSimulating;
                setIsSimulating(nextSimState);
                
                // If turning on simulation, also ensure logging is on
                if (nextSimState && !settings.isLogging) {
                  const settingsRef = ref(db, 'settings/logging');
                  set(settingsRef, {
                    ...settings,
                    isLogging: true,
                    lastUpdated: dbServerTimestamp()
                  });
                }
              }}
              disabled={!settings}
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
        {!isTabActive && (settings?.isLogging || isSimulating) && (
          <motion.div 
            variants={itemVariants}
            className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 glow-amber"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-2xl">
                <AlertTriangle className="text-amber-500" size={24} />
              </div>
              <div>
                <p className="text-amber-200 text-sm font-black uppercase tracking-widest">
                  Simulation Standby
                </p>
                <p className="text-amber-200/60 text-xs font-mono mt-1">
                  The simulator is active in another tab. This tab is paused to prevent data conflicts.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('esp32_active_tab_data');
                window.location.reload();
              }}
              className="px-6 py-3 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
            >
              Force Takeover
            </button>
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

        {/* 2. Sensor Cards (Temperature, Humidity, Soil) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Temperature Card */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            layout
            className="glass-card rounded-3xl p-8 relative overflow-hidden group glow-emerald"
          >
            <div className="absolute top-0 right-0 p-6 opacity-15 group-hover:opacity-30 transition-all duration-700">
              <Thermometer size={120} className="text-emerald-500/40 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                <div className="absolute inset-0 bg-emerald-500/50 blur-sm rounded-full animate-pulse" />
              </div>
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em]">DHT22 Temperature</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-1">Current</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-5xl font-black font-mono tracking-tighter text-glow text-emerald-400">
                    {stats?.temp?.current?.toFixed(1) ?? '0.0'}
                  </h2>
                  <span className="text-xl text-white/30 font-mono">°C</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                  <p className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Average</p>
                  <p className="text-lg font-bold font-mono text-white/60">{stats?.temp?.avg?.toFixed(1) ?? '0.0'}°C</p>
                </div>
                <div>
                  <p className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Maximum</p>
                  <p className="text-lg font-bold font-mono text-white/60">{stats?.temp?.max?.toFixed(1) ?? '0.0'}°C</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Humidity Card */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            layout
            className="glass-card rounded-3xl p-8 relative overflow-hidden group glow-blue"
          >
            <div className="absolute top-0 right-0 p-6 opacity-15 group-hover:opacity-30 transition-all duration-700">
              <Droplets size={120} className="text-blue-500/40 drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]" />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="w-2 h-6 bg-blue-500 rounded-full" />
                <div className="absolute inset-0 bg-blue-500/50 blur-sm rounded-full animate-pulse" />
              </div>
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">DHT22 Humidity</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-1">Current</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-5xl font-black font-mono tracking-tighter text-glow text-blue-400">
                    {stats?.hum?.current?.toFixed(1) ?? '0.0'}
                  </h2>
                  <span className="text-xl text-white/30 font-mono">%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                  <p className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Average</p>
                  <p className="text-lg font-bold font-mono text-white/60">{stats?.hum?.avg?.toFixed(1) ?? '0.0'}%</p>
                </div>
                <div>
                  <p className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Maximum</p>
                  <p className="text-lg font-bold font-mono text-white/60">{stats?.hum?.max?.toFixed(1) ?? '0.0'}%</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Soil Card */}
          <motion.div 
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            layout
            className="glass-card rounded-3xl p-8 relative overflow-hidden group glow-amber"
          >
            <div className="absolute top-0 right-0 p-6 opacity-15 group-hover:opacity-30 transition-all duration-700">
              <Droplets size={120} className="text-amber-500/40 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]" />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="w-2 h-6 bg-amber-500 rounded-full" />
                <div className="absolute inset-0 bg-amber-500/50 blur-sm rounded-full animate-pulse" />
              </div>
              <p className="text-amber-400 text-[10px] font-black uppercase tracking-[0.3em]">HW-390 Soil Sensor</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-1">Current</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-5xl font-black font-mono tracking-tighter text-glow text-amber-400">
                    {stats?.soil?.current?.toFixed(0) ?? '0'}
                  </h2>
                  <span className="text-xl text-white/30 font-mono">%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                  <p className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Average</p>
                  <p className="text-lg font-bold font-mono text-white/60">{stats?.soil?.avg?.toFixed(0) ?? '0'}%</p>
                </div>
                <div>
                  <p className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Maximum</p>
                  <p className="text-lg font-bold font-mono text-white/60">{stats?.soil?.max?.toFixed(0) ?? '0'}%</p>
                </div>
              </div>
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

        {/* 3. Sensor Comparison (Charts) */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <h2 className="text-sm font-black text-white/40 uppercase tracking-[0.5em] italic">Historical Analytics</h2>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <SensorChart 
              data={logs} 
              dataKey="temperature" 
              color="#10b981" 
              title="Temperature" 
              unit="°C" 
              icon={<Thermometer />}
            />
            <SensorChart 
              data={logs} 
              dataKey="humidity" 
              color="#3b82f6" 
              title="Humidity" 
              unit="%" 
              icon={<Droplets />}
            />
            <SensorChart 
              data={logs} 
              dataKey="soil" 
              color="#f59e0b" 
              title="Soil Moisture" 
              unit="%" 
              icon={<Droplets />}
            />
          </div>
        </div>

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
              <VirtualDeviceConsole logs={simLogs} isActive={isSimulating} />
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <button
                onClick={handleClearLogs}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 self-start md:self-center"
              >
                <RefreshCw size={14} />
                Clear All Logs
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const data = { temperature: 25, humidity: 45, soil: 50 };
                  setManualData(data);
                  handleManualInput(data);
                }}
                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Optimal Soil
              </button>
              <button
                onClick={() => {
                  const data = { temperature: 26, humidity: 55, soil: 25 };
                  setManualData(data);
                  handleManualInput(data);
                }}
                className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Dry Soil
              </button>
              <button
                onClick={() => {
                  const data = { temperature: 35, humidity: 75, soil: 80 };
                  setManualData(data);
                  handleManualInput(data);
                }}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Moist Soil
              </button>
              <button
                onClick={() => {
                  const data = { temperature: 28, humidity: 85, soil: 10 };
                  setManualData(data);
                  handleManualInput(data);
                }}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all glow-red"
              >
                Critical Dry
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
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
              <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Humidity (%)</label>
              <input
                type="number"
                value={manualData.humidity}
                onChange={(e) => setManualData(prev => ({ ...prev, humidity: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Soil Moisture (%)</label>
              <input
                type="number"
                value={manualData.soil}
                onChange={(e) => setManualData(prev => ({ ...prev, soil: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <button
              onClick={() => handleManualInput()}
              disabled={isInjecting}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-white/20 text-black font-black py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm glow-emerald"
            >
              {isInjecting ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
              {isInjecting ? "Sending..." : "Send Custom"}
            </button>
          </div>
          {!settings?.isLogging && (
            <p className="text-[10px] text-amber-500 mt-6 font-black uppercase tracking-widest">
              Recording is off: Manual data will still be logged, but automatic sensor data will be ignored.
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

      {/* Global Notifications */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl border shadow-2xl flex items-center gap-4 min-w-[320px] backdrop-blur-xl ${
              notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
              notification.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
              notification.type === 'warning' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' :
              'bg-blue-500/20 border-blue-500/50 text-blue-400'
            }`}
          >
            <div className={`p-2 rounded-xl ${
              notification.type === 'success' ? 'bg-emerald-500/20' :
              notification.type === 'error' ? 'bg-red-500/20' :
              notification.type === 'warning' ? 'bg-amber-500/20' :
              'bg-blue-500/20'
            }`}>
              {notification.type === 'success' && <RefreshCw size={20} className="animate-spin-slow" />}
              {notification.type === 'error' && <AlertTriangle size={20} />}
              {notification.type === 'warning' && <AlertTriangle size={20} />}
              {notification.type === 'info' && <RefreshCw size={20} />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest">{notification.type}</p>
              <p className="text-sm font-medium text-white/90">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <LogOut size={16} className="rotate-90" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
