# VTracer Integration

This app now uses VTracer CLI for PNG→SVG vectorization. VTracer produces much higher quality vectorization than JavaScript libraries.

## Setup

1. **Download VTracer binary** from https://github.com/visioncortex/vtracer/releases
   - macOS: Download `vtracer-macos` or `vtracer-macos-arm64`
   - Linux: Download `vtracer-linux`
   - Windows: Download `vtracer-win.exe`

2. **Place the binary** in the `/bin/` directory:
   ```bash
   # macOS example
   cp ~/Downloads/vtracer-macos bin/vtracer

   # Make executable
   chmod +x bin/vtracer
   ```

3. **Test the binary**:
   ```bash
   ./bin/vtracer --help
   ```

## How It Works

- After generating a PNG with OpenAI, the app calls `vectorizeWithVtracer(pngBuffer)`
- This writes the PNG to a temp file, runs VTracer CLI, reads the SVG output
- The SVG automatically gets a white background rect inserted
- Temp files are cleaned up automatically

## Benefits

- **Better Quality**: VTracer produces smoother curves and better color reproduction
- **No Runtime Issues**: No more JavaScript tracing library problems
- **Stable**: CLI-based approach is more reliable than JS implementations
- **Fast**: Native code is optimized for performance

## Troubleshooting

- **"VTracer binary not found"**: Make sure the binary is in `/bin/vtracer` and executable
- **Permission denied**: Run `chmod +x bin/vtracer`
- **Wrong architecture**: Download the correct binary for your OS/CPU
- **Still not working**: Check that `./bin/vtracer --help` works in terminal

The "mountain logo" should now produce SVGs that look much closer to the original PNG!