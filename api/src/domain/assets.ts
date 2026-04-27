/**
 * Asset taxonomy.
 *
 * Field naming follows IEC 60076 (power transformer specifications).
 * Cooling class codes follow IEC 60076-2:
 *   ONAN = Oil Natural / Air Natural
 *   ONAF = Oil Natural / Air Forced
 *   OFAF = Oil Forced  / Air Forced
 *
 * Asset type vocabulary mirrors typical Swedish DSO (distribution system operator)
 * inventory taxonomy.
 */

export type AssetType =
  | 'distribution_transformer'
  | 'mv_lv_substation'
  | 'feeder_breaker';

export type OilType = 'mineral' | 'ester' | 'silicone' | 'dry';

export type CoolingClass = 'ONAN' | 'ONAF' | 'OFAF';

export interface TransformerAsset {
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

/**
 * Seed fleet — 8 plausibly Swedish assets across the Solna / Stockholm metro area.
 * Mix of asset types, ages, and ratings so the dashboard shows variety.
 */
export const seedAssets: TransformerAsset[] = [
  {
    id: 'TR-SOLNA-04',
    name: 'Solna Strand T4',
    assetType: 'distribution_transformer',
    primaryVoltageKv: 11,
    secondaryVoltageKv: 0.4,
    ratedPowerKva: 1000,
    oilType: 'mineral',
    installYear: 2014,
    locationName: 'Solna Strand',
    locationLat: 59.3631,
    locationLng: 17.9881,
    lastInspectionDate: '2025-09-12',
    coolingClass: 'ONAN',
  },
  {
    id: 'TR-FROSUNDA-02',
    name: 'Frösunda T2',
    assetType: 'distribution_transformer',
    primaryVoltageKv: 11,
    secondaryVoltageKv: 0.4,
    ratedPowerKva: 800,
    oilType: 'ester',
    installYear: 2019,
    locationName: 'Frösunda',
    locationLat: 59.3702,
    locationLng: 17.9989,
    lastInspectionDate: '2026-01-08',
    coolingClass: 'ONAN',
  },
  {
    id: 'TR-RASUNDA-11',
    name: 'Råsunda T11',
    assetType: 'distribution_transformer',
    primaryVoltageKv: 11,
    secondaryVoltageKv: 0.4,
    ratedPowerKva: 630,
    oilType: 'mineral',
    installYear: 1997,
    locationName: 'Råsunda',
    locationLat: 59.3617,
    locationLng: 18.0048,
    lastInspectionDate: '2024-11-22',
    coolingClass: 'ONAN',
  },
  {
    id: 'TR-HUVUDSTA-07',
    name: 'Huvudsta T7',
    assetType: 'distribution_transformer',
    primaryVoltageKv: 11,
    secondaryVoltageKv: 0.4,
    ratedPowerKva: 1250,
    oilType: 'mineral',
    installYear: 2008,
    locationName: 'Huvudsta',
    locationLat: 59.3469,
    locationLng: 17.9844,
    lastInspectionDate: '2025-06-30',
    coolingClass: 'ONAF',
  },
  {
    id: 'SUB-HAGASTADEN-01',
    name: 'Hagastaden Substation',
    assetType: 'mv_lv_substation',
    primaryVoltageKv: 33,
    secondaryVoltageKv: 11,
    ratedPowerKva: 16000,
    oilType: 'mineral',
    installYear: 2021,
    locationName: 'Hagastaden',
    locationLat: 59.3458,
    locationLng: 18.0318,
    lastInspectionDate: '2025-12-05',
    coolingClass: 'OFAF',
  },
  {
    id: 'SUB-BROMMA-03',
    name: 'Bromma South Substation',
    assetType: 'mv_lv_substation',
    primaryVoltageKv: 33,
    secondaryVoltageKv: 11,
    ratedPowerKva: 25000,
    oilType: 'mineral',
    installYear: 2003,
    locationName: 'Bromma',
    locationLat: 59.3441,
    locationLng: 17.9376,
    lastInspectionDate: '2024-08-14',
    coolingClass: 'OFAF',
  },
  {
    id: 'FB-KISTA-09',
    name: 'Kista Feeder 9',
    assetType: 'feeder_breaker',
    primaryVoltageKv: 11,
    secondaryVoltageKv: 11,
    ratedPowerKva: 0,
    oilType: 'dry',
    installYear: 2017,
    locationName: 'Kista',
    locationLat: 59.4034,
    locationLng: 17.9442,
    lastInspectionDate: '2025-10-19',
    coolingClass: 'ONAN',
  },
  {
    id: 'FB-SUNDBYBERG-12',
    name: 'Sundbyberg Feeder 12',
    assetType: 'feeder_breaker',
    primaryVoltageKv: 11,
    secondaryVoltageKv: 11,
    ratedPowerKva: 0,
    oilType: 'dry',
    installYear: 2011,
    locationName: 'Sundbyberg',
    locationLat: 59.3617,
    locationLng: 17.9711,
    lastInspectionDate: '2024-12-01',
    coolingClass: 'ONAN',
  },
];

import { db } from '../lib/db.js';

interface AssetRow {
  id: string;
  name: string;
  asset_type: AssetType;
  primary_voltage_kv: number;
  secondary_voltage_kv: number;
  rated_power_kva: number;
  oil_type: OilType;
  install_year: number;
  location_name: string;
  location_lat: number | null;
  location_lng: number | null;
  last_inspection_date: string | null;
  cooling_class: CoolingClass;
}

const rowToAsset = (r: AssetRow): TransformerAsset => ({
  id: r.id,
  name: r.name,
  assetType: r.asset_type,
  primaryVoltageKv: r.primary_voltage_kv,
  secondaryVoltageKv: r.secondary_voltage_kv,
  ratedPowerKva: r.rated_power_kva,
  oilType: r.oil_type,
  installYear: r.install_year,
  locationName: r.location_name,
  ...(r.location_lat !== null ? { locationLat: r.location_lat } : {}),
  ...(r.location_lng !== null ? { locationLng: r.location_lng } : {}),
  ...(r.last_inspection_date !== null ? { lastInspectionDate: r.last_inspection_date } : {}),
  coolingClass: r.cooling_class,
});

export function listAssets(): TransformerAsset[] {
  const rows = db.prepare('SELECT * FROM assets ORDER BY id').all() as AssetRow[];
  return rows.map(rowToAsset);
}

export function getAsset(id: string): TransformerAsset | undefined {
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
  return row ? rowToAsset(row) : undefined;
}
