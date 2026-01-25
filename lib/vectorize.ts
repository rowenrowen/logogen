import { BinaryImageConverter, BinaryImageConverterParams, Options, RawImageData } from 'vectortracer';
// @ts-ignore - sharp default import
import sharp from 'sharp';
import { normalizeSvg } from './normalizeSvg';
import { getPalette } from './palettes';
import { recolorSvg } from './recolorSvg';
import { sanitizeSvg } from './sanitizeSvg';

/**
 * Preprocesses PNG to black-and-white (dark ink on white) before vectorization.
 * This ensures the SVG has visible content and isn't white-on-white.
 * 
 * @param pngBuffer - PNG image buffer (already flattened to white)
 * @returns Promise<{ buffer: Buffer, wasInverted: boolean }> - Preprocessed black-and-white PNG buffer and inversion flag
 */
async function preprocessToBlackWhite(pngBuffer: Buffer): Promise<{ buffer: Buffer, wasInverted: boolean }> {
  // Step 1: Convert to grayscale and apply threshold
  const bw = await sharp(pngBuffer)
    .ensureAlpha()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .grayscale()
    .threshold(200) // Pixels >= 200 become white (255), < 200 become black (0)
    .png()
    .toBuffer();

  // Step 2: Detect if it's inverted (white icon on black background)
  // Downsample to 64x64 for fast analysis
  const { data, info } = await sharp(bw)
    .resize(64, 64, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const borderThickness = 4; // ~6% of 64px
  let borderPixels = 0;
  let whiteBorderPixels = 0;

  // Sample border pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBorder = x < borderThickness || x >= width - borderThickness ||
                       y < borderThickness || y >= height - borderThickness;
      
      if (isBorder) {
        borderPixels++;
        const idx = (y * width + x) * channels;
        const r = data[idx];
        // In grayscale, r=g=b, so just check r
        if (r >= 245) { // White pixel
          whiteBorderPixels++;
        }
      }
    }
  }

  const borderWhiteRatio = borderPixels > 0 ? whiteBorderPixels / borderPixels : 1;

  // If border is mostly black (< 0.8 white), it's inverted - need to negate
  let finalBuffer = bw;
  let wasInverted = false;
  
  if (borderWhiteRatio < 0.8) {
    // Invert: white icon on black background -> black icon on white background
    finalBuffer = await sharp(bw)
      .negate()
      .png()
      .toBuffer();
    wasInverted = true;
  }

  return { buffer: finalBuffer, wasInverted };
}

/**
 * Converts a PNG buffer to RawImageData format for vectortracer.
 */
async function bufferToRawImageData(buffer: Buffer): Promise<RawImageData> {
  // Use sharp to decode the image and get raw pixel data
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Convert to RawImageData format
  const rawImageData: RawImageData = {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  };

  return rawImageData;
}

/**
 * Ensures SVG paths are not white (replaces white fills with dark color).
 * 
 * @param svg - SVG string to process
 * @returns string - SVG with white fills replaced by dark color
 */
function ensureNonWhitePaths(svg: string): string {
  // Replace white fills/strokes with dark color
  const darkColor = '#111827'; // Dark gray/black
  
  // Replace fill="white", fill="#fff", fill="#ffffff", fill="rgb(255,255,255)"
  let processed = svg
    .replace(/fill="white"/gi, `fill="${darkColor}"`)
    .replace(/fill="#fff"/gi, `fill="${darkColor}"`)
    .replace(/fill="#ffffff"/gi, `fill="${darkColor}"`)
    .replace(/fill="rgb\(255,\s*255,\s*255\)"/gi, `fill="${darkColor}"`)
    .replace(/stroke="white"/gi, `stroke="${darkColor}"`)
    .replace(/stroke="#fff"/gi, `stroke="${darkColor}"`)
    .replace(/stroke="#ffffff"/gi, `stroke="${darkColor}"`)
    .replace(/stroke="rgb\(255,\s*255,\s*255\)"/gi, `stroke="${darkColor}"`);

  // Also check for paths without explicit fill (might default to white)
  // If a path has no fill attribute, add a dark fill
  processed = processed.replace(
    /<path([^>]*?)(?!fill=)([^>]*)>/gi,
    (match, before, after) => {
      // If no fill attribute exists, add one
      if (!match.includes('fill=')) {
        return `<path${before} fill="${darkColor}"${after}>`;
      }
      return match;
    }
  );

  return processed;
}

/**
 * Checks if SVG has visible content (non-white paths).
 * 
 * @param svg - SVG string to check
 * @returns boolean - true if SVG has visible paths
 */
