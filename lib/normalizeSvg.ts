/**
 * Normalizes an SVG string to ensure it renders correctly.
 * Adds viewBox, dimensions, white background, and stable viewport.
 * 
 * @param svg - Raw SVG string from vectorization
 * @returns Normalized SVG string
 */
export function normalizeSvg(svg: string): string {
  if (!svg || typeof svg !== 'string') {
    return svg;
  }

  // Check if viewBox exists
  const hasViewBox = /viewBox\s*=/i.test(svg);
  const hasWidth = /width\s*=/i.test(svg);
  const hasHeight = /height\s*=/i.test(svg);
  const hasPreserveAspectRatio = /preserveAspectRatio\s*=/i.test(svg);
  const hasWhiteBackground = /<rect[^>]*fill\s*=\s*["']#FFFFFF["']/i.test(svg) || 
                             /<rect[^>]*fill\s*=\s*["']white["']/i.test(svg);

  // Find the opening <svg> tag
  const svgTagMatch = svg.match(/<svg[^>]*>/i);
  if (!svgTagMatch) {
    // Not a valid SVG, return as-is
    return svg;
  }

  const svgTag = svgTagMatch[0];
  const svgTagIndex = svgTagMatch.index || 0;

  // Build attributes to inject
  const attributesToAdd: string[] = [];
  
  if (!hasViewBox) {
    attributesToAdd.push('viewBox="0 0 1024 1024"');
  }
  if (!hasWidth) {
    attributesToAdd.push('width="1024"');
  }
  if (!hasHeight) {
    attributesToAdd.push('height="1024"');
  }
  if (!hasPreserveAspectRatio) {
    attributesToAdd.push('preserveAspectRatio="xMidYMid meet"');
  }

  let normalized = svg;

  // Inject attributes into <svg> tag
  if (attributesToAdd.length > 0) {
    // Insert attributes before the closing > of <svg>
    const svgTagEnd = svgTag.lastIndexOf('>');
    const newSvgTag = svgTag.slice(0, svgTagEnd) + ' ' + attributesToAdd.join(' ') + svgTag.slice(svgTagEnd);
    normalized = normalized.slice(0, svgTagIndex) + newSvgTag + normalized.slice(svgTagIndex + svgTag.length);
  }

  // Add white background rect if missing
  if (!hasWhiteBackground) {
    // Find the position after the opening <svg> tag
    const afterSvgTag = normalized.indexOf('>', svgTagIndex) + 1;
    const whiteRect = '<rect width="100%" height="100%" fill="#FFFFFF"/>';
    normalized = normalized.slice(0, afterSvgTag) + whiteRect + normalized.slice(afterSvgTag);
  }

  // Handle transform wrapper: if content starts with <g transform="...">, wrap it
  // Find the position after the opening <svg> tag and white background rect
  const afterSvgTag = normalized.indexOf('>', svgTagIndex) + 1;
  const contentAfterSvg = normalized.slice(afterSvgTag);
  
  // Skip white background rect if present
  const bgRectMatch = contentAfterSvg.match(/^\s*<rect[^>]*fill\s*=\s*["']#FFFFFF["'][^>]*\/?>\s*/i);
  const afterBgRect = bgRectMatch ? bgRectMatch.index! + bgRectMatch[0].length : 0;
  const contentAfterBg = contentAfterSvg.slice(afterBgRect);
  
  // Check if it starts with <g transform="...">
  const gTransformMatch = contentAfterBg.match(/^\s*<g[^>]*transform\s*=\s*["'][^"']*["'][^>]*>/i);
  
  if (gTransformMatch) {
    // Find the closing </svg> tag
    const svgCloseIndex = normalized.lastIndexOf('</svg>');
    if (svgCloseIndex > afterSvgTag) {
      // Find where the <g> starts
      const gStartIndex = afterSvgTag + afterBgRect + (gTransformMatch.index || 0);
      
      // Find the last </g> before </svg> (assuming it closes our wrapper)
      const beforeSvgClose = normalized.slice(0, svgCloseIndex);
      const lastGCloseIndex = beforeSvgClose.lastIndexOf('</g>');
      
      if (lastGCloseIndex > gStartIndex) {
        // Wrap the <g> content in a stable viewport group
        const beforeG = normalized.slice(0, gStartIndex);
        const gContent = normalized.slice(gStartIndex, lastGCloseIndex + 4); // +4 for '</g>'
        const afterG = normalized.slice(lastGCloseIndex + 4);
        
        normalized = beforeG + 
          '<g transform="translate(0,0) scale(1)">' +
          gContent +
          '</g>' +
          afterG;
      }
    }
  }

  return normalized;
}
