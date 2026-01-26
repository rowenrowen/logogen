import { getOpenAIClient } from "./openaiClient";
import { runQCChecks } from "./qc";
import { preprocessToWhitePng, validateImageBuffer, validateBase64 } from "./preprocessImage";
import { extractPalette } from "./extractPalette";
import { vectorizeWithVtracer } from "./vectorizeWithVtracer";
import { parsePrompt, ParsedPrompt } from "./parsePrompt";
import { applyShapeMask } from "./applyShapeMask";
import { enforceShapeInSvg } from "./enforceShapeInSvg";
import { preprocessForVectorize } from "./preprocessForVectorize";
import sharp from "sharp";

export async function generateSvgFromPng(
  pngBuffer: Buffer, 
  numberofcolors = 10,
  blurSigma = 0.6
) {
  // 1) Convert PNG -> raw RGBA pixels with blur for smoother edges
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
    .blur(blurSigma) // Blur to reduce jaggies before tracing
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 2) Build imgData (this is what ImageTracer expects)
  const imgData = {
    width: info.width,
    height: info.height,
    data: Uint8ClampedArray.from(data),
  };

  // 3) Trace with tuned settings for smoother edges
  // @ts-ignore - ImageTracer is not used in current pipeline (using VTracer instead)
  const svg = ImageTracer.imagedataToSVG(imgData, {
    numberofcolors,
    pathomit: 6,
    ltres: 1.1, // Tuned for smoother edges
    qtres: 1.1, // Tuned for smoother edges
    linefilter: true,
    strokewidth: 0,
    viewbox: true,
    desc: false,
  });

  return svg;
}

const MAX_TRIES = 5;

export interface GenerateSvgParams {
  prompt: string;
  style?: string;
  paletteChoice: string;
  shape?: string;
  businessName?: string;
  fontFamily?: 'Inter' | 'Lora' | 'Larken';
  gallerySvgs?: string[];
}

export interface GeneratePngResult {
  iconPngBase64: string; // "data:image/png;base64,..."
  palette?: string[];
  metadata?: {
    prompt: string;
    style: string;
    palette: string;
    shape: string;
    attempts: number;
    qcReasons: string[];
  };
}

export interface GenerateSvgResult {
  svg: string;
  lockupHorizontalSvg: string | null;
  lockupStackedSvg: string | null;
  pngBase64: string;
  meta: {
    prompt: string;
    style: string;
    palette: string;
    shape: string;
    shapeReceived?: string; // Debug: shape value received
    attempts: number;
    qcReasons: string[];
    similarityScore: number;
    vectorMeta: {
      paths: number;
      colors: number;
      palette?: Array<{ r: number; g: number; b: number }>;
      engine?: string;
      width?: number;
      height?: number;
      remapDebug?: {
        pngPalette: string[];
        uniqueFillsBefore: string[];
        uniqueFillsAfter: string[];
        changedCount: number;
        remapSkipped: boolean;
      };
    };
    pngPalette?: string[]; // Extracted palette from PNG
    uniqueFillsBefore?: string[]; // First 20 unique colors found in SVG before remap
    uniqueFillsAfter?: string[]; // First 20 unique colors found in SVG after remap
    changedCount?: number; // How many replacements were made
    remapSkipped?: boolean; // Whether remap was skipped due to low changes
    maxColorsUsed?: number; // Max colors used for palette extraction
    paletteMaxColors?: number; // Max colors enforced in prompt
    parsedPrompt?: { positive: string; negatives: string[] }; // Parsed positive and negative terms
    preprocess?: { median: number; sharpen: number }; // Edge preprocessing settings
    tracerOpts?: {
      numberofcolors: number;
      blurSigma: number;
      ltres: number;
      qtres: number;
      pathomit: number;
    };
  };
}

/**
 * Builds a strict image generation prompt based on user input and options.
 */
