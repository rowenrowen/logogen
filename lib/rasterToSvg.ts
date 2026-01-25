import sharp from 'sharp';
import { normalizeSvg } from './normalizeSvg';
import { sanitizeSvg } from './sanitizeSvg';
import { postprocessSvg } from './postprocessSvg';
import { remapSvgToPalette } from './remapSvgToPalette';
import { ensureWhiteBackground } from './ensureWhiteBackground';
// @ts-ignore - imagetracerjs may not have perfect TypeScript types
import ImageTracer from 'imagetracerjs';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Auto-crops SVG viewBox to match the visible ink content (removes huge whitespace).
 * 
 * @param svg - SVG string
 * @returns Cropped SVG string and crop box info
 */
async function cropSvgViewBox(svg: string): Promise<{ cropped: string; cropBox: { x: number; y: number; width: number; height: number } | null }> {
  try {
    // Rasterize SVG to PNG at 512x512
    const svgBuffer = Buffer.from(svg, 'utf-8');
    const pngBuffer = await sharp(svgBuffer, { density: 72 })
      .resize(512, 512, { fit: 'inside' })
      .png()
      .toBuffer();

    // Get raw pixel data
    const { data, info } = await sharp(pngBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // Find bounding box of non-white pixels (r,g,b < 250)
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let hasInk = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Treat as ink if any channel < 250
        if (r < 250 || g < 250 || b < 250) {
          hasInk = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasInk) {
      // No ink found, return original SVG
      return { cropped: svg, cropBox: null };
    }

    // Add padding (6% of size)
    const padding = Math.max(width, height) * 0.06;
    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;
    
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);
    
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // Parse existing viewBox from SVG
    const viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (!viewBoxMatch) {
      // No viewBox found, return original
      return { cropped: svg, cropBox: null };
    }

    const originalViewBox = viewBoxMatch[1].split(/\s+/).map(Number);
    const [origX, origY, origW, origH] = originalViewBox;

    // Scale crop coordinates to original viewBox space
    const scaleX = origW / width;
    const scaleY = origH / height;
    
    const cropX = origX + (minX * scaleX);
    const cropY = origY + (minY * scaleY);
    const cropWidth = cropW * scaleX;
    const cropHeight = cropH * scaleY;

    // Replace viewBox in SVG
    const newViewBox = `${cropX} ${cropY} ${cropWidth} ${cropHeight}`;
    const cropped = svg.replace(
      /viewBox\s*=\s*["'][^"']+["']/i,
      `viewBox="${newViewBox}"`
    );

    // Ensure preserveAspectRatio is set
    let finalSvg = cropped;
    if (!/preserveAspectRatio\s*=/i.test(finalSvg)) {
      // Add preserveAspectRatio to svg tag
      finalSvg = finalSvg.replace(
        /<svg([^>]*?)>/i,
        '<svg$1 preserveAspectRatio="xMidYMid meet">'
      );
    } else {
      // Update existing preserveAspectRatio
      finalSvg = finalSvg.replace(
        /preserveAspectRatio\s*=\s*["'][^"']*["']/i,
        'preserveAspectRatio="xMidYMid meet"'
      );
    }

    return {
      cropped: finalSvg,
      cropBox: {
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight,
      },
    };
  } catch (error) {
    console.error('Failed to crop SVG viewBox:', error);
    // Return original SVG on error
    return { cropped: svg, cropBox: null };
  }
}

/**
 * Converts a PNG raster image to a multi-color SVG using ImageTracerJS.
 * 
 * @param pngBuffer - PNG image buffer
 * @param colorMode - Color mode (monochrome, muted, bold)
 * @param fidelity - SVG color fidelity (flat, shaded, max)
 * @returns Promise with SVG string and metadata
 */
