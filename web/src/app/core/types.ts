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
  model: string | null;
  generated_at: string;
}

export interface ModelOption {
  id: string;
  label: string;
  vendor: 'anthropic' | 'openai';
  hint: string;
}

export interface ModelCatalog {
  items: ModelOption[];
  live: boolean;
}

export interface ApiList<T> {
  items: T[];
}

export type FuelKind =
  | 'nuclear'
  | 'hydro'
  | 'wind_onshore'
  | 'wind_offshore'
  | 'solar'
  | 'biomass'
  | 'fossil_gas'
  | 'fossil_hard_coal'
  | 'fossil_brown_coal'
  | 'fossil_oil'
  | 'other_renewable'
  | 'other';

export interface FuelSlice {
  kind: FuelKind;
  label: string;
  mw: number;
  fossilFree: boolean;
}

export interface BiddingZone {
  code: string;
  label: string;
  country: string;
  lat: number;
  lng: number;
  mockFossilShare: number;
  mockPriceBase: number;
}

export interface GenerationMix {
  zone: string;
  ts: string;
  totalMw: number;
  fossilFreeShare: number;
  slices: FuelSlice[];
  source: 'mock' | 'live';
}

export interface DayAheadPrices {
  zone: string;
  date: string;
  currency: 'EUR';
  unit: 'EUR/MWh';
  hourly: Array<{ hour: number; price: number }>;
  source: 'mock' | 'live';
}

export interface ZoneSummary {
  zone: string;
  label: string;
  country: string;
  ts: string;
  totalMw: number;
  fossilFreeShare: number;
  currentPrice: number;
  topFuel: { kind: FuelKind; label: string; mw: number };
  source: 'mock' | 'live';
}

export type DataSource = 'auto' | 'mock' | 'live';
