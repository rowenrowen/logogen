import { LogoSpec, MotifBlueprint } from '@/types/logo';

export interface QualityScore {
  score: number; // 0..100
  reasons: string[];
}

/**
 * Scores a logo spec against a blueprint and options.
 * Returns a quality score (0-100) with reasons.
 * 
 * Scoring rules:
 * - +30 if all requiredParts are represented (heuristic via shape counts/types)
 * - +20 if silhouette matches shape preference (circle/square/etc)
 * - +20 if palette fits colorMode + therapy vibe
 * - +15 if symmetry is appropriate
 * - +15 if complexity matches style without clutter
 * 
 * Fail conditions:
 * - If missing required parts => score <= 40
 * - If too abstract for motif => score <= 55
 * 
 * @param spec - Normalized logo spec
 * @param blueprint - Motif blueprint
 * @param options - Generation options (style, colorMode, shape, industry)
 * @returns QualityScore with score and reasons
 */
export function scoreLogoSpec(
  spec: LogoSpec,
  blueprint: MotifBlueprint,
  options: { style: string; colorMode: string; shape: string; industry: string }
): QualityScore {
  const reasons: string[] = [];
  let score = 0;

  // 1. Check required parts representation (+30 points)
  const requiredPartsScore = checkRequiredParts(spec, blueprint);
  score += requiredPartsScore.points;
  reasons.push(...requiredPartsScore.reasons);

  // Fail condition: missing required parts (stricter for leaves)
  const minRequiredPoints = blueprint.motif === 'leaves' ? 25 : 20; // Leaves need both silhouette AND vein
  if (requiredPartsScore.points < minRequiredPoints) {
    return { score: Math.min(score, 40), reasons };
  }

  // 2. Check silhouette alignment (+20 points)
  const silhouetteScore = checkSilhouetteAlignment(spec, options.shape);
  score += silhouetteScore.points;
  reasons.push(...silhouetteScore.reasons);

  // 3. Check palette fit (+20 points)
  const paletteScore = checkPaletteFit(spec, options.colorMode, options.industry, blueprint);
  score += paletteScore.points;
  reasons.push(...paletteScore.reasons);

  // 4. Check symmetry appropriateness (+15 points)
  const symmetryScore = checkSymmetry(spec, blueprint, options.style);
  score += symmetryScore.points;
  reasons.push(...symmetryScore.reasons);

  // 5. Check complexity match (+15 points)
  const complexityScore = checkComplexity(spec, options.style, blueprint);
  score += complexityScore.points;
  reasons.push(...complexityScore.reasons);

  // Fail condition: too abstract for motif
  if (score < 60 && blueprint.motif !== 'generic') {
    return { score: Math.min(score, 55), reasons: [...reasons, 'Too abstract for motif - not recognizable enough'] };
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Checks if required parts from blueprint are represented in the spec.
 * Uses heuristics based on shape types and counts.
 */
function checkRequiredParts(spec: LogoSpec, blueprint: MotifBlueprint): { points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;
  const shapes = spec.shapes || [];
  const shapeTypes = shapes.map(s => s.type);
  const shapeCount = shapes.length;

  // Heuristic checks based on motif
  if (blueprint.motif === 'sunshine') {
    // Need: sun disc/arc + rays
    const hasCircleOrEllipse = shapeTypes.some(t => t === 'circle' || t === 'ellipse');
    const hasPath = shapeTypes.some(t => t === 'path');
    const hasLines = shapeTypes.filter(t => t === 'line').length;
    const rayCount = hasLines; // Lines are likely rays

    if (hasCircleOrEllipse || hasPath) {
      points += 15; // Sun disc/arc found
      reasons.push('Sun disc or arc detected');
    } else {
      reasons.push('Missing sun disc or arc');
    }

    if (rayCount >= 3 && rayCount <= 7) {
      points += 15; // Appropriate ray count
      reasons.push(`Appropriate ray count: ${rayCount}`);
    } else if (rayCount > 0) {
      points += 10; // Some rays but not ideal count
      reasons.push(`Ray count ${rayCount} (ideal: 3-7)`);
    } else {
      reasons.push('Missing rays');
    }
  } else if (blueprint.motif === 'leaves') {
    // Need: curved leaf silhouette (NOT diamond) + central vein
    const pathShapes = shapes.filter(s => s.type === 'path');
    const polygonShapes = shapes.filter(s => s.type === 'polygon');
    const hasPath = pathShapes.length > 0;
    const hasPolygon = polygonShapes.length > 0;
    const hasEllipse = shapeTypes.some(t => t === 'ellipse');
    const hasCircle = shapeTypes.some(t => t === 'circle');
    
    // Check for curved path (A, Q, or C commands)
    let hasCurvedPath = false;
    if (hasPath) {
      for (const pathShape of pathShapes) {
        if (pathShape.d) {
          const pathData = pathShape.d.toUpperCase();
          if (pathData.includes('A') || pathData.includes('Q') || pathData.includes('C')) {
            hasCurvedPath = true;
            break;
          }
        }
      }
    }
    
    // Check for overlapping circles/ellipses (curved silhouette)
    const hasOverlappingCurves = (hasEllipse && shapeCount >= 2) || (hasCircle && shapeCount >= 2);
    
    // Check for diamond/rhombus (straight-edge polygon with <=6 points, no curves)
    let isDiamond = false;
    if (hasPolygon && !hasPath) {
      // If only polygons and no paths, check if it's a simple diamond
      for (const polyShape of polygonShapes) {
        if (polyShape.points && polyShape.points.length <= 6) {
          // Check if points form a diamond-like shape (rough heuristic)
          const xs = polyShape.points.map(p => p.x);
          const ys = polyShape.points.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const width = maxX - minX;
          const height = maxY - minY;
          // Diamond-like if roughly square and 4 points
          if (polyShape.points.length === 4 && Math.abs(width - height) < 10) {
            isDiamond = true;
            break;
          }
        }
      }
    }

    // Require curved silhouette (reject diamonds)
    if (isDiamond) {
      return { points: 0, reasons: ['REJECTED: Diamond/rhombus detected - leaf must have curved silhouette'] };
    } else if (hasCurvedPath) {
      points += 20; // Curved path found
      reasons.push('Curved leaf silhouette detected (path with curves)');
    } else if (hasOverlappingCurves) {
      points += 15; // Overlapping curves found
      reasons.push('Curved silhouette detected (overlapping circles/ellipses)');
    } else if (hasPath) {
      points += 10; // Path found but no curves detected
      reasons.push('Path found but may lack curves for leaf silhouette');
    } else {
      return { points: 0, reasons: ['REJECTED: Missing curved leaf silhouette - only straight edges found'] };
    }

    // Check for vein detail (including injected veins)
    const hasLine = shapeTypes.some(t => t === 'line');
    const hasCutout = shapes.some(s => s.role === 'cutout' || s.blend === 'cutout');
    const hasStrokeStyle = spec.strokeStyle?.enabled === true;
    const veinInjected = (spec.metadata as any)?.veinInjected === true;
    
    // Check if there's a thin path/line for vein
    let hasVeinPath = false;
    if (hasPath && pathShapes.length >= 2) {
      // One path might be the vein (thinner/shorter)
      for (const pathShape of pathShapes) {
        if (pathShape.d && pathShape.d.length < 100) { // Rough heuristic: vein is shorter
          hasVeinPath = true;
          break;
        }
      }
    }
    
    // Check for injected vein (cutout rect at x=49, y=25, width=2, height=53 OR path with d="M 50 25 L 50 78")
    const hasInjectedVein = shapes.some(s => {
      if (s.role === 'cutout' || s.blend === 'cutout') {
        if (s.type === 'rect' && s.x !== undefined && s.width !== undefined) {
          // Check if it matches the injected vein pattern (thin vertical rect centered)
          return s.x >= 48 && s.x <= 50 && s.width <= 3 && 
                 s.height !== undefined && s.height >= 50;
        } else if (s.type === 'path' && s.d) {
          // Also check for path-based injected vein (legacy)
          return s.d.includes('50 25') && s.d.includes('50 78') || 
                 s.d.includes('M 50 25 L 50 78') || 
                 s.d === 'M 50 25 L 50 78';
        }
      }
      return false;
    });
    
    // Vein is REQUIRED for leaves - accept if found or injected
    if (hasLine || hasCutout || hasVeinPath || hasStrokeStyle || hasInjectedVein || veinInjected) {
      points += 10; // Vein found
      if (veinInjected || hasInjectedVein) {
        reasons.push('Central vein detected (injected)');
      } else {
        reasons.push('Central vein detected');
      }
    } else {
      // Missing vein - this should not happen if injection works, but fail if it does
      return { points: 0, reasons: ['REJECTED: Missing central vein detail - leaf must have vein'] };
    }
  } else if (blueprint.motif === 'building-blocks') {
    // Need: 2-4 stacked blocks
    const rectCount = shapeTypes.filter(t => t === 'rect').length;
    const polygonCount = shapeTypes.filter(t => t === 'polygon').length;
    const blockCount = rectCount + polygonCount;

    if (blockCount >= 2 && blockCount <= 4) {
      points += 30; // Perfect block count
      reasons.push(`Appropriate block count: ${blockCount}`);
    } else if (blockCount > 0) {
      points += 15; // Some blocks but not ideal
      reasons.push(`Block count ${blockCount} (ideal: 2-4)`);
    } else {
      reasons.push('Missing stacked blocks');
    }
  } else {
    // Generic: check if we have reasonable shape count
    if (shapeCount >= 2) {
      points += 20;
      reasons.push('Generic motif: reasonable shape count');
    } else {
      reasons.push('Generic motif: too few shapes');
    }
  }

  return { points, reasons };
}

/**
 * Checks if silhouette matches shape preference.
 */
function checkSilhouetteAlignment(spec: LogoSpec, shapePreference: string): { points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;

  if (shapePreference === 'any') {
    return { points: 20, reasons: ['No specific shape preference'] };
  }

  const shapes = spec.shapes || [];
  const shapeTypes = shapes.map(s => s.type);
  const symmetry = (spec as any).symmetry?.toLowerCase() || '';

  if (shapePreference === 'circle') {
    const hasCircle = shapeTypes.some(t => t === 'circle' || t === 'ellipse');
    const isRadial = symmetry.includes('radial') || symmetry.includes('centered');
    if (hasCircle || isRadial) {
      points = 20;
      reasons.push('Circular silhouette alignment');
    } else {
      points = 10;
      reasons.push('Partial circular alignment');
    }
  } else if (shapePreference === 'square') {
    const hasRect = shapeTypes.some(t => t === 'rect');
    if (hasRect) {
      points = 20;
      reasons.push('Square/rectangular silhouette alignment');
    } else {
      points = 10;
      reasons.push('Partial square alignment');
    }
  } else {
    // Other shapes: give partial credit
    points = 15;
    reasons.push(`Shape preference: ${shapePreference}`);
  }

  return { points, reasons };
}

/**
 * Checks if palette fits colorMode and therapy vibe.
 */
function checkPaletteFit(
  spec: LogoSpec,
  colorMode: string,
  industry: string,
  blueprint: MotifBlueprint
): { points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;

  const shapes = spec.shapes || [];
  const colors = new Set<string>();
  shapes.forEach(s => {
    if (s.fill) colors.add(s.fill.toLowerCase());
    if (s.stroke) colors.add(s.stroke.toLowerCase());
  });
  const colorCount = colors.size;

  // Check color count matches colorMode
  if (colorMode === 'monochrome' && colorCount === 1) {
    points += 10;
    reasons.push('Monochrome palette correct');
  } else if ((colorMode === 'muted' || colorMode === 'bold') && colorCount >= 1 && colorCount <= 3) {
    points += 10;
    reasons.push(`${colorMode} palette: ${colorCount} colors`);
  } else {
    reasons.push(`Color count ${colorCount} doesn't match ${colorMode}`);
  }

  // Check therapy vibe (heuristic: warm, calm colors)
  if (industry === 'therapy') {
    // Check if colors are in therapy-appropriate range (heuristic)
    const therapyColors = ['#4A6FA5', '#6B8E7F', '#5A6578', '#6B8E7F', '#7A9B8A'];
    const hasTherapyColor = Array.from(colors).some(c => 
      therapyColors.some(tc => c.includes(tc.substring(1, 3))) // Rough match
    );
    if (hasTherapyColor || colorMode === 'muted') {
      points += 10;
      reasons.push('Therapy-appropriate palette');
    } else {
      reasons.push('Palette may not fit therapy vibe');
    }
  } else {
    points += 10; // Non-therapy: give full credit
    reasons.push('Palette appropriate for industry');
  }

  return { points, reasons };
}

/**
 * Checks if symmetry is appropriate for the blueprint.
 */
function checkSymmetry(spec: LogoSpec, blueprint: MotifBlueprint, style: string): { points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;

  const symmetry = (spec as any).symmetry?.toLowerCase() || '';

  if (blueprint.motif === 'sunshine') {
    if (symmetry.includes('radial') || symmetry.includes('centered')) {
      points = 15;
      reasons.push('Radial/centered symmetry for sunshine');
    } else {
      points = 10;
      reasons.push('Symmetry could be more radial for sunshine');
    }
  } else if (blueprint.motif === 'leaves') {
    if (symmetry.includes('bilateral') || symmetry.includes('centered')) {
      points = 15;
      reasons.push('Bilateral symmetry for leaves');
    } else {
      points = 10;
      reasons.push('Symmetry appropriate');
    }
  } else if (blueprint.motif === 'building-blocks') {
    if (symmetry.includes('stacked') || symmetry.includes('centered')) {
      points = 15;
      reasons.push('Stacked/centered symmetry for blocks');
    } else {
      points = 10;
      reasons.push('Symmetry appropriate');
    }
  } else {
    // Generic: any symmetry is fine
    if (symmetry) {
      points = 15;
      reasons.push(`Symmetry: ${symmetry}`);
    } else {
      points = 10;
      reasons.push('No explicit symmetry');
    }
  }

  return { points, reasons };
}

/**
 * Checks if complexity matches style without clutter.
 */
function checkComplexity(spec: LogoSpec, style: string, blueprint: MotifBlueprint): { points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;

  const shapeCount = spec.shapes?.length || 0;

  // Check shape count matches style
  if (style === 'minimal') {
    if (shapeCount >= 1 && shapeCount <= 2) {
      points += 10;
      reasons.push(`Minimal style: ${shapeCount} shapes`);
    } else {
      reasons.push(`Minimal style but ${shapeCount} shapes (ideal: 1-2)`);
    }
  } else if (style === 'balanced') {
    if (shapeCount >= 2 && shapeCount <= 4) {
      points += 10;
      reasons.push(`Balanced style: ${shapeCount} shapes`);
    } else {
      reasons.push(`Balanced style but ${shapeCount} shapes (ideal: 2-4)`);
    }
  } else if (style === 'intricate') {
    if (shapeCount >= 4 && shapeCount <= 8) {
      points += 10;
      reasons.push(`Intricate style: ${shapeCount} shapes`);
    } else {
      reasons.push(`Intricate style but ${shapeCount} shapes (ideal: 4-8)`);
    }
  }

  // Check detail budget alignment
  const pathCount = spec.shapes?.filter(s => s.type === 'path').length || 0;
  const hasCutouts = spec.shapes?.some(s => s.role === 'cutout' || s.blend === 'cutout') || false;

  if (blueprint.detailBudget >= 2 && (pathCount > 0 || hasCutouts)) {
    points += 5;
    reasons.push('Appropriate detail level');
  } else if (blueprint.detailBudget < 2 && pathCount === 0 && !hasCutouts) {
    points += 5;
    reasons.push('Appropriate detail level for minimal style');
  } else {
    reasons.push('Detail level may not match blueprint');
  }

  return { points, reasons };
}
