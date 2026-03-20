import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface SimulatedData {
  temperature: number;
  gas: number;
  timestamp: Date;
}

export interface SimulationConfig {
  tempMin: number;
  tempMax: number;
  gasMin: number;
  gasMax: number;
}

export class ESP32Simulator {
  private intervalId: any = null;
  private onDataSent?: (data: SimulatedData) => void;
  private config: SimulationConfig = {
    tempMin: 22,
    tempMax: 30,
    gasMin: 150,
    gasMax: 500
  };

  constructor(onDataSent?: (data: SimulatedData) => void) {
    this.onDataSent = onDataSent;
  }

  setConfig(newConfig: Partial<SimulationConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log(`[ESP32 Simulator] Config updated:`, this.config);
  }

  start(intervalMs: number) {
    this.stop();
    console.log(`[ESP32 Simulator] Starting with interval: ${intervalMs}ms`);
    
    this.intervalId = setInterval(async () => {
      const data: SimulatedData = {
        temperature: this.config.tempMin + Math.random() * (this.config.tempMax - this.config.tempMin),
        gas: this.config.gasMin + Math.random() * (this.config.gasMax - this.config.gasMin),
        timestamp: new Date()
      };

      try {
        await addDoc(collection(db, 'sensor_logs'), {
          ...data,
          timestamp: serverTimestamp()
        });
        
        if (this.onDataSent) {
          this.onDataSent(data);
        }
        console.log(`[ESP32 Simulator] Data sent:`, data);
      } catch (error) {
        console.error(`[ESP32 Simulator] Failed to send data:`, error);
      }
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`[ESP32 Simulator] Stopped`);
    }
  }

  isActive() {
    return this.intervalId !== null;
  }
}