export async function rasterToSvg(
  pngBuffer: Buffer,
  colorMode: 'monochrome' | 'muted' | 'bold',
  fidelity: 'flat' | 'shaded' | 'max' = 'shaded',
  extractedPalette?: string[] // Optional palette for color remapping
): Promise<{ 
  svg: string; 
  vectorMeta: { 
    colors: number; 
    paths: number; 
    palette: RGB[]; 
    engine: string; 
    width: number; 
    height: number;
    fidelity: string;
      colorsUsed: number;
      blurSigma: number;
      pathomit: number;
      ltres: number;
      qtres: number;
      removedTinyPathsCount: number;
      removedNearWhiteCount: number;
      cropBox: { x: number; y: number; width: number; height: number } | null;
      remapDebug?: {
        extractedPalette: string[];
        uniqueFillsBefore: string[];
        uniqueFillsAfter: string[];
        changedCount: number;
        remapSkipped: boolean;
      };
    } 
  }> {
  // Default to shaded if not specified
  const effectiveFidelity = fidelity || 'shaded';
  
  // Map fidelity to settings (tuned for smoother edges)
  const fidelitySettings = {
    flat: {
      numberofcolors: 5,
      blurSigma: 0.4, // Blur for smoother edges
      pathomit: 6,
      ltres: 1.1, // Tuned for smoother edges
      qtres: 1.1, // Tuned for smoother edges
      minPathLength: 120,
    },
    shaded: {
      numberofcolors: 10,
      blurSigma: 0.6, // Blur for smoother edges
      pathomit: 6,
      ltres: 1.1, // Tuned for smoother edges
      qtres: 1.1, // Tuned for smoother edges
      minPathLength: 80,
    },
    max: {
      numberofcolors: 16,
      blurSigma: 0.6, // Blur for smoother edges
      pathomit: 6,
      ltres: 1.1, // Tuned for smoother edges
      qtres: 1.1, // Tuned for smoother edges
      minPathLength: 50,
    },
  };

  const settings = fidelitySettings[effectiveFidelity];

  // Override numberofcolors for monochrome mode
  const numberofcolors = colorMode === 'monochrome' ? 2 : settings.numberofcolors;

  // Preprocess with sharp
  // - ensureAlpha
  // - flatten onto white
  // - resize to 512x512 (contain, white background)
  // - apply blur for smoother banding
  // - output RGBA raw buffer + width/height
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .blur(settings.blurSigma) // Blur for smoother banding
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width || 512;
  const height = info.height || 512;
  const channels = info.channels || 4; // RGBA

  // Convert to ImageData-like object for imagetracerjs
  // ImageTracerJS expects Uint8ClampedArray with RGBA data
  const imgData = {
    width,
    height,
    data: new Uint8ClampedArray(data),
  };

  // Trace using imagetracerjs with fidelity-based settings
  let tracedSvg = ImageTracer.imagedataToSVG(imgData, {
    numberofcolors,
    pathomit: settings.pathomit,
    ltres: settings.ltres,
    qtres: settings.qtres,
    scale: 1,
    strokewidth: 0, // No stroke
    blurradius: 0, // No blur (already applied in preprocessing)
    linefilter: true, // Filter lines
    desc: false, // No description
    viewbox: true, // Include viewBox
  });

  // Remap colors to palette if provided (BEFORE normalize/sanitize)
  let remapDebug: {
    extractedPalette: string[];
    uniqueFillsBefore: string[];
    uniqueFillsAfter: string[];
    changedCount: number;
    remapSkipped: boolean;
  } | null = null;
  if (extractedPalette && extractedPalette.length > 0) {
    const remapResult = remapSvgToPalette(tracedSvg, extractedPalette);
    tracedSvg = remapResult.svg;
    remapDebug = remapResult.debug;
  }

  // Normalize and sanitize
  let normalizedSvg = normalizeSvg(tracedSvg);
  normalizedSvg = sanitizeSvg(normalizedSvg);

  // Post-process: remove near-white, simplify palette, remove tiny paths
  normalizedSvg = postprocessSvg(normalizedSvg);

  // Auto-crop viewBox to match visible content
  let { cropped: finalSvg, cropBox } = await cropSvgViewBox(normalizedSvg);

  // ALWAYS enforce white background as the LAST step
  finalSvg = ensureWhiteBackground(finalSvg);

  // Extract metadata
  const pathCount = (finalSvg.match(/<path/g) || []).length;

  // Extract palette from final SVG
  const svgPalette: RGB[] = [];
  const fillMatches = finalSvg.matchAll(/fill\s*=\s*["']rgb\((\d+),\s*(\d+),\s*(\d+)\)["']/gi);
  const colorSet = new Set<string>();
  
  for (const match of fillMatches) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const colorKey = `${r},${g},${b}`;

    if (!colorSet.has(colorKey) && (r < 245 || g < 245 || b < 245)) {
      // Not white
      colorSet.add(colorKey);
      svgPalette.push({ r, g, b });
    }
  }

  // If no palette extracted, use a default
  if (svgPalette.length === 0) {
    svgPalette.push({ r: 17, g: 24, b: 39 }); // #111827
  }

  return {
    svg: finalSvg,
    vectorMeta: {
      colors: svgPalette.length,
      paths: pathCount,
      palette: svgPalette,
      engine: 'imagetracerjs',
      width,
      height,
      fidelity: effectiveFidelity,
      colorsUsed: numberofcolors,
      blurSigma: settings.blurSigma,
      pathomit: settings.pathomit,
      ltres: settings.ltres,
      qtres: settings.qtres,
      removedTinyPathsCount: 0, // Counted in postprocessSvg but not returned
      removedNearWhiteCount: 0, // Counted in postprocessSvg but not returned
      cropBox: cropBox ? {
        x: cropBox.x,
        y: cropBox.y,
        width: cropBox.width,
        height: cropBox.height,
      } : null,
      remapDebug: remapDebug || undefined,
    },
  };
}
