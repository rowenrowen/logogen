export interface RemapDebug {
  extractedPalette: string[];
  uniqueFillsBefore: string[];
  uniqueFillsAfter: string[];
  changedCount: number;
  remapSkipped: boolean;
}

export interface RemapResult {
  svg: string;
  debug: RemapDebug;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, n | 0));
}

function rgbToString(rgb: { r: number; g: number; b: number }): string {
  return `rgb(${clamp255(rgb.r)},${clamp255(rgb.g)},${clamp255(rgb.b)})`;
}

export function remapSvgToPalette(svg: string, palette: string[]): RemapResult {
  const debug: RemapDebug = {
    extractedPalette: [...palette],
    uniqueFillsBefore: [],
    uniqueFillsAfter: [],
    changedCount: 0,
    remapSkipped: false,
  };

  if (!svg || typeof svg !== 'string' || palette.length === 0) {
    return { svg, debug };
  }

  // ---- parsing helpers ----
  function parseColor(str: string): { r: number; g: number; b: number } | null {
    if (!str) return null;
    const raw = str.trim();
    const lowered = raw.toLowerCase();

    if (lowered === 'none' || lowered === 'transparent') return null;
    if (lowered.includes('url(')) return null; // gradients/patterns

    // strip !important for style parsing
    const noImportant = lowered.replace(/\s*!important\s*$/, '').trim();

    // rgb(r,g,b)
    const rgbMatch = noImportant.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
      return {
        r: clamp255(parseInt(rgbMatch[1], 10)),
        g: clamp255(parseInt(rgbMatch[2], 10)),
        b: clamp255(parseInt(rgbMatch[3], 10)),
      };
    }

    // #RGB
    const hex3 = noImportant.match(/^#([a-f0-9])([a-f0-9])([a-f0-9])$/i);
    if (hex3) {
      return {
        r: parseInt(hex3[1] + hex3[1], 16),
        g: parseInt(hex3[2] + hex3[2], 16),
        b: parseInt(hex3[3] + hex3[3], 16),
      };
    }

    // #RRGGBB
    const hex6 = noImportant.match(/^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
    if (hex6) {
      return {
        r: parseInt(hex6[1], 16),
        g: parseInt(hex6[2], 16),
        b: parseInt(hex6[3], 16),
      };
    }

    return null;
  }

  const paletteRgb: Array<{ r: number; g: number; b: number; str: string; lum: number }> = [];
  for (const p of palette) {
    const rgb = parseColor(p);
    if (!rgb) continue;
    const lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
    paletteRgb.push({ ...rgb, str: rgbToString(rgb), lum });
  }
  if (paletteRgb.length === 0) return { svg, debug };

  function nearestPaletteColor(rgb: { r: number; g: number; b: number }): string {
    let best = paletteRgb[0];
    let bestD = Infinity;
    for (const p of paletteRgb) {
      const d = (rgb.r - p.r) ** 2 + (rgb.g - p.g) ** 2 + (rgb.b - p.b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best.str;
  }

  function collectUniqueColors(s: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    // style="...fill:...; stroke:...;"
    const styleAttr = /style\s*=\s*["']([^"']*)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = styleAttr.exec(s)) !== null) {
      const style = m[1];
      const prop = /(fill|stroke)\s*:\s*([^;]+)\s*;?/gi;
      let pm: RegExpExecArray | null;
      while ((pm = prop.exec(style)) !== null) {
        const val = pm[2].trim();
        const rgb = parseColor(val);
        if (!rgb) continue;
        const canon = rgbToString(rgb);
        if (!seen.has(canon)) {
          seen.add(canon);
          out.push(canon);
          if (out.length >= 20) return out;
        }
      }
    }

    // fill="..." stroke="..."
    const attr = /\b(fill|stroke)\s*=\s*["']([^"']+)["']/gi;
    while ((m = attr.exec(s)) !== null) {
      const val = m[2].trim();
      const rgb = parseColor(val);
      if (!rgb) continue;
      const canon = rgbToString(rgb);
      if (!seen.has(canon)) {
        seen.add(canon);
        out.push(canon);
        if (out.length >= 20) return out;
      }
    }

    return out;
  }

  debug.uniqueFillsBefore = collectUniqueColors(svg);

  // ---- replacements ----
  function replaceColorInStyle(style: string): { style: string; changed: number } {
    let changed = 0;
    const next = style.replace(/(fill|stroke)\s*:\s*([^;]+)(;?)/gi, (full, prop, value, semi) => {
      const raw = String(value).trim();
      const hasImportant = /!important/i.test(raw);
      const withoutImportant = raw.replace(/\s*!important\s*$/i, '').trim();
      const rgb = parseColor(withoutImportant);
      if (!rgb) return full; // includes none/url(...)
      const mapped = nearestPaletteColor(rgb);
      const mappedFull = `${prop}: ${mapped}${hasImportant ? ' !important' : ''}${semi || ''}`;
      if (mappedFull !== full) changed++;
      return mappedFull;
    });
    return { style: next, changed };
  }

  let remapped = svg;

  // 1) style attributes first
  remapped = remapped.replace(/style\s*=\s*["']([^"']*)["']/gi, (full, styleBody) => {
    const { style: nextStyle, changed } = replaceColorInStyle(String(styleBody));
    debug.changedCount += changed;
    return `style="${nextStyle}"`;
  });

  // 2) fill/stroke attributes
  remapped = remapped.replace(/\b(fill|stroke)\s*=\s*["']([^"']+)["']/gi, (full, attr, value) => {
    const raw = String(value).trim();
    const lowered = raw.toLowerCase();
    if (lowered === 'none' || lowered === 'transparent') return full;
    if (lowered.includes('url(')) return full; // leave gradients/patterns alone
    const rgb = parseColor(raw);
    if (!rgb) return full;
    const mapped = nearestPaletteColor(rgb);
    const next = `${attr}="${mapped}"`;
    if (next !== full) debug.changedCount += 1;
    return next;
  });

  debug.uniqueFillsAfter = collectUniqueColors(remapped);

  // If we barely changed anything, treat as failed and skip.
  if (debug.changedCount < 5) {
    debug.remapSkipped = true;
    debug.uniqueFillsAfter = debug.uniqueFillsBefore;
    return { svg, debug };
  }

  return { svg: remapped, debug };
}
