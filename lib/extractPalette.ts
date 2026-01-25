import sharp from 'sharp';

/**
 * Extracts a color palette from a PNG image by sampling pixels.
 * 
 * @param pngBuffer - PNG image buffer
 * @param maxColors - Maximum number of colors to extract (default 8)
 * @returns Array of RGB color strings like ["rgb(255,0,0)", ...]
 */
export async function extractPalette(
  pngBuffer: Buffer,
  maxColors: number = 8
): Promise<string[]> {
  // Resize to 64x64 for faster processing
  const { data, info } = await sharp(pngBuffer)
    .resize(64, 64, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width || 64;
  const height = info.height || 64;
  const channels = info.channels || 3; // RGB

  // Collect non-white pixels
  const colorBins = new Map<string, number>(); // color -> frequency
  const minDistSq = 900; // Minimum squared distance between colors (30^2)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Ignore near-white pixels (r,g,b >= 245)
      if (r >= 245 && g >= 245 && b >= 245) {
        continue;
      }

      // Check if this color is close to an existing bin
      let foundBin = false;
      for (const [binColor, _] of colorBins.entries()) {
        const [binR, binG, binB] = binColor.split(',').map(Number);
        const distSq = (r - binR) ** 2 + (g - binG) ** 2 + (b - binB) ** 2;
        
        if (distSq < minDistSq) {
          // Merge into existing bin
          colorBins.set(binColor, (colorBins.get(binColor) || 0) + 1);
          foundBin = true;
          break;
        }
      }

      if (!foundBin) {
        // Create new bin
        const colorKey = `${r},${g},${b}`;
        colorBins.set(colorKey, 1);
      }
    }
  }

  // If we have too many colors, keep the most frequent ones
  let palette: string[] = [];
  if (colorBins.size <= maxColors) {
    // Use all colors
    palette = Array.from(colorBins.keys()).map(key => {
      const [r, g, b] = key.split(',').map(Number);
      return `rgb(${r},${g},${b})`;
    });
  } else {
    // Sort by frequency and take top maxColors
    const sorted = Array.from(colorBins.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency (descending)
      .slice(0, maxColors);

    palette = sorted.map(([key]) => {
      const [r, g, b] = key.split(',').map(Number);
      return `rgb(${r},${g},${b})`;
    });
  }

  // If no colors found (all white), return a default dark color
  if (palette.length === 0) {
    palette = ['rgb(17,24,39)']; // Default dark gray
  }

  return palette;
}
