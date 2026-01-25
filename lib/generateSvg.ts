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
  value?: 'hybrid' | 'filled' | 'outlined';
  industry?: string;
  svgFidelity?: string;
  gallerySvgs?: string[];
}

export interface GenerateSvgResult {
  svg: string;
  pngBase64: string;
  meta: {
    prompt: string;
    style: string;
    palette: string;
    shape: string;
    shapeReceived?: string; // Debug: shape value received
    value?: 'hybrid' | 'filled' | 'outlined'; // Value rendering style
    industry: string;
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
    value: string;
    industry: string;
  }
): string {
  const { style, palette, shape, value, industry } = options;

  // Base constraints for ALL palettes
  let imagePrompt = `Single logo icon only. ONE cohesive icon mark only. No scattered elements. `;
  imagePrompt += `Pure white background (#FFFFFF), no gradient, no shadow, no texture. `;
  imagePrompt += `No text, no letters, no words, no numbers, no typography. `;
  imagePrompt += `No sparkles, particles, confetti, dots, texture, grain. `;
  imagePrompt += `No separate shapes floating away from the main icon. `;
  imagePrompt += `All elements must touch or sit within one compact cluster. `;
  imagePrompt += `Centered, generous white padding around the icon, vector-like flat design, modern professional. `;
  imagePrompt += `No mockups, no scene, no objects outside the logo. `;

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
  imagePrompt += `No text. `;
  imagePrompt += `White background only. `;
  imagePrompt += `Single logo icon only. `;

  // Palette-specific constraints
  if (palette === 'any') {
    imagePrompt += `Choose a professional palette that fits the prompt. `;
  } else if (palette === 'monochrome') {
    imagePrompt += `ONE ink color only + white background. No gradients. No additional colors. `;
  } else if (palette === 'black_white') {
    imagePrompt += `Black and white only. No gray tones. Strict binary palette. `;
  } else if (palette === 'warm') {
    imagePrompt += `Warm palette only: reds, oranges, yellows. No blues, teals, or cool colors. `;
  } else if (palette === 'cool') {
    imagePrompt += `Cool palette only: blues, teals, greens. No reds, oranges, or warm colors. `;
  } else if (palette === 'complementary') {
    imagePrompt += `Two main complementary colors + optional neutral. High clarity and contrast. `;
  } else if (palette === 'analogous') {
    imagePrompt += `2–3 neighboring hues only + optional neutral. Harmonious color scheme. `;
  } else if (palette === 'earth') {
    imagePrompt += `Earth tones: olive, tan, clay, slate. No neon colors. Natural palette. `;
  } else if (palette === 'pastel') {
    imagePrompt += `Pastel tones only. Soft saturation, gentle colors. No vibrant hues. `;
  } else if (palette === 'neon') {
    imagePrompt += `Neon palette, high saturation, but still clean logo mark. Bright and vivid. `;
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

  // Shape composition constraints (compositional, not badge-based)
  if (shape === 'circle') {
    imagePrompt += `Compose the icon in a circular composition: elements arranged around a central point or radiating, overall silhouette reads circular WITHOUT adding a circle badge. `;
    imagePrompt += `No outer frame, no enclosing circle outline—just a naturally circular silhouette. `;
    imagePrompt += `Do NOT draw an explicit container/badge/frame. The logo itself should naturally form this silhouette. `;
  } else if (shape === 'square') {
    imagePrompt += `Compose the icon in a square/rectilinear composition: strong horizontal/vertical structure, overall silhouette reads square/boxy WITHOUT adding a square badge. `;
    imagePrompt += `Do NOT draw an explicit container/badge/frame. The logo itself should naturally form this silhouette. `;
  } else if (shape === 'roundedSquare') {
    imagePrompt += `Compose with softened corners/rounded geometry; silhouette reads rounded-square, but no enclosing rounded-rectangle badge. `;
    imagePrompt += `Do NOT draw an explicit container/badge/frame. The logo itself should naturally form this silhouette. `;
  } else if (shape === 'pill') {
    imagePrompt += `Compose in a horizontal pill/oval composition; silhouette reads pill-shaped, but no enclosing pill badge. `;
    imagePrompt += `Do NOT draw an explicit container/badge/frame. The logo itself should naturally form this silhouette. `;
  } else if (shape === 'hex') {
    imagePrompt += `Compose in a hexagonal composition; silhouette reads hexagonal, but no enclosing hexagon badge. `;
    imagePrompt += `Do NOT draw an explicit container/badge/frame. The logo itself should naturally form this silhouette. `;
  } else if (shape === 'shield') {
    imagePrompt += `Compose in a shield composition; silhouette reads shield-shaped, but no enclosing shield badge. `;
    imagePrompt += `Do NOT draw an explicit container/badge/frame. The logo itself should naturally form this silhouette. `;
  }

  // Value control (rendering style)
  if (value === 'outlined') {
    imagePrompt += `Outlined logo style: strokes/lines only. No filled regions. Use clean, consistent stroke widths. `;
    imagePrompt += `Use colored strokes permitted by palette; background pure white. `;
    imagePrompt += `Avoid shading, gradients, textures. `;
    imagePrompt += `Ensure the icon is still bold enough to read at small size. `;
  } else if (value === 'filled') {
    imagePrompt += `Filled logo style: solid filled shapes only. No visible outlines/strokes. `;
    imagePrompt += `Flat vector fills, clean edges, no texture. `;
  } else if (value === 'hybrid') {
    imagePrompt += `Hybrid: allow both fills and strokes where appropriate, but keep it clean and logo-like. `;
  }

  // Style guidance
  if (style === 'minimal') {
    imagePrompt += `Minimal design: simple, clean, geometric shapes. `;
  } else if (style === 'balanced') {
    imagePrompt += `Balanced design: moderate detail, professional. `;
  } else if (style === 'intricate') {
    imagePrompt += `Intricate design: refined details, polished finish. `;
  }

  // Industry guidance
  if (industry === 'therapy') {
    imagePrompt += `Therapy industry: calm, friendly, trustworthy, modern, supportive, growth-oriented. `;
  } else if (industry === 'healthcare') {
    imagePrompt += `Healthcare: calm, trustworthy, healing-focused. `;
  } else if (industry === 'tech') {
    imagePrompt += `Tech: modern, precise, innovation-focused. `;
  } else if (industry === 'finance') {
    imagePrompt += `Finance: stable, trustworthy, professional. `;
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
    value = 'hybrid',
    industry = 'general',
    svgFidelity = 'shaded',
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
    value,
    industry,
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
            shape as 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield',
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
            shape as 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield',
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
          fidelity: svgFidelity || 'shaded',
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
        pngBase64: processedBase64, // Return processed base64 (white background)
        meta: {
          prompt,
          style,
          palette: paletteChoice,
          shape,
          shapeReceived: shape, // Debug: shape value received
          value, // Value rendering style
          industry,
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
