/**
 * Logo Design Specification Types
 * 
 * Defines the structure for icon-only logo designs (no text, no background)
 */

export type ShapeType = 'circle' | 'rect' | 'polygon' | 'path' | 'ellipse' | 'line';

export interface Point {
  x: number;
  y: number;
}

export interface Shape {
  type: ShapeType;
  fill?: string; // Hex color
  stroke?: string; // Hex color
  strokeWidth?: number;
  opacity?: number;
  // Cutout/negative space support
  blend?: 'normal' | 'cutout'; // Default: 'normal'
  role?: 'fill' | 'cutout'; // For cutout shapes that subtract from the mark
  // Circle-specific
  cx?: number;
  cy?: number;
  r?: number;
  // Rect-specific
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rx?: number; // border radius (rect) or radius x (ellipse)
  ry?: number; // border radius (rect) or radius y (ellipse)
  // Polygon/Path-specific
  points?: Point[];
  // Path-specific
  d?: string; // SVG path data
  // Line-specific
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // Transform
  transform?: string;
}

export interface StrokeStyle {
  enabled: boolean;
  width: number; // 1-6
  color: string; // Hex color
  linecap?: 'round' | 'butt';
  linejoin?: 'round' | 'miter';
}

export interface LogoSpec {
  viewBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  shapes: Shape[];
  strokeStyle?: StrokeStyle | null; // Optional global stroke styling
  metadata?: {
    description?: string;
    [key: string]: any; // Allow additional debug fields (e.g., detailCueInjected)
  };
}

/**
 * Raw logo spec format returned by OpenAI
 * This is the format we expect from the model
 */
export interface RawLogoSpec {
  iconType?: string;
  symmetry?: string;
  shapes: RawShape[];
  colorPalette?: string[];
  colors?: string[]; // Synonym for colorPalette
  complexity?: string | number;
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  [key: string]: any; // Allow other keys that will be removed
}

/**
 * Raw shape format from OpenAI
 */
export interface RawShape {
  type: string;
  params?: Record<string, any>;
  fill?: string | null;
  stroke?: string | null;
  [key: string]: any; // Allow other keys that will be removed
}

/**
 * Motif Blueprint for structured logo generation
 */
export interface MotifBlueprint {
  motif: 'sunshine' | 'leaves' | 'building-blocks' | 'generic';
  requiredParts: string[];
  optionalParts: string[];
  compositionRules: string[];
  styleNotes: string[];
  detailBudget: number; // 0..4
  paletteNotes: string[];
}

/**
 * Logo family for template-based generation
 */
export type LogoFamily = 'auto' | 'filled-geometric' | 'radial-sunburst';
