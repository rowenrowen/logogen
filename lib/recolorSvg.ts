/**
 * Recolors an SVG by replacing black fills/strokes with palette colors.
 * Alternates colors across paths for multi-color logos.
 * Preserves white background.
 * 
 * @param svg - SVG string (black-and-white silhouette)
 * @param palette - Array of hex color strings to use
 * @returns Recolored SVG string
 */
export function recolorSvg(svg: string, palette: string[]): string {
  if (!svg || typeof svg !== 'string' || !palette || palette.length === 0) {
    return svg;
  }

  // Extract all path elements (including self-closing)
  const pathRegex = /<path([^>]*?)(?:\/>|>)/gi;
  const paths: Array<{ match: string; fullMatch: string; index: number; isSelfClosing: boolean }> = [];
  let match;
  
  while ((match = pathRegex.exec(svg)) !== null) {
    const isSelfClosing = match[0].endsWith('/>');
    paths.push({
      match: match[1], // Attributes
      fullMatch: match[0], // Full <path ...> or <path .../>
      index: match.index,
      isSelfClosing,
    });
  }

  if (paths.length === 0) {
    // No paths found, return as-is
    return svg;
  }

  // Process paths in reverse order to maintain correct indices
  let recolored = svg;
  
  for (let i = paths.length - 1; i >= 0; i--) {
    const path = paths[i];
    const colorIndex = i < palette.length ? i : 0; // Cycle through palette
    const color = palette[colorIndex];

    // Get the path attributes
    let attributes = path.match.trim();

    // Replace black fills (various formats)
    attributes = attributes.replace(
      /fill\s*=\s*["'](?:#000|#000000|black|rgb\s*\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi,
      `fill="${color}"`
    );

    // Replace black strokes (various formats)
    attributes = attributes.replace(
      /stroke\s*=\s*["'](?:#000|#000000|black|rgb\s*\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi,
      `stroke="${color}"`
    );

    // If no fill attribute exists, add fill
    if (!/fill\s*=/i.test(attributes)) {
      // Add fill attribute (with space before if attributes exist)
      attributes = attributes ? `${attributes} fill="${color}"` : `fill="${color}"`;
    }

    // Replace the path in the SVG
    const closing = path.isSelfClosing ? '/>' : '>';
    const newPathTag = `<path ${attributes}${closing}`;
    const startIndex = path.index;
    const endIndex = startIndex + path.fullMatch.length;
    
    recolored = recolored.slice(0, startIndex) + newPathTag + recolored.slice(endIndex);
  }

  // Ensure white background is preserved (should already be there from normalizeSvg)
  // But double-check: replace any background rect fills that aren't white
  recolored = recolored.replace(
    /<rect([^>]*?)fill\s*=\s*["'](?!none|transparent|#FFFFFF|#fff|white)([^"']+)["']([^>]*?)>/gi,
    (match, before, fillColor, after) => {
      // Check if this is the background rect (width="100%" height="100%")
      if (match.includes('width="100%"') || match.includes("width='100%'") ||
          match.includes('height="100%"') || match.includes("height='100%'")) {
        return `<rect${before}fill="#FFFFFF"${after}>`;
      }
      return match;
    }
  );

  return recolored;
}
