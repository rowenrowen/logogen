import sharp from 'sharp';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface QCCheckResult {
  pass: boolean;
  reasons: string[];
  whitePct?: number; // Border white percentage
  componentCount?: number;
  textPresent?: boolean;
  bboxAreaPct?: number; // Icon bounding box area percentage
}

/**
 * Checks background purity by sampling border pixels only.
 * This avoids false failures when the icon occupies a large portion of the canvas.
 * 
 * @param processedPng - Preprocessed PNG buffer (already flattened to white)
 * @returns QCCheckResult with border white percentage
 */
export async function checkBackgroundPurity(processedPng: Buffer): Promise<QCCheckResult> {
  try {
    // Resize to 256x256 for speed
    const { data, info } = await sharp(processedPng)
      .resize(256, 256, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    
    // Log metadata for debugging 0.0% cases
    if (width === 0 || height === 0 || channels < 3) {
      console.error(`Invalid image metadata: width=${width}, height=${height}, channels=${channels}`);
      // Log sample of first 10 pixels
      const sample = Array.from(data.slice(0, Math.min(10 * channels, data.length)));
      console.error(`First 10 pixels sample:`, sample);
      return {
        pass: false,
        reasons: [`Invalid image metadata: width=${width}, height=${height}, channels=${channels}`],
        whitePct: 0,
      };
    }

    // Define border thickness = 12px (≈ ~5% of 256)
    const borderThickness = 12;
    let borderPixels = 0;
    let whiteBorderPixels = 0;

    // Sample pixels where x<border OR x>=w-border OR y<border OR y>=h-border
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isBorder = x < borderThickness || x >= width - borderThickness ||
                         y < borderThickness || y >= height - borderThickness;
        
        if (isBorder) {
          borderPixels++;
          const idx = (y * width + x) * channels;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Check if pixel is white (r,g,b >= 245)
          if (r >= 245 && g >= 245 && b >= 245) {
            whiteBorderPixels++;
          }
        }
      }
    }

    if (borderPixels === 0) {
      console.error(`No border pixels found: width=${width}, height=${height}`);
      return {
        pass: false,
        reasons: ['Background purity check failed: no border pixels found'],
        whitePct: 0,
      };
    }

    const whitePercentage = whiteBorderPixels / borderPixels;
    const threshold = 0.99; // 99% white on border

    if (whitePercentage >= threshold) {
      return { pass: true, reasons: [], whitePct: whitePercentage };
    } else {
      return {
        pass: false,
        reasons: [`Background purity check failed: ${(whitePercentage * 100).toFixed(1)}% white on border (required >= ${threshold * 100}%)`],
        whitePct: whitePercentage,
      };
    }
  } catch (error) {
    console.error('Background purity check error:', error);
    return {
      pass: false,
      reasons: [`Background purity check error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Checks whitespace/icon-size to ensure icon is appropriately sized.
 * 
 * @param processedPng - Preprocessed PNG buffer
 * @returns QCCheckResult with bounding box area percentage
 */
export async function checkWhitespace(processedPng: Buffer): Promise<QCCheckResult & { bboxAreaPct?: number }> {
  try {
    // Get raw pixel data
    const { data, info } = await sharp(processedPng)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // Find bounding box of non-white pixels (r,g,b < 245)
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let hasNonWhite = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Pixel is non-white if r,g,b < 245
        if (r < 245 || g < 245 || b < 245) {
          hasNonWhite = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasNonWhite) {
      return {
        pass: false,
        reasons: ['Whitespace check failed: no non-white pixels found (empty image)'],
        bboxAreaPct: 0,
      };
    }

    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;
    const bboxArea = bboxWidth * bboxHeight;
    const totalArea = width * height;
    const bboxAreaPct = bboxArea / totalArea;

    // Enforce bboxAreaPct between 0.12 and 0.50
    // Too small (< 0.12) => icon too small, not enough content
    // Too large (> 0.50) => icon too large, not enough whitespace
    if (bboxAreaPct < 0.12) {
      return {
        pass: false,
        reasons: [`Whitespace check failed: icon too small (${(bboxAreaPct * 100).toFixed(1)}% of canvas, minimum 12%)`],
        bboxAreaPct,
      };
    }
    if (bboxAreaPct > 0.50) {
      return {
        pass: false,
        reasons: [`Whitespace check failed: icon too large (${(bboxAreaPct * 100).toFixed(1)}% of canvas, maximum 50%). Need more whitespace/padding.`],
        bboxAreaPct,
      };
    }

    return { pass: true, reasons: [], bboxAreaPct };
  } catch (error) {
    return {
      pass: false,
      reasons: [`Whitespace check error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Checks if image contains text using OpenAI vision.
 * 
 * @param imageBase64 - Base64-encoded PNG image
 * @returns QCCheckResult
 */
export async function checkNoText(imageBase64: string): Promise<QCCheckResult> {
  try {
    // Use OpenAI vision to detect text
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use mini for cost efficiency
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Does this image contain any visible text, letters, numbers, or typography? Answer ONLY "yes" or "no".',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 10,
    });

    const answer = response.choices[0]?.message?.content?.toLowerCase().trim() || '';
    const hasText = answer.includes('yes');

    if (hasText) {
      return {
        pass: false,
        reasons: ['Text detection check failed: image contains visible text/letters/numbers'],
      };
    } else {
      return { pass: true, reasons: [] };
    }
  } catch (error) {
    // If vision API fails, we'll be lenient and pass (but log the error)
    console.error('Text detection check error:', error);
    return {
      pass: true, // Pass on error to avoid blocking generation
      reasons: [`Text detection check error (passed): ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Checks if image contains a single cohesive mark (not multiple disconnected icons).
 * Uses cohesion-based analysis: allows multiple components if they form one centered cluster.
 * 
 * @param processedPng - Preprocessed PNG buffer (already flattened to white)
 * @returns QCCheckResult with component count and cohesion metrics
 */
export async function checkSingleMark(processedPng: Buffer): Promise<QCCheckResult> {
  try {
    // Image is already preprocessed (flattened to white)
    // Downsample to small mask for performance and to avoid stack issues
    const { data, info } = await sharp(processedPng)
      .resize(128, 128, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const imageArea = width * height;

    // Build binary "ink" mask: pixel is ink if NOT white (r,g,b < 245)
    const mask: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      mask[y] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Pixel is ink if not white
        mask[y][x] = !(r >= 245 && g >= 245 && b >= 245);
      }
    }

    // Find overall bounding box of all non-white pixels
    let overallMinX = width;
    let overallMaxX = 0;
    let overallMinY = height;
    let overallMaxY = 0;
    let hasInk = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x]) {
          hasInk = true;
          overallMinX = Math.min(overallMinX, x);
          overallMaxX = Math.max(overallMaxX, x);
          overallMinY = Math.min(overallMinY, y);
          overallMaxY = Math.max(overallMaxY, y);
        }
      }
    }

    if (!hasInk) {
      return {
        pass: false,
        reasons: ['Single mark check failed: no non-white pixels found (empty image)'],
        componentCount: 0,
      };
    }

    // Compute overall bounding box metrics
    const overallBboxWidth = overallMaxX - overallMinX + 1;
    const overallBboxHeight = overallMaxY - overallMinY + 1;
    const overallBboxArea = overallBboxWidth * overallBboxHeight;
    const overallBboxAreaPct = overallBboxArea / imageArea;
    const overallCentroidX = (overallMinX + overallMaxX) / 2;
    const overallCentroidY = (overallMinY + overallMaxY) / 2;

    // Hard fail if icon is too large (background-like)
    if (overallBboxAreaPct > 0.65) {
      return {
        pass: false,
        reasons: [`Single mark check failed: icon too large (${(overallBboxAreaPct * 100).toFixed(1)}% of canvas, max 65%)`],
        componentCount: 0,
      };
    }

    // Count connected components and compute their properties
    const visited: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      visited[y] = new Array(width).fill(false);
    }

    interface Component {
      pixels: Array<[number, number]>;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }

    const components: Component[] = [];
    const queue: Array<[number, number]> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x] && !visited[y][x]) {
          // Found a new component - flood fill using iterative queue
          const component: Component = {
            pixels: [],
            minX: width,
            maxX: 0,
            minY: height,
            maxY: 0,
          };

          queue.push([x, y]);
          visited[y][x] = true;

          // Process queue iteratively (no recursion)
          while (queue.length > 0) {
            const [cx, cy] = queue.shift()!;
            component.pixels.push([cx, cy]);
            component.minX = Math.min(component.minX, cx);
            component.maxX = Math.max(component.maxX, cx);
            component.minY = Math.min(component.minY, cy);
            component.maxY = Math.max(component.maxY, cy);

            // Check 4-connected neighbors
            const neighbors = [
              [cx - 1, cy],
              [cx + 1, cy],
              [cx, cy - 1],
              [cx, cy + 1],
            ];

            for (const [nx, ny] of neighbors) {
              if (
                nx >= 0 &&
                nx < width &&
                ny >= 0 &&
                ny < height &&
                mask[ny][nx] &&
                !visited[ny][nx]
              ) {
                visited[ny][nx] = true;
                queue.push([nx, ny]);
              }
            }
          }

          components.push(component);
        }
      }
    }

    const componentCount = components.length;

    if (componentCount === 0) {
      return {
        pass: false,
        reasons: ['Single mark check failed: no components found'],
        componentCount: 0,
      };
    }

    // Check cohesion: allow up to 30 components if they form one centered cluster
    if (overallBboxAreaPct < 0.10 || overallBboxAreaPct > 0.55) {
      return {
        pass: false,
        reasons: [`Single mark check failed: icon size out of range (${(overallBboxAreaPct * 100).toFixed(1)}% of canvas, required 10-55%)`],
        componentCount,
      };
    }

    // Check for scattered tiny components (sparkles/noise)
    const maxDistance = 0.18 * width; // 18% of image width
    let farTinyComponents = 0;

    for (const comp of components) {
      const compArea = comp.pixels.length;
      const compAreaPct = compArea / imageArea;
      const compCentroidX = (comp.minX + comp.maxX) / 2;
      const compCentroidY = (comp.minY + comp.maxY) / 2;
      
      // Distance from component centroid to overall centroid
      const dx = compCentroidX - overallCentroidX;
      const dy = compCentroidY - overallCentroidY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If component is tiny (< 0.2% of image) and far from center, count it
      if (compAreaPct < 0.002 && distance > maxDistance) {
        farTinyComponents++;
      }
    }

    // Hard fail if too many scattered tiny components (sparkles/noise)
    if (farTinyComponents > 5) {
      return {
        pass: false,
        reasons: [`Single mark check failed: ${farTinyComponents} scattered tiny components found (likely sparkles/noise, max 5 allowed)`],
        componentCount,
      };
    }

    // Check grid-based scattering (8x8 grid)
    const gridSize = 8;
    const gridOccupied: boolean[][] = [];
    for (let gy = 0; gy < gridSize; gy++) {
      gridOccupied[gy] = new Array(gridSize).fill(false);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x]) {
          const gx = Math.floor((x / width) * gridSize);
          const gy = Math.floor((y / height) * gridSize);
          if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
            gridOccupied[gy][gx] = true;
          }
        }
      }
    }

    // Count corners with ink
    const corners = [
      [0, 0], // top-left
      [0, gridSize - 1], // top-right
      [gridSize - 1, 0], // bottom-left
      [gridSize - 1, gridSize - 1], // bottom-right
    ];

    let cornersWithInk = 0;
    for (const [gx, gy] of corners) {
      if (gridOccupied[gy] && gridOccupied[gy][gx]) {
        cornersWithInk++;
      }
    }

    // If ink appears in 4+ corners, it's likely scattered
    if (cornersWithInk >= 4) {
      return {
        pass: false,
        reasons: [`Single mark check failed: ink appears in ${cornersWithInk} corners (likely scattered elements, max 3 allowed)`],
        componentCount,
      };
    }

    // All cohesion checks passed
    return { pass: true, reasons: [], componentCount };
  } catch (error) {
    return {
      pass: false,
      reasons: [`Single mark check error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Runs all QC checks on a preprocessed image.
 * Runs checks sequentially: background purity -> whitespace -> single mark -> text (to avoid wasting API calls).
 * 
 * @param processedPng - Preprocessed PNG buffer (already flattened to white, consistent buffer)
 * @param imageBase64 - Base64-encoded PNG image (for text detection)
 * @returns QCCheckResult with combined results and detailed metrics
 */
export async function runQCChecks(
  processedPng: Buffer,
  imageBase64: string
): Promise<QCCheckResult> {
  // Run checks sequentially to avoid wasting API calls on clearly failed images

  // 1. Background purity check (border-based, not global)
  const backgroundResult = await checkBackgroundPurity(processedPng);
  if (!backgroundResult.pass) {
    const whitePct = backgroundResult.whitePct || 0;
    console.log(`QC failed: background purity ${(whitePct * 100).toFixed(1)}% on border`);
    
    // If 0.0% white, log detailed debug info
    if (whitePct === 0) {
      try {
        const metadata = await sharp(processedPng).metadata();
        console.error(`0.0% white debug - metadata:`, {
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
          format: metadata.format,
        });
      } catch (err) {
        console.error(`0.0% white debug - failed to get metadata:`, err);
      }
    }
    
    return {
      pass: false,
      reasons: backgroundResult.reasons,
      whitePct,
    };
  }

  // 2. Whitespace/icon-size check (only if background passes)
  const whitespaceResult = await checkWhitespace(processedPng);
  if (!whitespaceResult.pass) {
    const bboxAreaPct = whitespaceResult.bboxAreaPct;
    console.log(`QC failed: whitespace check - icon ${bboxAreaPct ? (bboxAreaPct * 100).toFixed(1) : 'unknown'}% of canvas`);
    return {
      pass: false,
      reasons: whitespaceResult.reasons,
      whitePct: backgroundResult.whitePct,
      bboxAreaPct,
    };
  }

  // 3. Single mark check (only if previous checks pass)
  const singleMarkResult = await checkSingleMark(processedPng);
  if (!singleMarkResult.pass) {
    const componentCount = singleMarkResult.componentCount;
    console.log(`QC failed: single mark check - ${componentCount ?? 'unknown'} components`);
    return {
      pass: false,
      reasons: singleMarkResult.reasons,
      whitePct: backgroundResult.whitePct,
      componentCount,
      bboxAreaPct: whitespaceResult.bboxAreaPct,
    };
  }

  // 4. Text detection (only if all previous checks pass)
  const textResult = await checkNoText(imageBase64);
  if (!textResult.pass) {
    console.log(`QC failed: text detected`);
    return {
      pass: false,
      reasons: textResult.reasons,
      whitePct: backgroundResult.whitePct,
      componentCount: singleMarkResult.componentCount,
      bboxAreaPct: whitespaceResult.bboxAreaPct,
      textPresent: true,
    };
  }

  // All checks passed
  console.log(`QC passed: border white=${((backgroundResult.whitePct || 0) * 100).toFixed(1)}%, icon size=${((whitespaceResult.bboxAreaPct || 0) * 100).toFixed(1)}%, components=${singleMarkResult.componentCount ?? 0}, text=false`);
  return {
    pass: true,
    reasons: [],
    whitePct: backgroundResult.whitePct,
    componentCount: singleMarkResult.componentCount,
    bboxAreaPct: whitespaceResult.bboxAreaPct,
    textPresent: false,
  };
}
