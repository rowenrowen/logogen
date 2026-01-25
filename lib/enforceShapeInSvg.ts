type ShapeType = 'any' | 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield';
type ShapeStyle = 'clip' | 'badge' | 'outline';

/**
 * Generates clipPath content for a given shape
 */
function getClipPathContent(shape: ShapeType): string {
  switch (shape) {
    case 'circle':
      return '<circle cx="512" cy="512" r="420"/>';
    case 'square':
      return '<rect x="92" y="92" width="840" height="840"/>';
    case 'roundedSquare':
      return '<rect x="92" y="92" width="840" height="840" rx="140" ry="140"/>';
    case 'pill':
      return '<rect x="92" y="192" width="840" height="640" rx="320" ry="320"/>';
    case 'hex':
      return '<polygon points="512,92 820,260 820,596 512,764 204,596 204,260"/>';
    case 'shield':
      return '<path d="M 512,92 Q 820,92 820,260 L 820,596 Q 820,728 512,764 Q 204,728 204,596 L 204,260 Q 204,92 512,92 Z"/>';
    default:
      return '';
  }
}

/**
 * Generates shape element for badge/outline rendering
 */
function getShapeElement(shape: ShapeType, style: ShapeStyle, badgeFill?: string): string {
  const clipPathContent = getClipPathContent(shape);
  if (!clipPathContent) return '';

  if (style === 'badge') {
    const fill = badgeFill || '#F0F0F0'; // Default neutral gray
    return clipPathContent.replace(/>$/, ` fill="${fill}"/>`);
  } else if (style === 'outline') {
    return clipPathContent.replace(/>$/, ' fill="none" stroke="#C8C8C8" stroke-width="24"/>');
  }
  return '';
}

/**
 * Applies safety containment clip in SVG output (overflow protection only)
 * @param svg - Input SVG string
 * @param shape - Shape to enforce for containment
 * @param shapeStyle - Always 'clip' (badge/outline removed)
 * @returns SVG with clipPath containment
 */
export function enforceShapeInSvg(
  svg: string,
  shape: ShapeType = 'any',
  shapeStyle: ShapeStyle = 'clip'
): string {
  if (shape === 'any') {
    return svg;
  }

  try {
    const clipPathContent = getClipPathContent(shape);
    if (!clipPathContent) {
      return svg;
    }

    // Build the clipPath definition
    const clipPathDef = `<defs>
  <clipPath id="shapeClip">
    ${clipPathContent}
  </clipPath>
</defs>`;

    // Find the opening <svg> tag
    const svgOpenMatch = svg.match(/<svg[^>]*>/i);
    if (!svgOpenMatch) {
      console.warn('Could not find SVG opening tag');
      return svg;
    }

    const svgOpenTag = svgOpenMatch[0];
    const svgOpenIndex = svgOpenMatch.index!;

    // Extract content after opening tag
    const afterOpenTag = svg.slice(svgOpenIndex + svgOpenTag.length);

    // Find the closing </svg> tag
    const svgCloseMatch = afterOpenTag.lastIndexOf('</svg>');
    if (svgCloseMatch === -1) {
      console.warn('Could not find SVG closing tag');
      return svg;
    }

    // Split content
    const svgContent = afterOpenTag.slice(0, svgCloseMatch);

    // Ensure white background rect exists as first element
    let processedContent = svgContent;
    const whiteRectRegex = /<rect[^>]+width=["']100%["'][^>]+height=["']100%["'][^>]+fill=["']#FFFFFF["'][^>]*\/?>/i;

    if (!whiteRectRegex.test(processedContent)) {
      // Add white background rect as first element
      processedContent = `<rect width="100%" height="100%" fill="#FFFFFF"/>${processedContent}`;
    }

    // Find all vector elements (path, circle, rect, etc.) that are NOT the white background rect
    const vectorElementsRegex = /<(path|circle|rect|polygon|ellipse|line|polyline|text)[^>]*>[\s\S]*?<\/\1>/gi;
    const whiteBackgroundRectRegex = /<rect[^>]+width=["']100%["'][^>]+height=["']100%["'][^>]+fill=["']#FFFFFF["'][^>]*\/?>/gi;

    let vectorContent = '';
    let nonVectorContent = processedContent;

    // Extract all vector elements (excluding white background rect)
    const matches = processedContent.match(vectorElementsRegex);
    if (matches) {
      for (const match of matches) {
        if (!whiteBackgroundRectRegex.test(match)) {
          // This is a vector element, move it to vectorContent
          vectorContent += match;
          // Remove it from nonVectorContent
          nonVectorContent = nonVectorContent.replace(match, '');
        }
      }
    }

    // Build the new SVG content
    let newSvgContent = '';

    // Always add white background rect first
    newSvgContent += `<rect width="100%" height="100%" fill="#FFFFFF"/>`;

    // Add clipPath definition for containment
    newSvgContent += clipPathDef;

    // Wrap vector elements in clipPath group
    if (vectorContent.trim()) {
      newSvgContent += `<g clip-path="url(#shapeClip)">${vectorContent}</g>`;
    }

    // Add any remaining non-vector content
    newSvgContent += nonVectorContent.replace(whiteRectRegex, ''); // Remove any duplicate white rects

    // Reconstruct the full SVG
    const newSvg = svg.slice(0, svgOpenIndex + svgOpenTag.length) + newSvgContent + '</svg>';

    return newSvg;

  } catch (error) {
    console.error('Error enforcing shape in SVG:', error);
    // Return original SVG if enforcement fails
    return svg;
  }
}