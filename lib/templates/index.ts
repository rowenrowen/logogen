import { LogoSpec, Shape } from '@/types/logo';

const SAFE_MARGIN = 10;
const CENTER_X = 50;
const CENTER_Y = 50;

export interface FilledGeometricParams {
  layers: 2 | 3 | 4;
  cornerRadius: number; // 10..22
  rotationDeg: number; // -25..25
  sizeScale: number; // 0.55..0.95
  offset: number; // 0..10
  accent: boolean;
}

export interface RadialSunburstParams {
  rayCount: number; // 6..12
  rayStyle: 'triangle' | 'bar';
  innerRadius: number; // 14..24
  outerRadius: number; // 30..42
  ringCount: 1 | 2;
  ringThickness: number; // 3..8
  outerRing: boolean;
}

/**
 * Renders a filled geometric logo (overlapping rounded squares).
 * 
 * @param params - Template parameters
 * @param palette - Color palette (primary, secondary, accent)
 * @param style - Style ('minimal', 'balanced', 'intricate')
 * @returns LogoSpec
 */
export function renderFilledGeometric(
  params: FilledGeometricParams,
  palette: string[],
  style: string = 'balanced'
): LogoSpec {
  const shapes: Shape[] = [];
  let { layers, cornerRadius, rotationDeg, sizeScale, offset, accent } = params;
  
  // ENFORCE minimum layers based on style (never allow 1 layer)
  let actualLayers: 2 | 3 | 4;
  if (style === 'minimal') {
    actualLayers = 2; // Always 2 for minimal
  } else if (style === 'balanced') {
    actualLayers = 3; // Always 3 for balanced
  } else {
    actualLayers = 4; // Always 4 for intricate
  }
  
  // ENFORCE palette contrast: ensure colors have enough contrast
  const enhancedPalette = ensurePaletteContrast(palette);
  
  // Base size (fits within safe area)
  const baseSize = 70;
  
  // ENFORCE specific rotation patterns per style (not random)
  const rotationPatterns: Record<string, number[]> = {
    minimal: [-18, 18],
    balanced: [-22, 0, 22],
    intricate: [-26, -8, 10, 28],
  };
  const rotations = rotationPatterns[style] || rotationPatterns.balanced;
  
  // ENFORCE translation offsets per layer (so edges reveal)
  const offsetPatterns: Record<string, Array<[number, number]>> = {
    minimal: [[-4, -2], [4, 2]],
    balanced: [[-4, -2], [-2, 2], [4, -1]],
    intricate: [[-4, -2], [-2, 2], [2, 3], [4, -1]],
  };
  const offsets = offsetPatterns[style] || offsetPatterns.balanced;
  
  // ENFORCE varied corner radius per layer (base: 18-24, mid: 14-18, top: 10-14)
  const cornerRadiusPatterns: Record<string, number[]> = {
    minimal: [22, 14], // base, top
    balanced: [22, 16, 12], // base, mid, top
    intricate: [24, 18, 14, 10], // base, mid, mid, top
  };
  const cornerRadii = cornerRadiusPatterns[style] || cornerRadiusPatterns.balanced;
  
  // ENFORCE size differences (each layer visibly smaller)
  const sizeScales: Record<string, number[]> = {
    minimal: [1.0, 0.70], // base, top
    balanced: [1.0, 0.75, 0.55], // base, mid, top
    intricate: [1.0, 0.80, 0.65, 0.50], // base, mid, mid, top
  };
  const scales = sizeScales[style] || sizeScales.balanced;
  
  // ENFORCE palette usage: ensure at least 2 distinct colors used
  const colorIndices: number[] = [];
  if (enhancedPalette.length >= 2) {
    // Ensure first 2 layers use different colors
    for (let i = 0; i < actualLayers; i++) {
      if (i < 2) {
        colorIndices.push(i); // First two layers use different colors
      } else {
        colorIndices.push(i % enhancedPalette.length); // Remaining cycle through
      }
    }
  } else {
    // Single color: all layers use it
    for (let i = 0; i < actualLayers; i++) {
      colorIndices.push(0);
    }
  }
  
  // Create layered rounded rects with enforced differences
  for (let i = 0; i < actualLayers; i++) {
    const layerIndex = actualLayers - 1 - i; // Reverse order (largest first)
    
    // Use enforced size scale
    const scale = scales[i];
    const size = baseSize * scale;
    
    // Use enforced rotation
    const layerRotation = rotations[i];
    
    // Use enforced translation offset
    const [offsetX, offsetY] = offsets[i];
    
    // Calculate position with offset (cap to safe margin)
    let x = CENTER_X - size / 2 + offsetX;
    let y = CENTER_Y - size / 2 + offsetY;
    
    // Clamp to safe area
    x = Math.max(SAFE_MARGIN, Math.min(100 - SAFE_MARGIN - size, x));
    y = Math.max(SAFE_MARGIN, Math.min(100 - SAFE_MARGIN - size, y));
    
    // Use assigned color from enhanced palette
    const fill = enhancedPalette[colorIndices[i]];
    
    // Use enforced corner radius
    const rx = cornerRadii[i];
    
    // Create rounded rect
    const rect: Shape = {
      type: 'rect',
      fill,
      x,
      y,
      width: size,
      height: size,
      rx,
      ry: rx,
      transform: `rotate(${layerRotation}, ${CENTER_X}, ${CENTER_Y})`,
    };
    
    shapes.push(rect);
  }
  
  // Add optional "highlight" detail ONLY in intricate mode (refinement, not clutter)
  if (accent && style === 'intricate') {
    // Highlight must be <= 14% of canvas width (14 units max diameter)
    const highlightRadius = 7; // Max radius 7 (diameter 14)
    
    // Use last color in enhanced palette or first if only one
    const highlightColor = enhancedPalette.length > 1 ? enhancedPalette[enhancedPalette.length - 1] : enhancedPalette[0];
    
    // Add small inset cutout (negative space) for highlight effect
    const highlightShape: Shape = {
      type: 'circle',
      role: 'cutout', // Cutout creates negative space highlight
      fill: highlightColor,
      cx: CENTER_X,
      cy: CENTER_Y,
      r: highlightRadius,
    };
    
    shapes.push(highlightShape);
  }
  
  return {
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    shapes,
    metadata: {
      description: 'filled-geometric',
      colorPalette: enhancedPalette,
    },
  };
}