function buildImagePrompt(
  parsedPrompt: ParsedPrompt,
  options: {
    style: string;
    palette: string;
    shape: string;
  }
): string {
  const { style, palette, shape } = options;

  // Base constraints for ALL palettes
  let imagePrompt = `Single logo icon only. ONE cohesive icon mark only. No scattered elements. `;
  imagePrompt += `Pure white background (#FFFFFF), no gradient, no shadow, no texture. `;
  imagePrompt += `No text, no letters, no words, no numbers, no typography. `;
  imagePrompt += `No sparkles, particles, confetti, dots, texture, grain. `;
  imagePrompt += `No separate shapes floating away from the main icon. `;
  imagePrompt += `All elements must touch or sit within one compact cluster. `;
  imagePrompt += `Centered, generous white padding around the icon, vector-like flat design, modern professional. `;
  imagePrompt += `No mockups, no scene, no objects outside the logo. `;

  // Palette constraints (skip if "any")
  if (palette !== 'any') {
    // Determine max colors based on palette
    let paletteMaxColors = 4; // default
    if (palette === 'monochrome' || palette === 'black_white') {
      paletteMaxColors = 2;
    } else if (palette === 'complementary') {
      paletteMaxColors = 3;
    } else if (palette === 'analogous') {
      paletteMaxColors = 4;
    } else {
      paletteMaxColors = 4;
    }

    // General palette constraints
    imagePrompt += `Use a limited palette of 2–${paletteMaxColors} colors maximum (unless monochrome/black_white). `;
    imagePrompt += `No random extra accent colors. `;

    // Palette-specific constraints (high-level direction, not rigid mapping)
    if (palette === 'warm') {
      imagePrompt += `Color palette: warm and modern (terracotta, amber, deep navy, warm oranges, golden yellows). `;
    } else if (palette === 'cool') {
      imagePrompt += `Color palette: cool and fresh (ocean blues, teals, mint greens, cool grays). `;
    } else if (palette === 'neutral') {
      imagePrompt += `Color palette: neutral and sophisticated (grays, beiges, soft browns, muted tones). `;
    } else if (palette === 'complementary') {
      imagePrompt += `Color palette: complementary colors with high clarity and contrast (e.g., blue/orange, purple/yellow). `;
    } else if (palette === 'pastel') {
      imagePrompt += `Color palette: pastel tones (soft pinks, light blues, gentle purples, muted pastels). `;
    } else if (palette === 'bold') {
      imagePrompt += `Color palette: bold and vibrant (saturated colors, high contrast, energetic hues). `;
    }
    
    // Common color constraints
    imagePrompt += `Flat vector logo mark, 2–4 solid colors, no gradients, no shadows, white background. `;
  } else {
    // When palette is "any", model chooses best-fitting colors for the concept
    // No user-imposed palette family; still colorful and professional
    imagePrompt += `Choose a harmonious, brand-appropriate color palette that fits the concept. `;
    imagePrompt += `Use 2–4 flat colors with good contrast. `;
    imagePrompt += `Avoid monochrome or all-black. `;
    imagePrompt += `Flat vector logo mark, no gradients, no shadows, white background. `;
  }

  // Add negative constraints if any negatives specified
  if (parsedPrompt.negatives.length > 0) {
    imagePrompt += `Must NOT include: ${parsedPrompt.negatives.join(', ')}. Do not depict these concepts, objects, or silhouettes. `;
    imagePrompt += `Avoid any background scenes that introduce excluded items. `;

    // Special handling for text exclusion
    if (parsedPrompt.negatives.some(neg => neg.includes('text') || neg.includes('letter'))) {
      imagePrompt += `No text, no letters, no numbers anywhere. `;
    }
  }

  // Shape composition constraints (only if shape is not 'any')
  if (shape !== 'any') {
    // General shape rules for all non-"any" shapes
    imagePrompt += `Design a unified badge logo mark. `;
    imagePrompt += `The outer silhouette must be a perfect ${shape === 'circle' ? 'circle (roundel)' : shape === 'square' ? 'square' : shape === 'roundedSquare' ? 'rounded square with ~20–25% corner radius' : shape === 'hex' ? 'hexagon' : 'shield'}. `;
    imagePrompt += `Use a solid filled shape field (background) as part of the design so the silhouette reads clearly. `;
    imagePrompt += `Place the icon elements INSIDE the shape using contrasting colors and/or knockouts. `;
    imagePrompt += `The design should fill ~85–95% of the canvas with small optical margin. `;
    imagePrompt += `No detached border frame; no thin outline ring; no icon floating inside a container. `;
    
    // Shape-specific details
    if (shape === 'circle') {
      imagePrompt += `Outer silhouette is a perfect circle (roundel), solid filled circle background. `;
    } else if (shape === 'square') {
      imagePrompt += `Outer silhouette is a perfect square, solid filled square background. `;
    } else if (shape === 'roundedSquare') {
      imagePrompt += `Outer silhouette is rounded square with ~20–25% corner radius, solid filled background. `;
    } else if (shape === 'hex') {
      imagePrompt += `Outer silhouette is the chosen badge shape, solid filled background. `;
    } else if (shape === 'shield') {
      imagePrompt += `Outer silhouette is the chosen badge shape, solid filled background. `;
    }
    
    // Negative constraints for shapes
    imagePrompt += `No floating icon, no border-only outline, no thin ring, no sticker frame, no empty background inside the shape. `;
    
    // Composition hint
    imagePrompt += `Use 2–4 flat colors, high contrast between background field and icon elements. `;
    imagePrompt += `The background field must be visibly colored (not white) unless the palette explicitly requires otherwise. `;
    
    // White outer canvas background
    imagePrompt += `White page background, badge centered. `;
  }

  // Style guidance
  if (style === 'minimal') {
    imagePrompt += `Minimal design: simple, clean, geometric shapes. `;
  } else if (style === 'balanced') {
    imagePrompt += `Balanced design: moderate detail, professional. `;
  } else if (style === 'intricate') {
    imagePrompt += `Intricate design: refined details, polished finish. `;
  }

  // Final containment instruction (safety)
  imagePrompt += `Keep the entire icon centered with generous padding; nothing should touch the image edges. `;

  // User prompt (positive part only)
  imagePrompt += `Logo concept: ${parsedPrompt.positive}.`;

  return imagePrompt;
}

