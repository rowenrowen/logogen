import sharp from 'sharp';

type ShapeType = 'any' | 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield';
type ShapeStyle = 'clip' | 'badge' | 'outline';

/**
 * Generates SVG shape element for a given shape type
 */
function getShapeSvg(shape: ShapeType): string {
  const CANVAS_SIZE = 1024;
  
  switch (shape) {
    case 'circle':
      return `<circle cx="512" cy="512" r="420"/>`;
    
    case 'square':
      return `<rect x="92" y="92" width="840" height="840"/>`;
    
    case 'roundedSquare':
      return `<rect x="92" y="92" width="840" height="840" rx="140" ry="140"/>`;
    
    case 'pill':
      // Horizontal pill shape
      return `<rect x="92" y="192" width="840" height="640" rx="320" ry="320"/>`;
    
    case 'hex':
      // Hexagon points: top, top-right, bottom-right, bottom, bottom-left, top-left
      return `<polygon points="512,92 820,260 820,596 512,764 204,596 204,260"/>`;
    
    case 'shield':
      // Shield shape: rounded top, pointed bottom
      return `<path d="M 512,92 Q 820,92 820,260 L 820,596 Q 820,728 512,764 Q 204,728 204,596 L 204,260 Q 204,92 512,92 Z"/>`;
    
    default:
      return '';
  }
}

/**
 * Applies a safety containment clip to a PNG buffer (overflow protection only)
 * @param pngBuffer - Input PNG buffer
 * @param shape - Shape to apply for containment
 * @param shapeStyle - Always 'clip' (badge/outline removed)
 * @returns Processed PNG buffer with containment clip
 */
export async function applyShapeMask(
  pngBuffer: Buffer,
  shape: ShapeType = 'any',
  shapeStyle: ShapeStyle = 'clip'
): Promise<Buffer> {
  if (shape === 'any') {
    return pngBuffer;
  }

  try {
    const CANVAS_SIZE = 1024;

    // Step 1: Prepare base image on 1024x1024 canvas
    let base = sharp(pngBuffer)
      .ensureAlpha()
      .resize(CANVAS_SIZE, CANVAS_SIZE, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });

    const shapeSvg = getShapeSvg(shape);
    if (!shapeSvg) {
      return pngBuffer;
    }

    // Step 2: Create white background
    let result = sharp({
      create: {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    });

    // Only clip mode: use dest-in mask for containment
    const maskSvg = `<svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="black"/>
      ${shapeSvg.replace(/>$/, ' fill="white"/>')}
    </svg>`;
    
    const maskBuffer = Buffer.from(maskSvg);
    const maskPng = await sharp(maskBuffer).png().toBuffer();
    
    result = base.composite([{
      input: maskPng,
      blend: "dest-in"
    }]);

    // Step 3: Flatten and return
    const finalBuffer = await result
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();

    return finalBuffer;

  } catch (error) {
    console.error('Error applying shape mask:', error);
    return pngBuffer;
  }
}