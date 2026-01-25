import Potrace from 'potrace';

/**
 * Traces a binary mask PNG to SVG path data using potrace.
 * 
 * @param maskPngBuffer - Binary mask PNG buffer (black=ink, white=background)
 * @returns Promise with SVG path data string
 */
export async function traceMaskToPath(maskPngBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const trace = new Potrace();

    trace.setParameters({
      threshold: 128, // Threshold for black/white conversion
      turdSize: 10, // Remove tiny islands smaller than this
      optTolerance: 0.6, // Curve optimization tolerance (0.4-0.8)
      turnPolicy: Potrace.PotraceTurnPolicy.MINORITY, // Turn policy
      optCurve: true, // Optimize curves
    });

    trace.loadImage(maskPngBuffer, (err) => {
      if (err) {
        reject(new Error(`Potrace loadImage failed: ${err.message}`));
        return;
      }

      try {
        // Get SVG string
        const svg = trace.getSVG();

        // Extract all path data from SVG
        // Potrace may return multiple paths, we need to combine them
        const pathMatches = Array.from(svg.matchAll(/<path[^>]*d\s*=\s*["']([^"']+)["']/gi));
        const pathDataArray: string[] = [];
        
        for (const match of pathMatches) {
          if (match[1]) {
            pathDataArray.push(match[1]);
          }
        }
        
        if (pathDataArray.length > 0) {
          // Combine multiple paths into one (if potrace returns multiple)
          resolve(pathDataArray.join(' '));
        } else {
          // If no path found, return empty (mask had no content)
          resolve('');
        }
      } catch (error) {
        reject(new Error(`Potrace getSVG failed: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  });
}
