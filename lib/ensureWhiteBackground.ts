/**
 * Ensures an SVG always renders on a white background (no transparency).
 *
 * Guarantees:
 * 1) <svg ... style="...background:#FFFFFF;..." ...>
 * 2) First child element is:
 *    <rect width="100%" height="100%" fill="#FFFFFF"/>
 *
 * Idempotent: safe to call multiple times.
 */
export function ensureWhiteBackground(svg: string): string {
  if (typeof svg !== 'string' || !svg.trim()) return svg;

  // Ensure we have an <svg ...> opening tag.
  const openTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openTagMatch) return svg;

  const openTag = openTagMatch[0];

  // 1) Ensure style contains background:#FFFFFF
  let newOpenTag = openTag;
  const styleAttrMatch = openTag.match(/\sstyle\s*=\s*["']([^"']*)["']/i);
  if (styleAttrMatch) {
    const originalStyle = styleAttrMatch[1];
    const hasBackground = /background\s*:\s*#?fff(?:fff)?\b/i.test(originalStyle) || /background\s*:\s*white\b/i.test(originalStyle);
    const nextStyle = hasBackground
      ? originalStyle
      : `${originalStyle.trim().replace(/;?\s*$/, ';')} background:#FFFFFF;`.trim();
    newOpenTag = newOpenTag.replace(styleAttrMatch[0], ` style="${nextStyle}"`);
  } else {
    newOpenTag = newOpenTag.replace(/<svg\b/i, `<svg style="background:#FFFFFF;"`);
  }

  // Replace the first opening tag with updated one.
  let out = svg.replace(openTag, newOpenTag);

  // 2) Ensure a first-child white rect.
  const canonicalRect = `<rect width="100%" height="100%" fill="#FFFFFF"/>`;

  // Find content right after opening tag.
  const openIdx = out.search(/<svg\b[^>]*>/i);
  if (openIdx < 0) return out;
  const afterOpenIdx = openIdx + out.match(/<svg\b[^>]*>/i)![0].length;

  const before = out.slice(0, afterOpenIdx);
  let body = out.slice(afterOpenIdx);

  // Remove an existing full-canvas white rect anywhere (we'll reinsert it first).
  // Accept a few common variants: fill white/#fff/#ffffff and width/height 100%.
  const bgRectRegex =
    /<rect\b[^>]*\bwidth\s*=\s*["']100%["'][^>]*\bheight\s*=\s*["']100%["'][^>]*\bfill\s*=\s*["'](?:#fff(?:fff)?|white)["'][^>]*\/?>/i;
  body = body.replace(bgRectRegex, '');

  // Insert canonical rect as first child (ignoring whitespace/newlines).
  body = body.replace(/^\s*/, (ws) => `${ws}${canonicalRect}`);

  return before + body;
}

