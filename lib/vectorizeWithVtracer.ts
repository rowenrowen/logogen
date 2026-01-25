import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

/**
 * Vectorizes a PNG buffer to SVG using the VTracer CLI
 * @param pngBuffer - PNG image buffer
 * @returns Promise resolving to SVG string with guaranteed white background
 */
export async function vectorizeWithVtracer(pngBuffer: Buffer): Promise<string> {
  // Create temp directory
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "logo-vtracer-"));
  const inputPng = path.join(tmpDir, "input.png");
  const outputSvg = path.join(tmpDir, "output.svg");

  try {
    // Write PNG buffer to temp file
    await fs.writeFile(inputPng, pngBuffer);

    // Get VTracer binary path
    const binPath = path.join(process.cwd(), "bin", "vtracer");

    // Run VTracer CLI
    await new Promise<void>((resolve, reject) => {
      const child = spawn(binPath, ["-i", inputPng, "-o", outputSvg], {
        stdio: "pipe",
        cwd: process.cwd()
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(
            `VTracer exited with code ${code}\n` +
            `Stdout: ${stdout}\n` +
            `Stderr: ${stderr}\n` +
            `Command: ${binPath} -i ${inputPng} -o ${outputSvg}`
          ));
        }
      });

      child.on("error", (error) => {
        reject(new Error(`Failed to start VTracer: ${error.message}`));
      });
    });

    // Read the generated SVG
    let svgContent = await fs.readFile(outputSvg, "utf-8");

    // Ensure white background
    svgContent = ensureWhiteBackground(svgContent);

    return svgContent;

  } finally {
    // Cleanup temp files and directory
    try {
      await fs.unlink(inputPng);
    } catch (error) {
      console.warn("Failed to cleanup temp PNG:", error);
    }

    try {
      await fs.unlink(outputSvg);
    } catch (error) {
      console.warn("Failed to cleanup temp SVG:", error);
    }

    try {
      await fs.rmdir(tmpDir);
    } catch (error) {
      console.warn("Failed to cleanup temp dir:", error);
    }
  }
}

/**
 * Ensures the SVG has a white background by adding a white rect as the first element
 */
function ensureWhiteBackground(svgContent: string): string {
  // Check if white background rect already exists
  const whiteRectRegex = /<rect[^>]*width=["']100%["'][^>]*height=["']100%["'][^>]*fill=["']#FFFFFF["'][^>]*\/?>/;
  if (whiteRectRegex.test(svgContent)) {
    return svgContent;
  }

  // Find the opening <svg> tag and insert the white rect immediately after
  const svgOpenMatch = svgContent.match(/<svg[^>]*>/);
  if (svgOpenMatch) {
    const svgOpenTag = svgOpenMatch[0];
    const insertPoint = svgOpenMatch.index! + svgOpenTag.length;
    const whiteRect = '<rect width="100%" height="100%" fill="#FFFFFF"/>';
    svgContent = svgContent.slice(0, insertPoint) + whiteRect + svgContent.slice(insertPoint);
  }

  return svgContent;
}