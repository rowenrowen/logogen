'use client';

import { useState, useEffect, useRef } from 'react';


interface CurrentLogo {
  svg: string;
  spec: any | null;
  prompt: string;
  style: string;
  palette: string;
  shape: string;
  value?: 'hybrid' | 'filled' | 'outlined';
  createdAt: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'minimal' | 'balanced' | 'intricate'>('balanced');
  const [palette, setPalette] = useState<'any' | 'monochrome' | 'warm' | 'cool' | 'complementary' | 'analogous' | 'earth' | 'pastel' | 'neon' | 'black_white'>('any');
  const [shape, setShape] = useState<'any' | 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield'>('any');
  const [value, setValue] = useState<'hybrid' | 'filled' | 'outlined'>('hybrid');
  const [fontFamily, setFontFamily] = useState<'Inter' | 'Lora' | 'Larken'>('Inter');
  const [businessName, setBusinessName] = useState('');
  const [currentLogo, setCurrentLogo] = useState<CurrentLogo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'Idle' | 'Generating icon' | 'Checking background' | 'Checking text' | 'Done'>('Idle');
  const [iconPngBase64, setIconPngBase64] = useState<string | null>(null);
  const [meta, setMeta] = useState<any | null>(null);
  // Lockup PNG state (stacked only)
  const [lockupPng, setLockupPng] = useState<string | null>(null);
  const [lockupPngLogicalSize, setLockupPngLogicalSize] = useState<{ width: number; height: number } | null>(null);
  const [framedLockupPng, setFramedLockupPng] = useState<string | null>(null);

  // Device pixel ratio for high-quality rendering
  const DPR = 2;

