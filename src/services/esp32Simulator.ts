import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface SimulatedData {
  temperature: number;
  gas: number;
  timestamp: Date;
}

export class ESP32Simulator {
  private intervalId: any = null;
  private onDataSent?: (data: SimulatedData) => void;

  constructor(onDataSent?: (data: SimulatedData) => void) {
    this.onDataSent = onDataSent;
  }

  start(intervalMs: number) {
    this.stop();
    console.log(`[ESP32 Simulator] Starting with interval: ${intervalMs}ms`);
    
    this.intervalId = setInterval(async () => {
      const data: SimulatedData = {
        temperature: 22 + Math.random() * 8, // 22-30 range
        gas: 150 + Math.random() * 350,      // 150-500 range
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
