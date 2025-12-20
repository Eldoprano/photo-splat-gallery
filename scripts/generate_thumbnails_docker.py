#!/usr/bin/env python3
"""
Gaussian Splat thumbnail generator using gsplat CUDA rasterization.
Run inside nerfstudio Docker container for proper CUDA support.

Usage from host:
docker run --gpus all \
    -v '/home/eldoprano/Projects/photo-splat-gallery:/workspace/' \
    -w /workspace/ \
    --rm -e PYTHONUNBUFFERED=1 \
    docker.io/library/nerfstudio-86 \
    python scripts/generate_thumbnails_docker.py
"""

import torch
import numpy as np
from PIL import Image
from plyfile import PlyData
from pathlib import Path
import gsplat

# Configuration
SPLATS_DIR = Path("/workspace/public/splats")
THUMBS_DIR_PUBLIC = Path("/workspace/public/thumbnails")
THUMBS_DIR_DIST = Path("/workspace/dist/thumbnails")
WIDTH, HEIGHT = 1920, 1080
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Camera settings based on actual splat coordinate analysis:
# Splat bounds: X(-7 to 8), Y(-33 to 3, mean -1.17), Z(2.54 to 90, mean 10.85)
# Camera position: behind splats (Z < 2.54) looking toward them
# Looking at center of splat cloud
CAMERA_POS = np.array([0.0, 0.0, 0.0])  # At origin, behind the splats (Z starts at ~2.5)
CAMERA_LOOKAT = np.array([0.0, -1.0, 10.0])  # Look at center of splat cloud (mean Y=-1.17, mean Z=10.85)
CAMERA_UP = np.array([0.0, -1.0, 0.0])  # Y-down like SplatViewer
FOV = 60  # Standard FOV

# Everforest theme background color (matches website)
BG_COLOR = np.array([43, 51, 57]) / 255.0  # #2b3339


def load_gaussian_splats(filepath):
    """Load Gaussian splat data from PLY file."""
    plydata = PlyData.read(filepath)
    v = plydata['vertex']
    n = len(v['x'])
    
    # Positions (means)
    means = np.stack([np.array(v['x']), np.array(v['y']), np.array(v['z'])], axis=-1)
    
    # Scales (log scale in PLY -> exp)
    try:
        scales = np.exp(np.stack([
            np.array(v['scale_0']),
            np.array(v['scale_1']),
            np.array(v['scale_2'])
        ], axis=-1))
    except ValueError:
        scales = np.ones((n, 3)) * 0.01
    
    # Rotation quaternions [w, x, y, z] - normalize
    try:
        quats = np.stack([
            np.array(v['rot_0']),  # w
            np.array(v['rot_1']),  # x
            np.array(v['rot_2']),  # y
            np.array(v['rot_3'])   # z
        ], axis=-1)
        quats = quats / (np.linalg.norm(quats, axis=1, keepdims=True) + 1e-8)
    except ValueError:
        quats = np.tile([1, 0, 0, 0], (n, 1))
    
    # Colors from spherical harmonics DC component
    C0 = 0.28209479177387814
    try:
        colors = np.stack([
            np.clip(0.5 + np.array(v['f_dc_0']) * C0, 0, 1),
            np.clip(0.5 + np.array(v['f_dc_1']) * C0, 0, 1),
            np.clip(0.5 + np.array(v['f_dc_2']) * C0, 0, 1)
        ], axis=-1)
    except ValueError:
        colors = np.ones((n, 3)) * 0.5
    
    # Opacity (sigmoid activation)
    try:
        opacity = 1 / (1 + np.exp(-np.array(v['opacity'])))
    except ValueError:
        opacity = np.ones(n)
    
    return {
        'means': torch.tensor(means, dtype=torch.float32, device=DEVICE),
        'scales': torch.tensor(scales, dtype=torch.float32, device=DEVICE),
        'quats': torch.tensor(quats, dtype=torch.float32, device=DEVICE),
        'colors': torch.tensor(colors, dtype=torch.float32, device=DEVICE),
        'opacities': torch.tensor(opacity, dtype=torch.float32, device=DEVICE),
    }, n