  // Helper: Trim white padding from PNG
  const trimWhitePaddingFromPng = async (
    dataUrl: string
  ): Promise<{ dataUrl: string; width: number; height: number }> => {
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = dataUrl;
    });

    // Create temp canvas to read pixels
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(img, 0, 0);

    // Read pixel data
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    // Find bounding box of non-white pixels
    let minX = img.width;
    let minY = img.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const idx = (y * img.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Treat as white if (r>245 && g>245 && b>245 && a>245)
        const isWhite = r > 245 && g > 245 && b > 245 && a > 245;

        if (!isWhite) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // If no content pixels found, return original
    if (minX > maxX || minY > maxY) {
      return {
        dataUrl,
        width: img.width,
        height: img.height,
      };
    }

    // Add safety margin (2px) and clamp
    const margin = 2;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(img.width - 1, maxX + margin);
    maxY = Math.min(img.height - 1, maxY + margin);

    const croppedWidth = maxX - minX + 1;
    const croppedHeight = maxY - minY + 1;

    // Create cropped canvas at DPR resolution
    const canvas = document.createElement('canvas');
    canvas.width = croppedWidth * DPR;
    canvas.height = croppedHeight * DPR;
    const ctx = canvas.getContext('2d')!;
    
    // Set transform for high-DPI rendering
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, croppedWidth, croppedHeight);

    // Draw cropped region
    ctx.drawImage(
      img,
      minX, minY, croppedWidth, croppedHeight,
      0, 0, croppedWidth, croppedHeight
    );

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: croppedWidth,
      height: croppedHeight,
    };
  };

  // Helper: Ensure font is loaded before rendering
  const ensureFontLoaded = async (
    fontFamily: 'Inter' | 'Lora' | 'Larken',
    weight: number
  ): Promise<void> => {
    const cssFamily =
      fontFamily === 'Inter' ? 'Inter' :
      fontFamily === 'Lora' ? 'Lora' : 'Larken';

    // Wait for document fonts system to be ready
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    // Force-load the specific face we need
    const size = 40; // any size
    if (document.fonts?.load) {
      await document.fonts.load(`${weight} ${size}px "${cssFamily}"`);
    }

    // One more await to ensure it's applied
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  };

  // Helper: Render text to PNG
  const renderTextToPng = async (
    text: string,
    fontFamily: 'Inter' | 'Lora' | 'Larken',
    fontSizePx: number,
    color: string = '#111',
    maxWidthPx: number = 520
  ): Promise<{ dataUrl: string; width: number; height: number }> => {
    const fontWeight = fontFamily === 'Inter' ? 600 : 500;
    
    // Ensure font is loaded before rendering
    await ensureFontLoaded(fontFamily, fontWeight);

    const lineHeight = Math.round(fontSizePx * 1.15);
    const paddingX = 10;
    const paddingY = 10;

    // Set font family with explicit quoting + fallbacks
    const family =
      fontFamily === 'Inter' ? `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif` :
      fontFamily === 'Lora' ? `"Lora", serif` :
      `"Larken", serif`;

    // Create canvas for measurement
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d')!;
    measureCtx.font = `${fontWeight} ${fontSizePx}px ${family}`;
    
    // Measure full text single line width
    const fullW = measureCtx.measureText(text).width;
    
    let lines: string[] = [];
    
    // If full width is within max, use single line
    if (fullW <= maxWidthPx) {
      lines = [text];
    } else {
      // Wrap into up to 2 lines
      const words = text.split(' ');
      let line1 = '';
      
      // Build line1 word-by-word until adding next word would exceed maxWidthPx
      for (let i = 0; i < words.length; i++) {
        const testLine = line1 ? `${line1} ${words[i]}` : words[i];
        const testWidth = measureCtx.measureText(testLine).width;
        
        if (testWidth <= maxWidthPx) {
          line1 = testLine;
        } else {
          // This word would exceed, so line1 is done
          break;
        }
      }
      
      if (line1) {
        lines.push(line1);
        
        // Remaining words go to line2
        const line1WordCount = line1.split(' ').length;
        const remainingWords = words.slice(line1WordCount);
        
        if (remainingWords.length > 0) {
          let line2 = remainingWords.join(' ');
          const line2Width = measureCtx.measureText(line2).width;
          
          // If line2 still exceeds maxWidthPx, truncate with ellipsis
          if (line2Width > maxWidthPx) {
            let truncated = '';
            for (let i = 0; i < remainingWords.length; i++) {
              const test = truncated ? `${truncated} ${remainingWords[i]}` : remainingWords[i];
              const testWithEllipsis = `${test}…`;
              if (measureCtx.measureText(testWithEllipsis).width > maxWidthPx) {
                break;
              }
              truncated = test;
            }
            line2 = truncated ? `${truncated}…` : '…';
          }
          
          lines.push(line2);
        }
      } else {
        // Even first word is too long, just use it (will be truncated in rendering)
        lines = [text];
      }
    }

    // Calculate dimensions (logical)
    const textWidths = lines.map(line => measureCtx.measureText(line).width);
    const canvasWidth = Math.min(maxWidthPx, Math.max(...textWidths, 100)) + paddingX * 2;
    const canvasHeight = lines.length * lineHeight + paddingY * 2;

    // Create final canvas at DPR resolution
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * DPR;
    canvas.height = canvasHeight * DPR;
    const ctx = canvas.getContext('2d')!;
    
    // Set transform for high-DPI rendering
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Set font and draw text (logical coordinates) with proper fallbacks
    ctx.font = `${fontWeight} ${fontSizePx}px ${family}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    
    // Debug guard: check if font loaded correctly (temporary)
    const m1 = ctx.measureText('MMMMMM').width;
    ctx.font = `${fontWeight} ${fontSizePx}px serif`;
    const m2 = ctx.measureText('MMMMMM').width;
    ctx.font = `${fontWeight} ${fontSizePx}px ${family}`; // restore
    // If m1 is extremely close to m2 for Inter, likely fallback, but proceed anyway

    lines.forEach((line, index) => {
      const y = paddingY + index * lineHeight;
      ctx.fillText(line, paddingX, y);
    });

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvasWidth,
      height: canvasHeight,
    };
  };

  // Helper: Compose icon + text into lockup PNG (stacked only)
  const composeLockup = async (
    trimmedIconPngDataUrl: string,
    trimmedIconWidth: number,
    trimmedIconHeight: number,
    textPngDataUrl: string
  ): Promise<{ dataUrl: string; width: number; height: number }> => {
    // Load images
    const iconImg = new Image();
    const textImg = new Image();
    
    await Promise.all([
      new Promise<void>((resolve) => {
        iconImg.onload = () => resolve();
        iconImg.src = trimmedIconPngDataUrl;
      }),
      new Promise<void>((resolve) => {
        textImg.onload = () => resolve();
        textImg.src = textPngDataUrl;
      }),
    ]);

    const textH = textImg.height;
    const textW = textImg.width;
    const trimmedIconW = trimmedIconWidth;
    const trimmedIconH = trimmedIconHeight;

    // Target icon height: clamp(textH * 2.5, textH * 2.0, textH * 3.0)
    const targetIconH = Math.max(
      textH * 2.0,
      Math.min(textH * 3.0, textH * 2.5)
    );
    const iconScale = targetIconH / trimmedIconH;
    const iconW = trimmedIconW * iconScale;
    const iconH = targetIconH;

    // Gap: round(textH * 0.35), clamped between 10 and 22
    const gap = Math.max(10, Math.min(22, Math.round(textH * 0.35)));

    // Stacked layout
    const canvasWidth = Math.max(iconW, textW);
    const canvasHeight = iconH + gap + textH;
    const iconX = (canvasWidth - iconW) / 2;
    const iconY = 0;
    const textX = (canvasWidth - textW) / 2;
    const textY = iconH + gap;

    // Create canvas at DPR resolution
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * DPR;
    canvas.height = canvasHeight * DPR;
    const ctx = canvas.getContext('2d')!;
    
    // Set transform for high-DPI rendering
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw icon (logical coordinates)
    ctx.drawImage(iconImg, iconX, iconY, iconW, iconH);

    // Draw text (logical coordinates)
    ctx.drawImage(textImg, textX, textY);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvasWidth, // Return logical size
      height: canvasHeight, // Return logical size
    };
  };

  // Helper: Frame lockup in square with padding
  const frameToSquare = async (
    lockupPngDataUrl: string,
    boxSize: number = 320,
    framePaddingPx: number = 40
  ): Promise<string> => {
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = lockupPngDataUrl;
    });

    const innerSize = boxSize - 2 * framePaddingPx;
    const scale = Math.min(innerSize / img.width, innerSize / img.height);
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    const dx = (boxSize - scaledW) / 2;
    const dy = (boxSize - scaledH) / 2;

    // Create canvas at DPR resolution
    const canvas = document.createElement('canvas');
    canvas.width = boxSize * DPR;
    canvas.height = boxSize * DPR;
    const ctx = canvas.getContext('2d')!;
    
    // Set transform for high-DPI rendering
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, boxSize, boxSize);

    // Draw centered lockup (logical coordinates)
    ctx.drawImage(img, dx, dy, scaledW, scaledH);

    return canvas.toDataURL('image/png');
  };

  // Generate lockup PNG when businessName or icon changes
  useEffect(() => {
    if (!businessName.trim() || !iconPngBase64) {
      setLockupPng(null);
      setLockupPngLogicalSize(null);
      setFramedLockupPng(null);
      return;
    }

    const generateLockup = async () => {
      try {
        // Trim white padding from icon
        const trimmedIcon = await trimWhitePaddingFromPng(iconPngBase64);

        // Estimate text height to calculate icon dimensions first
        // Single line: fontSize * lineHeight, two lines: fontSize * lineHeight * 2
        const fontSizePx = 36;
        const lineHeight = Math.round(fontSizePx * 1.15);
        const paddingY = 10;
        // Estimate: assume 1-2 lines, use average
        const estimatedTextH = lineHeight * 1.5 + paddingY * 2;

        // Calculate icon dimensions based on estimated text height
        const targetIconH = Math.max(
          estimatedTextH * 2.0,
          Math.min(estimatedTextH * 3.0, estimatedTextH * 2.5)
        );
        const iconScale = targetIconH / trimmedIcon.height;
        const iconW = trimmedIcon.width * iconScale;

        // Max text width is 2x icon width
        const maxTextWidth = iconW * 2;

        // Render text to PNG with max width based on icon
        const textPng = await renderTextToPng(
          businessName,
          fontFamily,
          fontSizePx,
          '#111',
          maxTextWidth
        );

        // Compose stacked lockup using trimmed icon
        const lockup = await composeLockup(
          trimmedIcon.dataUrl,
          trimmedIcon.width,
          trimmedIcon.height,
          textPng.dataUrl
        );

        // Frame lockup in square with padding
        const framed = await frameToSquare(lockup.dataUrl, 320, 40);

        setLockupPng(lockup.dataUrl);
        setLockupPngLogicalSize({ width: lockup.width, height: lockup.height });
        setFramedLockupPng(framed);
      } catch (error) {
        console.error('Failed to generate lockup:', error);
      }
    };

    generateLockup();
  }, [businessName, iconPngBase64, fontFamily]);


  // Download lockup PNG
  const handleDownloadLockupPng = () => {
    if (!lockupPng) return;

    const a = document.createElement('a');
    a.href = lockupPng;
    a.download = 'lockup.png';
    a.click();
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentLogo(null);
    setIconPngBase64(null);
    setMeta(null);
    setError(null);
    setProgress(10);
    setStage('Generating icon');

    // Animate progress smoothly while waiting
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    const startProgressAnimation = () => {
      let currentProgress = 10;
      progressTimer = setInterval(() => {
        currentProgress += Math.random() * 2; // Increment by 0-2% each interval
        if (currentProgress > 80) {
          currentProgress = 80;
        }
        setProgress(currentProgress);
      }, 300); // Update every 300ms
    };

    startProgressAnimation();

    try {

      const payload = {
        prompt,
        style,
        palette,
        shape,
        value,
        businessName: businessName.trim() || undefined,
        fontFamily,
      };

      // Call generate-svg API with format=json
      const response = await fetch(`/api/generate-svg?format=json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Stop progress animation
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }

      // Update stages based on progress
      setProgress(30);
      setStage('Checking background');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setProgress(50);
      setStage('Checking text');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setProgress(90);
      setStage('Done');

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `Error: ${response.status} ${response.statusText}` };
        }
        throw new Error(errorData.error || errorData.lastFailureReason || errorData.message || `Error: ${response.status}`);
      }

      // Parse JSON response
      const data = await response.json();
      
      // Check if request failed
      if (!data.ok) {
        const errorMsg = data.error || data.lastFailureReason || 'Failed to generate logo';
        setError(errorMsg);
      setIconPngBase64(null);
        setMeta(null);
        throw new Error(errorMsg);
      }

      // Store PNG data URL
      const iconPngBase64 = typeof data.iconPngBase64 === 'string' ? data.iconPngBase64 : null;
      
      setIconPngBase64(iconPngBase64);
      
      if (data.metadata) {
        setMeta(data.metadata);
      }

      // Validate PNG
      if (!iconPngBase64 || iconPngBase64.length === 0) {
        throw new Error('Invalid response: PNG is empty or missing');
      }

      // Build logo object (PNG-based, SVG generated on demand)
      const logo: CurrentLogo = {
        svg: '', // Will be generated on demand via vectorize endpoint
        spec: null,
        prompt: prompt,
        style: style,
        palette,
        shape: data.metadata?.shape || shape,
        value: data.metadata?.value || value,
        createdAt: new Date().toISOString(),
      };
      setCurrentLogo(logo);
      
      setProgress(100);
      setStage('Done');
      
      // Reset stage after 1.5s (keep svg displayed)
      setTimeout(() => {
        setStage('Idle');
        setProgress(0);
      }, 1500);
    } catch (err) {
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStage('Idle');
      setProgress(0);
        setIconPngBase64(null);
        setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (svgContent?: string) => {
    // If SVG content is provided, use it directly
    if (svgContent) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logo.svg';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Otherwise, vectorize the current PNG
    if (!iconPngBase64) {
      console.error('No PNG available to vectorize');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/vectorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          iconPngBase64,
          shape: meta?.shape || 'any',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Vectorization failed');
      }

      const data = await response.json();
      if (!data.ok || !data.iconSvg) {
        throw new Error('Invalid vectorization response');
      }

      // Download the SVG
      const blob = new Blob([data.iconSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logo.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download SVG:', error);
      setError(error instanceof Error ? error.message : 'Failed to vectorize PNG');
    } finally {
      setLoading(false);
    }
  };




  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && prompt.trim()) {
      handleGenerate();
    }
  };


  return (
    <main className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold text-neutral-900 mb-3">
            SVG Logo Generator
          </h1>
          <p className="text-lg text-neutral-600">
            Generate icon-only SVG logos from text prompts
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 sm:p-10 mb-6">
          {/* Prompt Input Section */}
          <div className="mb-6">
            <label htmlFor="prompt-input" className="block text-sm font-medium text-neutral-700 mb-2">
              Describe your logo
            </label>
            <input
              id="prompt-input"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., ocean logo -mountain, sunrise -text, minimalist wave"
              className="w-full px-4 py-3.5 text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
              disabled={loading}
              aria-describedby="prompt-helper"
            />
            <p id="prompt-helper" className="mt-2 text-sm text-neutral-500">
              Use -term to exclude concepts (e.g., -mountain -text). Press Enter to generate or click the button below.
            </p>
          </div>

          {/* Business Name Input */}
          <div className="mb-6">
            <label htmlFor="business-name-input" className="block text-sm font-medium text-neutral-700 mb-2">
              Business Name (optional)
            </label>
            <input
              id="business-name-input"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Acme Corp"
              className="w-full px-4 py-3.5 text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
              disabled={loading}
            />
          </div>

              {/* Style, Palette, Shape, Value, Font Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div>
              <label htmlFor="style-select" className="block text-sm font-medium text-neutral-700 mb-2">
                Style
              </label>
              <select
                id="style-select"
                value={style}
                onChange={(e) => setStyle(e.target.value as 'minimal' | 'balanced' | 'intricate')}
                disabled={loading}
                className="w-full px-4 py-3 text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed bg-white"
              >
                <option value="minimal">Minimal</option>
                <option value="balanced">Balanced</option>
                <option value="intricate">Intricate</option>
              </select>
            </div>
            <div>
              <label htmlFor="palette-select" className="block text-sm font-medium text-neutral-700 mb-2">
                Palette
              </label>
              <select
                id="palette-select"
                value={palette}
                onChange={(e) => setPalette(e.target.value as 'any' | 'monochrome' | 'warm' | 'cool' | 'complementary' | 'analogous' | 'earth' | 'pastel' | 'neon' | 'black_white')}
                disabled={loading}
                className="w-full px-4 py-3 text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed bg-white"
              >
                <option value="any">Any</option>
                <option value="monochrome">Monochrome</option>
                <option value="warm">Warm</option>
                <option value="cool">Cool</option>
                <option value="complementary">Complementary</option>
                <option value="analogous">Analogous</option>
                <option value="earth">Earth</option>
                <option value="pastel">Pastel</option>
                <option value="neon">Neon</option>
                <option value="black_white">Black & White</option>
              </select>
            </div>
            <div>
              <label htmlFor="shape-select" className="block text-sm font-medium text-neutral-700 mb-2">
                Shape
              </label>
              <select
                id="shape-select"
                value={shape}
                onChange={(e) => setShape(e.target.value as 'any' | 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield')}
                disabled={loading}
                className="w-full px-4 py-3 text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed bg-white"
              >
                <option value="any">Any</option>
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="roundedSquare">Rounded Square</option>
                <option value="pill">Pill</option>
                <option value="hex">Hexagon</option>
                <option value="shield">Shield</option>
              </select>
            </div>
            <div>
              <label htmlFor="value-select" className="block text-sm font-medium text-neutral-700 mb-2">
                Value
              </label>
              <select
                id="value-select"
                value={value}
                onChange={(e) => setValue(e.target.value as 'hybrid' | 'filled' | 'outlined')}
                disabled={loading}
                className="w-full px-4 py-3 text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed bg-white"
              >
                <option value="hybrid">Hybrid</option>
                <option value="filled">Filled</option>
                <option value="outlined">Outlined</option>
              </select>
            </div>
            <div>
              <label htmlFor="font-select" className="block text-sm font-medium text-neutral-700 mb-2">
                Font
              </label>
              <select
                id="font-select"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as 'Inter' | 'Lora' | 'Larken')}
                disabled={loading}
                className="w-full px-4 py-3 text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed bg-white"
              >
                <option value="Inter">Inter</option>
                <option value="Lora">Lora</option>
                <option value="Larken">Larken</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="flex-1 sm:flex-none px-6 py-3 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Logo'
              )}
            </button>
            <button
              onClick={() => handleDownload()}
              disabled={!currentLogo || loading}
              className="flex-1 sm:flex-none px-6 py-3 bg-white text-neutral-700 font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Download SVG
            </button>
          </div>

          {/* Progress Bar */}
          {(loading || stage !== 'Idle') && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-600 font-medium">
                  {stage === 'Idle' ? 'Ready' : stage === 'Done' ? 'Complete' : `${stage}…`}
                </span>
                {progress > 0 && (
                  <span className="text-xs text-neutral-500">{Math.round(progress)}%</span>
                )}
              </div>
              <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral-900 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Line */}
          <div className="min-h-[24px]">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            {!loading && !error && currentLogo && stage === 'Idle' && (
              <p className="text-sm text-green-700" role="status" aria-live="polite">
                Logo generated successfully
              </p>
            )}
          </div>
        </div>

        {/* Preview Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 sm:p-10 mb-6">
          {/* Preview Section - Show Icon OR Lockup (not both) */}
          <div className="mb-6">
            {businessName.trim() ? (
              // Lockup Preview
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Lockup Preview</h2>
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-8 sm:p-12 flex items-center justify-center">
                  {framedLockupPng ? (
                    <img 
                      src={framedLockupPng}
                      alt="Lockup"
                      className="border border-neutral-200 rounded-xl bg-white"
                      style={{
                        width: '320px',
                        height: '320px',
                        maxWidth: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div className="border border-neutral-200 rounded-xl bg-white flex items-center justify-center" style={{ width: '320px', height: '320px' }}>
                      <p className="text-neutral-400 text-sm">Generating lockup...</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Icon Preview
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Icon Preview</h2>
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-8 sm:p-12 flex items-center justify-center">
                  {iconPngBase64 ? (
                    <div
                      className="relative overflow-hidden rounded-xl bg-white border border-neutral-200 w-full max-w-[420px] aspect-square flex items-center justify-center"
                      style={{ background: '#fff' }}
                    >
                      <img 
                        src={iconPngBase64} 
                        alt="Generated Icon" 
                        className="w-full h-auto"
                      />
                    </div>
                  ) : (
                    <div className="text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-neutral-400 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-neutral-500 text-sm">No preview yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Download Buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => handleDownload()}
              disabled={!currentLogo || loading}
              className="flex-1 sm:flex-none px-4 py-2 bg-white text-neutral-700 font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Download Icon SVG
            </button>
            {businessName.trim() && lockupPng && (
              <button
                onClick={handleDownloadLockupPng}
                disabled={loading}
                className="flex-1 sm:flex-none px-4 py-2 bg-white text-neutral-700 font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Download Lockup PNG
              </button>
            )}
          </div>
          
        </div>

      </div>

    </main>
  );
}
