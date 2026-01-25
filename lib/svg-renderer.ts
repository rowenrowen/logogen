import { LogoSpec, Shape } from '@/types/logo';

/**
 * Deterministic SVG renderer that converts a JSON logo spec into clean SVG markup
 */
export function renderSVG(spec: LogoSpec): string {
  const { viewBox, shapes } = spec;
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;

  const shapeElements = shapes.map(renderShape).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%">
    ${shapeElements}
</svg>`;
}

function renderShape(shape: Shape): string {
  const attrs: string[] = [];

  // Common attributes
  if (shape.fill) attrs.push(`fill="${shape.fill}"`);
  if (shape.stroke) attrs.push(`stroke="${shape.stroke}"`);
  if (shape.strokeWidth !== undefined) attrs.push(`stroke-width="${shape.strokeWidth}"`);
  if (shape.opacity !== undefined) attrs.push(`opacity="${shape.opacity}"`);
  if (shape.transform) attrs.push(`transform="${shape.transform}"`);

  const attrString = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  switch (shape.type) {
    case 'circle':
      if (shape.cx === undefined || shape.cy === undefined || shape.r === undefined) {
        throw new Error('Circle missing required properties');
      }
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"${attrString} />`;

    case 'rect':
      if (shape.x === undefined || shape.y === undefined || shape.width === undefined || shape.height === undefined) {
        throw new Error('Rect missing required properties');
      }
      const rectAttrs = [`x="${shape.x}"`, `y="${shape.y}"`, `width="${shape.width}"`, `height="${shape.height}"`];
      if (shape.rx !== undefined) rectAttrs.push(`rx="${shape.rx}"`);
      if (shape.ry !== undefined) rectAttrs.push(`ry="${shape.ry}"`);
      return `<rect ${rectAttrs.join(' ')}${attrString} />`;

    case 'ellipse':
      if (shape.cx === undefined || shape.cy === undefined || shape.rx === undefined || shape.ry === undefined) {
        throw new Error('Ellipse missing required properties');
      }
      return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}"${attrString} />`;

    case 'polygon':
      if (!shape.points || shape.points.length === 0) {
        throw new Error('Polygon missing points');
      }
      const pointsStr = shape.points.map(p => `${p.x},${p.y}`).join(' ');
      return `<polygon points="${pointsStr}"${attrString} />`;

    case 'path':
      if (!shape.d) {
        throw new Error('Path missing d property');
      }
      return `<path d="${shape.d}"${attrString} />`;

    case 'line':
      if (shape.x1 === undefined || shape.y1 === undefined || shape.x2 === undefined || shape.y2 === undefined) {
        throw new Error('Line missing required properties');
      }
      return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}"${attrString} />`;

    default:
      throw new Error(`Unknown shape type: ${(shape as any).type}`);
  }
}
