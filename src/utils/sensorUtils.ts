import { format } from 'date-fns';

export type RiskLevel = 'Normal' | 'Low Risk' | 'Medium Risk' | 'Dangerous';

export const getTemperatureRisk = (temp: number): RiskLevel => {
  if (temp >= 18 && temp <= 30) return 'Normal';
  if ((temp > 30 && temp <= 40) || (temp >= 10 && temp < 18)) return 'Low Risk';
  if ((temp > 40 && temp <= 50) || (temp >= 0 && temp < 10)) return 'Medium Risk';
  return 'Dangerous';
};

export const getHumidityRisk = (hum: number): RiskLevel => {
  if (hum >= 30 && hum <= 60) return 'Normal';
  if ((hum > 60 && hum <= 80) || (hum >= 20 && hum < 30)) return 'Low Risk';
  if ((hum > 80 && hum <= 90) || (hum >= 10 && hum < 20)) return 'Medium Risk';
  return 'Dangerous';
};

export const getSoilRisk = (s: number): RiskLevel => {
  if (s >= 30 && s <= 70) return 'Normal';
  if ((s > 70 && s <= 85) || (s >= 15 && s < 30)) return 'Low Risk';
  if ((s > 85 && s <= 95) || (s >= 5 && s < 15)) return 'Medium Risk';
  return 'Dangerous';
};

export const getSoilCategory = (s: number): string => {
  if (s < 15) return 'Very Dry';
  if (s >= 15 && s < 30) return 'Dry';
  if (s >= 30 && s <= 70) return 'Optimal';
  if (s > 70 && s <= 85) return 'Moist';
  return 'Very Wet';
};

export const getOverallRiskLevel = (temp: number, hum: number, soil: number): RiskLevel => {
  const tempRisk = getTemperatureRisk(temp);
  const humRisk = getHumidityRisk(hum);
  const soilRisk = getSoilRisk(soil);

  const riskPriority: Record<RiskLevel, number> = {
    'Normal': 0,
    'Low Risk': 1,
    'Medium Risk': 2,
    'Dangerous': 3,
  };

  return [tempRisk, humRisk, soilRisk].reduce((prev, curr) => 
    riskPriority[curr] > riskPriority[prev] ? curr : prev, 'Normal' as RiskLevel);
};

export const parseSensorValue = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove % and other non-numeric characters except decimal point and minus sign
    const cleaned = val.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
};

export const getTimestamp = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    // If it's the custom WIB format "YYYY-MM-DD HH:mm:ss", append +07:00
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts)) {
      return new Date(`${ts.replace(' ', 'T')}+07:00`).getTime();
    }
    return new Date(ts).getTime();
  }
  if (ts.toMillis) return ts.toMillis();
  if (ts.toDate) return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
};

export const formatTimestamp = (ts: any): string => {
  const numericTs = getTimestamp(ts);
  if (numericTs === 0) return 'Pending...';
  return format(new Date(numericTs), 'yyyy-MM-dd HH:mm:ss');
};
