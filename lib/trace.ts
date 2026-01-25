/**
 * Traces a binary mask PNG to SVG path data.
 * 
 * NOTE: Potrace tracing is disabled. Use VTracer CLI for PNG->SVG vectorization.
 * This function exists for backward compatibility but will throw an error if called.
 * 
 * @param maskPngBuffer - Binary mask PNG buffer (black=ink, white=background)
 * @returns Promise with SVG path data string
 * @throws Error indicating potrace is disabled
 */
export async function traceMaskToPath(maskPngBuffer: Buffer): Promise<string> {
  throw new Error(
    'Potrace tracing is disabled. Use vectorizeWithVtracer() for PNG->SVG vectorization instead.'
  );
}
