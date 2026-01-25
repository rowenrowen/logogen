import { RawLogoSpec, LogoSpec, Shape, RawShape } from '@/types/logo';

const SAFE_MARGIN = 10;
const MAX_RADIUS = 40; // 50 - SAFE_MARGIN
const MAX_DIMENSION = 80; // 100 - 2 * SAFE_MARGIN

/**
 * Converts hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    // Try 3-digit hex
    const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (shortResult) {
      return {
        r: parseInt(shortResult[1] + shortResult[1], 16),
        g: parseInt(shortResult[2] + shortResult[2], 16),
        b: parseInt(shortResult[3] + shortResult[3], 16),
      };
    }
    return null;
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Calculates RGB distance between two colors
 */
function colorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return Infinity;
  
  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Finds the closest color in a palette to a given color
 */
function findClosestColor(color: string, palette: string[]): string {
  if (palette.length === 0) return color;
  
  let closest = palette[0];
  let minDistance = colorDistance(color, closest);
  
  for (let i = 1; i < palette.length; i++) {
    const distance = colorDistance(color, palette[i]);
    if (distance < minDistance) {
      minDistance = distance;
      closest = palette[i];
    }
  }
  
  return closest;
}

/**
 * Validates hex color format
 */
function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Normalizes colors in a spec to enforce palette constraints.
 * 
 * - Collects all fill colors from shapes
 * - Builds a palette of up to MAX_COLORS based on colorMode
 * - If spec.metadata.colorPalette exists, use it as base (trim to MAX_COLORS)
 * - Otherwise derive palette from first encountered fills
 * - Maps any shape.fill not in the final palette to the closest color (RGB distance)
 * - Ensures cutout shapes don't introduce new fill colors
 * - Stores final palette in metadata.colorPalette
 * 
 * @param spec - Logo spec with shapes
 * @param colorMode - Color mode ('monochrome', 'muted', 'bold')
 * @returns Normalized spec with enforced palette
 */
function normalizeColors(spec: LogoSpec, colorMode: string): LogoSpec {
  const MAX_COLORS = colorMode === 'monochrome' ? 1 : 3;
  
  // Collect all fill colors from shapes (ignore null/undefined)
  const allFills = new Set<string>();
  spec.shapes.forEach(shape => {
    if (shape.fill && isValidHexColor(shape.fill)) {
      allFills.add(shape.fill.toLowerCase());
    }
  });
  
  // Build initial palette
  let palette: string[] = [];
  
  // Check if spec has colorPalette in metadata (from raw spec)
  const existingPalette = (spec.metadata as any)?.colorPalette;
  if (existingPalette && Array.isArray(existingPalette)) {
    // Use existing palette as base, trim to MAX_COLORS
    palette = existingPalette
      .filter((c: any) => isValidHexColor(c))
      .map((c: any) => c.toLowerCase())
      .slice(0, MAX_COLORS);
  }
  
  // If no existing palette or it's empty, derive from encountered fills
  if (palette.length === 0) {
    const fillsArray = Array.from(allFills).sort(); // Sort for determinism
    
    if (fillsArray.length === 0) {
      // No fills found - use default based on colorMode
      if (colorMode === 'monochrome') {
        palette = ['#111827']; // Dark neutral
      } else if (colorMode === 'muted') {
        palette = ['#4A6FA5', '#6B8E7F', '#5A6578']; // Muted blues/greens/grays
      } else { // bold
        palette = ['#0066FF', '#00CC66', '#FF3366']; // Bold blues/greens/reds
      }
    } else {
      // Use first encountered fills (sorted), trim to MAX_COLORS
      palette = fillsArray.slice(0, MAX_COLORS);
      
      // If we have fewer than MAX_COLORS and colorMode is not monochrome, pad with defaults
      if (palette.length < MAX_COLORS && colorMode !== 'monochrome') {
        const defaults = colorMode === 'muted' 
          ? ['#4A6FA5', '#6B8E7F', '#5A6578']
          : ['#0066FF', '#00CC66', '#FF3366'];
        
        for (let i = palette.length; i < MAX_COLORS; i++) {
          // Find a default that's not already in palette
          const candidate = defaults.find(d => !palette.includes(d.toLowerCase()));
          if (candidate) {
            palette.push(candidate.toLowerCase());
          } else {
            // If all defaults are already in palette, just use the first default
            palette.push(defaults[0].toLowerCase());
          }
        }
      }
    }
  }
  
  // Ensure palette is exactly MAX_COLORS
  palette = palette.slice(0, MAX_COLORS);
  
  // Map all shape fills to palette colors
  const normalizedShapes = spec.shapes.map(shape => {
    const normalizedShape = { ...shape };
    
    if (normalizedShape.fill && isValidHexColor(normalizedShape.fill)) {
      const fillLower = normalizedShape.fill.toLowerCase();
      
      // If fill is not in palette, map to closest
      if (!palette.includes(fillLower)) {
        normalizedShape.fill = findClosestColor(fillLower, palette);
      } else {
        normalizedShape.fill = fillLower; // Normalize to lowercase
      }
      
      // For cutout shapes, force to nearest palette color (cutout rendering is via mask anyway)
      if (normalizedShape.role === 'cutout' || normalizedShape.blend === 'cutout') {
        normalizedShape.fill = findClosestColor(normalizedShape.fill, palette);
      }
    }
    
    // Also normalize stroke colors if present
    if (normalizedShape.stroke && isValidHexColor(normalizedShape.stroke)) {
      const strokeLower = normalizedShape.stroke.toLowerCase();
      if (!palette.includes(strokeLower)) {
        normalizedShape.stroke = findClosestColor(strokeLower, palette);
      } else {
        normalizedShape.stroke = strokeLower;
      }
    }
    
    return normalizedShape;
  });
  
  // Build normalized spec with updated shapes and palette
  return {
    ...spec,
    shapes: normalizedShapes,
    // Store palette in metadata for reference (not part of LogoSpec type, but useful)
    metadata: {
      ...spec.metadata,
      colorPalette: palette,
    },
  };
}