/**
 * Computes similarity between two SVGs (simplified: color + shape heuristics).
 * Returns a score 0-1 where 1 is identical.
 */
function computeSimilarity(svg1: string, svg2: string): number {
  // Extract colors from SVG
  const colors1 = extractColors(svg1);
  const colors2 = extractColors(svg2);

  // Color similarity (Jaccard index)
  const colorSimilarity = computeColorSimilarity(colors1, colors2);

  // Path count similarity (simple heuristic)
  const paths1 = (svg1.match(/<path/g) || []).length;
  const paths2 = (svg2.match(/<path/g) || []).length;
  const pathSimilarity = paths1 === 0 && paths2 === 0 ? 1 : 1 - Math.abs(paths1 - paths2) / Math.max(paths1, paths2, 1);

  // Combined similarity (weighted)
  return colorSimilarity * 0.6 + pathSimilarity * 0.4;
}

function extractColors(svg: string): Set<string> {
  const colors = new Set<string>();
  const colorRegex = /(?:fill|stroke)="([^"]+)"/g;
  let match;
  while ((match = colorRegex.exec(svg)) !== null) {
    const color = match[1].toLowerCase();
    if (color !== 'none' && color !== 'transparent' && color.startsWith('#')) {
      colors.add(color);
    }
  }
  return colors;
}

function computeColorSimilarity(colors1: Set<string>, colors2: Set<string>): number {
  if (colors1.size === 0 && colors2.size === 0) return 1;
  if (colors1.size === 0 || colors2.size === 0) return 0;

  const intersection = new Set([...colors1].filter(c => colors2.has(c)));
  const union = new Set([...colors1, ...colors2]);

  return intersection.size / union.size;
}

/**
 * Generates a PNG logo from a prompt using OpenAI image generation (no vectorization).
 * 
 * @param params - Generation parameters
 * @returns Promise with PNG data URL and metadata
 * @throws Error if generation fails after all retries
 */
