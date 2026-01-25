# SVG Logo Generator

An SVG-first logo generator that creates icon-only logos from text prompts using OpenAI and deterministic SVG rendering.

## Features

- **Text-to-Logo**: Generate logo designs from natural language prompts
- **Icon-Only**: Strictly enforces no text, no background elements
- **Validation**: Ensures shape count (3-15), color count (1-4), and no typography
- **Deterministic Rendering**: Clean, predictable SVG output from JSON specs
- **Type-Safe**: Built with TypeScript for reliability

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up your OpenAI API key:
```bash
echo "OPENAI_API_KEY=your_key_here" > .env.local
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Usage

### POST `/api/generate`

Generate a logo from a text prompt.

**Request:**
```json
{
  "prompt": "a mountain logo"
}
```

**Response:**
- Success: SVG content with `Content-Type: image/svg+xml`
- Error: JSON error object

### GET `/api/generate?prompt=...`

Same as POST but using query parameters (useful for testing).

## Architecture

- **`types/logo.ts`**: TypeScript definitions for logo specifications
- **`lib/openai.ts`**: OpenAI integration for generating JSON logo specs
- **`lib/validation.ts`**: Validation logic for shape count, color count, and typography checks
- **`lib/svg-renderer.ts`**: Deterministic SVG renderer from JSON specs
- **`app/api/generate/route.ts`**: API route handler

## Constraints

- **Shapes**: 3-15 geometric shapes only (circle, rect, polygon, path, ellipse, line)
- **Colors**: 1-4 distinct colors (hex format)
- **No Typography**: Text elements are strictly forbidden
- **No Background**: No full-viewBox background shapes
- **Icon-Only**: Logos are pure icon designs

## Development

```bash
# Development
npm run dev

# Build
npm run build

# Start production server
npm start

# Lint
npm run lint
```
# logogen
# logogen
# logogen
