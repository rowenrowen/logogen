import { LogoSpec, Shape } from '@/types/logo';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a logo spec to ensure it meets requirements:
 * - Shape count within limits (3-15)
 * - Color count within limits (1-4)
 * - No typography elements
 * - All shapes are valid geometric shapes
 */
export function validateLogoSpec(spec: LogoSpec): ValidationResult {
  const errors: string[] = [];

  // Check viewBox exists
  if (!spec.viewBox || !spec.viewBox.width || !spec.viewBox.height) {
    errors.push('Invalid viewBox: must have width and height');
  }

  // Check shapes array exists
  if (!Array.isArray(spec.shapes)) {
    errors.push('Shapes must be an array');
    return { valid: false, errors };
  }

  // Check shape count (3-15)
  const shapeCount = spec.shapes.length;
  if (shapeCount < 3) {
    errors.push(`Shape count too low: ${shapeCount} (minimum 3)`);
  }
  if (shapeCount > 15) {
    errors.push(`Shape count too high: ${shapeCount} (maximum 15)`);
  }

  // Collect all colors
  const colors = new Set<string>();
  const validShapeTypes = ['circle', 'rect', 'polygon', 'path', 'ellipse', 'line'];

  spec.shapes.forEach((shape: Shape, index: number) => {
    // Check shape type is valid
    if (!validShapeTypes.includes(shape.type)) {
      errors.push(`Shape ${index}: Invalid type "${shape.type}"`);
    }

    // Check for typography (no text elements) using runtime-safe checks
    const anyShape = shape as any;
    if (anyShape?.text != null || anyShape?.fontSize != null || anyShape?.fontFamily != null || anyShape?.font != null) {
      errors.push(`Shape ${index}: Typography not allowed (found text element)`);
    }

    // Collect colors
    if (shape.fill) {
      if (!isValidHexColor(shape.fill)) {
        errors.push(`Shape ${index}: Invalid fill color format "${shape.fill}"`);
      } else {
        colors.add(shape.fill.toLowerCase());
      }
    }
    if (shape.stroke) {
      if (!isValidHexColor(shape.stroke)) {
        errors.push(`Shape ${index}: Invalid stroke color format "${shape.stroke}"`);
      } else {
        colors.add(shape.stroke.toLowerCase());
      }
    }

    // Validate shape-specific properties
    validateShapeProperties(shape, index, errors, spec.viewBox);
  });

  // Check color count (1-4)
  const colorCount = colors.size;
  if (colorCount === 0) {
    errors.push('No colors found (at least one fill or stroke required)');
  }
  if (colorCount > 4) {
    errors.push(`Too many colors: ${colorCount} (maximum 4)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

function validateShapeProperties(
  shape: Shape,
  index: number,
  errors: string[],
  viewBox: { x: number; y: number; width: number; height: number }
): void {
  switch (shape.type) {
    case 'circle':
      if (shape.cx === undefined || shape.cy === undefined || shape.r === undefined) {
        errors.push(`Shape ${index}: Circle missing required properties (cx, cy, r)`);
      } else {
        // Check bounds
        if (shape.cx - shape.r < viewBox.x || shape.cx + shape.r > viewBox.x + viewBox.width ||
            shape.cy - shape.r < viewBox.y || shape.cy + shape.r > viewBox.y + viewBox.height) {
          errors.push(`Shape ${index}: Circle extends outside viewBox`);
        }
      }
      break;

    case 'rect':
      if (shape.x === undefined || shape.y === undefined || shape.width === undefined || shape.height === undefined) {
        errors.push(`Shape ${index}: Rect missing required properties (x, y, width, height)`);
      } else {
        // Check bounds
        if (shape.x < viewBox.x || shape.x + shape.width > viewBox.x + viewBox.width ||
            shape.y < viewBox.y || shape.y + shape.height > viewBox.y + viewBox.height) {
          errors.push(`Shape ${index}: Rect extends outside viewBox`);
        }
      }
      break;

    case 'ellipse':
      if (shape.cx === undefined || shape.cy === undefined || shape.rx === undefined || shape.ry === undefined) {
        errors.push(`Shape ${index}: Ellipse missing required properties (cx, cy, rx, ry)`);
      } else {
        // Check bounds
        if (shape.cx - shape.rx < viewBox.x || shape.cx + shape.rx > viewBox.x + viewBox.width ||
            shape.cy - shape.ry < viewBox.y || shape.cy + shape.ry > viewBox.y + viewBox.height) {
          errors.push(`Shape ${index}: Ellipse extends outside viewBox`);
        }
      }
      break;

    case 'polygon':
      if (!shape.points || shape.points.length < 3) {
        errors.push(`Shape ${index}: Polygon must have at least 3 points`);
      } else {
        // Check all points are within bounds
        shape.points.forEach((point, pIndex) => {
          if (point.x < viewBox.x || point.x > viewBox.x + viewBox.width ||
              point.y < viewBox.y || point.y > viewBox.y + viewBox.height) {
            errors.push(`Shape ${index}: Polygon point ${pIndex} is outside viewBox`);
          }
        });
      }
      break;

    case 'path':
      if (!shape.d || shape.d.trim().length === 0) {
        errors.push(`Shape ${index}: Path missing required 'd' property`);
      }
      break;

    case 'line':
      if (shape.x1 === undefined || shape.y1 === undefined || shape.x2 === undefined || shape.y2 === undefined) {
        errors.push(`Shape ${index}: Line missing required properties (x1, y1, x2, y2)`);
      } else {
        // Check bounds
        if (shape.x1 < viewBox.x || shape.x1 > viewBox.x + viewBox.width ||
            shape.y1 < viewBox.y || shape.y1 > viewBox.y + viewBox.height ||
            shape.x2 < viewBox.x || shape.x2 > viewBox.x + viewBox.width ||
            shape.y2 < viewBox.y || shape.y2 > viewBox.y + viewBox.height) {
          errors.push(`Shape ${index}: Line extends outside viewBox`);
        }
      }
      break;
  }
}