/**
 * Ensures palette colors have enough contrast (even in muted mode).
 * If colors are too similar, swaps one for a higher-contrast option.
 */
function ensurePaletteContrast(palette: string[]): string[] {
  if (palette.length < 2) {
    return palette; // Single color, no contrast needed
  }
  
  // Calculate RGB distance between colors
  const color1 = hexToRgb(palette[0]);
  const color2 = hexToRgb(palette[1]);
  
  if (!color1 || !color2) {
    return palette; // Invalid colors, return as-is
  }
  
  const distance = Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
    Math.pow(color1.g - color2.g, 2) +
    Math.pow(color1.b - color2.b, 2)
  );
  
  // Threshold: if colors are too similar (distance < 80), swap one
  if (distance < 80) {
    // Swap second color for a higher-contrast muted option
    const highContrastMuted = [
      '#5A6578', // Slate gray
      '#6B8E7F', // Teal green
      '#7A9B8A', // Forest green
      '#4A6FA5', // Blue
    ];
    
    // Find a color that contrasts well with the first
    let bestContrast = palette[1];
    let maxDistance = distance;
    
    for (const candidate of highContrastMuted) {
      const candidateRgb = hexToRgb(candidate);
      if (candidateRgb) {
        const candidateDistance = Math.sqrt(
          Math.pow(color1.r - candidateRgb.r, 2) +
          Math.pow(color1.g - candidateRgb.g, 2) +
          Math.pow(color1.b - candidateRgb.b, 2)
        );
        if (candidateDistance > maxDistance) {
          maxDistance = candidateDistance;
          bestContrast = candidate;
        }
      }
    }
    
    return [palette[0], bestContrast, ...palette.slice(2)];
  }
  
  return palette;
}

/**
 * Converts hex color to RGB.
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
 * Renders a radial sunburst logo.
 * 
 * @param params - Template parameters
 * @param palette - Color palette (primary, secondary, accent)
 * @param style - Style ('minimal', 'balanced', 'intricate')
 * @returns LogoSpec
 */
