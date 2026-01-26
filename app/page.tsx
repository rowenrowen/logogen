'use client';

import { useState, useEffect, useRef } from 'react';


interface CurrentLogo {
  svg: string;
  spec: any | null;
  prompt: string;
  style: string;
  palette: string;
  shape: string;
  createdAt: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'minimal' | 'balanced' | 'intricate'>('balanced');
  const [shape, setShape] = useState<'any' | 'circle' | 'square' | 'roundedSquare' | 'hex' | 'shield'>('any');
  const [palette, setPalette] = useState<'any' | 'warm' | 'cool' | 'neutral' | 'complementary' | 'pastel' | 'bold'>('any');
  const [businessName, setBusinessName] = useState('');
  
  // Results state
  const [iconPngBase64, setIconPngBase64] = useState<string | null>(null);
  const [lockupInterPng, setLockupInterPng] = useState<string | null>(null);
  const [lockupLoraPng, setLockupLoraPng] = useState<string | null>(null);
  const [lockupLarkenPng, setLockupLarkenPng] = useState<string | null>(null);
  // Store unframed lockups for download
  const [lockupInterUnframed, setLockupInterUnframed] = useState<string | null>(null);
  const [lockupLoraUnframed, setLockupLoraUnframed] = useState<string | null>(null);
  const [lockupLarkenUnframed, setLockupLarkenUnframed] = useState<string | null>(null);
  const [currentLogo, setCurrentLogo] = useState<CurrentLogo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'Idle' | 'Generating icon' | 'Checking background' | 'Checking text' | 'Done'>('Idle');
  const [meta, setMeta] = useState<any | null>(null);

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

  // Generate 3 lockups (Inter/Lora/Larken) when businessName or icon changes
  useEffect(() => {
    if (!businessName.trim() || !iconPngBase64) {
      setLockupInterPng(null);
      setLockupLoraPng(null);
      setLockupLarkenPng(null);
      setLockupInterUnframed(null);
      setLockupLoraUnframed(null);
      setLockupLarkenUnframed(null);
      return;
    }

    const generateLockups = async () => {
      try {
        // Trim white padding from icon
        const trimmedIcon = await trimWhitePaddingFromPng(iconPngBase64);

        // Estimate text height
        const fontSizePx = 36;
        const lineHeight = Math.round(fontSizePx * 1.15);
        const paddingY = 10;
        const estimatedTextH = lineHeight * 1.5 + paddingY * 2;

        // Calculate icon dimensions
        const targetIconH = Math.max(
          estimatedTextH * 2.0,
          Math.min(estimatedTextH * 3.0, estimatedTextH * 2.5)
        );
        const iconScale = targetIconH / trimmedIcon.height;
        const iconW = trimmedIcon.width * iconScale;

        // Max text width is 2x icon width
        const maxTextWidth = iconW * 2;

        // Generate lockups for all 3 fonts
        const fonts: Array<'Inter' | 'Lora' | 'Larken'> = ['Inter', 'Lora', 'Larken'];
        const lockups = await Promise.all(
          fonts.map(async (font) => {
            // Render text to PNG
            const textPng = await renderTextToPng(
              businessName,
              font,
              fontSizePx,
              '#111',
              maxTextWidth
            );

            // Compose stacked lockup
            const lockup = await composeLockup(
              trimmedIcon.dataUrl,
              trimmedIcon.width,
              trimmedIcon.height,
              textPng.dataUrl
            );

            // Frame lockup in square with padding (for preview)
            const framed = await frameToSquare(lockup.dataUrl, 320, 40);
            return { font, framed, unframed: lockup.dataUrl };
          })
        );

        setLockupInterPng(lockups.find(l => l.font === 'Inter')?.framed || null);
        setLockupLoraPng(lockups.find(l => l.font === 'Lora')?.framed || null);
        setLockupLarkenPng(lockups.find(l => l.font === 'Larken')?.framed || null);
        
        // Store unframed for download
        setLockupInterUnframed(lockups.find(l => l.font === 'Inter')?.unframed || null);
        setLockupLoraUnframed(lockups.find(l => l.font === 'Lora')?.unframed || null);
        setLockupLarkenUnframed(lockups.find(l => l.font === 'Larken')?.unframed || null);
      } catch (error) {
        console.error('Failed to generate lockups:', error);
      }
    };

    generateLockups();
  }, [businessName, iconPngBase64]);


  // Helper: Download data URL as file
  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  // Download lockup PNG for a specific font (unframed)
  const handleDownloadLockup = (fontName: 'Inter' | 'Lora' | 'Larken') => {
    const unframedPng = 
      fontName === 'Inter' ? lockupInterUnframed :
      fontName === 'Lora' ? lockupLoraUnframed :
      lockupLarkenUnframed;
    
    if (!unframedPng) return;
    const filename = `${businessName.trim() || 'logo'}-${fontName}.png`;
    downloadDataUrl(unframedPng, filename);
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
    setLockupInterPng(null);
    setLockupLoraPng(null);
    setLockupLarkenPng(null);
    setLockupInterUnframed(null);
    setLockupLoraUnframed(null);
    setLockupLarkenUnframed(null);
    setMeta(null);
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
        businessName: businessName.trim() || undefined,
        fontFamily: 'Inter', // Not used in generation, only for lockups
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
        setLockupInterPng(null);
        setLockupLoraPng(null);
        setLockupLarkenPng(null);
        setLockupInterUnframed(null);
        setLockupLoraUnframed(null);
        setLockupLarkenUnframed(null);
        setMeta(null);
        throw new Error(errorMsg);
      }

      // Store PNG data URL
      const iconPngBase64 = typeof data.iconPngBase64 === 'string' ? data.iconPngBase64 : null;
      
      if (data.metadata) {
        setMeta(data.metadata);
      }

