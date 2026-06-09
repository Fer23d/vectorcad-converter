export type BinaryOperation = "dilate" | "erode";

export function morph(data: Uint8Array, width: number, height: number, radius: number, operation: BinaryOperation) {
  if (radius <= 0) return data.slice();
  const output = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = operation === "erode" ? 1 : 0;
    for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
      const inside = x + ox >= 0 && y + oy >= 0 && x + ox < width && y + oy < height;
      const sample = inside ? data[(y + oy) * width + x + ox] : 0;
      if (operation === "dilate" && sample) value = 1;
      if (operation === "erode" && !sample) value = 0;
    }
    output[y * width + x] = value;
  }
  return output;
}

export function closeBinary(data: Uint8Array, width: number, height: number, radius: number) {
  return morph(morph(data, width, height, radius, "dilate"), width, height, radius, "erode");
}

export function openBinary(data: Uint8Array, width: number, height: number, radius: number) {
  return morph(morph(data, width, height, radius, "erode"), width, height, radius, "dilate");
}

export function removeSmallComponents(data: Uint8Array, width: number, height: number, minArea: number) {
  if (minArea <= 1) return data.slice();
  const output = data.slice(), seen = new Uint8Array(data.length);
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || seen[start]) continue;
    const queue = [start], component: number[] = [];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor], x = index % width, y = Math.floor(index / width);
      component.push(index);
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy, next = ny * width + nx;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && data[next] && !seen[next]) {
          seen[next] = 1; queue.push(next);
        }
      }
    }
    if (component.length < minArea) for (const index of component) output[index] = 0;
  }
  return output;
}

export function boxBlur(gray: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return gray.slice();
  const output = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0, count = 0;
    for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
      const nx = x + ox, ny = y + oy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) { sum += gray[ny * width + nx]; count++; }
    }
    output[y * width + x] = sum / count;
  }
  return output;
}
