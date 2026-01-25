/**
 * Post-processes an SVG to remove near-white fills, simplify palette, and remove tiny paths.
 * 
 * @param svg - SVG string
 * @returns Cleaned SVG string
 */
export function postprocessSvg(svg: string): string {
  // Step 1: Find all <path> tags
  const pathRegex = /<path([^>]*?)>/gi;
  const paths: Array<{ full: string; fill?: string; d?: string; other: string }> = [];
  let match;

  while ((match = pathRegex.exec(svg)) !== null) {
    const attrs = match[1];
    const full = match[0];
    
    // Extract fill
    const fillMatch = attrs.match(/fill\s*=\s*["']([^"']+)["']/i);
    const fill = fillMatch ? fillMatch[1] : undefined;
    
    // Extract d
    const dMatch = attrs.match(/d\s*=\s*["']([^"']+)["']/i);
    const d = dMatch ? dMatch[1] : undefined;
    
    // Extract other attributes (everything except fill and d)
    const other = attrs
      .replace(/fill\s*=\s*["'][^"']*["']/gi, '')
      .replace(/d\s*=\s*["'][^"']*["']/gi, '')
      .trim();
    
    paths.push({ full, fill, d, other });
  }

  // Step 2: Filter paths
  // - Remove near-white (r,g,b >= 245)
  // - Remove tiny paths (d.length < 120)
  const filteredPaths = paths.filter((path) => {
    // Check if near-white
    if (path.fill) {
      const rgbMatch = path.fill.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        
        // Remove if all channels >= 245
        if (r >= 245 && g >= 245 && b >= 245) {
          return false;
        }
      }
    }
    
    // Check if tiny path
    if (path.d && path.d.length < 120) {
      return false;
    }
    
    return true;
  });

  // Step 3: Rebuild SVG with filtered paths (no color snapping - preserve palette lock)
  // Extract everything before first <path> (SVG opening tag, background rect, etc.)
  const beforePathsMatch = svg.match(/^([\s\S]*?)(?=<path)/i);
  const svgStart = beforePathsMatch ? beforePathsMatch[1] : svg.match(/^([\s\S]*?<svg[^>]*>[\s\S]*?)(?=<path|$)/i)?.[1] || '';
  
  // Extract everything after last </path> (closing tags)
  const afterPathsMatch = svg.match(/(<\/svg>[\s\S]*?)$/i);
  const svgEnd = afterPathsMatch ? afterPathsMatch[1] : '</svg>';
  
  // Rebuild paths (preserve original colors - no snapping)
  const rebuiltPaths: string[] = [];
  for (const path of filteredPaths) {
    // Build new path tag with original fill (preserve palette lock)
    const attrs: string[] = [];
    
    if (path.fill) {
      attrs.push(`fill="${path.fill}"`);
    }
    
    if (path.d) {
      attrs.push(`d="${path.d}"`);
    }
    
    if (path.other) {
      attrs.push(path.other);
    }
    
    rebuiltPaths.push(`<path ${attrs.join(' ')}/>`);
  }
  
  // Combine everything
  const processedSvg = svgStart + rebuiltPaths.join('') + svgEnd;
  
  return processedSvg;
}
