/**
 * Maps local drawing coordinates into the document's canonical CAD space.
 * The transform is applied as: origin + rotation(scale * point).
 */
export type CoordinateUnit = "pixel" | "millimeter" | "centimeter" | "meter";

export type CoordinateSystemSource = "image" | "manual" | "imported";

export type CoordinateSystem = {
  id: string;
  origin: { x: number; y: number };
  scale: { x: number; y: number };
  /** Counter-clockwise rotation in radians. */
  rotation: number;
  unit: CoordinateUnit;
  /** Decimal places retained after an affine transform. */
  precision: number;
  createdFrom: CoordinateSystemSource;
};
