#!/bin/bash
# Photo Splat Gallery - Startup Script
# Manages splats, thumbnails, builds and serves the gallery

set -e
cd "$(dirname "$0")/.."

echo "🖼️  Photo Splat Gallery - Starting..."
echo ""

# Directories
SPLATS_DIR="public/splats"
THUMBS_DIR="public/thumbnails"

# Step 1: Check for orphan thumbnails (thumbnails without matching .ply)
echo "🔍 Checking for orphan thumbnails..."
orphans=0
for thumb in "$THUMBS_DIR"/*.jpg; do
    [ -e "$thumb" ] || continue
    basename="${thumb##*/}"
    splatname="${basename%.jpg}.ply"
    if [ ! -f "$SPLATS_DIR/$splatname" ]; then
        echo "   Removing orphan: $basename"
        rm "$thumb"
        ((orphans++)) || true
    fi
done
echo "   Removed $orphans orphan thumbnails"

# Step 2: Check for missing thumbnails (splats without thumbnails)
echo "🔍 Checking for missing thumbnails..."
missing=()
for splat in "$SPLATS_DIR"/*.ply; do
    [ -e "$splat" ] || continue
    basename="${splat##*/}"
    thumbname="${basename%.ply}.jpg"
    if [ ! -f "$THUMBS_DIR/$thumbname" ]; then
        missing+=("$basename")
    fi
done

if [ ${#missing[@]} -gt 0 ]; then
    echo "   Found ${#missing[@]} splats without thumbnails:"
    for m in "${missing[@]}"; do
        echo "     - $m"
    done
    echo ""
    echo "🎨 Generating missing thumbnails..."
    
    # Activate venv and run thumbnail generator
    if [ -d ".venv" ]; then
        source .venv/bin/activate
        python scripts/generate_thumbnails.py
        deactivate
    else
        echo "   ⚠️  No .venv found - install dependencies first:"
        echo "      uv venv && uv pip install plyfile pillow numpy"
        exit 1
    fi
else
    echo "   All splats have thumbnails ✓"
fi

# Step 3: Build the app
echo ""
echo "🔨 Building app..."
npm run build

# Step 4: Start the API server (background)
echo ""
echo "🔧 Starting API server on port 3001..."
node scripts/api-server.cjs &
API_PID=$!

# Trap to kill API server on exit
trap "kill $API_PID 2>/dev/null" EXIT

# Step 5: Start the static server
echo ""
echo "🚀 Starting gallery server..."
echo "   Gallery:  http://localhost:3000"
echo "   API:      http://localhost:3001"
echo "   Press Ctrl+C to stop"
echo ""
npx serve dist -l 3000
