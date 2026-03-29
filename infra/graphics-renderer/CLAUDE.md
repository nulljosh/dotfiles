# Graphics Renderer - Claude Notes

## Overview
Software rasterizer / ray tracer in Rust. Renders 3D scenes to PPM/PNG images.

## Stack
Rust, no GPU — pure software rendering

## Build
```bash
cd ~/Documents/Code/graphics-renderer
cargo build --release
cargo run -- scene.txt output.ppm
```

## Scope
- Ray-sphere/plane/triangle intersection
- Phong lighting, shadows, reflections
- Scene file parser
- PPM/PNG output
- BVH acceleration (stretch)
- Real-time rasterizer with framebuffer (stretch)

## Status
Systems/learning project. Done/stable.
