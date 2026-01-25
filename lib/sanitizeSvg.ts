/**
 * Sanitizes an SVG string to ensure it renders safely in <img> tags.
 * Removes elements and attributes that can break rendering or reference external resources.
 * 
 * @param svg - SVG string to sanitize
 * @returns Sanitized SVG string
 */
export function sanitizeSvg(svg: string): string {
  if (!svg || typeof svg !== 'string') {
    return svg;
  }

  // 1) Strip anything that can break <img> rendering or reference external resources
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  svg = svg.replace(/<style[\s\S]*?<\/style>/gi, ''); // vectorizers sometimes add style blocks
  svg = svg.replace(/<defs[\s\S]*?<\/defs>/gi, '');   // remove defs/masks/filters/patterns that may be malformed

  // 2) Remove filter/mask/clip-path attributes that might reference removed defs
  svg = svg.replace(/\s(filter|mask|clip-path)=["'][^"']*["']/gi, '');

  // 3) Remove any "url(#...)" references
  svg = svg.replace(/url\(#.*?\)/g, '');

  // 4) Remove obviously invalid numeric tokens in path data (NaN/Infinity)
  svg = svg.replace(/NaN|Infinity|-Infinity/g, '0');

  // 5) Ensure it starts with <svg and ends with </svg>
  const start = svg.indexOf('<svg');
  const end = svg.lastIndexOf('</svg>');
  if (start >= 0 && end >= 0 && end > start) {
    svg = svg.slice(start, end + 6);
  }

  return svg;
}
