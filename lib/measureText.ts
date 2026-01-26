/**
 * Measures text dimensions using OffscreenCanvas if available, with fallback approximation.
 */

export interface TextMetrics {
  width: number;
  ascent: number;
  descent: number;
  height: number;
}

/**
 * Maps font family name to CSS font family string.
 */
function getCssFontFamily(fontFamily: 'Inter' | 'Lora' | 'Larken'): string {
  switch (fontFamily) {
    case 'Inter':
      return 'Inter, system-ui, sans-serif';
    case 'Lora':
      return 'Lora, serif';
    case 'Larken':
      return 'Larken, serif';
    default:
      return 'Inter, system-ui, sans-serif';
  }
}

/**
 * Measures text dimensions using OffscreenCanvas if available, with fallback.
 * 
 * @param text - The text to measure
 * @param fontSize - Font size in pixels
 * @param fontFamily - Font family name (Inter, Lora, or Larken)
 * @returns Text metrics including width, ascent, descent, and height
 */
export function measureText(
  text: string,
  fontSize: number,
  fontFamily: 'Inter' | 'Lora' | 'Larken'
): TextMetrics {
  const cssFontFamily = getCssFontFamily(fontFamily);
  
  // Try to use OffscreenCanvas if available (Node.js 18+)
  try {
    // @ts-ignore - OffscreenCanvas may not be in types
    if (typeof OffscreenCanvas !== 'undefined') {
      // @ts-ignore
      const canvas = new OffscreenCanvas(1, 1);
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.font = `${fontSize}px ${cssFontFamily}`;
        const metrics = ctx.measureText(text);
        
        const width = metrics.width;
        // Use actual bounding box if available, otherwise estimate
        const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.8;
        const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.2;
        const height = ascent + descent;
        
        return { width, ascent, descent, height };
      }
    }
  } catch (error) {
    // Fall through to fallback
    console.warn('OffscreenCanvas not available, using fallback text measurement:', error);
  }
  
  // Fallback: approximate measurement
  const width = text.length * fontSize * 0.62;
  const ascent = fontSize * 0.8;
  const descent = fontSize * 0.2;
  const height = ascent + descent;
  
  return { width, ascent, descent, height };
}
