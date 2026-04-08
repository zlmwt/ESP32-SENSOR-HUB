export interface SensorData {
  id?: string;
  temperature: number;
  humidity: number;
  soil: number;
  timestamp: any; // Firestore Timestamp or String
}

export type NotificationFrequency = 'minute' | 'hour' | 'day';

export interface LoggingSettings {
  isLogging: boolean;
  interval: number;
  notificationFrequency: NotificationFrequency;
  retentionDays: number;
  lastUpdated: any; // Firestore Timestamp
}
