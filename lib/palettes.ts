/**
 * Returns a deterministic palette based on color mode.
 * 
 * @param colorMode - Color mode: monochrome, muted, or bold
 * @returns Array of hex color strings
 */
export function getPalette(colorMode: 'monochrome' | 'muted' | 'bold'): string[] {
  switch (colorMode) {
    case 'monochrome':
      return ['#111827']; // Dark gray/black
    
    case 'muted':
      // Curated muted palette: slate, indigo, teal, forest, charcoal
      // Return 2-3 colors for variety
      return ['#475569', '#4C6FA5', '#5A7A8A']; // Slate blue, muted indigo, teal-gray
    
    case 'bold':
      // Curated bold palette: blue, orange, green, purple (still professional)
      // Return 2-3 colors for variety
      return ['#0066FF', '#FF6600', '#00CC66']; // Bright blue, orange, green
    
    default:
      return ['#111827']; // Fallback to monochrome
  }
}