def build_camera_matrices(pos, lookat, up, fov, width, height):
    """Build view matrix and camera intrinsics for gsplat."""
    # View matrix (world to camera)
    forward = lookat - pos
    forward = forward / np.linalg.norm(forward)
    right = np.cross(forward, up)
    right = right / np.linalg.norm(right)
    up_corrected = np.cross(right, forward)
    
    # Rotation matrix
    R = np.array([right, up_corrected, -forward])
    
    # Translation
    t = -R @ pos
    
    # View matrix 4x4
    viewmat = np.eye(4)
    viewmat[:3, :3] = R
    viewmat[:3, 3] = t
    
    # Camera intrinsics (K matrix)
    fov_rad = np.radians(fov)
    focal = height / (2 * np.tan(fov_rad / 2))
    K = np.array([
        [focal, 0, width / 2],
        [0, focal, height / 2],
        [0, 0, 1]
    ])
    
    return (
        torch.tensor(viewmat, dtype=torch.float32, device=DEVICE).unsqueeze(0),
        torch.tensor(K, dtype=torch.float32, device=DEVICE).unsqueeze(0)
    )


def render_gaussians(splats, viewmat, K, width, height):
    """Render Gaussians using gsplat rasterization."""
    render_colors, render_alphas, info = gsplat.rasterization(
        means=splats['means'],
        quats=splats['quats'],
        scales=splats['scales'],
        opacities=splats['opacities'],
        colors=splats['colors'],
        viewmats=viewmat,
        Ks=K,
        width=width,
        height=height,
        near_plane=0.01,
        far_plane=100.0,
        sh_degree=None,  # Using raw RGB colors, not SH
    )
    
    # render_colors shape: (C, H, W, 3)
    # render_alphas shape: (C, H, W, 1)
    image = render_colors[0].cpu().numpy()
    alpha = render_alphas[0].cpu().numpy()
    
    # Composite with background color
    bg = np.tile(BG_COLOR, (height, width, 1))
    image = image * alpha + bg * (1 - alpha)
    image = (np.clip(image, 0, 1) * 255).astype(np.uint8)
    
    return image


def main():
    print(f"🎨 Gaussian Splat Thumbnail Generator (gsplat CUDA in Docker)")
    print(f"Device: {DEVICE}")
    THUMBS_DIR_PUBLIC.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR_DIST.mkdir(parents=True, exist_ok=True)
    
    # Build camera matrices once
    viewmat, K = build_camera_matrices(CAMERA_POS, CAMERA_LOOKAT, CAMERA_UP, FOV, WIDTH, HEIGHT)
    
    ply_files = list(SPLATS_DIR.glob("*.ply"))
    print(f"Found {len(ply_files)} PLY files")
    
    for ply_file in ply_files:
        thumb_name = ply_file.stem + ".jpg"
        thumb_pub = THUMBS_DIR_PUBLIC / thumb_name
        thumb_dist = THUMBS_DIR_DIST / thumb_name
        
        print(f"  {ply_file.name}...", end=" ", flush=True)
        
        try:
            # Load Gaussian splats
            splats, n_total = load_gaussian_splats(ply_file)
            print(f"({n_total:,} splats)", end=" ", flush=True)
            
            # Render with gsplat
            img_array = render_gaussians(splats, viewmat, K, WIDTH, HEIGHT)
            
            # Save
            img = Image.fromarray(img_array)
            img.save(thumb_pub, quality=90)
            img.save(thumb_dist, quality=90)
            print("✓")
            
            # Clear GPU memory
            del splats
            torch.cuda.empty_cache()
            
        except Exception as e:
            print(f"✗ {e}")
            import traceback
            traceback.print_exc()
    
    print("Done!")


if __name__ == "__main__":
    main()