/**
 * Normalizes a raw logo spec from OpenAI to the validated LogoSpec format.
 * 
 * - Maps synonyms (e.g., colors -> colorPalette)
 * - Ensures shapes is an array
 * - Ensures params exists ({} if missing)
 * - Ensures stroke is undefined (not included) if missing, null, or "none"
 * - Trims shapes to max 8 (validator enforces style-specific limits)
 * - Intelligently trims paths: preserves symmetric pairs in intricate mode
 * - Clamps shapes to safe area (SAFE_MARGIN = 10)
 * - Normalizes colors to enforce palette constraints
 * - Removes any unknown keys
 * 
 * Note: Blueprint enforcement (including detail cue injection) is handled separately
 * in enforceBlueprint() after validation.
 * 
 * @param raw - Raw logo spec from OpenAI
 * @param colorMode - Color mode ('monochrome', 'muted', 'bold') for palette normalization
 * @param style - Style ('minimal', 'balanced', 'intricate') for path trimming logic
 * @returns Normalized LogoSpec
 */
export function normalizeLogoSpec(raw: RawLogoSpec, colorMode: string = 'muted', style: string = 'balanced'): LogoSpec {
  // Map synonyms: colors -> colorPalette
  const colorPalette = raw.colorPalette || raw.colors || [];

  // Trim colorPalette to max 3
  const trimmedColors = colorPalette.slice(0, 3);

  // Ensure shapes is an array
  if (!Array.isArray(raw.shapes)) {
    throw new Error('shapes must be an array');
  }

  // Intelligently trim paths before normalizing shapes
  // In intricate mode, prefer keeping symmetric path pairs
  let shapesToNormalize = raw.shapes;
  if (style === 'intricate' && raw.shapes.length > 0) {
    const pathShapes = raw.shapes
      .map((s, idx) => ({ shape: s, index: idx }))
      .filter(({ shape }) => shape.type === 'path');
    
    if (pathShapes.length > 2) {
      // More than 2 paths - try to find a symmetric pair to keep
      let bestPair: { idx1: number; idx2: number; score: number } | null = null;
      
      for (let i = 0; i < pathShapes.length; i++) {
        for (let j = i + 1; j < pathShapes.length; j++) {
          const path1 = pathShapes[i].shape;
          const path2 = pathShapes[j].shape;
          
          // Check if they appear to be a symmetric pair
          const fill1 = path1.fill?.toLowerCase();
          const fill2 = path2.fill?.toLowerCase();
          const sameFill = fill1 && fill2 && fill1 === fill2;
          
          const d1 = path1.params?.d || '';
          const d2 = path2.params?.d || '';
          const len1 = d1.length;
          const len2 = d2.length;
          const lengthRatio = len1 > 0 ? len2 / len1 : (len2 > 0 ? Infinity : 1);
          const similarComplexity = lengthRatio >= 0.7 && lengthRatio <= 1.3;
          
          if (sameFill && similarComplexity) {
            // This looks like a symmetric pair
            const score = sameFill ? 1 : 0.5;
            if (!bestPair || score > bestPair.score) {
              bestPair = { idx1: pathShapes[i].index, idx2: pathShapes[j].index, score };
            }
          }
        }
      }
      
      if (bestPair) {
        // Keep the symmetric pair, remove other paths
        shapesToNormalize = raw.shapes.filter((s, idx) => 
          s.type !== 'path' || idx === bestPair!.idx1 || idx === bestPair!.idx2
        );
      } else {
        // No symmetric pair found - keep first 2 paths deterministically
        let pathCount = 0;
        shapesToNormalize = raw.shapes.filter(s => {
          if (s.type === 'path') {
            pathCount++;
            return pathCount <= 2;
          }
          return true;
        });
      }
    }
  } else {
    // For minimal/balanced, trim to max 1 path deterministically
    let pathCount = 0;
    shapesToNormalize = raw.shapes.filter(s => {
      if (s.type === 'path') {
        pathCount++;
        return pathCount <= 1;
      }
      return true;
    });
  }

  // Trim shapes to max 8 (validator will enforce style-specific limits)
  const trimmedShapes = shapesToNormalize.slice(0, 8);

  // Normalize each shape
  const normalizedShapes: Shape[] = trimmedShapes.map((rawShape: RawShape) => {
    // Ensure params exists ({} if missing) - be forgiving
    const params = rawShape.params || {};

    // Ensure stroke is undefined (not included) if missing, null, or "none" - be forgiving
    let stroke: string | undefined = undefined;
    const strokeValue = rawShape.stroke;
    if (strokeValue && strokeValue !== 'none' && strokeValue !== '' && strokeValue !== null) {
      stroke = strokeValue;
    }

    // Build normalized shape by flattening params into the shape object
    // DO NOT add defaults - let validation catch missing params
    // Only include type and fill if they exist
    const normalizedShape: any = {};
    
    if (rawShape.type) {
      normalizedShape.type = rawShape.type;
    }
    if (rawShape.fill) {
      normalizedShape.fill = rawShape.fill;
    }
    
    // Only include stroke if it has a valid value
    if (stroke !== undefined) {
      normalizedShape.stroke = stroke;
    }

    // Flatten params into the shape object
    Object.assign(normalizedShape, params);
    
    // DO NOT add default values for missing params
    // Validation will catch missing required params and fail with clear reasons
    // This ensures motif hints are properly enforced

    // Clamp shapes to safe area (only if params exist - don't add missing params)
    if (normalizedShape.type === 'circle' && normalizedShape.r !== undefined) {
      // Clamp circle radius to max 40 (fits in [10..90] with margin)
      if (normalizedShape.r > MAX_RADIUS) {
        normalizedShape.r = MAX_RADIUS;
      }
      // DO NOT add default cx/cy - let validation catch missing params
    } else if (normalizedShape.type === 'rect') {
      // Clamp rect width and height to max 80 (only if they exist)
      if (normalizedShape.width !== undefined && normalizedShape.width > MAX_DIMENSION) {
        normalizedShape.width = MAX_DIMENSION;
      }
      if (normalizedShape.height !== undefined && normalizedShape.height > MAX_DIMENSION) {
        normalizedShape.height = MAX_DIMENSION;
      }
      // DO NOT add default x/y - let validation catch missing params
    } else if (normalizedShape.type === 'ellipse') {
      // Clamp ellipse radii (only if they exist)
      if (normalizedShape.rx !== undefined && normalizedShape.rx > MAX_RADIUS) {
        normalizedShape.rx = MAX_RADIUS;
      }
      if (normalizedShape.ry !== undefined && normalizedShape.ry > MAX_RADIUS) {
        normalizedShape.ry = MAX_RADIUS;
      }
      // DO NOT add default cx/cy - let validation catch missing params
    }

    // Preserve cutout/role properties
    if (rawShape.role === 'cutout' || rawShape.blend === 'cutout') {
      normalizedShape.role = 'cutout';
    } else {
      normalizedShape.role = 'fill'; // Default
    }

    // Remove any unknown keys (keep only known shape properties)
    const allowedKeys = new Set([
      'type', 'fill', 'stroke', 'strokeWidth', 'opacity', 'role', 'blend',
      'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'ry',
      'points', 'd', 'x1', 'y1', 'x2', 'y2', 'transform'
    ]);

    const cleanedShape: Shape = {} as Shape;
    for (const key of Object.keys(normalizedShape)) {
      if (allowedKeys.has(key)) {
        (cleanedShape as any)[key] = normalizedShape[key];
      }
    }

    return cleanedShape as Shape;
  });

  // Get or create viewBox
  const viewBox = raw.viewBox || { x: 0, y: 0, width: 100, height: 100 };

  // Normalize strokeStyle if present
  let strokeStyle = undefined;
  if (raw.strokeStyle && typeof raw.strokeStyle === 'object') {
    const ss = raw.strokeStyle as any;
    if (ss.enabled === true) {
      strokeStyle = {
        enabled: true,
        width: Math.max(1, Math.min(6, ss.width || 2)),
        color: ss.color || '#000000',
        linecap: (ss.linecap === 'round' || ss.linecap === 'butt') ? ss.linecap : 'round',
        linejoin: (ss.linejoin === 'round' || ss.linejoin === 'miter') ? ss.linejoin : 'round',
      };
    }
  }

  // Build normalized spec
  let normalized: LogoSpec = {
    viewBox,
    shapes: normalizedShapes,
    strokeStyle: strokeStyle || null,
    metadata: {
      description: raw.iconType || undefined,
      // Store raw colorPalette in metadata for normalizeColors to use
      colorPalette: trimmedColors.filter((c: any) => isValidHexColor(c)),
    },
  };

  // Normalize colors to enforce palette constraints
  normalized = normalizeColors(normalized, colorMode);

  // Note: Blueprint enforcement (including detail cue injection) is now handled
  // in enforceBlueprint() after validation. This keeps normalization focused on
  // data cleaning and color normalization only.

  return normalized;
}
