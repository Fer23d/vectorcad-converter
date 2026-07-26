/** Shared 2D coordinate used by the CAD geometry model. */
export type CadPoint = {
  x: number;
  y: number;
};

export type CadEntityType = "LINE" | "CIRCLE" | "ELLIPSE" | "ARC" | "SPLINE" | "LWPOLYLINE" | "POLYGON";

export type CadEntitySource = "legacy-vector-path" | "contour-extraction" | "geometry-recognition" | "manual" | "import";

export type CadEntityMetadataValue = string | number | boolean | null | CadPoint | CadPoint[];
export type CadEntityMetadata = Record<string, CadEntityMetadataValue>;

type CadEntityBase<Type extends CadEntityType, Coordinates> = {
  id: string;
  type: Type;
  layer: string;
  source: CadEntitySource;
  confidence: number;
  coordinates: Coordinates;
  metadata: CadEntityMetadata;
};

export type CadLineEntity = CadEntityBase<"LINE", {
  start: CadPoint;
  end: CadPoint;
}>;

export type CadCircleEntity = CadEntityBase<"CIRCLE", {
  center: CadPoint;
  radius: number;
}>;

/** Preserves truthful geometry when a circle receives non-uniform X/Y scaling. */
export type CadEllipseEntity = CadEntityBase<"ELLIPSE", {
  center: CadPoint;
  majorRadius: number;
  minorRadius: number;
  rotation: number;
}>;

export type CadArcEntity = CadEntityBase<"ARC", {
  center: CadPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
}>;

export type CadSplineEntity = CadEntityBase<"SPLINE", {
  fitPoints: CadPoint[];
  controlPoints?: CadPoint[];
  degree?: number;
  closed?: boolean;
}>;

export type CadLwPolylineEntity = CadEntityBase<"LWPOLYLINE", {
  points: CadPoint[];
  closed: boolean;
}>;

export type CadPolygonEntity = CadEntityBase<"POLYGON", {
  points: CadPoint[];
}>;

export type CadEntity =
  | CadLineEntity
  | CadCircleEntity
  | CadEllipseEntity
  | CadArcEntity
  | CadSplineEntity
  | CadLwPolylineEntity
  | CadPolygonEntity;
