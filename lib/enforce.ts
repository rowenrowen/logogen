import { LogoSpec, Shape, MotifBlueprint } from '@/types/logo';

const SAFE_MARGIN = 10;

export interface EnforcementNotes {
  requiredPartsSatisfied: boolean;
  detailCueInjected?: string;
  enforcementActions: string[];
}

/**
 * Determines the appropriate detail cue for a blueprint based on motif and style.
 * 
 * @param blueprint - Motif blueprint
 * @param style - Style ('minimal', 'balanced', 'intricate')
 * @param archetype - Optional archetype string
 * @returns Detail cue identifier
 */
function determineDetailCue(
  blueprint: MotifBlueprint,
  style: string,
  archetype?: string
): string | null {
  if (blueprint.motif === 'leaves') {
    return 'center_vein_cutout';
  } else if (blueprint.motif === 'sunshine') {
    // For sunshine, prefer horizon_line in balanced/intricate, inner_rays_cutout in minimal
    if (style === 'minimal') {
      return 'inner_rays_cutout';
    }
    return 'horizon_line';
  } else if (blueprint.motif === 'building-blocks') {
    // For building-blocks, prefer stack_offset in balanced/intricate, corner_rounding in minimal
    if (style === 'minimal') {
      return 'corner_rounding';
    } else if (style === 'balanced') {
      return 'stack_offset';
    }
    return 'overlap_layer';
  } else if (blueprint.motif === 'generic') {
    // For generic, choose based on archetype/style
    const archetypeLower = (archetype || '').toLowerCase();
    if (archetypeLower.includes('monoline') || archetypeLower.includes('line')) {
      return 'inner_line';
    } else if (archetypeLower.includes('solid') || archetypeLower.includes('mark')) {
      return 'accent_cutout';
    } else if (archetypeLower.includes('emblem') || archetypeLower.includes('seal')) {
      return 'inner_notch';
    }
    // Default based on style
    if (style === 'minimal') {
      return 'inner_line';
    } else if (style === 'balanced') {
      return 'accent_cutout';
    }
    return 'inner_notch';
  }
  
  return null;
}

/**
 * Checks if required parts from blueprint are satisfied in the spec.
 * 
 * @param spec - Logo spec
 * @param blueprint - Motif blueprint
 * @returns true if all required parts are present
 */
function checkRequiredPartsSatisfaction(spec: LogoSpec, blueprint: MotifBlueprint): boolean {
  const shapes = spec.shapes || [];
  const shapeTypes = shapes.map(s => s.type);
  const requiredParts = blueprint.requiredParts || [];
  
  // Heuristic checks based on motif
  if (blueprint.motif === 'leaves') {
    // Need: curved leaf silhouette + central vein
    const hasPath = shapeTypes.some(t => t === 'path');
    const hasPolygon = shapeTypes.some(t => t === 'polygon');
    const hasEllipse = shapeTypes.some(t => t === 'ellipse');
    const hasCircle = shapeTypes.some(t => t === 'circle');
    
    // Check for curved path
    let hasCurvedPath = false;
    if (hasPath) {
      for (const shape of shapes) {
        if (shape.type === 'path' && shape.d) {
          const pathData = shape.d.toUpperCase();
          if (pathData.includes('A') || pathData.includes('Q') || pathData.includes('C')) {
            hasCurvedPath = true;
            break;
          }
        }
      }
    }
    
    const hasCurvedSilhouette = hasCurvedPath || (hasEllipse && shapes.length >= 2) || (hasCircle && shapes.length >= 2);
    
    // Check for vein
    const hasVein = shapes.some(s => {
      if (s.role === 'cutout' || s.blend === 'cutout') {
        if (s.type === 'rect' && s.x !== undefined && s.width !== undefined) {
          return s.x >= 48 && s.x <= 50 && s.width <= 3 && s.height !== undefined && s.height >= 50;
        } else if (s.type === 'path' && s.d) {
          return s.d.includes('50 25') || s.d.includes('50 78');
        }
      }
      if (s.type === 'line' && s.x1 !== undefined && s.x2 !== undefined) {
        return Math.abs(s.x1 - s.x2) < 5 && ((s.x1 >= 40 && s.x1 <= 60) || (s.x2 >= 40 && s.x2 <= 60));
      }
      return false;
    });
    
    return hasCurvedSilhouette && hasVein;
  } else if (blueprint.motif === 'sunshine') {
    // Need: sun disc/arc + rays
    const hasCircleOrEllipse = shapeTypes.some(t => t === 'circle' || t === 'ellipse');
    const hasPath = shapeTypes.some(t => t === 'path');
    const rayCount = shapeTypes.filter(t => t === 'line').length;
    
    const hasSunDisc = hasCircleOrEllipse || hasPath;
    const hasRays = rayCount >= 3 && rayCount <= 7;
    
    return hasSunDisc && hasRays;
  } else if (blueprint.motif === 'building-blocks') {
    // Need: 2-4 stacked blocks
    const rectCount = shapeTypes.filter(t => t === 'rect').length;
    const polygonCount = shapeTypes.filter(t => t === 'polygon').length;
    const blockCount = rectCount + polygonCount;
    
    return blockCount >= 2 && blockCount <= 4;
  }
  
  // Generic: just check if we have reasonable shape count
  return shapes.length >= 2;
}