export async function generatePngFromPrompt(
  params: GenerateSvgParams
): Promise<GeneratePngResult> {
  const {
    prompt,
    style = 'balanced',
    paletteChoice,
    shape = 'any',
    gallerySvgs = [],
  } = params;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Missing or invalid prompt');
  }

  // Parse prompt for positive and negative terms
  const parsedPrompt = parsePrompt(prompt);

  // Ensure paletteChoice is valid
  const validPaletteChoices = ['any', 'monochrome', 'warm', 'cool', 'complementary', 'analogous', 'earth', 'pastel', 'neon', 'black_white'];
  if (!paletteChoice || !validPaletteChoices.includes(paletteChoice)) {
    throw new Error(`Invalid paletteChoice: ${paletteChoice}`);
  }

  // Build strict image prompt using parsed prompt
  const imagePrompt = buildImagePrompt(parsedPrompt, {
    style,
    palette: paletteChoice,
    shape,
  });

  // Try generation with QC checks (up to MAX_TRIES)
  let lastFailureReason = 'unknown';
  let attempts = 0;

  for (attempts = 1; attempts <= MAX_TRIES; attempts++) {
    try {
      // Generate image using OpenAI Images API
      const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
      
      const generateParams: any = {
        model: imageModel,
        prompt: imagePrompt,
        size: '1024x1024',
        output_format: 'png',
      };

      const openai = getOpenAIClient();
      const response = await openai.images.generate(generateParams);

      if (!response.data || response.data.length === 0) {
        throw new Error('No image data in response');
      }

      const imageData = response.data[0];
      if (!imageData) {
        throw new Error('No image data in response');
      }

      // Extract base64
      let base64Data: string | undefined;
      if ('b64_json' in imageData && imageData.b64_json) {
        base64Data = typeof imageData.b64_json === 'string' ? imageData.b64_json : undefined;
      } else if ('base64' in imageData && imageData.base64) {
        base64Data = typeof imageData.base64 === 'string' ? imageData.base64 : undefined;
      }

      if (!base64Data || typeof base64Data !== 'string') {
        throw new Error('No base64 image data found in response');
      }

      // Validate base64
      try {
        validateBase64(base64Data);
      } catch (error) {
        lastFailureReason = `Invalid base64 image data: ${error instanceof Error ? error.message : String(error)}`;
        continue;
      }

      // Convert base64 to Buffer
      let imageBuffer: Buffer;
      try {
        imageBuffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        lastFailureReason = `Failed to decode base64: ${error instanceof Error ? error.message : String(error)}`;
        continue;
      }

      // Validate image buffer
      try {
        await validateImageBuffer(imageBuffer);
      } catch (error) {
        lastFailureReason = `Invalid image buffer: ${error instanceof Error ? error.message : String(error)}`;
        continue;
      }

      // Preprocess to force white background
      let processedPng: Buffer;
      try {
        processedPng = await preprocessToWhitePng(imageBuffer);
      } catch (error) {
        lastFailureReason = `Image preprocessing failed: ${error instanceof Error ? error.message : String(error)}`;
        continue;
      }

      const processedBase64 = processedPng.toString('base64');

      // Extract palette
      let paletteMaxColors = 4;
      if (paletteChoice === 'monochrome' || paletteChoice === 'black_white') {
        paletteMaxColors = 2;
      } else if (paletteChoice === 'complementary') {
        paletteMaxColors = 3;
      }
      const pngPalette = await extractPalette(processedPng, paletteMaxColors);

      // Run QC checks
      const qcResult = await runQCChecks(processedPng, processedBase64);

      if (!qcResult.pass) {
        lastFailureReason = `QC check failed: ${qcResult.reasons.join('; ')}`;
        continue;
      }

      // Success! Return PNG as data URL
      const iconPngBase64 = `data:image/png;base64,${processedBase64}`;

      return {
        iconPngBase64,
        palette: pngPalette,
        metadata: {
          prompt,
          style,
          palette: paletteChoice,
          shape,
          attempts,
          qcReasons: qcResult.reasons,
        },
      };
    } catch (error: any) {
      lastFailureReason = error instanceof Error ? error.message : String(error);
      console.error(`Generate PNG error (attempt ${attempts}/${MAX_TRIES}):`, error);
    }
  }

  // All attempts failed
  throw new Error(`Failed to generate valid icon after ${attempts - 1} attempts: ${lastFailureReason}`);
}

