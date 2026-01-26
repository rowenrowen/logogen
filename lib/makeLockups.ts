export interface MakeLockupsOptions {
  iconSvg: string;
  businessName: string;
  fontFamily: 'Inter' | 'Lora' | 'Larken';
}

export interface MakeLockupsResult {
  lockupHorizontalSvg: string | null;
  lockupStackedSvg: string | null;
}

// Layout constants
const PADDING = 56;
const GAP = 56;
const ICON_SIZE = 220; // iconH = 220
const BASE_FONT_SIZE = 84;
const FONT_SIZE_MIN = 56;
const FONT_SIZE_MAX = 96;

/**
 * Gets font-specific width factor for text measurement.
 */
function getFontWidthFactor(fontFamily: 'Inter' | 'Lora' | 'Larken'): number {
  switch (fontFamily) {
    case 'Inter':
      return 0.56;
    case 'Lora':
      return 0.60;
    case 'Larken':
      return 0.62;
    default:
      return 0.56;
  }
}

/**
 * Gets CSS font family string for SVG text elements.
 */
function getCssFontFamily(fontFamily: 'Inter' | 'Lora' | 'Larken'): string {
  return fontFamily;
}

/**
 * Escapes XML special characters in text.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Cleans icon inner content by removing full-size background rects.
 */
function cleanIconContent(innerContent: string): string {
  // Remove self-closing rects with width="100%" or height="100%"
  let cleaned = innerContent
    .replace(/<rect[^>]*(?:width\s*=\s*["']100%["']|height\s*=\s*["']100%["'])[^>]*\/\s*>/gi, '')
    .replace(/<rect[^>]*(?:width\s*=\s*["']100%["']|height\s*=\s*["']100%["'])[^>]*>/gi, '');
  
  // Remove closing tags that might be orphaned
  cleaned = cleaned.replace(/<\/rect>/gi, '');
  
  return cleaned.trim();
}

/**
 * Creates horizontal and stacked logo lockups with natural bounds.
 */
export function makeLockups(options: MakeLockupsOptions): MakeLockupsResult {
  const { iconSvg, businessName, fontFamily = 'Inter' } = options;

  // Parse icon SVG viewBox
  const viewBoxMatch = iconSvg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 512 512';
  const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);

  // Extract icon inner content (strip outer <svg> wrapper)
  const innerContentMatch = iconSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  let iconInner = innerContentMatch ? innerContentMatch[1] : '';
  
  // Clean icon content: remove full-size background rects
  iconInner = cleanIconContent(iconInner);

  // Compute icon sizing
  const iconH = ICON_SIZE;
  const iconScale = iconH / vbHeight;
  const iconW = vbWidth * iconScale;

  // Compute text sizing
  const fontWidthFactor = getFontWidthFactor(fontFamily);
  const cssFontFamily = getCssFontFamily(fontFamily);
  
  let fontSize = BASE_FONT_SIZE;
  fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize));
  
  // Approximate text width
  let textW = businessName.length * fontSize * fontWidthFactor;
  
  // Calculate text height
  const textAscent = fontSize * 0.78;
  const textDescent = fontSize * 0.22;
  const textH = textAscent + textDescent;

  // === HORIZONTAL LOCKUP ===
  const horizontalContentW = iconW + GAP + textW;
  const horizontalContentH = Math.max(iconH, textH);
  
  const horizontalIconX = PADDING;
  const horizontalIconY = PADDING + (horizontalContentH - iconH) / 2;
  
  const horizontalTextX = PADDING + iconW + GAP;
  const horizontalBaselineY = PADDING + (horizontalContentH / 2) + (textAscent - textH / 2);
  
  const horizontalSvgW = PADDING * 2 + horizontalContentW;
  const horizontalSvgH = PADDING * 2 + horizontalContentH;

  const horizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${horizontalSvgW} ${horizontalSvgH}" width="${horizontalSvgW}" height="${horizontalSvgH}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <g transform="translate(${horizontalIconX}, ${horizontalIconY}) scale(${iconScale}) translate(${-vbX}, ${-vbY})">
    ${iconInner}
  </g>
  <text x="${horizontalTextX}" y="${horizontalBaselineY}" fill="#111111" font-family="${cssFontFamily}" font-size="${fontSize}" font-weight="400" text-anchor="start">${escapeXml(businessName)}</text>
</svg>`;

  // === STACKED LOCKUP ===
  const stackedContentW = Math.max(iconW, textW);
  const stackedContentH = iconH + GAP + textH;
  
  const stackedIconX = PADDING + (stackedContentW - iconW) / 2;
  const stackedIconY = PADDING;
  
  const stackedTextCenterX = PADDING + stackedContentW / 2;
  const stackedBaselineY = PADDING + iconH + GAP + textAscent;
  
  const stackedSvgW = PADDING * 2 + stackedContentW;
  const stackedSvgH = PADDING * 2 + stackedContentH;

  const stackedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stackedSvgW} ${stackedSvgH}" width="${stackedSvgW}" height="${stackedSvgH}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <g transform="translate(${stackedIconX}, ${stackedIconY}) scale(${iconScale}) translate(${-vbX}, ${-vbY})">
    ${iconInner}
  </g>
  <text x="${stackedTextCenterX}" y="${stackedBaselineY}" text-anchor="middle" fill="#111111" font-family="${cssFontFamily}" font-size="${fontSize}" font-weight="400">${escapeXml(businessName)}</text>
</svg>`;

  return {
    lockupHorizontalSvg: horizontalSvg,
    lockupStackedSvg: stackedSvg,
  };
}
