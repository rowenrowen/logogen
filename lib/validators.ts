import { LogoSpec, Shape } from '@/types/logo';

/**
 * Allowed shape types for logo designs
 */
const ALLOWED_SHAPE_TYPES: readonly string[] = ['circle', 'rect', 'polygon', 'path', 'ellipse', 'line'] as const;

const SAFE_MARGIN = 10;

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validates a logo spec and returns detailed result.
 * 
 * NOTE: This validates the NORMALIZED spec (after color normalization).
 * Color normalization ensures palette constraints are enforced before validation.
 * 
 * Enforces:
 * - Shape count based on style: minimal (1-2), balanced (2-4), intricate (4-8)
 * - 1-3 colors only (normalization should ensure this, but we validate as safety check)
 * - Allowed shape types only
 * - No text or typography
 * - Cutout limits (max 2 cutout shapes)
 * - Stroke style validation
 * - Soft check: shape preference alignment (if shape != 'any')
 * 
 * @param spec - Logo specification to validate (should be normalized)
 * @param shapePreference - Optional shape preference ('any', 'circle', 'square', etc.)
 * @param style - Optional style ('minimal', 'balanced', 'intricate') to determine shape count limits
 * @returns ValidationResult with ok boolean and optional reason string
 */
export function validateSpec(spec: LogoSpec, shapePreference: string = 'any', style: string = 'balanced', motif?: string): ValidationResult {
  // STRICT TEXT REJECTION: Check for any text-related keys in the spec
  const specString = JSON.stringify(spec).toLowerCase();
  const textIndicators = ['name', 'wordmark', 'text', 'letters', 'initials', 'typography', 'font'];
  const hasTextIndicator = textIndicators.some(indicator => specString.includes(indicator));
  if (hasTextIndicator) {
    return { ok: false, reason: 'text-related keys found in spec' };
  }

  // Check shapes array exists and is an array
  if (!spec.shapes || !Array.isArray(spec.shapes)) {
    return { ok: false, reason: 'missing shapes array' };
  }

  const shapeCount = spec.shapes.length;
  
  // Enforce shape count based on style
  let minShapes = 1;
  let maxShapes = 4;
  if (style === 'minimal') {
    minShapes = 1;
    maxShapes = 2;
  } else if (style === 'balanced') {
    minShapes = 2;
    maxShapes = 4;
  } else if (style === 'intricate') {
    minShapes = 4;
    maxShapes = 8;
  }
  
  if (shapeCount < minShapes) {
    return { ok: false, reason: `too few shapes: ${shapeCount} (minimum ${minShapes} for ${style} style)` };
  }
  if (shapeCount > maxShapes) {
    return { ok: false, reason: `too many shapes: ${shapeCount} (maximum ${maxShapes} for ${style} style)` };
  }
  
  // Count cutout shapes (max 2 allowed)
  const cutoutCount = spec.shapes.filter(s => s.role === 'cutout' || s.blend === 'cutout').length;
  if (cutoutCount > 2) {
    return { ok: false, reason: `cutout count too high: ${cutoutCount} (maximum 2)` };
  }
  
  // Validate stroke style if present
  if (spec.strokeStyle) {
    const stroke = spec.strokeStyle;
    if (stroke.enabled) {
      if (stroke.width < 1 || stroke.width > 6) {
        return { ok: false, reason: `invalid stroke width: ${stroke.width} (must be 1-6)` };
      }
      if (!isValidHexColor(stroke.color)) {
        return { ok: false, reason: 'invalid stroke color (must be hex)' };
      }
      if (stroke.linecap && !['round', 'butt'].includes(stroke.linecap)) {
        return { ok: false, reason: `invalid stroke linecap: ${stroke.linecap}` };
      }
      if (stroke.linejoin && !['round', 'miter'].includes(stroke.linejoin)) {
        return { ok: false, reason: `invalid stroke linejoin: ${stroke.linejoin}` };
      }
    }
  }

  // Collect colors and validate shapes
  const colors = new Set<string>();

  for (let i = 0; i < spec.shapes.length; i++) {
    const shape = spec.shapes[i];
    
    // Check for missing type
    if (!shape.type) {
      return { ok: false, reason: `shape at index ${i} missing required type` };
    }
    
    // Check for allowed shape types only (strictly enforce circle|rect|polygon|path|ellipse|line)
    if (!ALLOWED_SHAPE_TYPES.includes(shape.type)) {
      return { ok: false, reason: `invalid shape type at index ${i}: ${shape.type}` };
    }
    
    // Check for missing fill (required for all shapes)
    if (!shape.fill) {
      return { ok: false, reason: `shape at index ${i} missing required fill color` };
    }

    // Check for text or typography (explicitly disallow 'text' type)
    if ((shape as any).type === 'text' || (shape as any).text !== undefined) {
      return { ok: false, reason: `text element found at shape index ${i}` };
    }
    
    // Additional text rejection: check shape properties for text-like values
    const shapeString = JSON.stringify(shape).toLowerCase();
    if (textIndicators.some(indicator => shapeString.includes(indicator))) {
      return { ok: false, reason: `text-related properties found at shape index ${i}` };
    }

    // Validate shape-specific requirements
    if (shape.type === 'circle' && (shape.cx === undefined || shape.cy === undefined || shape.r === undefined)) {
      return { ok: false, reason: `circle at index ${i} missing required params (cx, cy, r)` };
    }
    if (shape.type === 'rect' && (shape.x === undefined || shape.y === undefined || shape.width === undefined || shape.height === undefined)) {
      return { ok: false, reason: `rect at index ${i} missing required params (x, y, width, height)` };
    }
    if (shape.type === 'polygon') {
      if (!shape.points || !Array.isArray(shape.points) || shape.points.length === 0) {
        return { ok: false, reason: `polygon at index ${i} missing or invalid points` };
      }
      if (shape.points.length > 8) {
        return { ok: false, reason: `polygon at index ${i} has too many points: ${shape.points.length} (max 8)` };
      }
    }
    if (shape.type === 'ellipse' && (shape.cx === undefined || shape.cy === undefined || shape.rx === undefined || shape.ry === undefined)) {
      return { ok: false, reason: `ellipse at index ${i} missing required params (cx, cy, rx, ry)` };
    }
    if (shape.type === 'path') {
      if (!shape.d || shape.d.trim().length === 0) {
        return { ok: false, reason: `path at index ${i} missing path data (d)` };
      }
    }
    if (shape.type === 'line' && (shape.x1 === undefined || shape.y1 === undefined || shape.x2 === undefined || shape.y2 === undefined)) {
      return { ok: false, reason: `line at index ${i} missing required params (x1, y1, x2, y2)` };
    }

    // Collect colors (normalize to lowercase for counting)
    if (shape.fill && isValidHexColor(shape.fill)) {
      colors.add(shape.fill.toLowerCase());
    }
    if (shape.stroke && isValidHexColor(shape.stroke)) {
      colors.add(shape.stroke.toLowerCase());
    }
  }

  // Enforce 1-3 colors only
  const colorCount = colors.size;
  if (colorCount < 1) {
    return { ok: false, reason: 'no valid colors found' };
  }
  if (colorCount > 3) {
    return { ok: false, reason: `too many colors: ${colorCount} (maximum 3)` };
  }

  // Quality checks: reject low-quality specs (pass style and motif for path checking)
  const qualityResult = passesQualityChecks(spec, style, motif);
  if (!qualityResult.ok) {
    return qualityResult;
  }

  // Check for full-bleed background shapes (conservative check)
  const hasFullBleedShape = checkFullBleedShape(spec.shapes, shapePreference);
  if (hasFullBleedShape) {
    return { ok: false, reason: 'full-bleed background shape detected' };
  }

  // Soft check: shape preference alignment (if shape != 'any')
  if (shapePreference && shapePreference !== 'any') {
    const symmetry = (spec as any).symmetry?.toLowerCase() || '';
    const shapeTypes = spec.shapes.map(s => s.type);
    
    let aligns = false;
    
    if (shapePreference === 'circle') {
      // Circle: prefer radial symmetry or circular shapes
      aligns = symmetry.includes('radial') || 
               shapeTypes.some(t => t === 'circle' || t === 'ellipse') ||
               symmetry.includes('centered');
    } else if (shapePreference === 'square') {
      // Square: prefer rects or polygons with orthogonal geometry
      aligns = shapeTypes.some(t => t === 'rect') ||
               (symmetry.includes('bilateral') && shapeTypes.some(t => t === 'polygon'));
    } else if (shapePreference === 'triangle') {
      // Triangle: prefer triangular forms or peak-like compositions
      aligns = shapeTypes.some(t => t === 'polygon') ||
               symmetry.includes('bilateral') ||
               symmetry.includes('asymmetric');
    } else if (shapePreference === 'hexagon') {
      // Hexagon: prefer polygons (especially 6-pointed) or 60° geometry
      aligns = shapeTypes.some(t => t === 'polygon') ||
               shapeTypes.some(t => t === 'path');
    } else if (shapePreference === 'badge') {
      // Badge: prefer centered, balanced compositions
      aligns = symmetry.includes('radial') ||
               symmetry.includes('centered') ||
               symmetry.includes('bilateral');
    }
    
    // Only reject if it's wildly off (be lenient)
    // If no alignment indicators found, still allow it (soft check)
    // This is intentionally lenient to avoid over-rejection
  }

  return { ok: true };
}

