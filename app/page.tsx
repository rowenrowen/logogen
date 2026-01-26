'use client';

import { useState, useEffect } from 'react';


interface GalleryItem {
  svg: string;
  spec: any | null;
  prompt: string;
  style: string;
  palette: string;
  shape: string;
  value?: 'hybrid' | 'filled' | 'outlined';
  createdAt: string;
}

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

const STORAGE_KEY = 'logoGallery';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'minimal' | 'balanced' | 'intricate'>('balanced');
  const [palette, setPalette] = useState<'any' | 'monochrome' | 'warm' | 'cool' | 'complementary' | 'analogous' | 'earth' | 'pastel' | 'neon' | 'black_white'>('any');
  const [shape, setShape] = useState<'any' | 'circle' | 'square' | 'roundedSquare' | 'pill' | 'hex' | 'shield'>('any');
  const [value, setValue] = useState<'hybrid' | 'filled' | 'outlined'>('hybrid');
  const [fontFamily, setFontFamily] = useState<'Inter' | 'Lora' | 'Larken'>('Inter');
  const [businessName, setBusinessName] = useState('');
  const [currentLogo, setCurrentLogo] = useState<CurrentLogo | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'Idle' | 'Generating icon' | 'Checking background' | 'Checking text' | 'Vectorizing' | 'Done'>('Idle');
  const [svg, setSvg] = useState<string | null>(null);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [lockupSvg, setLockupSvg] = useState<string | null>(null);
  const [lockupSvgUrl, setLockupSvgUrl] = useState<string | null>(null);
  const [lockupHorizontalSvg, setLockupHorizontalSvg] = useState<string | null>(null);
  const [lockupHorizontalSvgUrl, setLockupHorizontalSvgUrl] = useState<string | null>(null);
  const [lockupStackedSvg, setLockupStackedSvg] = useState<string | null>(null);
  const [lockupStackedSvgUrl, setLockupStackedSvgUrl] = useState<string | null>(null);
  const [pngBase64, setPngBase64] = useState<string | null>(null);
  const [meta, setMeta] = useState<any | null>(null);
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [svgLen, setSvgLen] = useState<number>(0);
  const [svgImgFailed, setSvgImgFailed] = useState<boolean>(false);
  const [lockupImgFailed, setLockupImgFailed] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<'icon' | 'lockup'>('icon');
  const [lockupVariant, setLockupVariant] = useState<'horizontal' | 'stacked'>('horizontal');
  const [showLockupDebug, setShowLockupDebug] = useState<boolean>(false);
  const [lockupDebug, setLockupDebug] = useState<any | null>(null);

  // Load gallery from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setGallery(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load gallery from localStorage:', err);
    }
  }, []);

  // Save gallery to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery));
    } catch (err) {
      console.error('Failed to save gallery to localStorage:', err);
    }
  }, [gallery]);

  // Create Blob URL for SVG and cleanup on change
  useEffect(() => {
    if (!svg) {
      setSvgUrl(null);
      setSvgLen(0);
      setSvgImgFailed(false);
      return;
    }
    // Ensure we have the full SVG string
    const fullSvg = typeof svg === 'string' ? svg : '';
    if (!fullSvg) {
      setSvgUrl(null);
      setSvgLen(0);
      setSvgImgFailed(false);
      return;
    }
    
    // Reset img failed flag when SVG changes
    setSvgImgFailed(false);
    
    try {
      const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setSvgUrl(url);
      setSvgLen(fullSvg.length);
      return () => URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create Blob URL for SVG:', err);
      setSvgUrl(null);
      setSvgLen(fullSvg.length);
      setSvgImgFailed(true);
    }
  }, [svg]);

  // Create Blob URL for horizontal lockup SVG and cleanup on change
  useEffect(() => {
    if (!lockupHorizontalSvg) {
      setLockupHorizontalSvgUrl(null);
      return;
    }
    const fullSvg = typeof lockupHorizontalSvg === 'string' ? lockupHorizontalSvg : '';
    if (!fullSvg) {
      setLockupHorizontalSvgUrl(null);
      return;
    }
    
    try {
      const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setLockupHorizontalSvgUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create Blob URL for horizontal lockup SVG:', err);
      setLockupHorizontalSvgUrl(null);
    }
  }, [lockupHorizontalSvg]);

  // Create Blob URL for stacked lockup SVG and cleanup on change
  useEffect(() => {
    if (!lockupStackedSvg) {
      setLockupStackedSvgUrl(null);
      return;
    }
    const fullSvg = typeof lockupStackedSvg === 'string' ? lockupStackedSvg : '';
    if (!fullSvg) {
      setLockupStackedSvgUrl(null);
      return;
    }
    
    try {
      const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setLockupStackedSvgUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create Blob URL for stacked lockup SVG:', err);
      setLockupStackedSvgUrl(null);
    }
  }, [lockupStackedSvg]);

  // Create Blob URL for lockup SVG (backward compatibility) and cleanup on change
  useEffect(() => {
    if (!lockupSvg) {
      setLockupSvgUrl(null);
      setLockupImgFailed(false);
      return;
    }
    // Ensure we have the full SVG string
    const fullLockupSvg = typeof lockupSvg === 'string' ? lockupSvg : '';
    if (!fullLockupSvg) {
      setLockupSvgUrl(null);
      setLockupImgFailed(false);
      return;
    }
    
    // Reset img failed flag when lockup SVG changes
    setLockupImgFailed(false);
    
    try {
      const blob = new Blob([fullLockupSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setLockupSvgUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create Blob URL for lockup SVG:', err);
      setLockupSvgUrl(null);
      setLockupImgFailed(true);
    }
  }, [lockupSvg]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentLogo(null);
    setSaveMessage(null);
        setSvg(null);
        setSvgUrl(null);
        setLockupSvg(null);
        setLockupSvgUrl(null);
        setLockupHorizontalSvg(null);
        setLockupHorizontalSvgUrl(null);
        setLockupStackedSvg(null);
        setLockupStackedSvgUrl(null);
        setPngBase64(null);
        setMeta(null);
        setRawJson(null);
        setSvgLen(0);
        setSvgImgFailed(false);
        setLockupImgFailed(false);
        setPreviewTab('icon');
        setLockupVariant('horizontal');
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
      // Collect existing gallery SVGs for similarity screening
      const gallerySvgs = gallery.map(item => item.svg);

      const payload = {
        prompt,
        style,
        palette,
        shape,
        value,
        businessName: businessName.trim() || undefined,
        fontFamily,
        gallerySvgs,
      };
      
      console.log("GENERATE PAYLOAD", payload);

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
      
      setProgress(70);
      setStage('Vectorizing');

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
      
      // Store raw JSON for debugging (full response)
      setRawJson(data);

      // Check if request failed
      if (!data.ok) {
        const errorMsg = data.error || data.lastFailureReason || 'Failed to generate logo';
        setError(errorMsg);
        setSvg(null);
        setSvgUrl(null);
        setLockupSvg(null);
        setLockupSvgUrl(null);
        setLockupHorizontalSvg(null);
        setLockupHorizontalSvgUrl(null);
        setLockupStackedSvg(null);
        setLockupStackedSvgUrl(null);
        setPngBase64(null);
        setMeta(null);
        setSvgLen(0);
        setLockupImgFailed(false);
        setLockupVariant('horizontal');
        throw new Error(errorMsg);
      }

      // Store FULL SVG and PNG base64 with type checking
      const fullSvg = typeof data.svg === 'string' ? data.svg : null;
      const fullLockupSvg = typeof data.lockupSvg === 'string' ? data.lockupSvg : null;
      const fullLockupHorizontalSvg = typeof data.lockupHorizontalSvg === 'string' ? data.lockupHorizontalSvg : null;
      const fullLockupStackedSvg = typeof data.lockupStackedSvg === 'string' ? data.lockupStackedSvg : null;
      const fullPngBase64 = typeof data.pngBase64 === 'string' ? data.pngBase64 : null;
      
      setSvg(fullSvg);
      setLockupSvg(fullLockupSvg);
      setLockupHorizontalSvg(fullLockupHorizontalSvg);
      setLockupStackedSvg(fullLockupStackedSvg);
      setPngBase64(fullPngBase64);
      
      // Switch to lockup tab if lockup exists, otherwise stay on icon
      if (fullLockupHorizontalSvg || fullLockupStackedSvg) {
        setPreviewTab('lockup');
        setLockupVariant('horizontal'); // Default to horizontal
      } else {
        setPreviewTab('icon');
      }
      
      if (data.meta) {
        setMeta(data.meta);
      }

      // Validate SVG
      if (!fullSvg || fullSvg.length === 0) {
        throw new Error('Invalid response: SVG is empty or missing');
      }

      // Build logo object using the FULL svg
      const logo: CurrentLogo = {
        svg: fullSvg,
        spec: null, // No spec for image-based generation
        prompt: prompt,
        style: style,
        palette,
        shape: data.meta?.shape || shape,
        value: data.meta?.value || value,
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
      setSvg(null);
      setSvgUrl(null);
        setLockupSvg(null);
        setLockupSvgUrl(null);
        setLockupHorizontalSvg(null);
        setLockupHorizontalSvgUrl(null);
        setLockupStackedSvg(null);
        setLockupStackedSvgUrl(null);
        setPngBase64(null);
        setMeta(null);
        setSvgLen(0);
        setLockupImgFailed(false);
        setPreviewTab('icon');
        setLockupVariant('horizontal');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (svgContent?: string) => {
    const svgToDownload = svgContent || currentLogo?.svg;
    if (!svgToDownload) return;

    const blob = new Blob([svgToDownload], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logo.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadLockup = (variant: 'horizontal' | 'stacked') => {
    const svgToDownload = variant === 'horizontal' ? lockupHorizontalSvg : lockupStackedSvg;
    if (!svgToDownload) return;

    const blob = new Blob([svgToDownload], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logo-lockup-${variant}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToGallery = () => {
    if (!currentLogo) return;

    // Check for duplicates
    const isDuplicate = gallery.some(item => item.svg === currentLogo.svg);
    if (isDuplicate) {
      setSaveMessage('Already saved');
      setTimeout(() => setSaveMessage(null), 2000);
      return;
    }

    // Add to gallery
    const newItem: GalleryItem = { ...currentLogo };
    setGallery(prev => [...prev, newItem]);
    setSaveMessage('Saved to gallery');
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleDeleteFromGallery = (index: number) => {
    setGallery(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearGallery = () => {
    if (gallery.length === 0) return;
    if (confirm(`Are you sure you want to delete all ${gallery.length} saved logos?`)) {
      setGallery([]);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && prompt.trim()) {
      handleGenerate();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unknown date';
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
            <button
              onClick={handleSaveToGallery}
              disabled={!currentLogo || loading}
              className="flex-1 sm:flex-none px-6 py-3 bg-white text-neutral-700 font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save to Gallery
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
            {saveMessage && (
              <p className="text-sm text-blue-700" role="status" aria-live="polite">
                {saveMessage}
              </p>
            )}
          </div>
        </div>

        {/* Preview Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 sm:p-10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Preview</h2>
            {lockupSvg && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewTab('icon')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    previewTab === 'icon'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Icon
                </button>
                <button
                  onClick={() => setPreviewTab('lockup')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    previewTab === 'lockup'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Lockup
                </button>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-8 sm:p-12 flex items-center justify-center">
            {previewTab === 'icon' ? (
              // Icon Preview
              svgUrl && !svgImgFailed ? (
                <div
                  className="svgCanvas relative overflow-hidden rounded-xl bg-white border border-neutral-200 w-full max-w-[420px] aspect-square flex items-center justify-center"
                  style={{ background: '#fff' }}
                >
                  <img 
                    src={svgUrl} 
                    alt="Generated SVG" 
                    className="w-full h-auto"
                    onError={(e) => {
                      console.error('SVG image failed to load', e);
                      setSvgImgFailed(true);
                    }}
                  />
                </div>
              ) : svg && svgImgFailed ? (
                <div
                  className="svgCanvas relative overflow-hidden rounded-xl bg-white border border-neutral-200 w-full max-w-[420px] aspect-square flex items-center justify-center"
                  style={{ background: '#fff' }}
                >
                  <div 
                    className="w-full h-full"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </div>
              ) : svg && svgLen > 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    SVG present ({svgLen} chars) but preview failed — likely invalid SVG markup.
                  </p>
                </div>
              ) : pngBase64 ? (
                <div
                  className="svgCanvas relative overflow-hidden rounded-xl bg-white border border-neutral-200 w-full max-w-[420px] aspect-square flex items-center justify-center"
                  style={{ background: '#fff' }}
                >
                  <img 
                    src={`data:image/png;base64,${pngBase64}`} 
                    alt="Generated PNG" 
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
              )
            ) : (
              // Lockup Preview
              (lockupHorizontalSvg || lockupStackedSvg) ? (
                <div className="w-full space-y-4">
                  {/* Variant Toggle */}
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setLockupVariant('horizontal')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        lockupVariant === 'horizontal'
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      Horizontal
                    </button>
                    <button
                      onClick={() => setLockupVariant('stacked')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        lockupVariant === 'stacked'
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      Stacked
                    </button>
                  </div>
                  
                  {/* Lockup Preview */}
                  {lockupVariant === 'horizontal' ? (
                    lockupHorizontalSvgUrl ? (
                      <div
                        className="svgCanvas relative rounded-xl bg-white border-2 border-blue-500 w-full max-w-[800px] mx-auto flex items-center justify-center"
                        style={{ background: '#fff', overflow: 'visible' }}
                      >
                        <img 
                          src={lockupHorizontalSvgUrl} 
                          alt="Horizontal Lockup SVG" 
                          style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}
                        />
                      </div>
                    ) : lockupHorizontalSvg ? (
                      <div
                        className="svgCanvas relative rounded-xl bg-white border-2 border-blue-500 w-full max-w-[800px] mx-auto flex items-center justify-center"
                        style={{ background: '#fff', overflow: 'visible' }}
                      >
                        <div 
                          style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}
                          dangerouslySetInnerHTML={{ __html: lockupHorizontalSvg }}
                        />
                      </div>
                    ) : null
                  ) : (
                    lockupStackedSvgUrl ? (
                      <div
                        className="svgCanvas relative rounded-xl bg-white border-2 border-blue-500 w-full max-w-[600px] mx-auto flex items-center justify-center"
                        style={{ background: '#fff', overflow: 'visible' }}
                      >
                        <img 
                          src={lockupStackedSvgUrl} 
                          alt="Stacked Lockup SVG" 
                          style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}
                        />
                      </div>
                    ) : lockupStackedSvg ? (
                      <div
                        className="svgCanvas relative rounded-xl bg-white border-2 border-blue-500 w-full max-w-[600px] mx-auto flex items-center justify-center"
                        style={{ background: '#fff', overflow: 'visible' }}
                      >
                        <div 
                          style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}
                          dangerouslySetInnerHTML={{ __html: lockupStackedSvg }}
                        />
                      </div>
                    ) : null
                  )}
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
                  <p className="text-neutral-500 text-sm">No lockup preview available</p>
                </div>
              )
            )}
          </div>
          
          {/* Debug Panel */}
          {(lockupHorizontalSvg || lockupStackedSvg) && (
            <div className="mt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowLockupDebug(v => !v);
                }}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                {showLockupDebug ? 'Hide' : 'Show'} debug
              </button>
              {showLockupDebug && (
                <div className="mt-4 p-4 bg-neutral-50 border-2 border-red-500 rounded-lg text-sm">
                  <h3 className="text-2xl font-bold text-red-600 mb-4">DEBUG ENABLED</h3>
                  <div className="mb-3 space-y-2">
                    <div>
                      <strong>businessName:</strong> {businessName || '(empty)'}
                    </div>
                    <div>
                      <strong>selectedFontFamily:</strong> {fontFamily}
                    </div>
                    <div>
                      <strong>Rendering SVG field:</strong> lockup{lockupVariant === 'horizontal' ? 'Horizontal' : 'Stacked'}Svg
                    </div>
                    <div>
                      <strong>Available SVGs:</strong>
                      <ul className="ml-4 list-disc">
                        <li>iconSvg: {svg ? '✓ present' : '✗ null'}</li>
                        <li>lockupSvg: {lockupSvg ? '✓ present' : '✗ null'}</li>
                        <li>lockupHorizontalSvg: {lockupHorizontalSvg ? '✓ present' : '✗ null'}</li>
                        <li>lockupStackedSvg: {lockupStackedSvg ? '✓ present' : '✗ null'}</li>
                      </ul>
                    </div>
                  </div>
                  {lockupDebug && (
                    <div className="mb-3">
                      <strong>Debug Data:</strong>
                      <pre className="mt-2 p-2 bg-white border border-neutral-200 rounded text-xs overflow-auto max-h-64">
                        {JSON.stringify(lockupDebug, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <strong>SVG Preview (first 500 chars):</strong>
                    <textarea
                      readOnly
                      value={(lockupVariant === 'horizontal' ? lockupHorizontalSvg : lockupStackedSvg)?.substring(0, 500) || ''}
                      className="mt-2 w-full p-2 bg-white border border-neutral-200 rounded text-xs font-mono"
                      rows={8}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Download Buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => handleDownload()}
              disabled={!currentLogo || loading}
              className="flex-1 sm:flex-none px-4 py-2 bg-white text-neutral-700 font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Download Icon SVG
            </button>
            {lockupHorizontalSvg && (
              <button
                onClick={() => handleDownloadLockup('horizontal')}
                disabled={loading}
                className="flex-1 sm:flex-none px-4 py-2 bg-white text-neutral-700 font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Download Horizontal Lockup
              </button>
            )}
            {lockupStackedSvg && (
              <button
                onClick={() => handleDownloadLockup('stacked')}
                disabled={loading}
                className="flex-1 sm:flex-none px-4 py-2 bg-white text-neutral-700 font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Download Stacked Lockup
              </button>
            )}
          </div>
          
          {/* Debug Block */}
          {(rawJson || svgLen > 0 || pngBase64) && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="p-3 bg-neutral-50 rounded-lg space-y-2">
                <p className="text-xs font-medium text-neutral-700">Debug Info</p>
                
                {/* Status */}
                <div className="text-xs text-neutral-600">
                  <span className="font-medium">Status:</span>{' '}
                  <span className={rawJson?.ok ? 'text-green-700' : 'text-red-700'}>
                    {rawJson?.ok ? 'OK' : 'FAILED'}
                  </span>
                </div>

                {/* SVG Length */}
                <div className="text-xs text-neutral-600">
                  <span className="font-medium">SVG Length:</span> {svgLen} chars
                </div>

                {/* SVG Preview (first 400 chars - truncated for display only) */}
                {svg && (
                  <div className="text-xs text-neutral-600">
                    <span className="font-medium">SVG Preview (first 400 chars):</span>
                    <pre className="mt-1 p-2 bg-white rounded border border-neutral-200 overflow-auto max-h-20 text-[10px] font-mono">
                      {svg.slice(0, 400)}
                      {svg.length > 400 ? '…' : ''}
                    </pre>
                  </div>
                )}

                {/* PNG Thumbnail */}
                {pngBase64 && (
                  <div className="text-xs text-neutral-600">
                    <span className="font-medium">Original PNG:</span>
                    <div className="mt-1">
                      <img
                        src={`data:image/png;base64,${pngBase64}`}
                        alt="Original generated PNG"
                        className="max-w-[200px] h-auto rounded border border-neutral-200"
                      />
                    </div>
                  </div>
                )}

                {/* Full JSON (collapsible) */}
                {rawJson && (
                  <details className="mt-2">
                    <summary className="text-xs text-neutral-600 cursor-pointer hover:text-neutral-900">
                      Show full JSON response
                    </summary>
                    <pre className="mt-2 text-xs text-neutral-700 overflow-auto max-h-64 bg-white p-2 rounded border border-neutral-200 font-mono">
                      {JSON.stringify(rawJson, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Error Display (if ok=false) */}
          {rawJson && !rawJson.ok && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <p className="text-sm font-medium text-red-900 mb-1">Generation Failed</p>
              <p className="text-sm text-red-800">
                {rawJson.error || rawJson.lastFailureReason || 'Unknown error'}
              </p>
              {rawJson.attempts && (
                <p className="text-xs text-red-700 mt-1">
                  Attempts: {rawJson.attempts}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Gallery Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 sm:p-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-900">
              Gallery {gallery.length > 0 && `(${gallery.length})`}
            </h2>
            {gallery.length > 0 && (
              <button
                onClick={handleClearGallery}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Clear Gallery
              </button>
            )}
          </div>

          {gallery.length === 0 ? (
            <div className="text-center py-12">
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
              <p className="text-neutral-500 text-sm">No saved logos yet. Generate and save a logo to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gallery.map((item, index) => (
                <div
                  key={index}
                  className="border border-neutral-200 rounded-lg p-4 bg-neutral-50 hover:bg-white transition-colors"
                >
                  {/* SVG Preview */}
                  <div className="svgCanvas relative overflow-hidden rounded-lg bg-white border border-neutral-200 mb-3 w-full aspect-square">
                    <div
                      dangerouslySetInnerHTML={{ __html: item.svg }}
                      role="img"
                      aria-label={`Logo preview: ${item.prompt}`}
                    />
                  </div>

                  {/* Metadata */}
                  <div className="mb-3 space-y-1">
                    <p className="text-sm font-medium text-neutral-900 truncate" title={item.prompt}>
                      {item.prompt}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <span className="capitalize">{item.style || 'balanced'}</span>
                      <span>•</span>
                      <span className="capitalize">{item.palette || 'any'}</span>
                      {item.value && item.value !== 'hybrid' && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{item.value}</span>
                        </>
                      )}
                      {(item.shape && item.shape !== 'any') && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{item.shape}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">{formatDate(item.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(item.svg)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 transition-colors"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDeleteFromGallery(index)}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
                      aria-label="Delete logo"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