export function renderRadialSunburst(
  params: RadialSunburstParams,
  palette: string[],
  style: string = 'balanced'
): LogoSpec {
  const shapes: Shape[] = [];
  const { rayCount, rayStyle, innerRadius, outerRadius, ringCount, ringThickness, outerRing } = params;
  
  // ENFORCE ray count: must be 8, 10, or 12 only
  let actualRayCount: 8 | 10 | 12;
  if (rayCount <= 8) {
    actualRayCount = 8;
  } else if (rayCount <= 10) {
    actualRayCount = 10;
  } else {
    actualRayCount = 12;
  }
  
  // ENFORCE ray style: always use bar rays (sun-like, not gear-like)
  const actualRayStyle = 'bar'; // Always bar rays for sun appearance
  
  // Build sun structure explicitly
  // Center disc radius: 16-22
  const centerDiscRadius = Math.max(16, Math.min(22, innerRadius));
  
  // Optional inner ring (intricate only)
  let hasInnerRing = false;
  if (style === 'intricate' && ringCount === 2) {
    hasInnerRing = true;
  }
  
  // ENFORCE: Remove outer container ring by default (only if explicitly requested)
  // outerRing should be false unless user explicitly picks shape=circle AND archetype=emblem
  // For now, we'll keep it false by default to avoid gear appearance
  const useOuterRing = false; // Disabled by default to avoid gear/target look
  
  // Create center disc (always present)
  const primaryColor = palette[0];
  const centerDisc: Shape = {
    type: 'circle',
    fill: primaryColor, // palette[0]
    cx: CENTER_X,
    cy: CENTER_Y,
    r: centerDiscRadius,
  };
  shapes.push(centerDisc);
  
  // Add optional inner ring (intricate only, thickness 3-6)
  if (hasInnerRing) {
    const innerRingThickness = Math.max(3, Math.min(6, ringThickness));
    const innerRingColor = palette.length > 2 ? palette[2] : (palette.length > 1 ? palette[1] : palette[0]);
    
    const innerRing: Shape = {
      type: 'circle',
      fill: 'none',
      stroke: innerRingColor,
      strokeWidth: innerRingThickness,
      cx: CENTER_X,
      cy: CENTER_Y,
      r: centerDiscRadius + innerRingThickness / 2,
    };
    shapes.push(innerRing);
  }
  
  // Create rays: must extend outward BEYOND the disc/ring
  const angleStep = (2 * Math.PI) / actualRayCount;
  // ENFORCE color discipline: rays use ONE color (palette[1] if available, else palette[0])
  const rayColor = palette.length > 1 ? palette[1] : palette[0];
  
  // Ray geometry: rays start outside disc and extend outward
  const rayStart = centerDiscRadius + 6; // Start 6 units outside disc
  const rayLength = Math.max(10, Math.min(16, outerRadius - rayStart)); // Ray length 10-16
  const rayEnd = rayStart + rayLength;
  
  // Ensure rays don't exceed safe area
  const maxRadius = 40; // Safe area limit
  const clampedRayEnd = Math.min(rayEnd, maxRadius);
  const clampedRayLength = clampedRayEnd - rayStart;
  
  for (let i = 0; i < actualRayCount; i++) {
    const angle = i * angleStep;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // Bar rays: rounded rectangles extending outward
    const rayWidth = 3; // Fixed width for clean sun rays (rx=2-4)
    const rayRx = 2; // Rounded corners
    
    // Calculate center point of the ray (midpoint along ray)
    const rayCenterX = CENTER_X + cos * (rayStart + clampedRayLength / 2);
    const rayCenterY = CENTER_Y + sin * (rayStart + clampedRayLength / 2);
    
    // Create rectangle along ray direction, then rotate
    const bar: Shape = {
      type: 'rect',
      fill: rayColor,
      x: rayCenterX - rayWidth / 2,
      y: rayCenterY - clampedRayLength / 2,
      width: rayWidth,
      height: clampedRayLength,
      rx: rayRx,
      ry: rayRx,
      transform: `rotate(${angle * 180 / Math.PI}, ${rayCenterX}, ${rayCenterY})`,
    };
    shapes.push(bar);
  }
  
  // Outer ring removed by default to avoid gear/target appearance
  // The sun itself (disc + rays) is the mark
  
  return {
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    shapes,
    metadata: {
      description: 'radial-sunburst',
      colorPalette: palette,
    },
  };
}
