import type { CadEntity, CadEntityType, CadLineEntity, CadLwPolylineEntity, CadCircleEntity } from "@/types/cad-geometry";
import { fitCircle, type CircleFitOptions } from "@/lib/geometry-recognition/circle-fit";
import { clonePoint } from "@/lib/geometry-recognition/geometry-utils";
import { fitLine, type LineFitOptions } from "@/lib/geometry-recognition/line-fit";
import type { RecognitionProfile, VectorDocument, VectorPath } from "@/types/vector";

export type RecognitionOptions = {
  minimumConfidence?: number;
  line?: LineFitOptions;
  circle?: CircleFitOptions;
};

const defaults: Required<Pick<RecognitionOptions, "minimumConfidence">> = {
  minimumConfidence: 0.9,
};

const profileOptions: Record<RecognitionProfile, RecognitionOptions> = {
  default: { minimumConfidence: 0.9 },
  architecture: { minimumConfidence: 0.92, line: { maxAbsoluteResidual: 1, maxRelativeResidual: 0.01 } },
  mechanical: { minimumConfidence: 0.94, circle: { maxRelativeResidual: 0.015 } },
  logo: { minimumConfidence: 0.86, line: { maxAbsoluteResidual: 1.75, maxRelativeResidual: 0.02 } },
  precision: { minimumConfidence: 0.96, line: { maxAbsoluteResidual: 0.5, maxRelativeResidual: 0.005 }, circle: { maxRelativeResidual: 0.01 } },
};

export type GeometryRecognitionDiagnostics = {
  profile: RecognitionProfile;
  total: number;
  counts: Record<CadEntityType, number>;
};

export class GeometryRecognitionEngine {
  recognize(paths: VectorPath[], options: RecognitionOptions = {}): CadEntity[] {
    return paths.map((path, index) => this.recognizePath(path, index, options));
  }

  recognizeWithProfile(paths: VectorPath[], profile: RecognitionProfile = "default"): CadEntity[] {
    return this.recognize(paths, profileOptions[profile]);
  }

  recognizePath(path: VectorPath, index = 0, options: RecognitionOptions = {}): CadEntity {
    const minimumConfidence = options.minimumConfidence ?? defaults.minimumConfidence;
    const id = `geometry-${index + 1}`;

    if (!path.closed) {
      const line = fitLine(path.points, options.line);
      if (line && line.confidence >= minimumConfidence) return this.withSourceMetadata(this.lineEntity(id, path, line), path, index);
    }

    if (path.closed) {
      const circle = fitCircle(path.points, options.circle);
      if (circle && circle.confidence >= minimumConfidence) return this.withSourceMetadata(this.circleEntity(id, path, circle), path, index);
    }

    return this.withSourceMetadata(this.polylineEntity(id, path), path, index);
  }

  private lineEntity(id: string, path: VectorPath, line: NonNullable<ReturnType<typeof fitLine>>): CadLineEntity {
    return {
      id,
      type: "LINE",
      layer: path.layer,
      source: "geometry-recognition",
      confidence: line.confidence,
      coordinates: { start: line.start, end: line.end },
      metadata: { fitError: line.residual, fitLength: line.length },
    };
  }

  private circleEntity(id: string, path: VectorPath, circle: NonNullable<ReturnType<typeof fitCircle>>): CadCircleEntity {
    return {
      id,
      type: "CIRCLE",
      layer: path.layer,
      source: "geometry-recognition",
      confidence: circle.confidence,
      coordinates: { center: circle.center, radius: circle.radius },
      metadata: { fitError: circle.residual, coverageRatio: circle.coverageRatio },
    };
  }

  private polylineEntity(id: string, path: VectorPath): CadLwPolylineEntity {
    return {
      id,
      type: "LWPOLYLINE",
      layer: path.layer,
      source: "contour-extraction",
      confidence: 0,
      coordinates: { points: path.points.map(clonePoint), closed: path.closed },
      metadata: { curved: Boolean(path.curved), recognition: "fallback" },
    };
  }

  private withSourceMetadata(entity: CadEntity, path: VectorPath, index: number): CadEntity {
    return {
      ...entity,
      metadata: {
        ...entity.metadata,
        sourcePathId: path.id || `path-${index + 1}`,
        originalPoints: path.points.map(clonePoint),
        recognitionConfidence: entity.confidence,
        fitError: entity.metadata.fitError ?? null,
      },
    };
  }
}

export const geometryRecognitionEngine = new GeometryRecognitionEngine();

export function summarizeGeometryRecognition(entities: CadEntity[], profile: RecognitionProfile): GeometryRecognitionDiagnostics {
  const counts: Record<CadEntityType, number> = { LINE: 0, CIRCLE: 0, ELLIPSE: 0, ARC: 0, SPLINE: 0, LWPOLYLINE: 0, POLYGON: 0 };
  for (const entity of entities) counts[entity.type] += 1;
  return { profile, total: entities.length, counts };
}

/** Adds geometry entities without removing the legacy path representation. */
export function recognizeDocumentGeometry(document: VectorDocument, profile: RecognitionProfile = "default") {
  const entities = geometryRecognitionEngine.recognizeWithProfile(document.paths, profile);
  return {
    document: { ...document, entities },
    diagnostics: summarizeGeometryRecognition(entities, profile),
  };
}
