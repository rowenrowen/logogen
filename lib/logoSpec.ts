import { getOpenAIClient } from './openaiClient';
import { RawLogoSpec, MotifBlueprint } from '@/types/logo';

// In-memory cache for motif hints (keyed by prompt|industry|shape|style|colorMode)
const motifHintsCache = new Map<string, string>();

// In-memory cache for motif blueprints
const blueprintCache = new Map<string, MotifBlueprint>();

export interface LogoSpecOptions {
  style?: 'minimal' | 'balanced' | 'intricate';
  colorMode?: 'monochrome' | 'muted' | 'bold';
  shape?: 'any' | 'circle' | 'square' | 'triangle' | 'hexagon' | 'badge';
  industry?: 'general' | 'healthcare' | 'therapy' | 'fitness' | 'tech' | 'finance' | 'education' | 'hospitality';
  archetype?: string;
}

/**
 * Generates a motif blueprint for structured logo generation.
 * Returns a JSON blueprint with required parts, composition rules, and style notes.
 * 
 * @param prompt - User's prompt (e.g., "sunshine", "leaves", "building blocks")
 * @param opts - Options including industry, style, colorMode
 * @returns Promise<MotifBlueprint> - Structured blueprint for logo generation
 */
async function generateMotifBlueprint(
  prompt: string,
  opts: { industry: string; style: string; colorMode: string }
): Promise<MotifBlueprint> {
  const cacheKey = `blueprint|${prompt.toLowerCase()}|${opts.industry}|${opts.style}|${opts.colorMode}`;
  if (blueprintCache.has(cacheKey)) {
    return blueprintCache.get(cacheKey)!;
  }

  // Normalize prompt for motif detection
  const promptLower = prompt.toLowerCase().trim();
  
  // Check for specific therapy motifs
  let motif: MotifBlueprint['motif'] = 'generic';
  let blueprint: MotifBlueprint;

  if (promptLower.includes('sun') || promptLower.includes('sunshine') || promptLower.includes('sunrise') || promptLower.includes('sunset')) {
    motif = 'sunshine';
    blueprint = {
      motif: 'sunshine',
      requiredParts: [
        'sun disc or rising arc',
        '3–7 rays'
      ],
      optionalParts: [
        'horizon line',
        'cloud silhouette'
      ],
      compositionRules: [
        'centered or horizon-based symmetry',
        'gentle geometry, no sharp aggressive spikes',
        'radial arrangement for rays'
      ],
      styleNotes: [
        'calm, optimistic, professional',
        'therapy-appropriate warmth',
        'balanced whitespace around sun'
      ],
      detailBudget: opts.style === 'intricate' ? 3 : opts.style === 'balanced' ? 2 : 1,
      paletteNotes: [
        'warm, approachable colors',
        'therapy-appropriate: soft yellows, warm oranges, or muted golds',
        'avoid harsh contrasts'
      ]
    };
  } else if (promptLower.includes('leaf') || promptLower.includes('leaves') || promptLower.includes('foliage') || 
             promptLower.includes('botanical') || promptLower.includes('sprout') || promptLower.includes('plant')) {
    motif = 'leaves';
    blueprint = {
      motif: 'leaves',
      requiredParts: [
        'curved leaf silhouette with pointed tip',
        'central vein'
      ],
      optionalParts: [
        'second leaf overlap (only if still one unified mark)',
        'subtle texture lines'
      ],
      compositionRules: [
        'soft curves, balanced whitespace',
        'organic yet geometric forms',
        'single unified mark'
      ],
      styleNotes: [
        'calm, growth-oriented',
        'therapy-appropriate natural forms',
        'gentle, approachable'
      ],
      detailBudget: opts.style === 'intricate' ? 3 : opts.style === 'balanced' ? 2 : 1,
      paletteNotes: [
        'natural greens, soft earth tones',
        'therapy-appropriate: muted greens, soft browns',
        'growth and healing associations'
      ]
    };
  } else if (promptLower.includes('block') || promptLower.includes('blocks') || promptLower.includes('building block')) {
    motif = 'building-blocks';
    blueprint = {
      motif: 'building-blocks',
      requiredParts: [
        '2–4 stacked blocks (squares/rounded squares)'
      ],
      optionalParts: [
        'subtle shadow or depth',
        'connecting lines or overlap'
      ],
      compositionRules: [
        'stable base, slight offset stacking',
        'friendly rounded corners preferred',
        'balanced, stable composition'
      ],
      styleNotes: [
        'calm, stable, supportive',
        'therapy-appropriate: foundation and growth',
        'professional yet approachable'
      ],
      detailBudget: opts.style === 'intricate' ? 2 : opts.style === 'balanced' ? 2 : 1,
      paletteNotes: [
        'warm, stable colors',
        'therapy-appropriate: soft blues, warm grays, muted purples',
        'foundation and stability associations'
      ]
    };
  } else {
    // Generic blueprint - use OpenAI to generate
    try {
      const systemPrompt = `You are a logo design blueprint generator for therapy-industry icons. Generate ONLY valid JSON for a MotifBlueprint.

CRITICAL RULES:
- Return STRICT JSON only (no prose, no markdown)
- Must be therapy-industry aligned: calm, optimistic, professional
- NO text/letters/initials ever
- Focus on recognizable, lightly abstracted objects
- Icon-only, no backgrounds

Blueprint structure:
{
  "motif": "generic",
  "requiredParts": ["part1", "part2", ...], // 2-4 concrete parts
  "optionalParts": ["optional1", ...], // 0-2 optional parts
  "compositionRules": ["rule1", "rule2", ...], // 2-4 rules
  "styleNotes": ["note1", "note2"], // therapy-appropriate notes
  "detailBudget": 2, // 0-4, based on style (minimal=1, balanced=2, intricate=3)
  "paletteNotes": ["note1", "note2"] // therapy-appropriate color guidance
}

Therapy industry alignment:
- Calm, supportive, growth-oriented
- Professional yet approachable
- Warm, optimistic palettes
- Soft curves, balanced whitespace
- No aggressive or harsh elements`;

      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a motif blueprint for: ${prompt}` },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        blueprint = JSON.parse(content) as MotifBlueprint;
        blueprint.motif = 'generic';
        // Ensure detailBudget is set based on style
        blueprint.detailBudget = opts.style === 'intricate' ? 3 : opts.style === 'balanced' ? 2 : 1;
      } else {
        throw new Error('No response content');
      }
    } catch (error) {
      // Fallback to generic blueprint
      console.error('Failed to generate blueprint:', error);
      blueprint = {
        motif: 'generic',
        requiredParts: ['geometric shapes representing the prompt'],
        optionalParts: [],
        compositionRules: ['centered composition', 'balanced whitespace'],
        styleNotes: ['calm, professional', 'therapy-appropriate'],
        detailBudget: opts.style === 'intricate' ? 3 : opts.style === 'balanced' ? 2 : 1,
        paletteNotes: ['therapy-appropriate colors', 'calm, approachable palette']
      };
    }
  }

  // Cache the result
  blueprintCache.set(cacheKey, blueprint);
  return blueprint;
}

/**
 * Generates motif hints (shape guidance) from a prompt.
 * Returns a short text string with concrete shape ideas.
 * 
 * @param prompt - User's prompt (e.g., "sunrise", "sailboat")
 * @param opts - Options including industry, shape, archetype, style
 * @returns Promise<string> - Short motif hint string (<= 240 chars)
 */
async function generateMotifHints(
  prompt: string,
  opts: { industry: string; shape: string; archetype?: string; style: string; colorMode: string }
): Promise<string> {
  // Check cache first
  const cacheKey = `${prompt}|${opts.industry}|${opts.shape}|${opts.style}|${opts.colorMode}|${opts.archetype || ''}`;
  if (motifHintsCache.has(cacheKey)) {
    return motifHintsCache.get(cacheKey)!;
  }

  const systemPrompt = `You are a motif interpreter for icon-only logo design. Translate user prompts into concrete, SVG-safe shape guidance.

CRITICAL RULES (MUST FOLLOW):
- NO text, NO letters, NO initials, NO typography
- NO backgrounds, NO scenes, NO mockups
- Return ONLY plain text (NOT JSON, NOT markdown)
- Keep it SHORT (≤240 characters)
- Focus on 2-6 concrete geometric shapes that represent the prompt
- Include composition guidance (symmetry, layering, arrangement)

Examples:
- "sunrise" → "horizon line (rect) + rising arc (path) + 5 short rays (lines) arranged radially, bilateral symmetry"
- "sailboat" → "sail triangle (polygon) + hull curve (path) + 1-2 wave lines, centered composition"
- "compass" → "outer circle + inner circle + 4 directional lines (N/S/E/W), radial symmetry"
- "owl" → "circular head + two eyes (circles) + triangular beak, centered, bilateral symmetry"

Return ONLY the motif hint text, nothing else.`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Interpret this prompt into motif hints: ${prompt}` },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const hints = response.choices[0]?.message?.content?.trim() || '';
    
    // Truncate to 240 chars if needed
    const truncatedHints = hints.length > 240 ? hints.substring(0, 237) + '...' : hints;
    
    // Cache the result
    motifHintsCache.set(cacheKey, truncatedHints);
    
    return truncatedHints;
  } catch (error) {
    // Fallback to generic hint if API fails
    console.error('Failed to generate motif hints:', error);
    return `geometric shapes representing ${prompt}, icon-only, no text`;
  }
}

