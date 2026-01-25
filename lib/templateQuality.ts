import { LogoSpec } from '@/types/logo';

/**
 * Quality guard for template-generated specs.
 * Ensures outputs are not boring (single shape) or messy (wrong shape count).
 * 
 * @param spec - Generated logo spec
 * @param family - Template family used
 * @param params - Template parameters used
 * @returns true if spec passes quality checks
 */
export function checkTemplateQuality(
  spec: LogoSpec,
  family: 'filled-geometric' | 'radial-sunburst',
  params: any
): { ok: boolean; reason?: string } {
  const shapes = spec.shapes || [];
  const shapeCount = shapes.length;
  
  if (family === 'filled-geometric') {
    // Must have >= 2 layer shapes AND at least 3 distinct bounding boxes
    const layerShapes = shapes.filter(s => s.type === 'rect');
    if (layerShapes.length < 2) {
      return { ok: false, reason: `filled-geometric must have >= 2 layer shapes, got ${layerShapes.length}` };
    }
    
    // Compute bounding boxes for each rect layer
    const bboxes = layerShapes.map(rect => {
      if (rect.x !== undefined && rect.y !== undefined && rect.width !== undefined && rect.height !== undefined) {
        return {
          minX: rect.x,
          minY: rect.y,
          maxX: rect.x + rect.width,
          maxY: rect.y + rect.height,
        };
      }
      return null;
    }).filter(bbox => bbox !== null);
    
    // Check for distinct bounding boxes (prevent identical positions)
    const uniqueBboxes = new Set(
      bboxes.map(bbox => 
        `${Math.round(bbox!.minX / 2)}_${Math.round(bbox!.minY / 2)}_${Math.round(bbox!.maxX / 2)}_${Math.round(bbox!.maxY / 2)}`
      )
    );
    
    if (uniqueBboxes.size < Math.min(3, layerShapes.length)) {
      return { ok: false, reason: `filled-geometric must have at least ${Math.min(3, layerShapes.length)} distinct layer positions, got ${uniqueBboxes.size}` };
    }
    
    return { ok: true };
  } else if (family === 'radial-sunburst') {
    // Must have >= (rayCount + 1) shapes (rays + center disc)
    const rayCount = params.rayCount || 8;
    const minShapes = rayCount + 1; // Rays + center disc
    
    if (shapeCount < minShapes) {
      return { ok: false, reason: `radial-sunburst must have >= ${minShapes} shapes (${rayCount} rays + center disc), got ${shapeCount}` };
    }
    
    // Check that we have a center disc (circle at center)
    const hasCenterDisc = shapes.some(s => s.type === 'circle' && s.cx === 50 && s.cy === 50 && s.fill !== 'none');
    if (!hasCenterDisc) {
      return { ok: false, reason: 'radial-sunburst must have a center disc' };
    }
    
    // Check ray geometry: rays must be outside center disc and have proper length
    const centerDisc = shapes.find(s => s.type === 'circle' && s.cx === 50 && s.cy === 50 && s.fill !== 'none');
    if (centerDisc && centerDisc.r !== undefined) {
      const rayShapes = shapes.filter(s => s.type === 'rect');
      if (rayShapes.length < rayCount) {
        return { ok: false, reason: `radial-sunburst must have ${rayCount} rays, got ${rayShapes.length}` };
      }
      
      // Check ray length: require rayLength >= 10
      const rayLengths = rayShapes
        .map(ray => ray.height !== undefined ? ray.height : 0)
        .filter(len => len > 0);
      
      if (rayLengths.length > 0) {
        const minRayLength = Math.min(...rayLengths);
        if (minRayLength < 10) {
          return { ok: false, reason: `radial-sunburst rays must have length >= 10, got ${minRayLength}` };
        }
      }
    }
    
    // Require rayCount >= 8
    if (rayCount < 8) {
      return { ok: false, reason: `radial-sunburst must have rayCount >= 8, got ${rayCount}` };
    }
    
    return { ok: true };
  }
  
  return { ok: true }; // Unknown family, pass
}
