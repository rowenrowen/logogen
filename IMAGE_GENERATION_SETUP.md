# Image-Based Logo Generation Setup

This document describes the new image-based logo generation system that uses OpenAI's image generation API.

## Overview

The system generates logos using:
1. **OpenAI Image Generation** → Creates PNG icon images
2. **QC Filters** → Validates white background, no text, single mark
3. **Vectorization** → Converts PNG to SVG using VTracer-based vectorizer
4. **Similarity Screening** → Checks against gallery to ensure uniqueness

## Dependencies

### Required Packages
- `sharp` - Image processing for QC checks
- `@neplex/vectorizer` - Raster to SVG conversion (VTracer-based)

**Note**: If `@neplex/vectorizer` is not available, consider alternatives:
- `vtracer` (Node.js bindings)
- `imagetracerjs` (JavaScript-based)
- `potrace` (via bindings)

### Installation
```bash
npm install sharp @neplex/vectorizer
```

## API Routes

### `/api/generate-icon`
Generates a PNG icon using OpenAI Images API.

**Request:**
```json
{
  "prompt": "mountain logo",
  "style": "balanced",
  "colorMode": "muted",
  "shape": "any",
  "industry": "therapy"
}
```

**Response:**
```json
{
  "ok": true,
  "pngBase64": "...",
  "meta": { ... }
}
```

### `/api/vectorize`
Converts PNG (base64) to SVG.

**Request:**
```json
{
  "pngBase64": "..."
}
```

**Response:**
```json
{
  "ok": true,
  "svg": "<svg>...</svg>",
  "vectorMeta": { "paths": 10, "colors": 3 }
}
```

### `/api/generate-svg`
Combined route: generates icon → QC checks → vectorizes → similarity screening.

**Request:**
```json
{
  "prompt": "mountain logo",
  "style": "balanced",
  "colorMode": "muted",
  "shape": "any",
  "industry": "therapy",
  "gallerySvgs": ["<svg>...</svg>", ...]
}
```

**Response:**
```json
{
  "ok": true,
  "svg": "<svg>...</svg>",
  "pngBase64": "...",
  "meta": {
    "prompt": "...",
    "style": "...",
    "similarityScore": 0.2,
    "vectorMeta": { ... }
  }
}
```

## QC Checks (`/lib/qc.ts`)

### White Background Check
- Requires >= 97% white pixels (R,G,B >= 250, alpha >= 250)
- Uses `sharp` to analyze pixel data

### Text Detection
- Uses OpenAI Vision API (gpt-4o-mini) to detect text
- Asks: "Does this image contain any visible text, letters, numbers, or typography?"
- Returns yes/no

### Single Mark Check
- Computes bounding box of non-white pixels
- Rejects if coverage > 60% (likely multiple marks or background)
- Checks pixel density to ensure single unified mark

## Image Prompt Engineering

The system builds strict prompts with:
- "Single logo icon only. ONE unified mark."
- "Pure white background (#FFFFFF), no gradient, no shadow, no texture."
- "No text, no letters, no words, no numbers, no typography."
- "Centered, lots of whitespace, vector-like flat design, modern professional."
- Style/color/shape/industry guidance

## Similarity Screening

After vectorization, compares new SVG against gallery:
- Extracts colors from SVG
- Computes color similarity (Jaccard index)
- Compares path counts
- Rejects if similarity > 85%

## Configuration

### Environment Variables
- `OPENAI_API_KEY` - Required for image generation and text detection
- `OPENAI_IMAGE_MODEL` - Optional, defaults to `dall-e-3` (can be set to `gpt-image-1.5` if available)

### Model Notes
- Currently uses `dall-e-3` for image generation
- If `gpt-image-1.5` becomes available, set `OPENAI_IMAGE_MODEL=gpt-image-1.5`
- Text detection uses `gpt-4o-mini` (cost-efficient)

## Retry Logic

- Maximum 5 attempts per generation
- Each attempt: generate → QC → vectorize → similarity check
- Returns first valid result or error after all attempts

## UI Updates

The frontend (`app/page.tsx`) now:
- Calls `/api/generate-svg` instead of template routes
- Shows progress stages: "Generating icon" → "Checking background" → "Checking text" → "Vectorizing" → "Done"
- Displays SVG in preview
- Optionally shows original PNG in collapsible debug panel
- Saves SVG + metadata (style, colorMode, shape, industry, prompt) to gallery

## Gallery

Gallery items now store:
- `svg` - Vectorized SVG
- `prompt` - Original prompt
- `style`, `colorMode`, `shape`, `industry` - Tags
- `createdAt` - Timestamp
- No `spec` or `family` (not applicable to image-based generation)

## Troubleshooting

### Vectorizer Package Issues
If `@neplex/vectorizer` is not available:
1. Try alternative: `npm install vtracer` or `imagetracerjs`
2. Update imports in `/app/api/vectorize/route.ts` and `/app/api/generate-svg/route.ts`
3. Adjust API calls to match the alternative package's interface

### QC Check Failures
- White background: Ensure prompt emphasizes "pure white background"
- Text detection: May have false positives; consider adjusting threshold
- Single mark: May reject complex logos; adjust coverage threshold if needed

### Model Availability
- If `gpt-image-1.5` is not available, system falls back to `dall-e-3`
- Check OpenAI API documentation for latest model names
