export interface ComposeLockupsOptions {
  iconSvg: string;
  businessName: string;
  fontFamily: 'Inter' | 'Lora' | 'Larken';
  textColor?: string;
}

export interface LockupResult {
  horizontal: string;
  stacked: string;
  debug?: {
    usedFontFamily: string;
    fontSize: number;
    iconViewBox: string;
    iconW: number;
    iconH: number;
    textW: number;
    textH: number;
    horizontalSvgW: number;
    horizontalSvgH: number;
    stackedSvgW: number;
    stackedSvgH: number;
  };
}

// Layout constants
const PADDING = 56;
const GAP = 56;
const ICON_TARGET_H = 220; // Target icon height
const BASE_FONT_SIZE = 96;
const FONT_SIZE_MIN = 56;
const FONT_SIZE_MAX = 110;
const HORIZONTAL_MAX_TEXT_WIDTH = 900;
const STACKED_MAX_TEXT_WIDTH = 980;

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
 * Uses exact font names that match @font-face declarations.
 */
function getCssFontFamily(fontFamily: 'Inter' | 'Lora' | 'Larken'): string {
  switch (fontFamily) {
    case 'Inter':
      return 'Inter';
    case 'Lora':
      return 'Lora';
    case 'Larken':
      return 'Larken';
    default:
      return 'Inter';
  }
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
 * Removes any <rect> elements that have width="100%" or height="100%" or both.
 * Also removes rects with explicit width/height matching the SVG viewBox dimensions.
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
 * Composes horizontal and stacked logo lockup SVGs with natural bounds.
 * 
 * @param options - Lockup composition options
 * @returns Both horizontal and stacked lockup SVGs
 */
export async function composeLockups(options: ComposeLockupsOptions): Promise<LockupResult> {
  const { iconSvg, businessName, fontFamily = 'Inter', textColor = '#111111' } = options;

  // === STEP 1: Parse icon SVG and extract inner content ===
  const viewBoxMatch = iconSvg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 512 512';
  const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);

  // Extract icon inner content (only the inner markup, not the <svg> wrapper)
  const innerContentMatch = iconSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  let iconInner = innerContentMatch ? innerContentMatch[1] : '';
  
  // Clean icon content: remove full-size background rects
  iconInner = cleanIconContent(iconInner);

  // === STEP 2: Compute icon sizing FIRST ===
  // Set icon target height
  let iconTargetH = ICON_TARGET_H;
  // iconH must be exactly iconTargetH (clamped if needed, but we use target directly)
  const iconH = iconTargetH;
  
  // Compute icon scale: MUST be iconH/vbHeight
  const iconScale = iconH / vbHeight;
  const iconW = vbWidth * iconScale;

  // === STEP 3: Compute text sizing ===
  const fontWidthFactor = getFontWidthFactor(fontFamily);
  const cssFontFamily = getCssFontFamily(fontFamily);
  
  // Start with base font size
  let fontSize = BASE_FONT_SIZE;
  fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize));
  
  // Compute text width
  let textW = businessName.length * fontSize * fontWidthFactor;
  
  // Adjust font size if text is too wide for horizontal layout
  if (textW > HORIZONTAL_MAX_TEXT_WIDTH) {
    fontSize = Math.max(FONT_SIZE_MIN, (HORIZONTAL_MAX_TEXT_WIDTH / (businessName.length * fontWidthFactor)));
    textW = businessName.length * fontSize * fontWidthFactor;
  }
  
  // Calculate text height (ascent + descent)
  const textAscent = fontSize * 0.78;
  const textDescent = fontSize * 0.22;
  const textH = textAscent + textDescent;

  // === STEP 4: HORIZONTAL LOCKUP (natural bounds) ===
  // Compute content bounds
  const horizontalContentW = iconW + GAP + textW;
  const horizontalContentH = Math.max(iconH, textH);
  
  // Icon position
  const horizontalIconX = PADDING;
  const horizontalIconY = PADDING + (horizontalContentH - iconH) / 2;
  
  // Text position
  const horizontalTextX = PADDING + iconW + GAP;
  const horizontalBaselineY = PADDING + (horizontalContentH / 2) + (textAscent - textH / 2);
  
  // Total SVG dimensions (natural bounds + padding)
  const horizontalSvgW = PADDING * 2 + horizontalContentW;
  const horizontalSvgH = PADDING * 2 + horizontalContentH;

  // === STEP 5: STACKED LOCKUP (natural bounds) ===
  // Recalculate text for stacked (may need different size)
  let stackedFontSize = fontSize;
  let stackedTextW = businessName.length * stackedFontSize * fontWidthFactor;
  let stackedTextAscent = textAscent;
  let stackedTextH = textH;
  
  if (stackedTextW > STACKED_MAX_TEXT_WIDTH) {
    stackedFontSize = Math.max(FONT_SIZE_MIN, (STACKED_MAX_TEXT_WIDTH / (businessName.length * fontWidthFactor)));
    stackedTextW = businessName.length * stackedFontSize * fontWidthFactor;
    stackedTextAscent = stackedFontSize * 0.78;
    const stackedTextDescent = stackedFontSize * 0.22;
    stackedTextH = stackedTextAscent + stackedTextDescent;
  }
  
  // Compute content bounds
  const stackedContentW = Math.max(iconW, stackedTextW);
  const stackedContentH = iconH + GAP + stackedTextH;
  
  // Icon position (centered horizontally)
  const stackedIconX = PADDING + (stackedContentW - iconW) / 2;
  const stackedIconY = PADDING;
  
  // Text position (centered horizontally, below icon)
  const stackedTextCenterX = PADDING + stackedContentW / 2;
  const stackedBaselineY = PADDING + iconH + GAP + stackedTextAscent;
  
  // Total SVG dimensions (natural bounds + padding)
  const stackedSvgW = PADDING * 2 + stackedContentW;
  const stackedSvgH = PADDING * 2 + stackedContentH;

  // === STEP 6: Build SVGs ===
  const horizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${horizontalSvgW} ${horizontalSvgH}" width="${horizontalSvgW}" height="${horizontalSvgH}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <g transform="translate(${horizontalIconX}, ${horizontalIconY}) scale(${iconScale}) translate(${-vbX}, ${-vbY})">
    ${iconInner}
  </g>
  <text x="${horizontalTextX}" y="${horizontalBaselineY}" fill="${textColor}" font-family="${cssFontFamily}" font-size="${fontSize}" font-weight="400" text-anchor="start">${escapeXml(businessName)}</text>
</svg>`;

  const stackedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stackedSvgW} ${stackedSvgH}" width="${stackedSvgW}" height="${stackedSvgH}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <g transform="translate(${stackedIconX}, ${stackedIconY}) scale(${iconScale}) translate(${-vbX}, ${-vbY})">
    ${iconInner}
  </g>
  <text x="${stackedTextCenterX}" y="${stackedBaselineY}" text-anchor="middle" fill="${textColor}" font-family="${cssFontFamily}" font-size="${stackedFontSize}" font-weight="400">${escapeXml(businessName)}</text>
</svg>`;

  // === STEP 7: Return with debug info ===
  return {
    horizontal: horizontalSvg,
    stacked: stackedSvg,
    debug: {
      usedFontFamily: fontFamily,
      fontSize: fontSize,
      iconViewBox: viewBox,
      iconW: iconW,
      iconH: iconH,
      textW: textW,
      textH: textH,
      horizontalSvgW: horizontalSvgW,
      horizontalSvgH: horizontalSvgH,
      stackedSvgW: stackedSvgW,
      stackedSvgH: stackedSvgH,
    },
  };
}