/**
 * Checks if shapes contain a full-bleed background shape.
 * Conservative check - only rejects obvious background cases.
 * 
 * @param shapes - Array of shapes to check
 * @param shapePreference - User's shape preference
 * @returns true if full-bleed background detected (should reject)
 */
function checkFullBleedShape(shapes: Shape[], shapePreference: string = 'any'): boolean {
  // Allow one enclosing shape if shape preference is circle/square/hexagon/badge
  const allowsEnclosingShape = ['circle', 'square', 'hexagon', 'badge'].includes(shapePreference);
  
  let enclosingShapeCount = 0;
  
  for (const shape of shapes) {
    let isFullBleed = false;
    
    if (shape.type === 'circle') {
      const cx = shape.cx ?? 50;
      const cy = shape.cy ?? 50;
      const r = shape.r ?? 0;
      // Check if circle extends beyond safe area significantly
      if (r > 45 || (cx - r < 5 && cy - r < 5 && cx + r > 95 && cy + r > 95)) {
        isFullBleed = true;
      }
    } else if (shape.type === 'rect') {
      const x = shape.x ?? 0;
      const y = shape.y ?? 0;
      const width = shape.width ?? 0;
      const height = shape.height ?? 0;
      // Check if rect fills most of the canvas (background-like)
      if ((x < 5 && y < 5 && width > 90 && height > 90) || 
          (width > 90 || height > 90)) {
        isFullBleed = true;
      }
    } else if (shape.type === 'polygon' && shape.points) {
      // Check if polygon appears to be a full-bleed enclosing shape
      const xs = shape.points.map(p => p.x);
      const ys = shape.points.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      // If polygon spans most of the canvas, it might be a background
      if (minX < 5 && minY < 5 && maxX > 95 && maxY > 95) {
        isFullBleed = true;
      }
    } else if (shape.type === 'path' && shape.d) {
      // Simple check for paths that might be full-bleed
      // Look for paths that start near (0,0) and extend to (100,100)
      const pathStr = shape.d.toLowerCase();
      if (pathStr.includes('m 0') || pathStr.includes('m0')) {
        // Could be a full-bleed path, but be conservative
        // Only reject if it's clearly a rectangle-like path
        if (pathStr.includes('l 100') || pathStr.includes('l100') || 
            pathStr.includes('h 100') || pathStr.includes('h100') ||
            pathStr.includes('v 100') || pathStr.includes('v100')) {
          isFullBleed = true;
        }
      }
    }
    
    if (isFullBleed) {
      enclosingShapeCount++;
      // If not allowing enclosing shapes, reject immediately
      if (!allowsEnclosingShape) {
        return true;
      }
      // If allowing but more than one, reject
      if (enclosingShapeCount > 1) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Quality checks to reject low-quality specs.
 * Symmetry-aware: allows 2 paths in intricate mode if they appear to be a mirrored pair.
 * Leaf-aware: allows curved paths (A/Q/C) for leaf motif.
 * 
 * @param spec - Logo spec to check
 * @param style - Style ('minimal', 'balanced', 'intricate') for path limit determination
 * @param motif - Optional motif ('leaves', 'sunshine', etc.) for special rules
 * @returns ValidationResult
 */
function passesQualityChecks(spec: LogoSpec, style: string = 'balanced', motif?: string): ValidationResult {
  const shapes = spec.shapes || [];
  
  // Determine max paths based on style and motif
  let maxPaths = 1;
  const isLeafMotif = motif === 'leaves';
  
  if (style === 'minimal') {
    maxPaths = isLeafMotif ? 2 : 1; // Allow 2 paths for leaf (silhouette + vein)
  } else if (style === 'balanced') {
    maxPaths = isLeafMotif ? 2 : 1; // Allow 2 paths for leaf
  } else if (style === 'intricate') {
    maxPaths = 2; // Allow up to 2 if symmetric pair or leaf motif
  }
  
  // Count paths
  const pathShapes = shapes.filter(s => s.type === 'path');
  const pathCount = pathShapes.length;
  
  if (pathCount > maxPaths) {
    return { ok: false, reason: `too many paths: ${pathCount} (maximum ${maxPaths} for ${style} style${isLeafMotif ? ' with leaf motif' : ''})` };
  }
  
  // For intricate mode with 2 paths, check if they appear to be a symmetric pair (unless leaf motif)
  if (style === 'intricate' && pathCount === 2 && !isLeafMotif) {
    const [path1, path2] = pathShapes;
    
    // Check if both have the same fill color
    const fill1 = path1.fill?.toLowerCase();
    const fill2 = path2.fill?.toLowerCase();
    const sameFill = fill1 && fill2 && fill1 === fill2;
    
    // Check if they have similar command complexity (within 30% length)
    const d1 = path1.d || '';
    const d2 = path2.d || '';
    const len1 = d1.length;
    const len2 = d2.length;
    const lengthRatio = len1 > 0 ? len2 / len1 : (len2 > 0 ? Infinity : 1);
    const similarComplexity = lengthRatio >= 0.7 && lengthRatio <= 1.3;
    
    // If not a symmetric pair, reject
    if (!sameFill || !similarComplexity) {
      return { ok: false, reason: `too many paths: 2 paths found but they do not appear to be a symmetric pair (different fills or complexity)` };
    }
  }
  
  // Check path commands (if paths exist)
  // For leaf motif, allow curved paths (A, Q, C) for the silhouette
  for (const pathShape of pathShapes) {
    if (pathShape.d) {
      const pathData = pathShape.d.toUpperCase();
      const freeformCurveCommands = ['C', 'Q', 'S', 'T'];
      const hasFreeformCurves = freeformCurveCommands.some(cmd => pathData.includes(cmd));
      
      // Allow curves for leaf motif (A, Q, C are needed for curved leaf silhouette)
      if (hasFreeformCurves && !isLeafMotif) {
        return { ok: false, reason: 'path commands not allowed (freeform curves C/Q/S/T detected)' };
      }
      
      // For leaf motif, prefer A/Q/C for curves, but still allow M/L/H/V/Z
      // Check path length to avoid overly complex paths
      if (pathData.length > 500) {
        return { ok: false, reason: `path too complex: ${pathData.length} characters (max 500)` };
      }
    }
  }
  
  // Check polygon point count (already checked in main validation, but keep for consistency)
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    if (shape.type === 'polygon' && shape.points) {
      if (shape.points.length > 8) {
        return { ok: false, reason: `polygon at index ${i} has too many points: ${shape.points.length} (max 8)` };
      }
    }
  }
  
  return { ok: true };
}

/**
 * Helper function to validate hex color format
 */
function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}
