import { wordmarkToPath, WordmarkPathResult } from './wordmarkToPath';

export interface ComposeLockupOptions {
  iconSvg: string;
  businessName: string;
  fontFamily?: 'Inter' | 'Lora';
  color?: string;
}

export interface LockupResult {
  horizontal: string;
  stacked: string;
}

/**
 * Composes horizontal and stacked logo lockup SVGs with proper sizing and centering.
 * 
 * @param options - Lockup composition options
 * @returns Both horizontal and stacked lockup SVGs
 */
export async function composeLockupSvg(options: ComposeLockupOptions): Promise<LockupResult> {
  const { iconSvg, businessName, fontFamily = 'Inter', color = '#111111' } = options;

  // Layout constants
  const outerPadding = 64;
  const iconTargetHeight = 240;
  const iconMinHeight = 200;
  const iconMaxHeight = 280;
  const horizontalGap = 56;
  const stackedGap = 40;
  const horizontalMaxTextWidth = 720;
  const stackedMaxTextWidth = 900;
  const minTextScale = 0.65;
  const fontSizeMin = 56;
  const fontSizeMax = 120;
  const wordmarkHeightRatio = 0.42; // wordmark height ≈ 0.42 * iconHeight

  // Parse icon SVG
  const viewBoxMatch = iconSvg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 512 512';
  const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);

  // Extract icon content
  const innerContentMatch = iconSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const iconContent = innerContentMatch ? innerContentMatch[1] : '';

  // Determine icon height (clamp to min/max)
  const iconHeight = Math.max(iconMinHeight, Math.min(iconMaxHeight, iconTargetHeight));
  
  // Calculate icon scale and dimensions
  const iconScale = iconHeight / vbHeight;
  const iconWidth = vbWidth * iconScale;

  // Determine initial font size based on icon height
  let fontSize = Math.round(iconHeight * wordmarkHeightRatio);
  fontSize = Math.max(fontSizeMin, Math.min(fontSizeMax, fontSize));

  // Generate wordmark path
  let wordmarkPath: WordmarkPathResult;
  try {
    wordmarkPath = await wordmarkToPath(businessName, fontFamily, fontSize);
  } catch (error) {
    console.error('Failed to generate wordmark path:', error);
    // Return icon-only SVGs as fallback
    const iconOnlySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${iconWidth + outerPadding * 2} ${iconHeight + outerPadding * 2}" width="${iconWidth + outerPadding * 2}" height="${iconHeight + outerPadding * 2}" preserveAspectRatio="xMidYMid meet">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <g transform="translate(${outerPadding}, ${outerPadding}) scale(${iconScale}) translate(${-vbX}, ${-vbY})">
    ${iconContent}
  </g>
</svg>`;
    return { horizontal: iconOnlySvg, stacked: iconOnlySvg };
  }

  // Calculate text dimensions using ascent/descent estimates
  const textAscent = fontSize * 0.78;
  const textDescent = fontSize * 0.22;
  const textHeight = textAscent + textDescent;
  let textWidth = wordmarkPath.width;
  let textScale = 1.0;

  // Helper function to compute baseline Y for vertical centering
  // Formula: baselineY = boxTop + (H/2) + (ascent - textHeight/2)
  const computeBaselineY = (boxTop: number, boxHeight: number): number => {
    return boxTop + (boxHeight / 2) + (textAscent - textHeight / 2);
  };
  
  // For path-based rendering, we need to adjust the path's vertical position
  // The path is created with baseline at y=0, so we need to translate it
  // Path's visual center is at (bboxY1 + bboxY2) / 2
  // We want the visual center at baselineY, so translate by: baselineY - pathCenterY
  const pathCenterY = ((wordmarkPath.bboxY1 ?? -textHeight / 2) + (wordmarkPath.bboxY2 ?? textHeight / 2)) / 2;

  // === HORIZONTAL LOCKUP ===
  // Check if text needs scaling for horizontal layout
  if (textWidth > horizontalMaxTextWidth) {
    textScale = Math.max(minTextScale, horizontalMaxTextWidth / textWidth);
    textWidth = horizontalMaxTextWidth;
  }

  const horizontalContentWidth = iconWidth + horizontalGap + textWidth;
  const horizontalContentHeight = Math.max(iconHeight, textHeight);
  const horizontalTotalWidth = horizontalContentWidth + outerPadding * 2;
  const horizontalTotalHeight = horizontalContentHeight + outerPadding * 2;

  // Center content within SVG
  const horizontalContentX = (horizontalTotalWidth - horizontalContentWidth) / 2;
  const horizontalContentY = (horizontalTotalHeight - horizontalContentHeight) / 2;

  // Icon position (left, vertically centered)
  const horizontalIconX = horizontalContentX;
  const horizontalIconY = horizontalContentY + (horizontalContentHeight - iconHeight) / 2;

  // Text position (right, vertically centered)
  const horizontalTextX = horizontalContentX + iconWidth + horizontalGap;
  const horizontalBaselineY = computeBaselineY(horizontalContentY, horizontalContentHeight);
  const horizontalPathOffsetY = horizontalBaselineY - pathCenterY;

  // === STACKED LOCKUP ===
  // Reset text scale for stacked layout
  textScale = 1.0;
  textWidth = wordmarkPath.width;

  // Check if text needs scaling for stacked layout
  if (textWidth > stackedMaxTextWidth) {
    textScale = Math.max(minTextScale, stackedMaxTextWidth / textWidth);
    textWidth = stackedMaxTextWidth;
  }

  const stackedContentWidth = Math.max(iconWidth, textWidth);
  const stackedContentHeight = iconHeight + stackedGap + textHeight;
  const stackedTotalWidth = stackedContentWidth + outerPadding * 2;
  const stackedTotalHeight = stackedContentHeight + outerPadding * 2;

  // Center content within SVG
  const stackedContentX = (stackedTotalWidth - stackedContentWidth) / 2;
  const stackedContentY = (stackedTotalHeight - stackedContentHeight) / 2;

  // Icon position (centered horizontally, top)
  const stackedIconX = stackedContentX + (stackedContentWidth - iconWidth) / 2;
  const stackedIconY = stackedContentY;

  // Text position (centered horizontally, below icon)
  // For stacked, center the text path horizontally
  const stackedTextCenterX = stackedContentX + stackedContentWidth / 2;
  const stackedBaselineY = computeBaselineY(stackedContentY + iconHeight + stackedGap, textHeight);
  // Path's horizontal center is at wordmarkPath.width / 2 (since path starts at x=0)
  const stackedPathOffsetX = -wordmarkPath.width / 2;

  // Build SVGs
  const horizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${horizontalTotalWidth} ${horizontalTotalHeight}" width="${horizontalTotalWidth}" height="${horizontalTotalHeight}" preserveAspectRatio="xMidYMid meet">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <g transform="translate(${horizontalIconX}, ${horizontalIconY}) scale(${iconScale}) translate(${-vbX}, ${-vbY})">
    ${iconContent}
  </g>
  <g transform="translate(${horizontalTextX}, ${horizontalBaselineY}) scale(${textScale})">
    <path d="${wordmarkPath.d}" fill="${color}" transform="translate(0, ${-pathCenterY})"/>
  </g>
</svg>`;

  const stackedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stackedTotalWidth} ${stackedTotalHeight}" width="${stackedTotalWidth}" height="${stackedTotalHeight}" preserveAspectRatio="xMidYMid meet">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <g transform="translate(${stackedIconX}, ${stackedIconY}) scale(${iconScale}) translate(${-vbX}, ${-vbY})">
    ${iconContent}
  </g>
  <g transform="translate(${stackedTextCenterX}, ${stackedBaselineY}) scale(${textScale})">
    <path d="${wordmarkPath.d}" fill="${color}" transform="translate(${stackedPathOffsetX}, ${-pathCenterY})"/>
  </g>
</svg>`;

  return {
    horizontal: horizontalSvg,
    stacked: stackedSvg,
  };
}
