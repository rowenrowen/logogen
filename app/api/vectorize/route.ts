export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { vectorizeWithVtracer } from '../../../lib/vectorizeWithVtracer';
import { enforceShapeInSvg } from '../../../lib/enforceShapeInSvg';
import { preprocessForVectorize } from '../../../lib/preprocessForVectorize';
import { applyShapeMask } from '../../../lib/applyShapeMask';

/**
 * POST handler: Vectorize PNG to SVG using VTracer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { iconPngBase64, shape } = body;

    if (!iconPngBase64 || typeof iconPngBase64 !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid iconPngBase64' },
        { status: 400 }
      );
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = iconPngBase64.replace(/^data:image\/png;base64,/, '');
    
    // Convert to Buffer
    let pngBuffer: Buffer;
    try {
      pngBuffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: 'Failed to decode base64 PNG' },
        { status: 400 }
      );
    }

    try {
      // Apply edge preprocessing
      let preprocessedPng = pngBuffer;
      try {
        preprocessedPng = await preprocessForVectorize(pngBuffer);
      } catch (preprocessError) {
        console.warn('Edge preprocessing failed, using original:', preprocessError);
      }

      // Apply shape mask if specified
      let maskedPng = preprocessedPng;
      if (shape && shape !== 'any') {
        try {
          maskedPng = await applyShapeMask(
            preprocessedPng,
            shape as 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield',
            'clip'
          );
        } catch (maskError) {
          console.warn('Shape mask failed, using original:', maskError);
        }
      }

      // Vectorize with VTracer
      let svg = await vectorizeWithVtracer(maskedPng);

      // Apply shape enforcement in SVG if specified
      if (shape && shape !== 'any') {
        try {
          svg = enforceShapeInSvg(
            svg,
            shape as 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield',
            'clip'
          );
        } catch (enforceError) {
          console.warn('SVG shape enforcement failed:', enforceError);
        }
      }

      return NextResponse.json(
        {
          ok: true,
          iconSvg: svg,
        },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Vectorization failed:', error);
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Vectorization failed',
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("API ERROR in vectorize:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
