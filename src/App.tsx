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
  addDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { db, auth } from './firebase';
import { SensorData, LoggingSettings } from './types';
import { SensorChart } from './components/SensorChart';
import { SensorTable } from './components/SensorTable';
import { LoggingControls } from './components/LoggingControls';
import { VirtualDeviceConsole } from './components/VirtualDeviceConsole';
import { ESP32Simulator, SimulatedData } from './services/esp32Simulator';
import { Activity, Thermometer, Wind, RefreshCw, LogIn, Cpu } from 'lucide-react';

export default function App() {
  const [logs, setLogs] = useState<SensorData[]>([]);
  const [settings, setSettings] = useState<LoggingSettings | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simLogs, setSimLogs] = useState<SimulatedData[]>([]);
  const [simulator] = useState(() => new ESP32Simulator((data) => {
    setSimLogs(prev => [data, ...prev].slice(0, 20));
  }));

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore listeners
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Mock Data Simulation (for testing without real ESP32)
  useEffect(() => {
    if (isSimulating && settings?.isLogging) {
      simulator.start(settings.interval);
    } else {
      simulator.stop();
    }
    return () => simulator.stop();
  }, [isSimulating, settings?.isLogging, settings?.interval]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <RefreshCw className="text-emerald-500 animate-spin" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/10 shadow-2xl text-center">
          <Activity className="mx-auto text-emerald-500 mb-6" size={64} />
          <h1 className="text-3xl font-bold text-white mb-4">ESP32 Sensor Hub</h1>
          <p className="text-white/60 mb-8">Connect to your real-time sensor monitoring dashboard.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
          >
            <LogIn size={20} />
            Connect to Dashboard
          </button>
        </div>
      </div>
    );
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
    </div>
  );
}
