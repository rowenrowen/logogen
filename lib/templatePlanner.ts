import { getOpenAIClient } from './openaiClient';
import { FilledGeometricParams, RadialSunburstParams } from './templates';

export type LogoFamily = 'auto' | 'filled-geometric' | 'radial-sunburst';

export interface TemplatePlan {
  family: 'filled-geometric' | 'radial-sunburst';
  params: FilledGeometricParams | RadialSunburstParams;
}

/**
 * Plans a template selection based on prompt and options.
 * Uses OpenAI to choose family and generate parameters.
 * 
 * @param prompt - User's prompt
 * @param opts - Options including style, colorMode, industry
 * @returns Template plan with family and params
 */
export async function planTemplate(
  prompt: string,
  opts: {
    style: string;
    colorMode: string;
    industry: string;
    shape?: string;
  }
): Promise<TemplatePlan> {
  const systemPrompt = `You are a logo template planner. Choose a template family and generate parameters based on the user's prompt.

CRITICAL RULES:
- Return ONLY valid JSON (no prose, no markdown)
- Choose ONE family: "filled-geometric" OR "radial-sunburst"
- Generate parameters that match the chosen family
- Do NOT include text, SVG, or shape descriptions
- Parameters must be within valid ranges

TEMPLATE FAMILIES:

1. "filled-geometric": Overlapping rounded squares/rectangles
   - Good for: modern, abstract, growth, stability, therapy, tech
   - Parameters:
     {
       "layers": 2|3|4, // Minimal=2, Balanced=3, Intricate=4 (enforced)
       "cornerRadius": 10..22,
       "rotationDeg": -25..25, // Each layer will have >=8° rotation difference
       "sizeScale": 0.55..0.95, // Each layer will have >=0.12 scale difference
       "offset": 0..10, // Each layer will have >=4 units offset difference
       "accent": boolean // Only used in intricate mode
     }

2. "radial-sunburst": Central disc with radiating rays
   - Good for: sunshine, energy, optimism, growth, therapy (sunshine themes)
   - Parameters:
     {
       "rayCount": 8|10|12, // MUST be exactly 8, 10, or 12 (no other values)
       "rayStyle": "triangle"|"bar",
       "innerRadius": 16..22, // Clamped to 16-22
       "outerRadius": 34..42, // Clamped to 34-42
       "ringCount": 1|2,
       "ringThickness": 3..8,
       "outerRing": boolean
     }

SELECTION GUIDELINES:
- If prompt mentions: sun, sunshine, light, rays, energy, optimism → prefer "radial-sunburst"
- If prompt mentions: growth, modern, abstract, blocks, layers, stability → prefer "filled-geometric"
- For therapy industry: prefer "radial-sunburst" for sunshine themes, "filled-geometric" for growth/modern
- For tech/finance: prefer "filled-geometric"
- For general/abstract: choose based on prompt vibe

STYLE ADJUSTMENTS:
- minimal: fewer layers/rays, simpler
- balanced: default parameters
- intricate: add one extra layer/ring, but keep clean

Return JSON in this exact format:
{
  "family": "filled-geometric" | "radial-sunburst",
  "params": { ... } // Matching the chosen family's parameter structure
}`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Plan a logo template for: ${prompt}\nStyle: ${opts.style}, ColorMode: ${opts.colorMode}, Industry: ${opts.industry}` },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI API');
    }

    const plan = JSON.parse(content) as TemplatePlan;

    // Validate and fix parameters
    if (plan.family === 'filled-geometric') {
      plan.params = validateFilledGeometricParams(plan.params as FilledGeometricParams);
    } else if (plan.family === 'radial-sunburst') {
      plan.params = validateRadialSunburstParams(plan.params as RadialSunburstParams);
    } else {
      // Invalid family, fallback to filled-geometric with random params
      plan.family = 'filled-geometric';
      plan.params = generateRandomFilledGeometricParams();
    }

    return plan;
  } catch (error) {
    console.error('Failed to plan template:', error);
    // Fallback to filled-geometric with random params
    return {
      family: 'filled-geometric',
      params: generateRandomFilledGeometricParams(),
    };
  }
}

/**
 * Validates and clamps filled-geometric parameters to valid ranges.
 */
function validateFilledGeometricParams(params: any): FilledGeometricParams {
  return {
    layers: Math.max(2, Math.min(4, Math.round(params.layers || 3))) as 2 | 3 | 4,
    cornerRadius: Math.max(10, Math.min(22, Math.round(params.cornerRadius || 16))),
    rotationDeg: Math.max(-25, Math.min(25, Math.round(params.rotationDeg || 0))),
    sizeScale: Math.max(0.55, Math.min(0.95, params.sizeScale || 0.75)),
    offset: Math.max(0, Math.min(10, params.offset || 2)),
    accent: params.accent === true || params.accent === false ? params.accent : false,
  };
}

/**
 * Validates and clamps radial-sunburst parameters to valid ranges.
 */
function validateRadialSunburstParams(params: any): RadialSunburstParams {
  // ENFORCE ray count: must be 8, 10, or 12 only
  let rayCount: 8 | 10 | 12;
  const rawRayCount = Math.round(params.rayCount || 8);
  if (rawRayCount <= 8) {
    rayCount = 8;
  } else if (rawRayCount <= 10) {
    rayCount = 10;
  } else {
    rayCount = 12;
  }
  
  return {
    rayCount,
    rayStyle: params.rayStyle === 'bar' ? 'bar' : 'triangle',
    innerRadius: Math.max(16, Math.min(22, Math.round(params.innerRadius || 18))), // Clamp to 16-22
    outerRadius: Math.max(34, Math.min(42, Math.round(params.outerRadius || 36))), // Clamp to 34-42
    ringCount: (params.ringCount === 2 ? 2 : 1) as 1 | 2,
    ringThickness: Math.max(3, Math.min(8, Math.round(params.ringThickness || 5))),
    outerRing: params.outerRing === true || params.outerRing === false ? params.outerRing : false,
  };
}

/**
 * Generates random filled-geometric parameters within valid ranges.
 * Ensures visible layering differences.
 */
function generateRandomFilledGeometricParams(): FilledGeometricParams {
  const layers = (2 + Math.floor(Math.random() * 3)) as 2 | 3 | 4;
  
  // Ensure visible rotation difference (at least 8° per layer)
  const baseRotation = -25 + Math.floor(Math.random() * 51);
  
  // Ensure visible size difference (at least 0.12 scale difference)
  const sizeScale = 0.55 + Math.random() * 0.3; // Smaller range to ensure difference
  
  // Ensure visible offset (at least 4 units per layer)
  const offset = 4 + Math.random() * 6; // 4-10 range
  
  return {
    layers,
    cornerRadius: 10 + Math.floor(Math.random() * 13),
    rotationDeg: baseRotation,
    sizeScale,
    offset,
    accent: Math.random() > 0.5,
  };
}

/**
 * Generates random radial-sunburst parameters within valid ranges.
 */
export function generateRandomRadialSunburstParams(): RadialSunburstParams {
  // Ray count must be 8, 10, or 12 only
  const rayCounts: (8 | 10 | 12)[] = [8, 10, 12];
  const rayCount = rayCounts[Math.floor(Math.random() * rayCounts.length)];
  
  return {
    rayCount,
    rayStyle: Math.random() > 0.5 ? 'bar' : 'triangle',
    innerRadius: 16 + Math.floor(Math.random() * 7), // 16-22
    outerRadius: 34 + Math.floor(Math.random() * 9), // 34-42
    ringCount: (Math.random() > 0.5 ? 2 : 1) as 1 | 2,
    ringThickness: 3 + Math.floor(Math.random() * 6),
    outerRing: Math.random() > 0.5,
  };
}