/**
 * Injects a detail cue shape into the spec.
 * 
 * @param spec - Logo spec
 * @param detailCue - Detail cue identifier
 * @param blueprint - Motif blueprint
 * @returns Spec with injected detail cue
 */
function injectDetailCue(
  spec: LogoSpec,
  detailCue: string,
  blueprint: MotifBlueprint
): LogoSpec {
  const shapes = spec.shapes || [];
  const actions: string[] = [];
  
  // Get palette color
  let cueColor = '#000000';
  const palette = (spec.metadata as any)?.colorPalette;
  if (palette && Array.isArray(palette) && palette.length > 0) {
    cueColor = palette[0];
  } else if (shapes.length > 0 && shapes[0].fill) {
    cueColor = shapes[0].fill;
  }
  
  let injectedShape: Shape | null = null;
  
  switch (detailCue) {
    case 'center_vein_cutout':
      // Leaf vein: thin vertical cutout rect
      injectedShape = {
        type: 'rect',
        role: 'cutout',
        fill: cueColor,
        x: 49,
        y: 25,
        width: 2,
        height: 53,
      };
      actions.push('Injected center_vein_cutout (thin vertical rect)');
      break;
      
    case 'horizon_line':
      // Sunshine horizon: horizontal line near bottom
      injectedShape = {
        type: 'line',
        fill: cueColor,
        x1: 20,
        y1: 75,
        x2: 80,
        y2: 75,
        strokeWidth: 2,
      };
      actions.push('Injected horizon_line (horizontal line at y=75)');
      break;
      
    case 'inner_rays_cutout':
      // Sunshine inner rays: small cutout lines radiating from center
      // For minimal, add 2-3 small cutout lines
      const rayCount = 3;
      const centerX = 50;
      const centerY = 50;
      const rayLength = 8;
      const injectedRays: Shape[] = [];
      
      for (let i = 0; i < rayCount; i++) {
        const angle = (i * 360 / rayCount) * (Math.PI / 180);
        const x1 = centerX + Math.cos(angle) * 15;
        const y1 = centerY + Math.sin(angle) * 15;
        const x2 = centerX + Math.cos(angle) * (15 + rayLength);
        const y2 = centerY + Math.sin(angle) * (15 + rayLength);
        
        injectedRays.push({
          type: 'line',
          role: 'cutout',
          fill: cueColor,
          x1,
          y1,
          x2,
          y2,
          strokeWidth: 1,
        });
      }
      
      return {
        ...spec,
        shapes: [...shapes, ...injectedRays],
        metadata: {
          ...spec.metadata,
          detailCueInjected: detailCue,
        },
      };
      
    case 'stack_offset':
      // Building-blocks: slight offset for stacked effect
      // Adjust existing rect positions slightly
      const updatedShapes = shapes.map((shape, idx) => {
        if (shape.type === 'rect' && idx > 0) {
          // Offset subsequent blocks slightly
          return {
            ...shape,
            x: (shape.x || 0) + 2,
            y: (shape.y || 0) - 2,
          };
        }
        return shape;
      });
      actions.push('Applied stack_offset (offset subsequent blocks)');
      return {
        ...spec,
        shapes: updatedShapes,
        metadata: {
          ...spec.metadata,
          detailCueInjected: detailCue,
        },
      };
      
    case 'corner_rounding':
      // Building-blocks: add rounded corners to rects
      const roundedShapes = shapes.map(shape => {
        if (shape.type === 'rect' && shape.rx === undefined) {
          return {
            ...shape,
            rx: 3,
            ry: 3,
          };
        }
        return shape;
      });
      actions.push('Applied corner_rounding (rx=3, ry=3 to rects)');
      return {
        ...spec,
        shapes: roundedShapes,
        metadata: {
          ...spec.metadata,
          detailCueInjected: detailCue,
        },
      };
      
    case 'overlap_layer':
      // Building-blocks: add subtle overlap effect via slight size adjustment
      const overlappedShapes = shapes.map((shape, idx) => {
        if (shape.type === 'rect' && idx > 0) {
          // Make subsequent blocks slightly larger for overlap effect
          return {
            ...shape,
            width: (shape.width || 0) + 1,
            height: (shape.height || 0) + 1,
          };
        }
        return shape;
      });
      actions.push('Applied overlap_layer (slight size increase for overlap)');
      return {
        ...spec,
        shapes: overlappedShapes,
        metadata: {
          ...spec.metadata,
          detailCueInjected: detailCue,
        },
      };
      
    case 'inner_line':
      // Generic monoline: add a simple inner line
      injectedShape = {
        type: 'line',
        fill: cueColor,
        x1: 40,
        y1: 50,
        x2: 60,
        y2: 50,
        strokeWidth: 1,
      };
      actions.push('Injected inner_line (horizontal line at center)');
      break;
      
    case 'accent_cutout':
      // Generic solid-mark: add a small accent cutout
      injectedShape = {
        type: 'circle',
        role: 'cutout',
        fill: cueColor,
        cx: 50,
        cy: 50,
        r: 8,
      };
      actions.push('Injected accent_cutout (small circular cutout)');
      break;
      
    case 'inner_notch':
      // Generic emblem: add a small inner notch
      injectedShape = {
        type: 'polygon',
        role: 'cutout',
        fill: cueColor,
        points: [
          { x: 50, y: 45 },
          { x: 48, y: 50 },
          { x: 50, y: 55 },
          { x: 52, y: 50 },
        ],
      };
      actions.push('Injected inner_notch (small diamond cutout)');
      break;
      
    default:
      return spec; // Unknown cue, return unchanged
  }
  
  if (injectedShape) {
    return {
      ...spec,
      shapes: [...shapes, injectedShape],
      metadata: {
        ...spec.metadata,
        detailCueInjected: detailCue,
      },
    };
  }
  
  return spec;
}

