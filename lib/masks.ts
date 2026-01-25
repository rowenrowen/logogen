import sharp from 'sharp';

/**
 * Creates a binary mask for a specific palette color index.
 * Pixels matching the target index are black (0), others are white (255).
 * Applies cleanup to remove speckles.
 * 
 * @param indexed - Indexed image array (Uint8Array)
 * @param width - Image width
 * @param height - Image height
 * @param targetIndex - Palette index to create mask for
 * @returns PNG buffer with binary mask (black=target, white=other)
 */
export async function makeMask(
  indexed: Uint8Array,
  width: number,
  height: number,
  targetIndex: number
): Promise<{ buffer: Buffer; inkPct: number }> {
  // Create grayscale image where target pixels are black (0) and others white (255)
  const maskData = new Uint8Array(width * height);
  let inkPixels = 0;
  
  for (let i = 0; i < indexed.length; i++) {
    if (indexed[i] === targetIndex) {
      maskData[i] = 0; // Black = ink
      inkPixels++;
    } else {
      maskData[i] = 255; // White = background
    }
  }

  // Calculate ink percentage
  const inkPct = inkPixels / (width * height);

  // Create PNG from raw data
  let maskBuffer = await sharp(maskData, {
    raw: {
      width,
      height,
      channels: 1,
    },
  })
    .png()
    .toBuffer();

  // Apply cleanup: blur + threshold to remove speckles
  maskBuffer = await sharp(maskBuffer)
    .greyscale()
    .blur(0.5) // Light blur to smooth edges
    .threshold(128) // Convert to pure black/white
    .png()
    .toBuffer();

  return { buffer: maskBuffer, inkPct };
}
