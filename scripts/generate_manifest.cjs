const fs = require('fs');
const path = require('path');

const SPLATS_DIR = path.join(__dirname, '..', 'public', 'splats');
const THUMBS_DIR = path.join(__dirname, '..', 'public', 'thumbnails');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'splats.json');

console.log('📦 Generating static splats manifest...');

try {
    if (!fs.existsSync(SPLATS_DIR)) {
        console.log('⚠️ Splats directory not found, creating empty manifest');
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2));
        process.exit(0);
    }

    const files = fs.readdirSync(SPLATS_DIR)
        .filter(f => f.endsWith('.ply'))
        .map(f => ({
            id: f.replace('.ply', ''),
            filename: f,
            hasThumb: fs.existsSync(path.join(THUMBS_DIR, f.replace('.ply', '.jpg')))
        }));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(files, null, 2));
    console.log(`✅ Manifest generated with ${files.length} items at ${OUTPUT_FILE}`);
} catch (err) {
    console.error('❌ Error generating manifest:', err.message);
    process.exit(1);
}
