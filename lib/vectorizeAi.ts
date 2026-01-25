import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Vectorizes a PNG image to SVG using OpenAI vision API.
 * 
 * @param pngBase64 - Base64-encoded PNG image
 * @returns Promise with SVG string
 */
export async function vectorizeAi(pngBase64: string): Promise<string> {
  // Build prompt for the vision model
  const vectorizationPrompt = `You are a logo vectorization tool. Recreate the attached logo PNG as a clean, editable SVG.
Requirements:
- Match composition and color balance closely.
- Use 4–8 coherent colors. Prefer solid fills; use gradients ONLY if it improves fidelity (keep gradients minimal).
- Smooth curves, clean geometry, no raster artifacts, no tiny speckles.
- Keep the icon centered on a pure white background.
- Output only valid SVG markup beginning with <svg ...> and ending with </svg>.
- Do not include any text.`;

  // Call OpenAI vision model (use gpt-4o or equivalent)
  const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
  
  const response = await openai.chat.completions.create({
    model: visionModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: vectorizationPrompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${pngBase64}`,
            },
          },
        ],
      },
    ],
    max_tokens: 4000, // SVG can be long
    temperature: 0.3, // Lower temperature for more consistent output
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in AI response');
  }

  // Extract SVG from response (may have markdown code blocks or extra text)
  let svg = content.trim();
  
  // Remove markdown code blocks if present
  svg = svg.replace(/^```(?:svg|xml)?\s*\n?/i, '');
  svg = svg.replace(/\n?```\s*$/i, '');
  
  // Extract SVG content (from <svg to </svg>)
  const svgMatch = svg.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    svg = svgMatch[0];
  }

  // Validate SVG
  if (!svg || svg.length < 200 || !svg.includes('<svg') || !svg.includes('</svg>')) {
    throw new Error(`Invalid SVG from AI response: length=${svg.length}, hasSvg=${svg.includes('<svg')}`);
  }

  // Check if SVG contains paths
  if (!svg.includes('<path')) {
    throw new Error('AI SVG contains no paths');
  }

  return svg;
}
