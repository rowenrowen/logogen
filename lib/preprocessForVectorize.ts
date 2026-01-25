import sharp from 'sharp';

/**
 * Preprocesses PNG buffer for clean vectorization
 * Applies median filter to remove noise and sharpening to restore crisp edges
 * @param pngBuffer - Input PNG buffer
 * @returns Preprocessed PNG buffer with clean edges
 */
export async function preprocessForVectorize(pngBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(pngBuffer)
      .ensureAlpha()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 }
      })
      .median(1) // Remove speckle noise / pixel chatter
      .sharpen(0.4) // Restore crisp edges without over-sharpening
      .png()
      .toBuffer();
  } catch (error) {
    console.warn('Edge preprocessing failed, using original:', error);
    return pngBuffer;
  }
}
