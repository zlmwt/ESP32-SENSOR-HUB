export interface SensorData {
  id?: string;
  temperature: number;
  gas: number;
  timestamp: any; // Firestore Timestamp
}

export interface LoggingSettings {
  isLogging: boolean;
  interval: number;
  lastUpdated: any; // Firestore Timestamp
}
