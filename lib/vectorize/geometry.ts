import type { Point } from "@/types/vector";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function joinNearbyPaths(paths: Point[][], maxDistance: number) {
  const joined = paths.map(path => [...path]);
  if (maxDistance <= 0) return joined;
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let a = 0; a < joined.length; a++) for (let b = a + 1; b < joined.length; b++) {
      const left = joined[a], right = joined[b];
      const options: Array<[number, boolean, boolean]> = [
        [distance(left[left.length - 1], right[0]), false, false],
        [distance(left[left.length - 1], right[right.length - 1]), false, true],
        [distance(left[0], right[0]), true, false],
        [distance(left[0], right[right.length - 1]), true, true],
      ];
      const best = options.sort((x, y) => x[0] - y[0])[0];
      if (best[0] > maxDistance) continue;
      const l = best[1] ? [...left].reverse() : left;
      const r = best[2] ? [...right].reverse() : right;
      joined[a] = [...l, ...r];
      joined.splice(b, 1);
      changed = true;
      break outer;
    }
  }
  return joined;
}

export function chaikin(points: Point[], closed: boolean, iterations: number) {
  let result = [...points];
  for (let iteration = 0; iteration < iterations; iteration++) {
    if (result.length < 3) break;
    const next: Point[] = closed ? [] : [result[0]];
    const limit = closed ? result.length : result.length - 1;
    for (let i = 0; i < limit; i++) {
      const a = result[i], b = result[(i + 1) % result.length];
      next.push({ x: a.x * .75 + b.x * .25, y: a.y * .75 + b.y * .25 });
      next.push({ x: a.x * .25 + b.x * .75, y: a.y * .25 + b.y * .75 });
    }
    if (!closed) next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}