function hasVisibleContent(svg: string): boolean {
  // Check if SVG has any paths
  const hasPaths = /<path[^>]*>/i.test(svg);
  if (!hasPaths) {
    return false;
  }

  // Check if all fills are white/transparent/none
  const fillMatches = svg.match(/fill="([^"]+)"/gi) || [];
  const strokeMatches = svg.match(/stroke="([^"]+)"/gi) || [];
  
  const allFills = [...fillMatches, ...strokeMatches];
  if (allFills.length === 0) {
    // No fills/strokes defined - might be using default black
    return true;
  }

  // Check if any fill/stroke is not white/transparent
  const nonWhitePattern = /fill="(?!none|transparent|#fff|#ffffff|white|rgb\(255,\s*255,\s*255\))/i;
  const hasNonWhite = nonWhitePattern.test(svg);
  
  return hasNonWhite;
}

/**
 * Vectorizes a PNG image buffer to SVG using vectortracer.
 * Preprocesses PNG to black-and-white to ensure visible output.
 * 
 * @param imageBuffer - PNG image buffer
 * @param colorMode - Color mode for recoloring (optional, defaults to 'monochrome')
 * @returns Promise<{ svg: string, vectorMeta: { paths: number, colors: number, wasInverted: boolean, hasViewBox: boolean, paletteUsed: string[] } }>
 * @throws Error if SVG has no visible content
 */
export async function vectorizeImage(
  imageBuffer: Buffer,
  colorMode: 'monochrome' | 'muted' | 'bold' = 'monochrome'
): Promise<{ svg: string, vectorMeta: { paths: number, colors: number, wasInverted: boolean, hasViewBox: boolean, paletteUsed: string[], sanitized: boolean } }> {
  // Preprocess to black-and-white (dark ink on white)
  const { buffer: bwBuffer, wasInverted } = await preprocessToBlackWhite(imageBuffer);

  // Convert buffer to RawImageData
  const rawImageData = await bufferToRawImageData(bwBuffer);
  
  // Create ImageData-like object (BinaryImageConverter expects ImageData interface)
  // In Node.js, we need to create a compatible object
  const imageData = {
    data: rawImageData.data,
    width: rawImageData.width,
    height: rawImageData.height,
    colorSpace: 'srgb' as const, // Add colorSpace property
  } as ImageData;

  // VTracer options tuned for logo icons
  const converterOptions: BinaryImageConverterParams = {
    debug: false,
    mode: 'spline', // Smooth curves
    cornerThreshold: 60, // Smooth corners
    lengthThreshold: 4, // Smooth paths
    maxIterations: 10, // Balance between quality and speed
    spliceThreshold: 2, // Clean path splicing
    filterSpeckle: 4, // Remove small noise
    pathPrecision: 3, // Smooth curve precision
  };

  // Additional options - ensure black paths on white background
  const options: Options = {
    invert: false, // Don't invert - we want black on white
    pathFill: '#000000', // Force black fill for paths
    backgroundColor: '#FFFFFF', // White background
    attributes: undefined,
    scale: 1,
  };

  // Create converter
  const converter = new BinaryImageConverter(imageData, converterOptions, options);

  // Process in async loop
  const svg = await new Promise<string>((resolve, reject) => {
    try {
      converter.init();
      
      const tick = () => {
        try {
          const done = converter.tick();
          if (!done) {
            // Use setImmediate for async processing (Node.js compatible)
            setImmediate(tick);
          } else {
            const result = converter.getResult();
            converter.free();
            resolve(result);
          }
        } catch (error) {
          converter.free();
          reject(error);
        }
      };
      
      setImmediate(tick);
    } catch (error) {
      // If converter constructor fails
      reject(error);
    }
  });

  // Post-process: Ensure paths are not white (safety net)
  let processedSvg = ensureNonWhitePaths(svg);

  // Normalize SVG: add viewBox, dimensions, white background, stable viewport
  processedSvg = normalizeSvg(processedSvg);

  // Recolor SVG using palette
  const palette = getPalette(colorMode);
  processedSvg = recolorSvg(processedSvg, palette);

  // Sanitize SVG: remove problematic elements that break <img> rendering
  processedSvg = sanitizeSvg(processedSvg);

  // Safeguard: Check if SVG has visible content
  if (!hasVisibleContent(processedSvg)) {
    throw new Error('Vectorization produced SVG with no visible content (likely white-on-white)');
  }

  // Extract metadata from SVG
  const pathCount = (processedSvg.match(/<path/g) || []).length;
  const colorMatches = processedSvg.match(/(?:fill|stroke)="([^"]+)"/g) || [];
  const uniqueColors = new Set(colorMatches.map(m => m.match(/"([^"]+)"/)?.[1] || '').filter(c => c && c !== 'none' && c !== 'transparent' && c !== '#FFFFFF' && c !== 'white'));
  const hasViewBox = /viewBox\s*=/i.test(processedSvg);

  return {
    svg: processedSvg,
    vectorMeta: {
      paths: pathCount,
      colors: uniqueColors.size,
      wasInverted,
      hasViewBox,
      paletteUsed: palette,
      sanitized: true,
    },
  };
}
