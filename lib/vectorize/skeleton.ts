/** Result of a binary thinning pass. Coordinates remain aligned with the input bitmap. */
export type SkeletonResult = {
  data: Uint8Array;
  width: number;
  height: number;
  iterations: number;
  removedPixels: number;
};

export type SkeletonOptions = {
  /** Limits work on large technical drawings while retaining a useful centerline mask. */
  maxIterations?: number;
};

const defaultOptions: Required<SkeletonOptions> = { maxIterations: 32 };

function transitions(neighbors: number[]) {
  let changes = 0;
  for (let index = 0; index < neighbors.length; index++) {
    if (neighbors[index] === 0 && neighbors[(index + 1) % neighbors.length] === 1) changes++;
  }
  return changes;
}

function neighborsAt(data: Uint8Array, width: number, x: number, y: number) {
  const at = (offsetX: number, offsetY: number) => data[(y + offsetY) * width + x + offsetX] ? 1 : 0;
  // P2 through P9, clockwise, as defined by the Zhang-Suen thinning algorithm.
  return [at(0, -1), at(1, -1), at(1, 0), at(1, 1), at(0, 1), at(-1, 1), at(-1, 0), at(-1, -1)];
}

function markForRemoval(data: Uint8Array, width: number, height: number, firstPass: boolean) {
  const marked: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      if (!data[index]) continue;
      const neighbors = neighborsAt(data, width, x, y);
      const count = neighbors.reduce((total, value) => total + value, 0);
      if (count < 2 || count > 6 || transitions(neighbors) !== 1) continue;
      const p2 = neighbors[0], p4 = neighbors[2], p6 = neighbors[4], p8 = neighbors[6];
      const preservesConnectivity = firstPass
        ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0
        : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0;
      if (preservesConnectivity) marked.push(index);
    }
  }
  return marked;
}

/**
 * Produces a one-pixel centerline mask from a binary foreground bitmap. It is
 * intentionally independent from contour extraction so later architectural
 * detectors can use it for walls, pipes and centerlines without changing paths.
 */
export function skeletonizeBitmap(input: Uint8Array, width: number, height: number, options: SkeletonOptions = {}): SkeletonResult {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || input.length !== width * height) {
    throw new Error("Skeletonization requires a bitmap matching the supplied dimensions.");
  }

  const settings = { ...defaultOptions, ...options };
  const data = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index++) data[index] = input[index] ? 1 : 0;

  let iterations = 0;
  let removedPixels = 0;
  while (iterations < settings.maxIterations) {
    const first = markForRemoval(data, width, height, true);
    for (const index of first) data[index] = 0;
    const second = markForRemoval(data, width, height, false);
    for (const index of second) data[index] = 0;
    removedPixels += first.length + second.length;
    iterations++;
    if (!first.length && !second.length) break;
  }

  return { data, width, height, iterations, removedPixels };
}
