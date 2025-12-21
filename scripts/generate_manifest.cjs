const fs = require('fs');
const path = require('path');

const SPLATS_DIR = path.join(__dirname, '..', 'public', 'splats');
const COMPRESSED_DIR = path.join(__dirname, '..', 'public', 'splats-compressed');
const THUMBS_DIR = path.join(__dirname, '..', 'public', 'thumbnails');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'splats.json');

console.log('📦 Generating static splats manifest...');

try {
    const validExtensions = ['.ply', '.splat', '.ksplat', '.spz'];
    const splatMap = new Map(); // Use Map to dedupe by ID

    // Scan original splats directory (if exists)
    if (fs.existsSync(SPLATS_DIR)) {
        fs.readdirSync(SPLATS_DIR)
            .filter(f => validExtensions.some(ext => f.toLowerCase().endsWith(ext)))
            .forEach(f => {
                const ext = path.extname(f);
                const baseName = path.basename(f, ext);
                splatMap.set(baseName, {
                    id: baseName,
                    filename: f,
                    format: ext.substring(1),
                    hasThumb: fs.existsSync(path.join(THUMBS_DIR, baseName + '.jpg'))
                });
            });
    }

    // Scan compressed splats directory (if exists) - adds entries not in splats/
    if (fs.existsSync(COMPRESSED_DIR)) {
        fs.readdirSync(COMPRESSED_DIR)
            .filter(f => f.toLowerCase().endsWith('.spz'))
            .forEach(f => {
                const baseName = path.basename(f, '.spz');
                // Only add if not already in map (prefer original format)
                if (!splatMap.has(baseName)) {
                    splatMap.set(baseName, {
                        id: baseName,
                        filename: f,
                        format: 'spz',
                        hasThumb: fs.existsSync(path.join(THUMBS_DIR, baseName + '.jpg'))
                    });
                }
            });
    }

    const files = Array.from(splatMap.values());

    if (files.length === 0) {
        console.log('⚠️ No splat files found in splats/ or splats-compressed/');
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(files, null, 2));
    console.log(`✅ Manifest generated with ${files.length} items at ${OUTPUT_FILE}`);
} catch (err) {
    console.error('❌ Error generating manifest:', err.message);
    process.exit(1);
}
