import { LogoSpec, Shape } from '@/types/logo';

const SAFE_MARGIN = 10;

/**
 * Renders a clean, centered SVG from a validated logo spec.
 * 
 * Ensures:
 * - No background elements
 * - No text elements
 * - Clean, deterministic output
 * - Centered rendering with safe area
 * - Auto-fits shapes within safe margin
 * 
 * @param spec - Validated logo specification
 * @returns Clean SVG markup string
 */
export function renderSVG(spec: LogoSpec): string {
  const { viewBox, shapes, strokeStyle } = spec;
  
  // DEFENSIVE CHECK: Reject any spec with text-like keys
  const specString = JSON.stringify(spec).toLowerCase();
  const textIndicators = ['name', 'wordmark', 'text', 'letters', 'initials', 'typography', 'font'];
  const hasTextIndicator = textIndicators.some(indicator => specString.includes(indicator));
  if (hasTextIndicator) {
    throw new Error('Spec contains text-related keys - text is not allowed in logo generation');
  }
  
  // Build viewBox string (always use 0 0 100 100 for consistency)
  const vb = `0 0 100 100`;
  
  // Separate fill and cutout shapes
  const fillShapes = shapes.filter(s => s.role !== 'cutout' && s.blend !== 'cutout');
  const cutoutShapes = shapes.filter(s => s.role === 'cutout' || s.blend === 'cutout');
  
  // Render fill shapes
  const fillElements = fillShapes
    .map((shape, index) => renderShape(shape, index, strokeStyle))
    .filter(Boolean)
    .join('\n    ');

  // Compute bounding box for all shapes (for transform)
  const bbox = computeBoundingBox(shapes);
  
  // Calculate transform to fit within safe area
  const targetMin = SAFE_MARGIN;
  const targetMax = 100 - SAFE_MARGIN;
  const targetWidth = targetMax - targetMin;
  const targetHeight = targetMax - targetMin;
  
  const bboxWidth = bbox.maxX - bbox.minX;
  const bboxHeight = bbox.maxY - bbox.minY;
  
  // Calculate scale (don't scale up, only scale down if needed)
  const scaleX = bboxWidth > 0 ? Math.min(targetWidth / bboxWidth, 1) : 1;
  const scaleY = bboxHeight > 0 ? Math.min(targetHeight / bboxHeight, 1) : 1;
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate center of bounding box
  const bboxCenterX = (bbox.minX + bbox.maxX) / 2;
  const bboxCenterY = (bbox.minY + bbox.maxY) / 2;
  
  // Calculate translation to center in viewBox
  const targetCenterX = 50;
  const targetCenterY = 50;
  
  const translateX = targetCenterX - (bboxCenterX * scale);
  const translateY = targetCenterY - (bboxCenterY * scale);
  
  // Build transform string
  const transform = `translate(${translateX}, ${translateY}) scale(${scale})`;

  // Build mask for cutouts if any exist
  let maskDef = '';
  let maskAttr = '';
  if (cutoutShapes.length > 0) {
    const maskId = 'cutout-mask';
    // Base: white rect covering viewBox
    const baseRect = `<rect x="0" y="0" width="100" height="100" fill="white"/>`;
    // Fill shapes: draw in white
    const fillMaskElements = fillShapes
      .map((shape, index) => renderShapeForMask(shape, index, 'white'))
      .filter(Boolean)
      .join('\n      ');
    // Cutout shapes: draw in black (subtracts)
    const cutoutMaskElements = cutoutShapes
      .map((shape, index) => renderShapeForMask(shape, index, 'black'))
      .filter(Boolean)
      .join('\n      ');
    
    maskDef = `    <defs>
      <mask id="${maskId}">
        ${baseRect}
        ${fillMaskElements}
        ${cutoutMaskElements}
      </mask>
    </defs>`;
    maskAttr = ` mask="url(#${maskId})"`;
  }

  // Return clean SVG with no background, no text
  // Do NOT set width/height attributes - let CSS control sizing
  // Use preserveAspectRatio to ensure proper scaling
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">
${maskDef}
    <g id="mark" transform="${transform}"${maskAttr}>
    ${fillElements}
    </g>
</svg>`;
}

/**
 * Computes bounding box for all shapes in the spec.
 * Returns min/max coordinates in spec space (0..100).
 */
function computeBoundingBox(shapes: Shape[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  for (const shape of shapes) {
    const shapeBbox = getShapeBoundingBox(shape);
    if (shapeBbox) {
      minX = Math.min(minX, shapeBbox.minX);
      minY = Math.min(minY, shapeBbox.minY);
      maxX = Math.max(maxX, shapeBbox.maxX);
      maxY = Math.max(maxY, shapeBbox.maxY);
    }
  }
  
  // Default to centered if no shapes or invalid bbox
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { minX: 40, minY: 40, maxX: 60, maxY: 60 };
  }
  
  return { minX, minY, maxX, maxY };
}

/**
 * Gets bounding box for a single shape.
 */
function getShapeBoundingBox(shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } | null {
  switch (shape.type) {
    case 'circle': {
      const cx = shape.cx ?? 50;
      const cy = shape.cy ?? 50;
      const r = shape.r ?? 0;
      return {
        minX: cx - r,
        minY: cy - r,
        maxX: cx + r,
        maxY: cy + r,
      };
    }
    
    case 'rect': {
      const x = shape.x ?? 10;
      const y = shape.y ?? 10;
      const width = shape.width ?? 80;
      const height = shape.height ?? 80;
      return {
        minX: x,
        minY: y,
        maxX: x + width,
        maxY: y + height,
      };
    }
    
    case 'ellipse': {
      const cx = shape.cx ?? 50;
      const cy = shape.cy ?? 50;
      const rx = shape.rx ?? 40;
      const ry = shape.ry ?? 40;
      return {
        minX: cx - rx,
        minY: cy - ry,
        maxX: cx + rx,
        maxY: cy + ry,
      };
    }
    
    case 'polygon': {
      if (!shape.points || shape.points.length === 0) {
        return null;
      }
      const xs = shape.points.map(p => p.x);
      const ys = shape.points.map(p => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
    
    case 'path': {
      if (!shape.d) {
        return null;
      }
      // Simple bbox computation for paths with M/L/H/V/Z commands
      const bbox = parsePathBoundingBox(shape.d);
      if (bbox) {
        return bbox;
      }
      // If we can't parse, return null (will use default)
      return null;
    }
    
    case 'line': {
      const x1 = shape.x1 ?? 10;
      const y1 = shape.y1 ?? 10;
      const x2 = shape.x2 ?? 90;
      const y2 = shape.y2 ?? 90;
      return {
        minX: Math.min(x1, x2),
        minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2),
        maxY: Math.max(y1, y2),
      };
    }
    
    default:
      return null;
  }
}

/**
 * Parses path bounding box from path data string.
 * Conservative approach: extracts all numeric coordinates.
 * For complex paths, this is an approximation.
 */
function parsePathBoundingBox(pathData: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  // Extract all numbers from path data
  const numbers = pathData.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  
  if (!numbers || numbers.length < 2) {
    return null;
  }
  
  // Collect all coordinates (assume they come in x,y pairs)
  const xs: number[] = [];
  const ys: number[] = [];
  
  for (let i = 0; i < numbers.length; i += 2) {
    if (i + 1 < numbers.length) {
      const x = parseFloat(numbers[i]);
      const y = parseFloat(numbers[i + 1]);
      if (isFinite(x) && isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  
  if (xs.length === 0 || ys.length === 0) {
    return null;
  }
  
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/**
 * Renders a single shape to SVG markup.
 * Deterministically converts shape data to SVG elements.
 * Explicitly excludes text and background elements.
 */
function renderShape(shape: Shape, index: number, strokeStyle?: { enabled: boolean; width: number; color: string; linecap?: string; linejoin?: string } | null): string {
  // STRICT TEXT REJECTION: Explicitly reject text elements using runtime-safe checks
  const shapeAny = shape as any;
  if ("text" in shapeAny && shapeAny.text != null) {
    throw new Error(`Shape ${index}: Text elements are not allowed`);
  }
  
  // Check for text-related properties (fontSize, fontFamily, etc.)
  if ("fontSize" in shapeAny || "fontFamily" in shapeAny || "font" in shapeAny) {
    throw new Error(`Shape ${index}: Shape contains text-related properties - text is not allowed`);
  }
  
  // Additional defensive check: reject if shape type is not in allowed list
  const allowedTypes = ['circle', 'rect', 'polygon', 'path', 'ellipse', 'line'];
  if (!allowedTypes.includes(shape.type)) {
    throw new Error(`Shape ${index}: Invalid shape type "${shape.type}". Only geometric shapes allowed, no text.`);
  }
  
  // Check for text-like properties in shape (string-based check)
  const shapeString = JSON.stringify(shape).toLowerCase();
  const textIndicators = ['name', 'wordmark', 'text', 'letters', 'initials', 'typography', 'font'];
  if (textIndicators.some(indicator => shapeString.includes(indicator))) {
    throw new Error(`Shape ${index}: Shape contains text-related properties - text is not allowed`);
  }

  // Build common attributes
  const attrs: string[] = [];

  // Only include fill if specified (no default background fill)
  if (shape.fill !== undefined) {
    attrs.push(`fill="${shape.fill}"`);
  } else {
    // Explicitly set fill to none if not specified (no background)
    attrs.push('fill="none"');
  }

  // Apply strokeStyle if enabled (global stroke styling)
  if (strokeStyle && strokeStyle.enabled) {
    attrs.push(`stroke="${strokeStyle.color}"`);
    attrs.push(`stroke-width="${strokeStyle.width}"`);
    if (strokeStyle.linecap) {
      attrs.push(`stroke-linecap="${strokeStyle.linecap}"`);
    }
    if (strokeStyle.linejoin) {
      attrs.push(`stroke-linejoin="${strokeStyle.linejoin}"`);
    }
  } else {
    // Use shape-specific stroke if no global strokeStyle
    if (shape.stroke) {
      attrs.push(`stroke="${shape.stroke}"`);
    }
    if (shape.strokeWidth !== undefined) {
      attrs.push(`stroke-width="${shape.strokeWidth}"`);
    }
  }
  
  if (shape.opacity !== undefined) {
    attrs.push(`opacity="${shape.opacity}"`);
  }
  if (shape.transform) {
    attrs.push(`transform="${shape.transform}"`);
  }

  const attrString = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Deterministically render based on shape type
  // DO NOT render fallback shapes - missing params should cause validation failure
  switch (shape.type) {
    case 'circle':
      if (shape.cx === undefined || shape.cy === undefined || shape.r === undefined) {
        throw new Error(`Shape ${index}: Circle missing required properties (cx, cy, r) - validation should have caught this`);
      }
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"${attrString} />`;

    case 'rect':
      if (shape.x === undefined || shape.y === undefined || shape.width === undefined || shape.height === undefined) {
        throw new Error(`Shape ${index}: Rect missing required properties (x, y, width, height) - validation should have caught this`);
      }
      const rectAttrs = [
        `x="${shape.x}"`,
        `y="${shape.y}"`,
        `width="${shape.width}"`,
        `height="${shape.height}"`
      ];
      if (shape.rx !== undefined) {
        rectAttrs.push(`rx="${shape.rx}"`);
      }
      if (shape.ry !== undefined) {
        rectAttrs.push(`ry="${shape.ry}"`);
      }
      return `<rect ${rectAttrs.join(' ')}${attrString} />`;

    case 'ellipse':
      if (shape.cx === undefined || shape.cy === undefined || shape.rx === undefined || shape.ry === undefined) {
        throw new Error(`Shape ${index}: Ellipse missing required properties (cx, cy, rx, ry) - validation should have caught this`);
      }
      return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}"${attrString} />`;

    case 'polygon':
      if (!shape.points || !Array.isArray(shape.points) || shape.points.length === 0) {
        throw new Error(`Shape ${index}: Polygon missing or invalid points - validation should have caught this`);
      }
      // Deterministically format points
      const pointsStr = shape.points.map(p => `${p.x},${p.y}`).join(' ');
      return `<polygon points="${pointsStr}"${attrString} />`;

    case 'path':
      if (!shape.d || shape.d.trim().length === 0) {
        throw new Error(`Shape ${index}: Path missing required 'd' property - validation should have caught this`);
      }
      return `<path d="${shape.d}"${attrString} />`;

    case 'line':
      if (shape.x1 === undefined || shape.y1 === undefined || shape.x2 === undefined || shape.y2 === undefined) {
        throw new Error(`Shape ${index}: Line missing required properties (x1, y1, x2, y2) - validation should have caught this`);
      }
      return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}"${attrString} />`;

    default:
      throw new Error(`Shape ${index}: Unknown or invalid shape type: ${(shape as any).type}`);
  }
}

