import type { FuelKind } from '../core/types';

/**
 * Per-fuel colors. Picked so that:
 *   - Fossil-free fuels lean cool (cyan/violet/green) — visually allied with the
 *     amber-on-dark UI without competing for the accent.
 *   - Fossil fuels lean warm/grey — recognisably "carbon".
 *
 * Solar uses a desaturated yellow (not the brand amber) so the brand accent
 * remains exclusive to GridSight chrome.
 */
export const FUEL_COLOR: Record<FuelKind, string> = {
  nuclear:           '#a78bfa',
  hydro:             '#7cdfff',
  wind_onshore:      '#5fa8d3',
  wind_offshore:     '#3d8c91',
  solar:             '#fbbf24',
  biomass:           '#4ade80',
  fossil_gas:        '#fb923c',
  fossil_hard_coal:  '#9ca3af',
  fossil_brown_coal: '#a16207',
  fossil_oil:        '#dc2626',
  other_renewable:   '#86efac',
  other:             '#6b7280',
};

export function fuelColor(kind: FuelKind): string {
  return FUEL_COLOR[kind] ?? '#6b7280';
}
