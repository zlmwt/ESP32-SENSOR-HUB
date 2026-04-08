export interface SensorData {
  id?: string;
  temperature: number;
  humidity: number;
  soil: number;
  timestamp: any; // Unix Timestamp or String
}

export type NotificationFrequency = 'minute' | 'hour' | 'day';

export interface LoggingSettings {
  isLogging: boolean;
  interval: number;
  notificationFrequency: NotificationFrequency;
  retentionDays: number;
  lastUpdated: any; // Unix Timestamp
}