/**
 * Enforces blueprint requirements on a normalized spec.
 * 
 * - Checks requiredParts satisfaction
 * - Injects detailCue when missing
 * - Ensures safe-area fit (shapes stay within SAFE_MARGIN)
 * - Returns enforced spec with enforcement notes
 * 
 * @param spec - Normalized logo spec
 * @param blueprint - Motif blueprint
 * @param options - Options including style, archetype
 * @returns Enforced spec and enforcement notes
 */
export function enforceBlueprint(
  spec: LogoSpec,
  blueprint: MotifBlueprint,
  options: { style: string; archetype?: string }
): { spec: LogoSpec; notes: EnforcementNotes } {
  const notes: EnforcementNotes = {
    requiredPartsSatisfied: false,
    enforcementActions: [],
  };
  
  // Check required parts satisfaction
  const partsSatisfied = checkRequiredPartsSatisfaction(spec, blueprint);
  notes.requiredPartsSatisfied = partsSatisfied;
  
  if (!partsSatisfied) {
    notes.enforcementActions.push('Required parts not fully satisfied');
  }
  
  // Determine detail cue
  const detailCue = determineDetailCue(blueprint, options.style, options.archetype);
  
  if (detailCue) {
    // Check if detail cue is already present
    const hasCue = checkDetailCuePresent(spec, detailCue);
    
    if (!hasCue) {
      // Inject detail cue
      const enforcedSpec = injectDetailCue(spec, detailCue, blueprint);
      notes.detailCueInjected = detailCue;
      notes.enforcementActions.push(`Injected detail cue: ${detailCue}`);
      
      // Ensure safe-area fit (clamp shapes if needed)
      const clampedSpec = ensureSafeAreaFit(enforcedSpec);
      
      return {
        spec: clampedSpec,
        notes,
      };
    } else {
      notes.enforcementActions.push(`Detail cue ${detailCue} already present`);
    }
  }
  
  // Ensure safe-area fit even if no injection
  const clampedSpec = ensureSafeAreaFit(spec);
  
  return {
    spec: clampedSpec,
    notes,
  };
}