/**
 * Renders a shape for mask (cutout) purposes.
 * Uses a fixed fill color (white for base, black for cutouts).
 */
function renderShapeForMask(shape: Shape, index: number, fillColor: 'white' | 'black'): string {
  const attrs: string[] = [`fill="${fillColor}"`];
  
  // No stroke in mask
  if (shape.opacity !== undefined) {
    attrs.push(`opacity="${shape.opacity}"`);
  }
  if (shape.transform) {
    attrs.push(`transform="${shape.transform}"`);
  }
  
  const attrString = ' ' + attrs.join(' ');

  switch (shape.type) {
    case 'circle':
      if (shape.cx === undefined || shape.cy === undefined || shape.r === undefined) {
        return '';
      }
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"${attrString} />`;

    case 'rect':
      if (shape.x === undefined || shape.y === undefined || shape.width === undefined || shape.height === undefined) {
        return '';
      }
      const rectAttrs = [
        `x="${shape.x}"`,
        `y="${shape.y}"`,
        `width="${shape.width}"`,
        `height="${shape.height}"`
      ];
      if (shape.rx !== undefined) {
        rectAttrs.push(`rx="${shape.rx}"`);
      }
      if (shape.ry !== undefined) {
        rectAttrs.push(`ry="${shape.ry}"`);
      }
      return `<rect ${rectAttrs.join(' ')}${attrString} />`;

    case 'ellipse':
      if (shape.cx === undefined || shape.cy === undefined || shape.rx === undefined || shape.ry === undefined) {
        return '';
      }
      return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}"${attrString} />`;

    case 'polygon':
      if (!shape.points || shape.points.length === 0) {
        return '';
      }
      const pointsStr = shape.points.map(p => `${p.x},${p.y}`).join(' ');
      return `<polygon points="${pointsStr}"${attrString} />`;

    case 'path':
      if (!shape.d || shape.d.trim().length === 0) {
        return '';
      }
      return `<path d="${shape.d}"${attrString} />`;

    case 'line':
      if (shape.x1 === undefined || shape.y1 === undefined || shape.x2 === undefined || shape.y2 === undefined) {
        return '';
      }
      return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}"${attrString} />`;

    default:
      return '';
  }
}
