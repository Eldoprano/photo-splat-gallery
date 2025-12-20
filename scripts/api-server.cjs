const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

const SPLATS_DIR = path.join(__dirname, '..', 'public', 'splats');
const THUMBS_DIR_PUBLIC = path.join(__dirname, '..', 'public', 'thumbnails');
const THUMBS_DIR_DIST = path.join(__dirname, '..', 'dist', 'thumbnails');

// List all splats
app.get('/api/splats', (req, res) => {
    try {
        const files = fs.readdirSync(SPLATS_DIR)
            .filter(f => f.endsWith('.ply'))
            .map(f => ({
                id: f.replace('.ply', ''),
                filename: f,
                hasThumb: fs.existsSync(path.join(THUMBS_DIR_PUBLIC, f.replace('.ply', '.jpg')))
            }));
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a splat and its thumbnail
app.delete('/api/splats/:id', (req, res) => {
    const id = req.params.id;
    const splatPath = path.join(SPLATS_DIR, `${id}.ply`);
    const thumbPathPublic = path.join(THUMBS_DIR_PUBLIC, `${id}.jpg`);
    const thumbPathDist = path.join(THUMBS_DIR_DIST, `${id}.jpg`);

    const deleted = [];
    const errors = [];

    // Delete splat file
    if (fs.existsSync(splatPath)) {
        try {
            fs.unlinkSync(splatPath);
            deleted.push(splatPath);
        } catch (err) {
            errors.push(`Failed to delete splat: ${err.message}`);
        }
    } else {
        errors.push('Splat file not found');
    }

    // Delete thumbnails
    [thumbPathPublic, thumbPathDist].forEach(thumbPath => {
        if (fs.existsSync(thumbPath)) {
            try {
                fs.unlinkSync(thumbPath);
                deleted.push(thumbPath);
            } catch (err) {
                errors.push(`Failed to delete thumbnail: ${err.message}`);
            }
        }
    });

    if (errors.length === 0) {
        res.json({ success: true, deleted });
    } else if (deleted.length > 0) {
        res.json({ success: true, deleted, warnings: errors });
    } else {
        res.status(400).json({ success: false, errors });
    }
});

app.listen(PORT, () => {
    console.log(`🔧 Splat API server running on http://localhost:${PORT}`);
    console.log('   DELETE /api/splats/:id - Delete a splat and its thumbnail');
    console.log('   GET /api/splats - List all splats');
});
