import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  setDoc, 
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { SensorData, LoggingSettings } from './types';
import { SensorChart } from './components/SensorChart';
import { SensorTable } from './components/SensorTable';
import { LoggingControls } from './components/LoggingControls';
import { RiskAnalysis } from './components/RiskAnalysis';
import { SettingsPanel } from './components/SettingsPanel';
import { LoginPage } from './components/LoginPage';
import { VirtualDeviceConsole } from './components/VirtualDeviceConsole';
import { ESP32Simulator, SimulatedData, SimulationConfig } from './services/esp32Simulator';
import { Activity, Thermometer, Wind, RefreshCw, Cpu, Settings } from 'lucide-react';

export default function App() {
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
    gasMin: 150,
    gasMax: 500,
    noise: 0.5
  });
  const [simulator] = useState(() => new ESP32Simulator((data) => {
    setSimLogs(prev => [data, ...prev].slice(0, 20));
  }));
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  const [lastRiskLevel, setLastRiskLevel] = useState<string>('Normal');

  const handleLogin = () => {
    localStorage.setItem('esp32_auth', 'true');
    setIsAuthenticated(true);
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

  // Risk Analysis Logic (duplicated from RiskAnalysis component for monitoring)
  const getRiskLevel = (temp: number, ppm: number) => {
    const getTempRisk = (t: number) => {
      if (t >= 18 && t <= 30) return 0; // Normal
      if ((t > 30 && t <= 40) || (t >= 10 && t < 18)) return 1; // Low
      if ((t > 40 && t <= 50) || (t >= 0 && t < 10)) return 2; // Medium
      return 3; // Dangerous
    };
    const getGasRisk = (p: number) => {
      if (p < 200) return 0;
      if (p >= 200 && p < 400) return 1;
      if (p >= 400 && p < 800) return 2;
      return 3;
    };
    const levels = ['Normal', 'Low Risk', 'Medium Risk', 'Dangerous'];
    const maxRisk = Math.max(getTempRisk(temp), getGasRisk(ppm));
    return levels[maxRisk];
  };

  // Notification Monitor
  useEffect(() => {
    if (logs.length === 0 || !isAuthenticated) return;
    const current = logs[0];
    const currentRisk = getRiskLevel(current.temperature, current.gas);
    
    // Only notify if risk is Medium or Dangerous AND it's a new risk level OR 5 mins have passed
    const isHighRisk = currentRisk === 'Medium Risk' || currentRisk === 'Dangerous';
    const isNewRisk = currentRisk !== lastRiskLevel;
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    if (isHighRisk && (isNewRisk || (now - lastNotificationTime > cooldownPeriod))) {
      console.log(`[App] High risk detected (${currentRisk}). Sending notification...`);
      
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: currentRisk,
          temperature: current.temperature,
          gas: current.gas,
          timestamp: Date.now()
        })
      }).catch(err => console.error("Notification error:", err));

      setLastNotificationTime(now);
      setLastRiskLevel(currentRisk);
    } else if (!isHighRisk) {
      setLastRiskLevel(currentRisk);
    }
  }, [logs, lastNotificationTime, lastRiskLevel, isAuthenticated]);

  // Firestore listeners
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    // Listen to settings
    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'logging'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as LoggingSettings);
      } else {
        // Initialize settings if they don't exist
        setDoc(doc(db, 'settings', 'logging'), {
          isLogging: false,
          interval: 5000,
          lastUpdated: serverTimestamp()
        });
      }
      setIsLoading(false);
    });

    // Listen to logs (last 10)
    const logsQuery = query(
      collection(db, 'sensor_logs'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const logsUnsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SensorData[];
      setLogs(data);
    });

    return () => {
      settingsUnsubscribe();
      logsUnsubscribe();
    };
  }, [isAuthenticated]);

  // Mock Data Simulation (for testing without real ESP32)
  useEffect(() => {
    if (isSimulating && settings?.isLogging && isAuthenticated) {
      simulator.start(settings.interval);
    } else {
      simulator.stop();
    }
    return () => simulator.stop();
  }, [isSimulating, settings?.isLogging, settings?.interval, isAuthenticated]);

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
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Activity className="text-emerald-500" size={32} />
              <h1 className="text-4xl font-bold tracking-tight">ESP32 Sensor Hub</h1>
            </div>
            <p className="text-white/50">Monitoring DS18B20 & MQ2 Sensors</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isSimulating 
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                  : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
              }`}
            >
              {isSimulating ? "Simulation Active" : "Enable Simulation"}
            </button>
            <div className="h-10 w-[1px] bg-white/10 hidden md:block"></div>
            <div className="text-right">
              <p className="text-xs text-white/30 uppercase tracking-widest font-bold">System Status</p>
              <div className="flex items-center gap-2 justify-end mt-1">
                <div className={`w-2 h-2 rounded-full animate-pulse ${settings?.isLogging ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-mono">{settings?.isLogging ? 'ACTIVE' : 'IDLE'}</span>
              </div>
            </div>
            <div className="h-10 w-[1px] bg-white/10 hidden md:block"></div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/60 hover:text-white group"
            >
              <Settings className="group-hover:rotate-90 transition-transform duration-500" size={24} />
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Thermometer size={120} />
            </div>
            <p className="text-emerald-400/70 text-sm font-bold uppercase tracking-widest mb-2">Current Temperature</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-6xl font-bold font-mono">
                {logs[0]?.temperature.toFixed(1) || '--.-'}
              </h2>
              <span className="text-2xl text-white/50">°C</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wind size={120} />
            </div>
            <p className="text-amber-400/70 text-sm font-bold uppercase tracking-widest mb-2">Gas Concentration</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-6xl font-bold font-mono">
                {logs[0]?.gas.toFixed(0) || '---'}
              </h2>
              <span className="text-2xl text-white/50">PPM</span>
            </div>
          </div>
        </div>

        {/* Risk Analysis */}
        <RiskAnalysis currentData={logs[0]} />

        {/* Controls */}
        <LoggingControls settings={settings} />

        {/* Virtual Device Console (Simulation Mode Only) */}
        {isSimulating && (
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu size={20} className="text-emerald-500" />
              Virtual ESP32 Device Output
            </h3>
            <VirtualDeviceConsole logs={simLogs} isActive={settings?.isLogging || false} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <SensorChart data={logs} />
          </div>
          <div className="lg:col-span-1">
            <SensorTable data={logs} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-white/5 text-center text-white/20 text-sm">
          <p>© 2026 ESP32 Sensor Hub • Powered by Firebase Studio</p>
        </footer>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={handleLogout}
        simConfig={simConfig}
        onSimConfigChange={(newConfig) => setSimConfig(prev => ({ ...prev, ...newConfig }))}
        isSimulating={isSimulating}
      />
    </div>
  );
}
