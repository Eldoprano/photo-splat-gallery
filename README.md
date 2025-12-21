# Photo Splat Gallery

A nice and vibe coded 3D Gaussian Splat viewer built with React, TypeScript, and Three.js using the [@sparkjsdev/spark](https://github.com/sparkjsdev/spark) renderer.

## 🌐 Live Demo

**[View the Gallery →](https://eldoprano.github.io/photo-splat-gallery/)**

## Features

- 📷 View Gaussian Splats in an interactive 3D gallery
- 🎮 Smooth navigation with WASD fly controls + mouse orbit
- 🔮 Reveal animation when loading splats
- 🥽 AR mode support (WebXR on **Android only** - see below)
- 📱 Lenticular postcard effect on mobile using device sensors
- ⚡ Compressed `.spz` format for fast loading

> **⚠️ iOS Note:** Safari on iPhone/iPad does **not** support WebXR AR sessions.
> The AR feature only works on Android with Chrome/Edge. This is an Apple platform limitation.

## Tech Stack

- React 19 + TypeScript
- Three.js + [@sparkjsdev/spark](https://github.com/sparkjsdev/spark)
- Vite
- TailwindCSS
- Express (for local development server)

## Local Development

```bash
# Install dependencies
npm install

# Start the full development stack (with API server)
./scripts/start.sh

# Or just run the frontend
npm run dev
```

## Creating Your Own Splats

This gallery displays pre-generated 3D Gaussian Splats. To create your own splats from photos:

1. Use a tool like [ml-sharp](https://github.com/eldoprano/ml-sharp) or other Gaussian Splatting software
2. Export as `.ply` format
3. Place the `.ply` files in `public/splats/`
4. Run `node scripts/compress_spark.js` to compress to `.spz` format
5. Run `./scripts/start.sh` to generate thumbnails and start the server

> **Note:** The 2D-to-splat conversion is not included in this repository.

## Adding Splats to the Gallery

1. Add your `.ply` files to `public/splats/`
2. Compress them: `node scripts/compress_spark.js`
3. Generate thumbnails by running the server and using Puppeteer screenshot automation
4. For manual thumbnails, use the camera button in the viewer to set a default view

## Project Structure

```
public/
├── splats/              # Original .ply files (not committed to git)
├── splats-compressed/   # Compressed .spz files (deployed)
├── thumbnails/          # Gallery thumbnails
└── configs/             # Saved camera positions
scripts/
├── start.sh             # Full development stack
├── api-server.cjs       # Express API server
├── preview-server.cjs   # Static file server
└── compress_spark.js    # PLY to SPZ compression
```

## License

MIT
