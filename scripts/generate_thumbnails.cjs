const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration - works with the production build served by "npx serve dist"
const SPLATS_DIR = path.join(__dirname, '../public/splats');
const THUMBS_DIR_PUBLIC = path.join(__dirname, '../public/thumbnails');
const THUMBS_DIR_DIST = path.join(__dirname, '../dist/thumbnails');
const URL_BASE = 'http://localhost:3000'; // Production build served by npx serve dist

// Create both thumbnail directories
if (!fs.existsSync(THUMBS_DIR_PUBLIC)) {
    fs.mkdirSync(THUMBS_DIR_PUBLIC, { recursive: true });
}
if (!fs.existsSync(THUMBS_DIR_DIST)) {
    fs.mkdirSync(THUMBS_DIR_DIST, { recursive: true });
}

async function run() {
    console.log('Starting Thumbnail Generation...');
    console.log('Make sure "npx serve dist" is running on port 3000');

    const browser = await puppeteer.launch({
        headless: false, // Use non-headless for WebGL support
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--enable-webgl',
            '--use-gl=swiftshader', // Software WebGL rendering
            '--enable-accelerated-2d-canvas',
            '--ignore-gpu-blocklist'
        ]
    });
    const page = await browser.newPage();

    // Set viewport to standard thumbnail size (aspect ratio 16:9)
    await page.setViewport({ width: 1280, height: 720 });

    const files = fs.readdirSync(SPLATS_DIR).filter(file => file.endsWith('.ply'));
    console.log(`Found ${files.length} PLY files to process`);

    for (const file of files) {
        const splatUrl = `/splats/${file}`;
        const thumbName = file.replace('.ply', '.jpg');
        const thumbPathPublic = path.join(THUMBS_DIR_PUBLIC, thumbName);
        const thumbPathDist = path.join(THUMBS_DIR_DIST, thumbName);

        if (fs.existsSync(thumbPathPublic) && fs.existsSync(thumbPathDist)) {
            console.log(`Skipping existing thumbnail: ${thumbName}`);
            continue;
        }

        console.log(`Processing: ${file}`);
        const pageUrl = `${URL_BASE}/?splat=${encodeURIComponent(splatUrl)}`;

        try {
            await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait for splat to load and render
            console.log('  Waiting for splat to render...');
            await new Promise(resolve => setTimeout(resolve, 8000));

            await page.screenshot({ path: thumbPathPublic, type: 'jpeg', quality: 85 });
            fs.copyFileSync(thumbPathPublic, thumbPathDist);
            console.log(`  Saved thumbnail: ${thumbName}`);
        } catch (err) {
            console.error(`  Failed to process ${file}:`, err.message);
        }
    }

    await browser.close();
    console.log('Thumbnail generation complete.');
}

run();