      // Validate PNG
      if (!iconPngBase64 || iconPngBase64.length === 0) {
        throw new Error('Invalid response: PNG is empty or missing');
      }

      // Store icon PNG
      setIconPngBase64(iconPngBase64);

      // Build logo object (PNG-based, SVG generated on demand)
      const logo: CurrentLogo = {
        svg: '', // Will be generated on demand via vectorize endpoint
        spec: null,
        prompt: prompt,
        style: style,
        palette: palette,
        shape: data.metadata?.shape || shape,
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
      setLockupInterPng(null);
      setLockupLoraPng(null);
      setLockupLarkenPng(null);
      setLockupInterUnframed(null);
      setLockupLoraUnframed(null);
      setLockupLarkenUnframed(null);
      setMeta(null);
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
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-1">
            AI Logo Generator
          </h1>
          <p className="text-sm text-zinc-500">Create professional logos with AI</p>
        </div>

        {/* Control Panel Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8 mb-6">
          {/* Form Grid */}
          <div className="space-y-4 mb-6">
            {/* Keywords and Business Name - 2 columns on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Keywords */}
              <div>
                <label htmlFor="prompt-input" className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Logo Keywords
                </label>
                <input
                  id="prompt-input"
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., ocean logo -mountain, sunrise -text"
                  className="w-full h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-zinc-50 disabled:cursor-not-allowed"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-zinc-500">Use -term to exclude concepts</p>
              </div>

              {/* Business Name */}
              <div>
                <label htmlFor="business-name-input" className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Business Name (optional)
                </label>
                <input
                  id="business-name-input"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Acme Corp"
                  className="w-full h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-zinc-50 disabled:cursor-not-allowed"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Style, Shape, Color - 3 columns on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Style */}
              <div>
                <label htmlFor="style-select" className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Style
                </label>
                <select
                  id="style-select"
                  value={style}
                  onChange={(e) => setStyle(e.target.value as 'minimal' | 'balanced' | 'intricate')}
                  disabled={loading}
                  className="w-full h-11 rounded-xl border border-zinc-200 bg-white px-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-zinc-50 disabled:cursor-not-allowed"
                >
                  <option value="minimal">Minimal</option>
                  <option value="balanced">Balanced</option>
                  <option value="intricate">Intricate</option>
                </select>
              </div>

              {/* Shape */}
              <div>
                <label htmlFor="shape-select" className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Shape
                </label>
                <select
                  id="shape-select"
                  value={shape}
                  onChange={(e) => setShape(e.target.value as 'any' | 'circle' | 'square' | 'roundedSquare' | 'hex' | 'shield')}
                  disabled={loading}
                  className="w-full h-11 rounded-xl border border-zinc-200 bg-white px-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-zinc-50 disabled:cursor-not-allowed"
                >
                  <option value="any">Any</option>
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                  <option value="roundedSquare">Rounded Square</option>
                  <option value="hex">Hexagon</option>
                  <option value="shield">Shield</option>
                </select>
              </div>

              {/* Color */}
              <div>
                <label htmlFor="palette-select" className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Color
                </label>
                <select
                  id="palette-select"
                  value={palette}
                  onChange={(e) => setPalette(e.target.value as 'any' | 'warm' | 'cool' | 'neutral' | 'complementary' | 'pastel' | 'bold')}
                  disabled={loading}
                  className="w-full h-11 rounded-xl border border-zinc-200 bg-white px-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-zinc-50 disabled:cursor-not-allowed"
                >
                  <option value="any">Any</option>
                  <option value="warm">Warm</option>
                  <option value="cool">Cool</option>
                  <option value="neutral">Neutral</option>
                  <option value="complementary">Complementary</option>
                  <option value="pastel">Pastel</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              'Generate Logo'
            )}
          </button>

          {/* Progress Bar */}
          {(loading || stage !== 'Idle') && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-600 font-medium">
                  {stage === 'Idle' ? 'Ready' : stage === 'Done' ? 'Complete' : `${stage}…`}
                </span>
                {progress > 0 && (
                  <span className="text-xs text-zinc-500">{Math.round(progress)}%</span>
                )}
              </div>
              <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Line */}
          <div className="mt-4 min-h-[20px]">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl" role="alert">
                <p className="text-xs text-red-800">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Result Card */}
        {iconPngBase64 && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 sm:p-10">
            <h2 className="text-lg font-semibold text-zinc-900 mb-6">Result</h2>

            {businessName.trim() ? (
              /* 3 Lockup Previews */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { font: 'Inter' as const, png: lockupInterPng },
                  { font: 'Lora' as const, png: lockupLoraPng },
                  { font: 'Larken' as const, png: lockupLarkenPng },
                ].map(({ font, png }) => (
                  <div key={font} className="flex flex-col items-center">
                    {/* Preview Frame */}
                    <div className="aspect-square w-full max-w-[320px] rounded-2xl border border-zinc-200 bg-white shadow-inner flex items-center justify-center overflow-hidden mb-3">
                      {png ? (
                        <img
                          src={png}
                          alt={`${font} lockup`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-zinc-400 text-xs">Generating...</div>
                      )}
                    </div>
                    
                    {/* Font Label */}
                    <p className="text-xs font-medium text-zinc-600 mb-2">{font}</p>
                    
                    {/* Download Icon */}
                    <button
                      onClick={() => handleDownloadLockup(font)}
                      disabled={!png}
                      className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={`Download ${font} lockup`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* Single Icon Preview */
              <div className="flex justify-center">
                <div className="aspect-square w-full max-w-[380px] rounded-2xl border border-zinc-200 bg-white shadow-inner flex items-center justify-center overflow-hidden">
                  <img
                    src={iconPngBase64}
                    alt="Generated Icon"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </main>
  );
}