/**
 * Checks if a detail cue is already present in the spec.
 */
function checkDetailCuePresent(spec: LogoSpec, detailCue: string): boolean {
  const shapes = spec.shapes || [];
  
  switch (detailCue) {
    case 'center_vein_cutout':
      return shapes.some(s => {
        if (s.role === 'cutout' && s.type === 'rect' && s.x !== undefined && s.width !== undefined) {
          return s.x >= 48 && s.x <= 50 && s.width <= 3 && s.height !== undefined && s.height >= 50;
        }
        return false;
      });
      
    case 'horizon_line':
      return shapes.some(s => {
        if (s.type === 'line' && s.y1 !== undefined && s.y2 !== undefined) {
          const y = s.y1; // Assume horizontal line
          return Math.abs(y - 75) < 5 && Math.abs(s.y1 - s.y2) < 2;
        }
        return false;
      });
      
    case 'inner_rays_cutout':
      // Check for small cutout lines radiating from center
      const cutoutLines = shapes.filter(s => s.role === 'cutout' && s.type === 'line');
      return cutoutLines.length >= 2;
      
    case 'stack_offset':
      // Hard to detect, assume not present if we're checking
      return false;
      
    case 'corner_rounding':
      return shapes.some(s => s.type === 'rect' && s.rx !== undefined && s.rx > 0);
      
    case 'overlap_layer':
      // Hard to detect, assume not present if we're checking
      return false;
      
    case 'inner_line':
      return shapes.some(s => {
        if (s.type === 'line' && s.x1 !== undefined && s.y1 !== undefined && s.x2 !== undefined && s.y2 !== undefined) {
          const isHorizontal = Math.abs(s.y1 - s.y2) < 2;
          const isCentered = (s.y1 >= 45 && s.y1 <= 55) || (s.y2 >= 45 && s.y2 <= 55);
          return isHorizontal && isCentered;
        }
        return false;
      });
      
    case 'accent_cutout':
      return shapes.some(s => {
        if (s.role === 'cutout' && s.type === 'circle' && s.r !== undefined) {
          return s.r <= 10; // Small circular cutout
        }
        return false;
      });
      
    case 'inner_notch':
      return shapes.some(s => {
        if (s.role === 'cutout' && s.type === 'polygon' && s.points && s.points.length === 4) {
          // Check if it's a small diamond/notch
          const xs = s.points.map(p => p.x);
          const ys = s.points.map(p => p.y);
          const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
          const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
          return Math.abs(avgX - 50) < 5 && Math.abs(avgY - 50) < 5;
        }
        return false;
      });
      
    default:
      return false;
  }
}

/**
 * Ensures all shapes fit within safe area (SAFE_MARGIN bounds).
 */
function ensureSafeAreaFit(spec: LogoSpec): LogoSpec {
  const shapes = spec.shapes || [];
  const MAX_RADIUS = 40; // 50 - SAFE_MARGIN
  const MAX_DIMENSION = 80; // 100 - 2 * SAFE_MARGIN
  
  const clampedShapes = shapes.map(shape => {
    const clamped = { ...shape };
    
    // Clamp circle radius
    if (shape.type === 'circle' && shape.r !== undefined) {
      if (shape.r > MAX_RADIUS) {
        clamped.r = MAX_RADIUS;
      }
    }
    
    // Clamp rect dimensions
    if (shape.type === 'rect') {
      if (shape.width !== undefined && shape.width > MAX_DIMENSION) {
        clamped.width = MAX_DIMENSION;
      }
      if (shape.height !== undefined && shape.height > MAX_DIMENSION) {
        clamped.height = MAX_DIMENSION;
      }
    }
    
    // Clamp ellipse radii
    if (shape.type === 'ellipse') {
      if (shape.rx !== undefined && shape.rx > MAX_RADIUS) {
        clamped.rx = MAX_RADIUS;
      }
      if (shape.ry !== undefined && shape.ry > MAX_RADIUS) {
        clamped.ry = MAX_RADIUS;
      }
    }
    
    return clamped;
  });
  
  return {
    ...spec,
    shapes: clampedShapes,
  };
}
