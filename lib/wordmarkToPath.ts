import { promises as fs } from 'fs';
import pathModule from 'path';
// @ts-ignore - opentype.js may not have perfect TypeScript types
import opentype from 'opentype.js';

export interface WordmarkPathResult {
  d: string;
  width: number;
  height: number;
  capHeight: number;
  bboxY1?: number; // Bounding box y1 (for vertical centering)
  bboxY2?: number; // Bounding box y2 (for vertical centering)
}

/**
 * Converts a business name to an SVG path using opentype.js.
 * 
 * @param text - The business name text
 * @param fontFamily - 'Inter' or 'Lora'
 * @param fontSize - Font size in pixels
 * @returns SVG path data and dimensions
 */
export async function wordmarkToPath(
  text: string,
  fontFamily: 'Inter' | 'Lora' = 'Inter',
  fontSize: number = 110
): Promise<WordmarkPathResult> {
  // Determine font file path
  let fontPath: string;
  if (fontFamily === 'Inter') {
    // Try Inter-Regular first, fallback to Inter-Medium
    const interRegular = pathModule.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf');
    const interMedium = pathModule.join(process.cwd(), 'public', 'fonts', 'Inter-Medium.ttf');
    
    try {
      await fs.access(interRegular);
      fontPath = interRegular;
    } catch {
      fontPath = interMedium;
    }
  } else {
    fontPath = pathModule.join(process.cwd(), 'public', 'fonts', 'Lora-Regular.ttf');
  }

  // Load font file
  const fontBuffer = await fs.readFile(fontPath);
  const font = opentype.parse(fontBuffer.buffer);

  // Get font metrics
  const capHeight = font.tables.os2?.sCapHeight || fontSize * 0.7; // Fallback if not available
  const unitsPerEm = font.unitsPerEm || 1000;

  // Create text path
  const textPath = font.getPath(text, 0, 0, fontSize);
  const pathData = textPath.toSVG(2); // 2 decimal places

  // Extract path data (d attribute)
  const dMatch = pathData.match(/d="([^"]+)"/);
  const d = dMatch ? dMatch[1] : '';

  // Get bounding box
  const bbox = textPath.getBoundingBox();
  const width = bbox.x2 - bbox.x1;
  const height = bbox.y2 - bbox.y1;
  
  // Also return the bbox for more accurate positioning
  const bboxY1 = bbox.y1;
  const bboxY2 = bbox.y2;

  return {
    d,
    width,
    height,
    capHeight: (capHeight / unitsPerEm) * fontSize,
    bboxY1, // For vertical centering
    bboxY2, // For vertical centering
  };
}
