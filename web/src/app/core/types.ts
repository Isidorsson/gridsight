export type AssetType =
  | 'distribution_transformer'
  | 'mv_lv_substation'
  | 'feeder_breaker';

export type OilType = 'mineral' | 'ester' | 'silicone' | 'dry';
export type CoolingClass = 'ONAN' | 'ONAF' | 'OFAF';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Urgency = Severity;

export interface Asset {
  id: string;
  name: string;
  assetType: AssetType;
  primaryVoltageKv: number;
  secondaryVoltageKv: number;
  ratedPowerKva: number;
  oilType: OilType;
  installYear: number;
  locationName: string;
  locationLat?: number;
  locationLng?: number;
  lastInspectionDate?: string;
  coolingClass: CoolingClass;
}

export interface TelemetryReading {
  assetId: string;
  ts: string;
  oilTempC: number;
  windingTempC: number;
  ambientTempC: number;
  loadFactor: number;
  voltagePu: number;
  currentA: number;
  dgaH2Ppm: number;
  dgaCh4Ppm: number;
  dgaC2h2Ppm: number;
}

export interface Alert {
  id: string;
  assetId: string;
  rule: string;
  severity: Severity;
  message: string;
  status: 'open' | 'ack' | 'resolved';
  raisedAt: string;
  ackedAt?: string | null;
  ackUser?: string | null;
  resolvedAt?: string | null;
}

export interface Recommendation {
  urgency: Urgency;
  root_cause: string;
  recommended_actions: Array<{
    priority: 'now' | 'soon' | 'planned';
    action: string;
    rationale: string;
  }>;
  confidence: number;
  references?: string[];
  source: 'live' | 'fixture';
  generated_at: string;
}

export interface ApiList<T> {
  items: T[];
}
