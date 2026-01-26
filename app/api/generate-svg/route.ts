export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { generateSvgFromPrompt, GenerateSvgParams } from '../../../lib/generateSvg';

// Process-level error handlers for TDZ debugging
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  console.error("STACK:", err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
  if (err instanceof Error) {
    console.error("STACK:", err.stack);
  }
});

/**
 * GET handler: Parse query params and generate SVG
 */
export async function GET(request: NextRequest) {
  console.log('GET handler called with URL:', request.url);
  try {
    const { searchParams } = new URL(request.url);

    const prompt = searchParams.get('prompt');
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: 'Missing prompt' },
        { status: 400 }
      );
    }

    // Declare paletteChoice at the top BEFORE any usage
    const paletteChoice = searchParams.get('palette') ?? 'any';
    console.log('GET paletteChoice=', paletteChoice);

    const shape = searchParams.get('shape') ?? 'any';
    const value = (searchParams.get('value') ?? 'hybrid') as 'hybrid' | 'filled' | 'outlined';
    
    const params: GenerateSvgParams = {
      prompt,
      style: searchParams.get('style') || undefined,
      paletteChoice,
      shape,
      value,
      businessName: searchParams.get('businessName') || undefined,
      // Note: gallerySvgs not available in GET (would need to be passed as query param array)
    };

    console.log('GET params.paletteChoice:', params.paletteChoice);

    const format = searchParams.get('format') || 'json';

    const result = await generateSvgFromPrompt(params);

    if (format === 'json') {
      return NextResponse.json(
        {
          ok: true,
          svg: result.svg,
          lockupSvg: result.lockupSvg,
          lockupHorizontalSvg: result.lockupHorizontalSvg,
          lockupStackedSvg: result.lockupStackedSvg,
          lockupDebug: result.lockupDebug,
          pngBase64: result.pngBase64,
          meta: result.meta,
        },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        }
      );
    } else {
      // Return raw SVG
      return new NextResponse(result.svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache',
        },
      });
    }
  } catch (err: any) {
    console.error("API ERROR in GET:", err);
    console.error("STACK:", err?.stack);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? String(err),
        stack: err?.stack ?? null,
        location: "GET handler"
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler: Parse JSON body and generate SVG
 */
export async function POST(request: NextRequest) {
  console.log('POST handler called');
  try {
    console.log('POST request received, parsing JSON...');
    const body = await request.json();
    console.log("GENERATE BODY", body);
        const { prompt, style, palette, shape, value, businessName, fontFamily, gallerySvgs } = body;
    console.log('POST extracted prompt:', prompt, 'type:', typeof prompt, 'length:', prompt?.length);

    if (!prompt || typeof prompt !== 'string') {
      console.log('POST validation failed: prompt missing or invalid');
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid prompt' },
        { status: 400 }
      );
    }

    // Declare paletteChoice at the top BEFORE any usage
    const paletteChoice = palette ?? 'any';
    const shapeValue = shape ?? 'any';
    const valueParam = value ?? 'hybrid';
    console.log('POST paletteChoice=', paletteChoice);

    const params: GenerateSvgParams = {
      prompt,
      style,
      paletteChoice,
      shape: shapeValue,
      value: valueParam,
      businessName,
      fontFamily: (fontFamily || 'Inter') as 'Inter' | 'Lora' | 'Larken',
      gallerySvgs: Array.isArray(gallerySvgs) ? gallerySvgs : [],
    };

    console.log('POST params.paletteChoice:', params.paletteChoice);

    const result = await generateSvgFromPrompt(params);

    return NextResponse.json(
        {
          ok: true,
          svg: result.svg,
          lockupSvg: result.lockupSvg,
          lockupHorizontalSvg: result.lockupHorizontalSvg,
          lockupStackedSvg: result.lockupStackedSvg,
          lockupDebug: result.lockupDebug,
          pngBase64: result.pngBase64,
          meta: result.meta,
        },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err: any) {
    console.error("API ERROR in POST:", err);
    console.error("STACK:", err?.stack);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? String(err),
        stack: err?.stack ?? null,
        location: "POST handler"
      },
      { status: 500 }
    );
  }
}
