import sharp from 'sharp';

/**
 * Preprocesses a PNG image to ensure a pure white background.
 * 
 * Steps:
 * 1. Validates the image can be decoded
 * 2. Ensures alpha channel and flattens transparency onto white background
 * 3. Returns processed PNG buffer (consistent, used everywhere)
 * 
 * @param pngBuffer - PNG image buffer from OpenAI
 * @returns Processed PNG buffer with guaranteed white background
 */
export async function preprocessToWhitePng(pngBuffer: Buffer): Promise<Buffer> {
  // Validate first
  await validateImageBuffer(pngBuffer);

  // Preprocess: ensure alpha and flatten onto white background
  // This is the single source of truth - all QC functions use this processed buffer
  const processed = await sharp(pngBuffer)
    .ensureAlpha()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  return processed;
}

/**
 * Validates that an image buffer can be decoded and is valid.
 * 
 * @param pngBuffer - PNG image buffer to validate
 * @returns true if valid, throws error if invalid
 */
export async function validateImageBuffer(pngBuffer: Buffer): Promise<boolean> {
  if (!pngBuffer || pngBuffer.length === 0) {
    throw new Error('Image buffer is empty');
  }

  if (pngBuffer.length < 100) {
    throw new Error('Image buffer too small (likely invalid)');
  }

  try {
    // Try to decode and get metadata
    const metadata = await sharp(pngBuffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Image has invalid dimensions');
    }

    if (metadata.width < 10 || metadata.height < 10) {
      throw new Error('Image dimensions too small');
    }

    return true;
  } catch (error) {
    throw new Error(`Invalid image buffer: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validates a base64 string before decoding.
 * 
 * @param base64 - Base64-encoded image string
 * @returns true if valid, throws error if invalid
 */
export function validateBase64(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Base64 string is missing or invalid type');
  }

  if (base64.length < 1000) {
    throw new Error('Base64 string too short (likely invalid image data)');
  }

  // Basic base64 validation (should only contain valid base64 chars)
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(base64)) {
    throw new Error('Base64 string contains invalid characters');
  }

  return true;
}
