/**
 * European grid mix + day-ahead price domain.
 *
 * Two backends:
 *   - mock : deterministic synthesis tuned per bidding zone. Always available;
 *            useful as fallback when the upstream API is rate-limited or down.
 *   - live : Energy-Charts API by Fraunhofer ISE
 *            (https://api.energy-charts.info, no auth, generous quota).
 *
 * Both produce the same wire shape so the frontend never branches on source.
 *
 * Choice is per-request: `?source=mock` forces the synthetic path, `?source=live`
 * forces the upstream call (with mock fallback on error), `auto` (default) picks
 * live unless `?disable_live=1` style overrides apply (we just default to live).
 */

import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

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
  /** Power generation in megawatts at the reference timestamp. */
  mw: number;
  /** Whether this counts toward the "fossil-free" share. */
  fossilFree: boolean;
}

export interface BiddingZone {
  /** ENTSO-E EIC code. */
  code: string;
  /** Short human-readable name e.g. "Sweden — SE3 (Stockholm)". */
  label: string;
  /** ISO country code, used for flag rendering on the frontend. */
  country: string;
  /** Approximate centroid for map plotting. */
  lat: number;
  lng: number;
  /** Energy-Charts public_power country code (lowercase ISO). */
  ecCountry: string;
  /** Energy-Charts price bzn name (uppercase ENTSO-E zone). */
  ecBzn: string;
  /** Mock profile: rough fossil share at noon, used to tune the synthetic mix. */
  mockFossilShare: number;
  /** Mock profile: typical day-ahead price baseline (EUR/MWh). */
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

const FUEL_LABELS: Record<FuelKind, string> = {
  nuclear: 'Nuclear',
  hydro: 'Hydro',
  wind_onshore: 'Wind (onshore)',
  wind_offshore: 'Wind (offshore)',
  solar: 'Solar',
  biomass: 'Biomass',
  fossil_gas: 'Fossil gas',
  fossil_hard_coal: 'Hard coal',
  fossil_brown_coal: 'Brown coal',
  fossil_oil: 'Oil',
  other_renewable: 'Other renewable',
  other: 'Other',
};

const FOSSIL_FREE: Record<FuelKind, boolean> = {
  nuclear: true,
  hydro: true,
  wind_onshore: true,
  wind_offshore: true,
  solar: true,
  biomass: true,
  other_renewable: true,
  fossil_gas: false,
  fossil_hard_coal: false,
  fossil_brown_coal: false,
  fossil_oil: false,
  other: false,
};

/**
 * Bidding zones included in the demo.
 *
 * Selection picked to span the spectrum from "almost entirely fossil-free" (Sweden,
 * Norway, France) to "still heavily fossil" (Poland, Netherlands), so the comparison
 * view is striking. EIC codes match ENTSO-E.
 */
export const BIDDING_ZONES: BiddingZone[] = [
  { code: '10Y1001A1001A47J', label: 'Sweden — SE3 (Stockholm)',  country: 'SE', lat: 59.3, lng: 18.0, ecCountry: 'se', ecBzn: 'SE3',   mockFossilShare: 0.02, mockPriceBase: 35 },
  { code: '10Y1001A1001A44P', label: 'Sweden — SE1 (Luleå)',      country: 'SE', lat: 65.6, lng: 22.1, ecCountry: 'se', ecBzn: 'SE1',   mockFossilShare: 0.01, mockPriceBase: 22 },
  { code: '10YNO-3--------J', label: 'Norway — NO3 (Trondheim)',  country: 'NO', lat: 63.4, lng: 10.4, ecCountry: 'no', ecBzn: 'NO3',   mockFossilShare: 0.01, mockPriceBase: 28 },
  { code: '10YFI-1--------U', label: 'Finland',                    country: 'FI', lat: 60.2, lng: 24.9, ecCountry: 'fi', ecBzn: 'FI',    mockFossilShare: 0.05, mockPriceBase: 42 },
  { code: '10YDK-1--------W', label: 'Denmark — DK1',              country: 'DK', lat: 55.7, lng: 9.2,  ecCountry: 'dk', ecBzn: 'DK1',   mockFossilShare: 0.20, mockPriceBase: 55 },
  { code: '10YDE-VE-------2', label: 'Germany',                    country: 'DE', lat: 52.5, lng: 13.4, ecCountry: 'de', ecBzn: 'DE-LU', mockFossilShare: 0.45, mockPriceBase: 78 },
  { code: '10YFR-RTE------C', label: 'France',                     country: 'FR', lat: 48.9, lng: 2.4,  ecCountry: 'fr', ecBzn: 'FR',    mockFossilShare: 0.08, mockPriceBase: 60 },
  { code: '10YNL----------L', label: 'Netherlands',                country: 'NL', lat: 52.4, lng: 4.9,  ecCountry: 'nl', ecBzn: 'NL',    mockFossilShare: 0.55, mockPriceBase: 85 },
  { code: '10YPL-AREA-----S', label: 'Poland',                     country: 'PL', lat: 52.2, lng: 21.0, ecCountry: 'pl', ecBzn: 'PL',    mockFossilShare: 0.70, mockPriceBase: 92 },
  { code: '10YES-REE------0', label: 'Spain',                      country: 'ES', lat: 40.4, lng: -3.7, ecCountry: 'es', ecBzn: 'ES',    mockFossilShare: 0.30, mockPriceBase: 65 },
];

const ZONE_BY_CODE = new Map(BIDDING_ZONES.map((z) => [z.code, z]));

export function getZone(code: string): BiddingZone | undefined {
  return ZONE_BY_CODE.get(code);
}

export function listZones(): BiddingZone[] {
  return BIDDING_ZONES;
}

/**
 * Deterministic pseudo-random generator. Same `seed` → same sequence.
 * Used so the mock data is stable across requests within the same hour.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return h >>> 0;
}

/**
 * Synthesize a fuel mix slice list for a bidding zone at a given timestamp.
 *
 * Mix strategy:
 *   - Start from a per-zone fossil/non-fossil ratio.
 *   - Diurnal solar curve (sin, peaks near 12:00 local).
 *   - Wind randomness gated by zone and day-of-year (multiday weather pattern).
 *   - Nuclear is steady (baseload).
 *   - Hydro flexes mildly with load.
 *   - Coal/gas absorb the residual fossil share.
 */
export function generateMockMix(zoneCode: string, ts: Date = new Date()): GenerationMix {
  const zone = getZone(zoneCode);
  if (!zone) throw new Error(`Unknown bidding zone: ${zoneCode}`);

  const dayKey = `${zone.code}-${ts.getUTCFullYear()}-${ts.getUTCMonth()}-${ts.getUTCDate()}`;
  const rng = mulberry32(hashCode(dayKey));

  const hourLocal = ts.getUTCHours() + zone.lng / 15;
  const solarFactor = Math.max(0, Math.sin(((hourLocal - 6) / 12) * Math.PI));
  const windPattern = 0.4 + 0.5 * rng();
  const loadFactor = 0.65 + 0.35 * Math.max(0, Math.sin(((hourLocal - 4) / 16) * Math.PI));

  const baseTotal = (8000 + rng() * 12000) * loadFactor;
  const fossilShare = zone.mockFossilShare * (0.85 + 0.3 * rng());
  const fossilFreeShare = 1 - fossilShare;

  const mix: Record<FuelKind, number> = {
    nuclear: 0,
    hydro: 0,
    wind_onshore: 0,
    wind_offshore: 0,
    solar: 0,
    biomass: 0,
    fossil_gas: 0,
    fossil_hard_coal: 0,
    fossil_brown_coal: 0,
    fossil_oil: 0,
    other_renewable: 0,
    other: 0,
  };

  const cleanPool = baseTotal * fossilFreeShare;

  switch (zone.country) {
    case 'SE':
    case 'FI':
      mix.nuclear = cleanPool * 0.32;
      mix.hydro = cleanPool * 0.40;
      mix.wind_onshore = cleanPool * 0.18 * windPattern;
      mix.biomass = cleanPool * 0.06;
      mix.solar = cleanPool * 0.04 * solarFactor;
      break;
    case 'NO':
      mix.hydro = cleanPool * 0.88;
      mix.wind_onshore = cleanPool * 0.10 * windPattern;
      mix.solar = cleanPool * 0.02 * solarFactor;
      break;
    case 'DK':
      mix.wind_onshore = cleanPool * 0.45 * windPattern;
      mix.wind_offshore = cleanPool * 0.30 * windPattern;
      mix.biomass = cleanPool * 0.18;
      mix.solar = cleanPool * 0.07 * solarFactor;
      break;
    case 'FR':
      mix.nuclear = cleanPool * 0.78;
      mix.hydro = cleanPool * 0.12;
      mix.wind_onshore = cleanPool * 0.06 * windPattern;
      mix.solar = cleanPool * 0.04 * solarFactor;
      break;
    case 'DE':
      mix.wind_onshore = cleanPool * 0.32 * windPattern;
      mix.wind_offshore = cleanPool * 0.12 * windPattern;
      mix.solar = cleanPool * 0.30 * solarFactor;
      mix.biomass = cleanPool * 0.18;
      mix.hydro = cleanPool * 0.08;
      break;
    case 'NL':
      mix.wind_onshore = cleanPool * 0.30 * windPattern;
      mix.wind_offshore = cleanPool * 0.20 * windPattern;
      mix.solar = cleanPool * 0.35 * solarFactor;
      mix.biomass = cleanPool * 0.15;
      break;
    case 'PL':
      mix.wind_onshore = cleanPool * 0.55 * windPattern;
      mix.solar = cleanPool * 0.25 * solarFactor;
      mix.biomass = cleanPool * 0.20;
      break;
    case 'ES':
      mix.solar = cleanPool * 0.30 * solarFactor;
      mix.wind_onshore = cleanPool * 0.30 * windPattern;
      mix.nuclear = cleanPool * 0.20;
      mix.hydro = cleanPool * 0.15;
      mix.biomass = cleanPool * 0.05;
      break;
    default:
      mix.wind_onshore = cleanPool * 0.40 * windPattern;
      mix.solar = cleanPool * 0.30 * solarFactor;
      mix.hydro = cleanPool * 0.20;
      mix.biomass = cleanPool * 0.10;
  }

  const fossilPool = baseTotal * fossilShare;
  switch (zone.country) {
    case 'PL':
      mix.fossil_brown_coal = fossilPool * 0.55;
      mix.fossil_hard_coal = fossilPool * 0.35;
      mix.fossil_gas = fossilPool * 0.10;
      break;
    case 'DE':
      mix.fossil_brown_coal = fossilPool * 0.30;
      mix.fossil_hard_coal = fossilPool * 0.20;
      mix.fossil_gas = fossilPool * 0.45;
      mix.fossil_oil = fossilPool * 0.05;
      break;
    case 'NL':
      mix.fossil_gas = fossilPool * 0.85;
      mix.fossil_hard_coal = fossilPool * 0.10;
      mix.fossil_oil = fossilPool * 0.05;
      break;
    case 'DK':
      mix.fossil_gas = fossilPool * 0.55;
      mix.fossil_hard_coal = fossilPool * 0.40;
      mix.fossil_oil = fossilPool * 0.05;
      break;
    default:
      mix.fossil_gas = fossilPool * 0.6;
      mix.fossil_hard_coal = fossilPool * 0.3;
      mix.fossil_oil = fossilPool * 0.1;
  }

  const slices: FuelSlice[] = (Object.keys(mix) as FuelKind[])
    .map((kind) => ({
      kind,
      label: FUEL_LABELS[kind],
      mw: Math.round(mix[kind]),
      fossilFree: FOSSIL_FREE[kind],
    }))
    .filter((s) => s.mw > 0)
    .sort((a, b) => b.mw - a.mw);

  const totalMw = slices.reduce((sum, s) => sum + s.mw, 0);
  const cleanMw = slices.filter((s) => s.fossilFree).reduce((sum, s) => sum + s.mw, 0);
  const realFossilFreeShare = totalMw > 0 ? cleanMw / totalMw : 0;

  return {
    zone: zone.code,
    ts: ts.toISOString(),
    totalMw,
    fossilFreeShare: realFossilFreeShare,
    slices,
    source: 'mock',
  };
}

/**
 * Synthesize 24 hourly day-ahead prices for a bidding zone.
 *
 * Real day-ahead prices typically show a morning peak (~07:00–09:00) and
 * evening peak (~17:00–20:00) with a midday solar dip in solar-heavy zones.
 * The mock approximates this with two gaussians + a per-zone baseline.
 */
export function generateMockPrices(zoneCode: string, date: Date = new Date()): DayAheadPrices {
  const zone = getZone(zoneCode);
  if (!zone) throw new Error(`Unknown bidding zone: ${zoneCode}`);

  const dayKey = `prices-${zone.code}-${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  const rng = mulberry32(hashCode(dayKey));
  const dayMod = 0.85 + 0.3 * rng();

  const solarHeavy = zone.country === 'ES' || zone.country === 'DE' || zone.country === 'NL';

  const hourly = Array.from({ length: 24 }, (_, h) => {
    const morningPeak = Math.exp(-Math.pow((h - 8) / 1.6, 2)) * 28;
    const eveningPeak = Math.exp(-Math.pow((h - 18.5) / 1.7, 2)) * 38;
    const middayDip = solarHeavy ? -Math.exp(-Math.pow((h - 13) / 1.8, 2)) * 22 : 0;
    const noise = (rng() - 0.5) * 6;

    const price = (zone.mockPriceBase + morningPeak + eveningPeak + middayDip + noise) * dayMod;
    return { hour: h, price: Math.max(0, Math.round(price * 100) / 100) };
  });

  return {
    zone: zone.code,
    date: date.toISOString().slice(0, 10),
    currency: 'EUR',
    unit: 'EUR/MWh',
    hourly,
    source: 'mock',
  };
}

interface CacheEntry<T> { value: T; expires: number }
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60_000;

function cached<T>(key: string, build: () => T): T {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = build();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Map an Energy-Charts production_type name to our internal FuelKind.
 *
 * Energy-Charts strings come from the Fraunhofer ISE feed and aren't fully
 * documented as an enum, so anything we don't recognise gets dropped (returning
 * null). The "Load", "Residual load", "Renewable share..." entries are
 * intentionally not mapped — they are derived series, not generation.
 */
function mapEcFuelName(name: string): FuelKind | null {
  const n = name.trim().toLowerCase();
  if (n === 'nuclear') return 'nuclear';
  if (n.startsWith('hydro run-of-river') || n === 'hydro run of river' || n === 'hydro') return 'hydro';
  if (n.startsWith('hydro water reservoir')) return 'hydro';
  if (n.startsWith('hydro pumped storage')) return null; // storage, not generation source
  if (n === 'wind onshore') return 'wind_onshore';
  if (n === 'wind offshore') return 'wind_offshore';
  if (n === 'solar') return 'solar';
  if (n === 'biomass') return 'biomass';
  if (n === 'fossil gas' || n === 'natural gas') return 'fossil_gas';
  if (n === 'hard coal') return 'fossil_hard_coal';
  if (n === 'lignite' || n === 'fossil brown coal') return 'fossil_brown_coal';
  if (n === 'fossil oil' || n === 'oil') return 'fossil_oil';
  if (n === 'geothermal' || n === 'waste') return 'other_renewable';
  if (n === 'others' || n === 'other') return 'other';
  return null;
}

/**
 * Pick the latest non-null index that has at least one positive production
 * sample across the supplied series. Energy-Charts often pads the end of the
 * window with nulls while data is still being aggregated.
 */
function findLatestIndex(series: Array<{ data: Array<number | null> }>): number {
  if (series.length === 0) return -1;
  const length = series[0]?.data.length ?? 0;
  for (let i = length - 1; i >= 0; i--) {
    let any = false;
    for (const s of series) {
      const v = s.data[i];
      if (typeof v === 'number' && v > 0) { any = true; break; }
    }
    if (any) return i;
  }
  return length - 1;
}

interface EcProductionResponse {
  unix_seconds: number[];
  production_types: Array<{ name: string; data: Array<number | null> }>;
}

interface EcPriceResponse {
  unix_seconds?: number[];
  price?: Array<number | null>;
  unit?: string;
  license_info?: string;
  deprecated?: boolean;
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'GridSight/0.2' },
    });
    if (!res.ok) {
      throw new Error(`Energy-Charts ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live generation mix from Energy-Charts (Fraunhofer ISE).
 *
 * Endpoint:  GET /public_power?country=<cc>&start=<iso>&end=<iso>
 *   Returns time-aligned arrays of production by type (MW). We pull the most
 *   recent ~2 hour window, then take the latest fully-populated sample so we
 *   get a "right now" snapshot.
 */
async function fetchLiveMix(zoneCode: string): Promise<GenerationMix> {
  const zone = getZone(zoneCode);
  if (!zone) throw new Error(`Unknown bidding zone: ${zoneCode}`);

  const end = new Date();
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
  const url = `${env.ENERGY_CHARTS_BASE}/public_power`
    + `?country=${encodeURIComponent(zone.ecCountry)}`
    + `&start=${start.toISOString()}`
    + `&end=${end.toISOString()}`;

  const data = await fetchJson<EcProductionResponse>(url);
  if (!Array.isArray(data.production_types) || data.production_types.length === 0) {
    throw new Error('Energy-Charts response missing production_types');
  }

  const idx = findLatestIndex(data.production_types);
  if (idx < 0) throw new Error('Energy-Charts response had no usable samples');
  const sampleTs = (data.unix_seconds?.[idx] ?? Math.floor(Date.now() / 1000)) * 1000;

  const buckets = new Map<FuelKind, number>();
  for (const series of data.production_types) {
    const kind = mapEcFuelName(series.name);
    if (!kind) continue;
    const v = series.data[idx];
    if (typeof v !== 'number' || v <= 0) continue;
    buckets.set(kind, (buckets.get(kind) ?? 0) + v);
  }

  if (buckets.size === 0) {
    throw new Error('Energy-Charts mapping produced empty mix');
  }

  const slices: FuelSlice[] = Array.from(buckets.entries())
    .map(([kind, mw]) => ({
      kind,
      label: FUEL_LABELS[kind],
      mw: Math.round(mw),
      fossilFree: FOSSIL_FREE[kind],
    }))
    .filter((s) => s.mw > 0)
    .sort((a, b) => b.mw - a.mw);

  const totalMw = slices.reduce((sum, s) => sum + s.mw, 0);
  const cleanMw = slices.filter((s) => s.fossilFree).reduce((sum, s) => sum + s.mw, 0);
  const fossilFreeShare = totalMw > 0 ? cleanMw / totalMw : 0;

  return {
    zone: zone.code,
    ts: new Date(sampleTs).toISOString(),
    totalMw,
    fossilFreeShare,
    slices,
    source: 'live',
  };
}

/**
 * Live day-ahead prices from Energy-Charts.
 *
 * Endpoint:  GET /price?bzn=<bzn>&start=<iso>&end=<iso>
 *   Returns one price per hour in EUR/MWh. We request a slightly wider window
 *   than the calendar day so DST shifts don't drop edge hours, then bucket back
 *   to 0..23 by the local UTC hour of each timestamp.
 */
async function fetchLivePrices(zoneCode: string): Promise<DayAheadPrices> {
  const zone = getZone(zoneCode);
  if (!zone) throw new Error(`Unknown bidding zone: ${zoneCode}`);

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const url = `${env.ENERGY_CHARTS_BASE}/price`
    + `?bzn=${encodeURIComponent(zone.ecBzn)}`
    + `&start=${start.toISOString()}`
    + `&end=${end.toISOString()}`;

  const data = await fetchJson<EcPriceResponse>(url);
  if (!Array.isArray(data.unix_seconds) || !Array.isArray(data.price)) {
    throw new Error('Energy-Charts price response missing arrays');
  }

  const hourly: Array<{ hour: number; price: number }> = [];
  const seen = new Set<number>();
  for (let i = 0; i < data.unix_seconds.length; i++) {
    const sec = data.unix_seconds[i];
    const p = data.price[i];
    if (typeof sec !== 'number' || typeof p !== 'number') continue;
    const ts = new Date(sec * 1000);
    if (ts.getUTCFullYear() !== start.getUTCFullYear()
      || ts.getUTCMonth() !== start.getUTCMonth()
      || ts.getUTCDate() !== start.getUTCDate()) continue;
    const hour = ts.getUTCHours();
    if (seen.has(hour)) continue;
    seen.add(hour);
    hourly.push({ hour, price: Math.round(p * 100) / 100 });
  }

  if (hourly.length === 0) {
    throw new Error('Energy-Charts price response had no points for today');
  }

  hourly.sort((a, b) => a.hour - b.hour);

  return {
    zone: zone.code,
    date: start.toISOString().slice(0, 10),
    currency: 'EUR',
    unit: 'EUR/MWh',
    hourly,
    source: 'live',
  };
}

export type DataSource = 'auto' | 'mock' | 'live';

function resolveSource(requested: DataSource): 'mock' | 'live' {
  if (requested === 'mock') return 'mock';
  // Energy-Charts is open and unauthenticated — live is always available
  // unless the caller explicitly asks for the synthetic backend.
  return 'live';
}

export async function getMix(zoneCode: string, source: DataSource = 'auto'): Promise<GenerationMix> {
  const resolved = resolveSource(source);
  const key = `mix:${zoneCode}:${resolved}:${Math.floor(Date.now() / CACHE_TTL_MS)}`;
  if (resolved === 'live') {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as GenerationMix;
    try {
      const fresh = await fetchLiveMix(zoneCode);
      cache.set(key, { value: fresh, expires: Date.now() + CACHE_TTL_MS });
      return fresh;
    } catch (err) {
      logger.warn({ err, zoneCode }, 'Energy-Charts live mix failed — falling back to mock');
      // fall through to the mock path so the demo never goes blank
    }
  }
  return cached(`mix:mock:${zoneCode}:${Math.floor(Date.now() / CACHE_TTL_MS)}`, () => generateMockMix(zoneCode));
}

export async function getPrices(zoneCode: string, source: DataSource = 'auto'): Promise<DayAheadPrices> {
  const resolved = resolveSource(source);
  const key = `prices:${zoneCode}:${resolved}:${new Date().toISOString().slice(0, 10)}`;
  if (resolved === 'live') {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as DayAheadPrices;
    try {
      const fresh = await fetchLivePrices(zoneCode);
      cache.set(key, { value: fresh, expires: Date.now() + CACHE_TTL_MS });
      return fresh;
    } catch (err) {
      logger.warn({ err, zoneCode }, 'Energy-Charts live prices failed — falling back to mock');
    }
  }
  return cached(`prices:mock:${zoneCode}:${new Date().toISOString().slice(0, 10)}`, () => generateMockPrices(zoneCode));
}

export async function getZoneSummary(zoneCode: string, source: DataSource = 'auto'): Promise<ZoneSummary> {
  const zone = getZone(zoneCode);
  if (!zone) throw new Error(`Unknown bidding zone: ${zoneCode}`);

  const [mix, prices] = await Promise.all([getMix(zoneCode, source), getPrices(zoneCode, source)]);
  const currentHour = new Date().getUTCHours();
  const currentPrice = prices.hourly.find((h) => h.hour === currentHour)?.price ?? prices.hourly[0]!.price;
  const top = mix.slices[0]!;

  return {
    zone: zone.code,
    label: zone.label,
    country: zone.country,
    ts: mix.ts,
    totalMw: mix.totalMw,
    fossilFreeShare: mix.fossilFreeShare,
    currentPrice,
    topFuel: { kind: top.kind, label: top.label, mw: top.mw },
    source: mix.source,
  };
}

export async function getAllSummaries(source: DataSource = 'auto'): Promise<ZoneSummary[]> {
  return Promise.all(BIDDING_ZONES.map((z) => getZoneSummary(z.code, source)));
}