/**
 * Generates an SVG logo from a prompt using OpenAI image generation and vectorization.
 * 
 * @param params - Generation parameters
 * @returns Promise with SVG, PNG base64, and metadata
 * @throws Error if generation fails after all retries
 */
export async function generateSvgFromPrompt(
  params: GenerateSvgParams
): Promise<GenerateSvgResult> {
  const {
    prompt,
    style = 'balanced',
    paletteChoice,
    shape = 'any',
    businessName,
    gallerySvgs = [],
  } = params;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Missing or invalid prompt');
  }

  // Parse prompt for positive and negative terms
  const parsedPrompt = parsePrompt(prompt);

  // Ensure paletteChoice is valid
  const validPaletteChoices = ['any', 'monochrome', 'warm', 'cool', 'complementary', 'analogous', 'earth', 'pastel', 'neon', 'black_white'];
  if (!paletteChoice || !validPaletteChoices.includes(paletteChoice)) {
    throw new Error(`Invalid paletteChoice: ${paletteChoice}`);
  }

  // Build strict image prompt using parsed prompt
  const imagePrompt = buildImagePrompt(parsedPrompt, {
    style,
    palette: paletteChoice,
    shape,
  });

  // Try generation with QC checks and similarity screening (up to MAX_TRIES)
  let lastFailureReason = 'unknown';
  let attempts = 0;
  const SIMILARITY_THRESHOLD = 0.85; // Reject if similarity > 85%

  for (attempts = 1; attempts <= MAX_TRIES; attempts++) {
    try {
      // Generate image using OpenAI Images API
      // Use GPT image models (gpt-image-1.5, gpt-image-1, or gpt-image-1-mini)
      const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
      
      // Ensure we're using a GPT image model (not dall-e-*)
      const isGptImageModel = imageModel.includes('gpt-image');
      if (!isGptImageModel) {
        console.warn(`Warning: Using non-GPT image model: ${imageModel}. Consider using gpt-image-1.5`);
      }

      // Build generate parameters (only supported fields)
      const generateParams: any = {
        model: imageModel,
        prompt: imagePrompt,
        size: '1024x1024',
        output_format: 'png', // PNG supports transparency
      };

      // Debug logging
      console.log(`images.generate: model=${imageModel}, output_format=${generateParams.output_format}, size=${generateParams.size}`);

      // Generate image
      const openai = getOpenAIClient();
      const response = await openai.images.generate(generateParams);

      // Extract base64 from response (handle both possible field names)
      if (!response.data || response.data.length === 0) {
        throw new Error('No image data in response');
      }

      const imageData = response.data[0];
      if (!imageData) {
        throw new Error('No image data in response');
      }

      // Try to extract base64 from either b64_json or base64 field
      let base64Data: string | undefined;
      if ('b64_json' in imageData && imageData.b64_json) {
        base64Data = typeof imageData.b64_json === 'string' ? imageData.b64_json : undefined;
      } else if ('base64' in imageData && imageData.base64) {
        base64Data = typeof imageData.base64 === 'string' ? imageData.base64 : undefined;
      }

      if (!base64Data || typeof base64Data !== 'string') {
        // Log available keys for debugging
        const availableKeys = Object.keys(imageData || {});
        throw new Error(`No base64 image data found in response. Available keys: ${availableKeys.join(', ')}`);
      }

      // Validate base64 before decoding
      try {
        validateBase64(base64Data);
      } catch (error) {
        lastFailureReason = `Invalid base64 image data: ${error instanceof Error ? error.message : String(error)}`;
        console.log(`Base64 validation failed (attempt ${attempts}/${MAX_TRIES}): ${lastFailureReason}`);
        continue;
      }

      // Convert base64 to Buffer
      let imageBuffer: Buffer;
      try {
        imageBuffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        lastFailureReason = `Failed to decode base64: ${error instanceof Error ? error.message : String(error)}`;
        console.log(`Base64 decode failed (attempt ${attempts}/${MAX_TRIES}): ${lastFailureReason}`);
        continue;
      }

      // Validate image buffer can be decoded
      try {
        await validateImageBuffer(imageBuffer);
      } catch (error) {
        lastFailureReason = `Invalid image buffer: ${error instanceof Error ? error.message : String(error)}`;
        console.log(`Image validation failed (attempt ${attempts}/${MAX_TRIES}): ${lastFailureReason}`);
        continue;
      }

      // Preprocess to force white background (before QC)
      // This creates ONE consistent buffer used everywhere
      let processedPng: Buffer;
      try {
        processedPng = await preprocessToWhitePng(imageBuffer);
      } catch (error) {
        lastFailureReason = `Image preprocessing failed: ${error instanceof Error ? error.message : String(error)}`;
        console.log(`Preprocessing failed (attempt ${attempts}/${MAX_TRIES}): ${lastFailureReason}`);
        continue;
      }

      // Update base64 with processed image for text detection
      // Use original base64Data for text detection (before preprocessing)
      const processedBase64 = processedPng.toString('base64');

  // Extract palette from PNG for color locking
  // Use paletteChoice-based maxColors
  let paletteMaxColors = 4; // default
  if (paletteChoice === 'monochrome' || paletteChoice === 'black_white') {
    paletteMaxColors = 2;
  } else if (paletteChoice === 'complementary') {
    paletteMaxColors = 3;
  } else if (paletteChoice === 'analogous') {
    paletteMaxColors = 4;
  }

  const maxPaletteColors = paletteMaxColors;
      const pngPalette = await extractPalette(processedPng, maxPaletteColors);

      // Run QC checks on preprocessed image (consistent buffer)
      const qcResult = await runQCChecks(processedPng, processedBase64);

      if (!qcResult.pass) {
        lastFailureReason = `QC check failed: ${qcResult.reasons.join('; ')}`;
        console.log(`QC check failed (attempt ${attempts}/${MAX_TRIES}): ${lastFailureReason}`);
        continue;
      }

      // Always apply edge preprocessing for clean vectorization
      let preprocessedPng = processedPng;
      try {
        console.log('Applying edge preprocessing for clean vectorization...');
        preprocessedPng = await preprocessForVectorize(processedPng);
        console.log('Edge preprocessing applied');
      } catch (preprocessError) {
        console.warn(`Edge preprocessing failed, using original: ${preprocessError}`);
        // Continue with original PNG if preprocessing fails
      }

      // Apply safety containment clip (only if shape is specified, for overflow protection)
      let maskedPng = preprocessedPng;
      if (shape !== 'any') {
        try {
          console.log(`Applying safety containment clip for ${shape} shape...`);
          maskedPng = await applyShapeMask(
            preprocessedPng,
            shape as 'circle' | 'square' | 'roundedSquare' | 'hex' | 'shield',
            'clip' // Only clip, no badge/outline
          );
          console.log('Safety containment clip applied');
        } catch (maskError) {
          console.warn(`Containment clip failed, using original PNG: ${maskError}`);
          // Continue with original PNG if clipping fails
        }
      }

      // Convert PNG to SVG using VTracer CLI
      let svg: string;
      try {
        console.log('Vectorizing PNG with VTracer...');
        svg = await vectorizeWithVtracer(maskedPng);
        console.log(`VTracer vectorization succeeded: ${svg.length} chars`);
      } catch (vtracerError) {
        lastFailureReason = `VTracer vectorization failed: ${vtracerError instanceof Error ? vtracerError.message : String(vtracerError)}`;
        console.log(`VTracer failed (attempt ${attempts}/${MAX_TRIES}): ${lastFailureReason}`);
        continue;
      }

      // Apply safety containment clip in SVG (only if shape is specified)
      if (shape !== 'any') {
        try {
          console.log(`Applying safety containment clip for ${shape} shape in SVG...`);
          svg = enforceShapeInSvg(
            svg,
            shape as 'circle' | 'square' | 'roundedSquare' | 'hex' | 'shield',
            'clip' // Only clip, no badge/outline
          );
          console.log('SVG containment clip applied');
        } catch (enforceError) {
          console.warn(`SVG containment clip failed, using vectorized SVG: ${enforceError}`);
          // Continue with vectorized SVG if clipping fails
        }
      }

      // Extract metadata from VTracer SVG
      const pathCount = (svg.match(/<path/g) || []).length +
                       (svg.match(/<circle/g) || []).length +
                       (svg.match(/<rect/g) || []).length +
                       (svg.match(/<polygon/g) || []).length +
                       (svg.match(/<ellipse/g) || []).length;

      const svgPalette: Array<{ r: number, g: number, b: number }> = [];
      const fillMatches = svg.matchAll(/fill\s*=\s*["']rgb\((\d+),\s*(\d+),\s*(\d+)\)["']/gi);
      const colorSet = new Set<string>();

      for (const match of fillMatches) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        const colorKey = `${r},${g},${b}`;

        if (!colorSet.has(colorKey) && (r < 245 || g < 245 || b < 245)) {
          colorSet.add(colorKey);
          svgPalette.push({ r, g, b });
        }
      }

      if (svgPalette.length === 0) {
        svgPalette.push({ r: 17, g: 24, b: 39 });
      }

      const rasterResult = {
        svg,
        vectorMeta: {
          colors: svgPalette.length,
          paths: pathCount,
          palette: svgPalette,
          engine: 'vtracer-cli',
          width: 512,
          height: 512,
          colorsUsed: svgPalette.length,
          blurSigma: 0,
          pathomit: 0,
          ltres: 0,
          qtres: 0,
          removedTinyPathsCount: 0,
          removedNearWhiteCount: 0,
          cropBox: null,
        },
      };

      // Similarity screening against gallery
      // Ensure svg and rasterResult are set before similarity check
      if (!svg || !rasterResult) {
        lastFailureReason = 'SVG vectorization failed: no SVG or rasterResult';
        console.log(`Vectorization failed (attempt ${attempts}/${MAX_TRIES}): ${lastFailureReason}`);
        continue;
      }

      let maxSimilarity = 0;
      for (const existingSvg of gallerySvgs) {
        if (typeof existingSvg === 'string') {
          const similarity = computeSimilarity(svg, existingSvg);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }

      if (maxSimilarity > SIMILARITY_THRESHOLD) {
        lastFailureReason = `Similarity check failed: too similar to existing logo (${(maxSimilarity * 100).toFixed(1)}% similar)`;
        console.log(`Similarity check failed (attempt ${attempts}/${MAX_TRIES}): ${lastFailureReason}`);
        continue;
      }

      // Success! Return processed image (with white background)
      // SVG already has white background from VTracer
      
      return {
        svg,
        lockupHorizontalSvg: null, // Lockups removed - use HTML/CSS preview instead
        lockupStackedSvg: null,
        pngBase64: processedBase64, // Return processed base64 (white background)
        meta: {
          prompt,
          style,
          palette: paletteChoice,
          shape,
          shapeReceived: shape, // Debug: shape value received
          attempts,
          qcReasons: qcResult.reasons,
          similarityScore: maxSimilarity,
          vectorMeta: rasterResult.vectorMeta,
          pngPalette, // Extracted palette from PNG
          maxColorsUsed: maxPaletteColors, // Max colors used for extraction
          paletteMaxColors, // Max colors enforced in prompt
          parsedPrompt, // Parsed positive and negative terms
          preprocess: { median: 1, sharpen: 0.4 }, // Edge preprocessing settings
        },
      };
    } catch (error: any) {
      lastFailureReason = error instanceof Error ? error.message : String(error);
      console.error(`Generate SVG error (attempt ${attempts}/${MAX_TRIES}):`, error);
      // continue to next attempt
    }
  }

  // All attempts failed
  throw new Error(`Failed to generate valid icon after ${attempts - 1} attempts: ${lastFailureReason}`);
}
