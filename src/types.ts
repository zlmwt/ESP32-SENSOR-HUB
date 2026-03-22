export interface SensorData {
  id?: string;
  temperature: number;
  gas: number;
  timestamp: any; // Firestore Timestamp
}

export type NotificationFrequency = 'minute' | 'hour' | 'day';

export interface LoggingSettings {
  isLogging: boolean;
  interval: number;
  notificationFrequency: NotificationFrequency;
  retentionDays: number;
  lastUpdated: any; // Firestore Timestamp
}
