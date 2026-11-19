/**
 * Typical gas volume of a full medical oxygen cylinder, in litres.
 * Always check the label on your own cylinders; sizes and fill pressures vary.
 */
export const OXYGEN_CYLINDER_LITRES = {
  D: 425,
  E: 680,
} as const;

export type OxygenCylinderSize = keyof typeof OXYGEN_CYLINDER_LITRES;

export interface CylinderInput {
  /** Litres of oxygen in one full cylinder, or a standard size. */
  cylinder: OxygenCylinderSize | number;
  /** Prescribed flow in litres per minute. */
  flowLpm: number;
  /** Number of full cylinders. Default 1. */
  count?: number;
  /**
   * How many times longer a conserving (pulse) regulator makes a cylinder
   * last compared with continuous flow. Default 1 (continuous flow).
   */
  conserverRatio?: number;
  /** Share of each cylinder kept in reserve, from 0 to 1. Default 0.1. */
  reserveFraction?: number;
}

/** Hours a supply of oxygen cylinders lasts at a given flow. */
export function oxygenCylinderHours(input: CylinderInput): number {
  const litres =
    typeof input.cylinder === 'number' ? input.cylinder : OXYGEN_CYLINDER_LITRES[input.cylinder];
  if (!(input.flowLpm > 0)) return Number.POSITIVE_INFINITY;
  const count = Math.max(0, input.count ?? 1);
  const ratio = Math.max(1, input.conserverRatio ?? 1);
  const reserve = Math.min(1, Math.max(0, input.reserveFraction ?? 0.1));
  return (Math.max(0, litres) * count * (1 - reserve) * ratio) / input.flowLpm / 60;
}
