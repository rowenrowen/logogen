import quantize from 'quantize';
import sharp from 'sharp';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Quantizes a PNG image to a limited color palette.
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

  // Extract RGB pixels (ignore alpha)
  const pixels: number[][] = [];
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    pixels.push([r, g, b]);
  }

  // Quantize using median cut algorithm
  const colorMap = quantize(pixels, maxColors);

  if (!colorMap) {
    throw new Error('Quantization failed');
  }

  // Get palette
  const palette: RGB[] = [];
  const paletteSize = colorMap.size();
  for (let i = 0; i < paletteSize; i++) {
    const [r, g, b] = colorMap.palette()[i];
    palette.push({ r: Math.round(r), g: Math.round(g), b: Math.round(b) });
  }

  // Create indexed image (each pixel is an index into the palette)
  // Use nearest-color assignment if colorMap.map doesn't work correctly
  const indexed = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = pixels[i];
    
    // Try colorMap.map first
    let index = colorMap.map([r, g, b]);
    
    // If that fails or returns invalid, use nearest-color search
    if (index === undefined || index < 0 || index >= paletteSize) {
      let minDist = Infinity;
      let bestIndex = 0;
      
      for (let j = 0; j < paletteSize; j++) {
        const [pr, pg, pb] = colorMap.palette()[j];
        const dr = r - pr;
        const dg = g - pg;
        const db = b - pb;
        const dist = dr * dr + dg * dg + db * db;
        
        if (dist < minDist) {
          minDist = dist;
          bestIndex = j;
        }
      }
      
      index = bestIndex;
    }
    
    indexed[i] = index;
  }

  return {
    palette,
    indexed,
    width,
    height,
  };
}