/**
 * Generates a JSON logo design spec from a text prompt using OpenAI's text model.
 * Returns a parsed RawLogoSpec object (not a string).
 * 
 * @param prompt - Text description of the desired logo
 * @param options - Style and color mode options
 * @returns Promise<RawLogoSpec> - Parsed JSON logo design specification
 * @throws Error if OpenAI API call fails or response is not valid JSON
 */
export async function generateLogoSpec(
  prompt: string,
  options: LogoSpecOptions = {}
): Promise<RawLogoSpec & { motifHints?: string; archetype?: string; blueprint?: MotifBlueprint }> {
  const { style = 'balanced', colorMode = 'muted', shape = 'any', industry = 'general', archetype } = options;
  // Build style constraints
  let styleConstraints = '';
  let shapeRange = '1-4';
  let colorRange = '1-3';
  let symmetryPreference = '';

  // Generate motif blueprint first (for therapy industry or when explicitly needed)
  const blueprint = await generateMotifBlueprint(prompt, {
    industry,
    style,
    colorMode,
  });

  // Logo archetypes for controlled variety
  const archetypes = [
    'monogram-like abstraction (geometric letterform-inspired, NO actual letters)',
    'emblem (centered, seal-like, balanced)',
    'split-geometry (divided composition, left/right or top/bottom)',
    'negative-space mark (cutouts create recognizable forms)',
    'stacked geometry (layered vertical or horizontal)',
    'radial mark (circular arrangement, centered)'
  ];
  const selectedArchetype = archetype || archetypes[Math.floor(Math.random() * archetypes.length)];
  
  // Generate motif hints (for backward compatibility)
  const motifHints = await generateMotifHints(prompt, {
    industry,
    shape,
    archetype: selectedArchetype,
    style,
    colorMode,
  });

  if (style === 'minimal') {
    shapeRange = '1-2';
    colorRange = '1';
    symmetryPreference = 'STRONGLY prefer high symmetry (radial, bilateral, or mirrored). NO paths unless extremely simple (M/L only).';
  } else if (style === 'balanced') {
    shapeRange = '2-3';
    colorRange = '1-2';
    symmetryPreference = 'Prefer balanced compositions (centered, bilateral, or stacked). Allow ONE simple path (M/L/H/V/Z only) or polygon.';
  } else if (style === 'intricate') {
    shapeRange = '4-8';
    colorRange = 'up to 3';
    symmetryPreference = 'Allow more complex compositions while maintaining unity. Encourage recognizable icon motifs with refined detail. Use 1-3 interior details that enhance recognizability. Use negative space cutouts for refinement. Allow clean, geometric paths (prefer M/L/H/V/Z, avoid curves).';
  }

  // Build color mode constraints and palette
  let colorConstraints = '';
  let requiredPalette: string[] = [];
  
  if (colorMode === 'monochrome') {
    colorRange = '1';
    requiredPalette = ['#111827']; // Dark neutral
    colorConstraints = `MUST use exactly 1 color only. Use ONLY this color: ${requiredPalette[0]}. NO color variety.`;
  } else if (colorMode === 'muted') {
    requiredPalette = ['#4A6FA5', '#6B8E7F', '#5A6578']; // Muted blues/greens/grays
    colorConstraints = `Use a calm, professional palette. Use ONLY these colors: ${requiredPalette.join(', ')}. You may use 1-3 of these colors. Do not invent additional colors.`;
  } else if (colorMode === 'bold') {
    requiredPalette = ['#0066FF', '#00CC66', '#FF3366']; // Bold blues/greens/reds
    colorConstraints = `Use a high-contrast, vivid palette. Use ONLY these colors: ${requiredPalette.join(', ')}. You may use 1-3 of these colors. Do not invent additional colors.`;
  }

  const systemPrompt = `You are a professional logo design specification generator for corporate-grade brand marks. Generate ONLY valid JSON for icon-only logos that look like real modern brand marks, not generic abstract art.

DESIGN LANGUAGE & QUALITY STANDARDS:
- Create iconic, scalable, corporate-grade vector marks
- Construct from circles/rectangles/polygons with clean proportions
- Ensure balanced whitespace and safe margins (shapes should fit within 10-90 coordinate range)
- Avoid clip-art feel - aim for sophisticated, geometric construction
- Prefer geometric construction and symmetry over organic blobs
- Prefer simple, crisp primitives (circles, rectangles, polygons) over complex paths
- Encourage negative space cutouts using overlapping shapes or paths to create recognizable marks
- Prefer 1 strong motif rather than multiple unrelated elements
- Avoid "random" composition - enforce clear hierarchy and focal point
- Use restrained, professional palettes (especially in muted mode)
- Paths must be clean and geometric - avoid scribbles or overly complex curves

LOGO ARCHETYPE (use this as composition guide):
- ${selectedArchetype}
- This archetype should influence your composition but remain icon-only with NO text

MOTIF BLUEPRINT (STRUCTURED REQUIREMENTS):
- Motif: ${blueprint.motif}
- Required Parts (MUST INCLUDE ALL): ${blueprint.requiredParts.join(', ')}
- Optional Parts (may include): ${blueprint.optionalParts.length > 0 ? blueprint.optionalParts.join(', ') : 'none'}
- Composition Rules: ${blueprint.compositionRules.join('; ')}
- Style Notes: ${blueprint.styleNotes.join('; ')}
- Detail Budget: ${blueprint.detailBudget} (use this to guide interior detail level)
- Palette Notes: ${blueprint.paletteNotes.join('; ')}
${blueprint.motif === 'leaves' ? '\nLEAF MOTIF HARD REQUIREMENTS:\n- Leaf must be a CURVED organic silhouette with a pointed tip\n- Do NOT use a simple diamond/rhombus polygon - use a curved path (A, Q, or C commands) for the silhouette\n- Include a central vein as a thin cutout (role="cutout") OR a thin path/line for the vein\n- Construction suggestion: Use ONE curved path for the leaf silhouette (with A/Q/C commands) and ONE thin path/line for the central vein\n- The leaf silhouette path should use curved commands (A for arcs, Q for quadratic curves, or C for cubic curves) to create organic leaf shape\n- Example: path with d="M 50 20 Q 30 40 50 70 Q 70 40 50 20 Z" creates a curved leaf shape' : ''}

MOTIF HINTS (ADDITIONAL GUIDANCE):
- ${motifHints}
- These hints provide concrete shape guidance for the prompt "${prompt}"

MUST INCLUDE CHECKLIST (parse the blueprint requiredParts and create shapes for each element):
- CRITICAL: You MUST implement ALL required parts from the blueprint above: ${blueprint.requiredParts.join(', ')}
- Read the blueprint requiredParts carefully and identify each required element (e.g., "sun disc", "rays", "leaf silhouette", "central vein", "stacked blocks", etc.)
- For each required part mentioned in the blueprint, create a corresponding shape in your JSON:
  * If hints mention "circle" or "circular" → create a circle shape with complete params: {"type": "circle", "params": {"cx": number, "cy": number, "r": number}, "fill": "#hex"}
  * If hints mention "triangle" or "triangular" → create a polygon with 3 points: {"type": "polygon", "params": {"points": [{"x": n, "y": n}, ...]}, "fill": "#hex"}
  * If hints mention "line" or "ray" → create a line: {"type": "line", "params": {"x1": n, "y1": n, "x2": n, "y2": n}, "fill": "#hex"}
  * If hints mention "path" or "curve" → create a path: {"type": "path", "params": {"d": "M x y L x y ..."}, "fill": "#hex"}
  * If hints mention "rect" or "rectangle" → create a rect: {"type": "rect", "params": {"x": n, "y": n, "width": n, "height": n}, "fill": "#hex"}
- Count the elements: if hints say "two eyes", create TWO circle shapes. If hints say "5 rays", create FIVE line shapes.
- Each shape MUST have complete params - do not omit required params (cx/cy/r for circles, points for polygons, d for paths, x/y/width/height for rects, x1/y1/x2/y2 for lines)
- If you cannot include all required elements from the motif hints, return an empty JSON object {} and we will regenerate
- Still maintain icon-only, no text, no background
- All shapes must form one unified mark

CRITICAL CONSTRAINTS (MUST FOLLOW - THESE ARE HARD REQUIREMENTS):
1. NO text elements (no <text>, no typography, no letters, no letterforms)
2. NO background shapes or rectangles that fill the entire viewBox
3. Use ONLY geometric shapes: circles, rectangles, polygons, paths, ellipses, lines
4. Keep shapes between ${shapeRange} total (HARD CONSTRAINT - must be within this range)
5. Use ${colorRange} distinct colors (hex format) (HARD CONSTRAINT - must be within this range)
6. All coordinates must be within the viewBox bounds (prefer 10-90 range for safe margins)
7. Return ONLY valid JSON, no markdown, no code blocks
8. All shapes must form ONE unified mark/icon (not multiple separate icons)
9. Paths: ${blueprint.motif === 'leaves' ? 'For LEAF motif: You MUST use curved path commands (A for arcs, Q for quadratic curves, or C for cubic curves) for the leaf silhouette. The leaf silhouette must be a curved path, NOT a straight-edge polygon. You may use up to 2 paths (one for silhouette, one for vein).' : 'Use ONLY M (move), L (line), H (horizontal), V (vertical), Z (close) commands. Avoid curves (C, Q, S, T, A) unless absolutely necessary and geometric.'}
10. Polygons: Keep point count reasonable (≤8 points for clean geometry)

STYLE CONSTRAINT (${style.toUpperCase()}):
- Shape count: ${shapeRange} shapes exactly
- ${symmetryPreference}
- ${style === 'minimal' ? 'Keep the design simple and clean with strong symmetry. NO paths unless extremely simple (M/L only).' : style === 'balanced' ? 'Keep the design well-balanced. Allow ONE simple path (M/L/H/V/Z only) or polygon.' : 'Keep the design detailed but unified with recognizable motifs. For prompts like "sunrise": create horizon + rising arc + 2-4 rays (simple, clean). For "sailboat": create sail triangle + hull + 1-2 waves (stylized). Add 1-3 interior details that enhance recognizability. Use negative space cutouts (role: "cutout") for refinement. Allow clean, geometric paths (prefer M/L/H/V/Z, avoid curves).'}
- Prefer geometric construction over organic forms
${style === 'intricate' ? '\nINTRICATE MODE ENHANCEMENTS:\n- Create recognizable icon motifs that clearly represent the prompt\n- Add 1-3 interior details (small shapes, lines, or cutouts) that enhance recognizability\n- Use negative space cutouts (set shape role: "cutout") to create refined details\n- Optional: include strokeStyle for global stroke styling (enabled: true, width: 1-6, color: hex, linecap: "round"|"butt", linejoin: "round"|"miter")\n- Keep a single unified mark - all shapes work together as one icon' : ''}

COLOR MODE CONSTRAINT (${colorMode.toUpperCase()}):
- ${colorConstraints}
- Color count: ${colorRange} colors exactly (HARD CONSTRAINT)
- HARD RULE: Use ONLY these palette colors: ${requiredPalette.join(', ')}
- Do NOT invent additional colors beyond this palette
- All shape.fill values MUST be one of: ${requiredPalette.join(', ')}
- If you use a color not in this list, your spec will be rejected
- Use restrained, professional palettes appropriate for corporate branding

INDUSTRY DESIGN LANGUAGE (${industry.toUpperCase()}):
${industry === 'general' ? '- General purpose: balanced, professional, versatile design language' : industry === 'healthcare' ? '- Healthcare: calm, trustworthy, healing-focused. Prefer soft curves, medical cross abstractions (geometric only), or protective shield-like forms. Use calming blues, soft greens, or professional grays.' : industry === 'therapy' ? '- Therapy: warm, supportive, growth-oriented. Prefer organic yet geometric forms, growth symbols (abstract), or connection motifs. Use warm, approachable colors.' : industry === 'fitness' ? '- Fitness: dynamic, energetic, strength-focused. Prefer bold geometric forms, movement lines, or power symbols. Use energetic colors with good contrast.' : industry === 'tech' ? '- Tech: modern, precise, innovation-focused. Prefer clean geometric forms, circuit-like patterns (abstract), or digital-inspired shapes. Use modern, tech-forward palettes.' : industry === 'finance' ? '- Finance: stable, trustworthy, professional. Prefer strong geometric forms, shield-like or secure motifs, balanced symmetry. Use conservative, professional colors.' : industry === 'education' ? '- Education: growth, knowledge, learning-focused. Prefer upward-pointing forms, book/light abstractions (geometric), or growth symbols. Use approachable, inspiring colors.' : industry === 'hospitality' ? '- Hospitality: welcoming, warm, service-focused. Prefer rounded, approachable forms, welcoming gestures (abstract), or service motifs. Use warm, inviting colors.' : ''}
- IMPORTANT: Industry guidance influences palette vibe, geometry mood, and archetype choice ONLY
- NEVER add text, letters, initials, brand names, or typography
- This is design language guidance, NOT permission to add text elements

ABSOLUTE TEXT PROHIBITION (HARD RULE):
- NO text, NO letters, NO initials, NO typography, NO brand names
- Do NOT include any <text> elements in the SVG
- Do NOT create letterform-like shapes that spell words
- Do NOT use shapes to form letters or numbers
- Icon-only means PURE geometric shapes forming a mark, nothing else

SHAPE SILHOUETTE CONSTRAINT (${shape.toUpperCase()}):
${shape === 'any' ? '- No specific silhouette constraint - design freely but maintain professional geometric construction' : shape === 'circle' ? '- HARD CONSTRAINT: Design the icon to read as a CIRCULAR silhouette\n- Use radial symmetry, circular composition, or arrange shapes in a circular pattern\n- Prefer circles, arcs, or radial arrangements\n- Do NOT add a literal border ring unless it is part of the icon itself\n- The overall composition should feel circular' : shape === 'square' ? '- HARD CONSTRAINT: Design the icon to read as a SQUARE/ROUNDED-SQUARE silhouette\n- Use orthogonal geometry with strong corner alignment\n- Prefer rectangles, squares, or 90-degree angles in composition\n- Do NOT add a background box\n- The overall composition should feel square or rectangular' : shape === 'triangle' ? '- HARD CONSTRAINT: Design the icon to read as a TRIANGULAR silhouette\n- Use peak/triangular composition\n- Prefer triangular forms, upward-pointing shapes, or triangular arrangements\n- The overall composition should feel triangular' : shape === 'hexagon' ? '- HARD CONSTRAINT: Design the icon to read as a HEXAGONAL silhouette\n- Use 60-degree geometry\n- Prefer polygons with 6 points or shapes arranged in hexagonal patterns\n- The overall composition should feel hexagonal' : shape === 'badge' ? '- HARD CONSTRAINT: Design the icon to read like a BADGE/MEDALLION\n- Use rounded-square or seal-like composition\n- Prefer centered, balanced arrangements with rounded corners or circular elements\n- Still icon-only and no text\n- The overall composition should feel like a badge or seal' : ''}

PROFESSIONAL LOGO HEURISTICS:
- Geometric construction: Build from precise circles, rectangles, and polygons
- Symmetry: Prefer radial, bilateral, or centered symmetry
- Negative space: Use overlapping shapes with different colors to create cutouts and recognizable forms
- Single strong motif: Focus on one clear visual idea, not multiple unrelated elements
- Clear hierarchy: Establish a focal point - don't scatter elements randomly
- Restrained palette: Professional colors that work in corporate contexts
- Clean paths: If using paths, keep them simple and geometric (M/L/H/V/Z only)
- Balanced whitespace: Ensure shapes have breathing room (safe margins)

REQUIRED JSON Structure - you MUST include these EXACT keys:
{
  "iconType": "string description",
  "symmetry": "string (e.g., 'radial', 'bilateral', 'asymmetric', 'centered', 'stacked', 'split', 'mirrored')",
  "shapes": [
    {
      "type": "circle" | "rect" | "polygon" | "path" | "ellipse" | "line",
      "params": {
        // For circles: {"cx": number, "cy": number, "r": number} - prefer centered (cx: 40-60, cy: 40-60)
        // For rectangles: {"x": number, "y": number, "width": number, "height": number, "rx": number (optional), "ry": number (optional)} - prefer centered
        // For ellipses: {"cx": number, "cy": number, "rx": number, "ry": number} - prefer centered
        // For polygons: {"points": [{"x": number, "y": number}, ...]} - keep ≤8 points, prefer centered composition
        // For paths: {"d": "M x y L x y ..."} - use ONLY M/L/H/V/Z commands, keep geometric and simple
        // For lines: {"x1": number, "y1": number, "x2": number, "y2": number}
      },
      "fill": "#hexcolor" (required, hex color),
      "stroke": null (MUST be null, not a string),
      "role": "fill" | "cutout" (optional, default: "fill" - use "cutout" for negative space shapes)
    }
  ],
  "colorPalette": ["#hexcolor1", "#hexcolor2", ...] (array of 1-3 hex colors),
  "complexity": "low" | "medium" | "high" | number,
  "strokeStyle": { "enabled": boolean, "width": number (1-6), "color": "#hexcolor", "linecap": "round"|"butt", "linejoin": "round"|"miter" } | null (optional, for intricate mode only)
}

IMPORTANT QUALITY REMINDERS:
- Center shapes around coordinates 40-60 for balanced composition
- Use clean, geometric construction - avoid organic blobs
- Create one strong, recognizable motif
- Ensure clear visual hierarchy with a focal point
- Use professional, restrained color palettes

Example for "a mountain logo" (professional geometric approach):
{
  "iconType": "geometric mountain peaks",
  "symmetry": "bilateral",
  "shapes": [
    {
      "type": "polygon",
      "params": {
        "points": [{"x": 30, "y": 70}, {"x": 40, "y": 35}, {"x": 50, "y": 50}, {"x": 60, "y": 30}, {"x": 70, "y": 70}]
      },
      "fill": "#4A6FA5",
      "stroke": null
    },
    {
      "type": "polygon",
      "params": {
        "points": [{"x": 35, "y": 70}, {"x": 40, "y": 40}, {"x": 50, "y": 55}, {"x": 60, "y": 35}, {"x": 65, "y": 70}]
      },
      "fill": "#5B7FA8",
      "stroke": null
    }
  ],
  "colorPalette": ["#4A6FA5", "#5B7FA8"],
  "complexity": "medium"
}

Remember: Create professional, brand-ready marks with geometric construction, clear hierarchy, and restrained palettes.`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a logo design spec for: ${prompt}` },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI API');
    }

    // Parse JSON response - will throw if not valid JSON
    let spec: RawLogoSpec;
    try {
      spec = JSON.parse(content) as RawLogoSpec;
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}. Response: ${content.substring(0, 200)}`);
      }
      throw parseError;
    }

    // Attach motif hints, archetype, and blueprint to spec for metadata
    (spec as any).motifHints = motifHints;
    (spec as any).archetype = selectedArchetype;
    (spec as any).blueprint = blueprint;
    
    return spec;
  } catch (error) {
    // Re-throw with more context if it's not already a formatted error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`OpenAI API error: ${String(error)}`);
  }
}
