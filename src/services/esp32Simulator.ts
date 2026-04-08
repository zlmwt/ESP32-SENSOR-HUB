import { ref, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';

export interface SimulatedData {
  temperature: number;
  humidity: number;
  soil: number;
  timestamp: Date;
}

export interface SimulationConfig {
  tempMin: number;
  tempMax: number;
  humidityMin: number;
  humidityMax: number;
  soilMin: number;
  soilMax: number;
  noise: number; // 0 to 1
}

export class ESP32Simulator {
  private intervalId: any = null;
  private onDataSent?: (data: SimulatedData) => void;
  private config: SimulationConfig = {
    tempMin: 22,
    tempMax: 30,
    humidityMin: 40,
    humidityMax: 80,
    soilMin: 0,
    soilMax: 100,
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
    
    const sendData = async () => {
      const generateValue = (min: number, max: number, noise: number) => {
        const midpoint = (min + max) / 2;
        const halfRange = (max - min) / 2;
        return midpoint + (Math.random() * 2 - 1) * halfRange * noise;
      };

      const data: SimulatedData = {
        temperature: generateValue(this.config.tempMin, this.config.tempMax, this.config.noise),
        humidity: generateValue(this.config.humidityMin, this.config.humidityMax, this.config.noise),
        soil: generateValue(this.config.soilMin, this.config.soilMax, this.config.noise),
        timestamp: new Date()
      };

      try {
        console.log(`[Simulator] Sending data:`, {
          temperature: data.temperature.toFixed(2),
          humidity: data.humidity.toFixed(2),
          soil: data.soil.toFixed(2)
        });
        const response = await fetch('/api/esp32/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temperature: data.temperature,
            humidity: data.humidity,
            soil: data.soil,
            manual: true // Simulation bypasses interval to ensure responsiveness in test mode
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${JSON.stringify(result)}`);
        }
        
        if (result.ignored) {
          console.warn(`[ESP32 Simulator] Data was ignored by server:`, result.message);
          return;
        }

        if (this.onDataSent) {
          this.onDataSent(data);
        }
        console.log(`[ESP32 Simulator] Data logged successfully:`, data);
      } catch (error) {
        console.error(`[ESP32 Simulator] Failed to send data:`, error);
      }
    };

    // Send first log immediately
    sendData();
    
    // Then start interval
    this.intervalId = setInterval(sendData, intervalMs);
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
