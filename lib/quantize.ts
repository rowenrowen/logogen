import sharp from 'sharp';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Quantizes a PNG image to a limited color palette using sharp-based sampling.
 * 
 * @param pngBuffer - PNG image buffer
 * @param maxColors - Maximum number of colors in palette (1-256)
 * @returns Promise with palette, indexed image, and dimensions
 */
export async function quantizeToPalette(
  pngBuffer: Buffer,
  maxColors: number
): Promise<{ palette: RGB[]; indexed: Uint8Array; width: number; height: number }> {
  // Get raw pixel data
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Sample pixels and bucket colors (round to nearest 16 to reduce noise)
  const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  const sampleStep = 8; // Sample every 8th pixel for efficiency

  for (let i = 0; i < data.length; i += channels * sampleStep) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Ignore near-white pixels (r,g,b > 245)
    if (r > 245 && g > 245 && b > 245) {
      continue;
    }

    // Bucket by rounding channels to nearest 16
    const bucketR = Math.round(r / 16) * 16;
    const bucketG = Math.round(g / 16) * 16;
    const bucketB = Math.round(b / 16) * 16;
    const bucketKey = `${bucketR},${bucketG},${bucketB}`;

    if (colorBuckets.has(bucketKey)) {
      const bucket = colorBuckets.get(bucketKey)!;
      // Update average color (weighted by count)
      const totalCount = bucket.count + 1;
      bucket.r = Math.round((bucket.r * bucket.count + r) / totalCount);
      bucket.g = Math.round((bucket.g * bucket.count + g) / totalCount);
      bucket.b = Math.round((bucket.b * bucket.count + b) / totalCount);
      bucket.count = totalCount;
    } else {
      colorBuckets.set(bucketKey, { r, g, b, count: 1 });
    }
  }

  // Sort by frequency and take top maxColors
  const sortedBuckets = Array.from(colorBuckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors);

  // Build palette
  const palette: RGB[] = sortedBuckets.map(bucket => ({
    r: bucket.r,
    g: bucket.g,
    b: bucket.b,
  }));

  // If no colors found (all white), add a default dark color
  if (palette.length === 0) {
    palette.push({ r: 17, g: 24, b: 39 }); // Default dark gray
  }

  // Create indexed image (each pixel is an index into the palette)
  const indexed = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Find nearest palette color
    let minDist = Infinity;
    let bestIndex = 0;

    for (let j = 0; j < palette.length; j++) {
      const pr = palette[j].r;
      const pg = palette[j].g;
      const pb = palette[j].b;
      const dr = r - pr;
      const dg = g - pg;
      const db = b - pb;
      const dist = dr * dr + dg * dg + db * db;

      if (dist < minDist) {
        minDist = dist;
        bestIndex = j;
      }
    }

    const pixelIndex = Math.floor(i / channels);
    indexed[pixelIndex] = bestIndex;
  }

  return {
    palette,
    indexed,
    width,
    height,
  };
}
