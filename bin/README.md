# VTracer Binaries

This directory should contain the VTracer CLI binary for your operating system.

## Download Instructions

1. Go to the [VTracer releases page](https://github.com/visioncortex/vtracer/releases)
2. Download the appropriate binary for your OS:
   - **macOS**: Download `vtracer-macos` or `vtracer-macos-arm64` (depending on your chip)
   - **Linux**: Download `vtracer-linux`
   - **Windows**: Download `vtracer-win.exe`

3. Rename the downloaded file to match these names:
   - macOS: `vtracer-mac`
   - Linux: `vtracer-linux`
   - Windows: `vtracer-win.exe`

4. Place the binary in this directory (`/bin/`)

5. Make sure the binary is executable:
   ```bash
   chmod +x bin/vtracer-mac  # or appropriate filename
   ```

## Usage

The vectorization script will automatically detect your OS and use the correct binary.

## Troubleshooting

- If you get "permission denied" errors, make sure the binary is executable
- If the binary doesn't work, verify you downloaded the correct version for your OS/architecture
- Test by running: `./bin/vtracer-mac --help` (or appropriate filename)