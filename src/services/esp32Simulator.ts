import { ref, push, serverTimestamp } from 'firebase/database';
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
  noise: number; // 0 to 1
}

export class ESP32Simulator {
  private intervalId: any = null;
  private onDataSent?: (data: SimulatedData) => void;
  private config: SimulationConfig = {
    tempMin: 22,
    tempMax: 30,
    gasMin: 150,
    gasMax: 500,
    noise: 0.5
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
      const generateValue = (min: number, max: number, noise: number) => {
        const midpoint = (min + max) / 2;
        const halfRange = (max - min) / 2;
        // If noise is 0, return midpoint. If noise is 1, return full random in range.
        return midpoint + (Math.random() * 2 - 1) * halfRange * noise;
      };

      const data: SimulatedData = {
        temperature: generateValue(this.config.tempMin, this.config.tempMax, this.config.noise),
        gas: generateValue(this.config.gasMin, this.config.gasMax, this.config.noise),
        timestamp: new Date()
      };

      try {
        await push(ref(db, 'sensor_logs'), {
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
