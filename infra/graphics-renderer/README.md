![Graphics Renderer](icon.svg)

# Graphics Renderer

![version](https://img.shields.io/badge/version-v0.1.0-blue)

A software rasterizer / ray tracer in Rust — render 3D scenes to images.

## Scope
- Ray tracer: rays, spheres, planes, triangles
- Phong lighting model
- Shadows and reflections
- PPM/PNG image output
- Scene description file parser
- BVH acceleration (stretch goal)
- Real-time rasterizer with framebuffer (stretch goal)

## Learning Goals
- Linear algebra (vectors, matrices, transforms)
- Ray-object intersection math
- Lighting and shading models
- Spatial acceleration structures
- Image formats and pixel manipulation
- Performance optimization in Rust

## Project Map

```svg
<svg viewBox="0 0 680 420" width="680" height="420" xmlns="http://www.w3.org/2000/svg" style="font-family:monospace;background:#f8fafc;border-radius:12px">
  <rect width="680" height="420" fill="#f8fafc" rx="12"/>
  <text x="340" y="28" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e293b">graphics-renderer — software rasterizer / ray tracer in Rust</text>

  <!-- Root node -->
  <rect x="255" y="45" width="170" height="34" rx="8" fill="#0071e3"/>
  <text x="340" y="67" text-anchor="middle" font-size="11" fill="white">graphics-renderer/</text>

  <!-- Dashed lines from root -->
  <line x1="340" y1="79" x2="160" y2="140" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4,3"/>
  <line x1="340" y1="79" x2="340" y2="140" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4,3"/>
  <line x1="340" y1="79" x2="510" y2="140" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4,3"/>

  <!-- src/ -->
  <rect x="110" y="140" width="100" height="34" rx="6" fill="#6366f1"/>
  <text x="160" y="162" text-anchor="middle" font-size="11" fill="white">src/</text>

  <!-- Cargo.toml -->
  <rect x="290" y="140" width="100" height="34" rx="6" fill="#e0f2fe"/>
  <text x="340" y="157" text-anchor="middle" font-size="11" fill="#0369a1">Cargo.toml</text>
  <text x="340" y="168" text-anchor="middle" font-size="9" fill="#64748b">Rust workspace</text>

  <!-- README / setup -->
  <rect x="460" y="140" width="100" height="34" rx="6" fill="#dcfce7"/>
  <text x="510" y="157" text-anchor="middle" font-size="11" fill="#166534">README.md</text>
  <text x="510" y="168" text-anchor="middle" font-size="9" fill="#64748b">scope + learning goals</text>

  <!-- src/main.rs -->
  <line x1="160" y1="174" x2="160" y2="230" stroke="#94a3b8" stroke-width="1"/>
  <rect x="110" y="230" width="100" height="34" rx="6" fill="#e0e7ff"/>
  <text x="160" y="247" text-anchor="middle" font-size="11" fill="#3730a3">main.rs</text>
  <text x="160" y="258" text-anchor="middle" font-size="9" fill="#64748b">renderer entry point</text>

  <!-- Rendering subsystems -->
  <line x1="160" y1="264" x2="70" y2="320" stroke="#94a3b8" stroke-width="1"/>
  <line x1="160" y1="264" x2="170" y2="320" stroke="#94a3b8" stroke-width="1"/>
  <line x1="160" y1="264" x2="270" y2="320" stroke="#94a3b8" stroke-width="1"/>
  <line x1="160" y1="264" x2="370" y2="320" stroke="#94a3b8" stroke-width="1"/>
  <line x1="160" y1="264" x2="470" y2="320" stroke="#94a3b8" stroke-width="1"/>
  <line x1="160" y1="264" x2="570" y2="320" stroke="#94a3b8" stroke-width="1"/>

  <rect x="20" y="320" width="100" height="40" rx="6" fill="#e0e7ff"/>
  <text x="70" y="337" text-anchor="middle" font-size="10" fill="#3730a3">ray tracer</text>
  <text x="70" y="348" text-anchor="middle" font-size="9" fill="#64748b">rays · spheres</text>
  <text x="70" y="358" text-anchor="middle" font-size="9" fill="#64748b">planes · triangles</text>

  <rect x="120" y="320" width="100" height="40" rx="6" fill="#e0e7ff"/>
  <text x="170" y="337" text-anchor="middle" font-size="10" fill="#3730a3">lighting</text>
  <text x="170" y="348" text-anchor="middle" font-size="9" fill="#64748b">Phong model</text>
  <text x="170" y="358" text-anchor="middle" font-size="9" fill="#64748b">shadows + reflect</text>

  <rect x="220" y="320" width="100" height="40" rx="6" fill="#e0e7ff"/>
  <text x="270" y="337" text-anchor="middle" font-size="10" fill="#3730a3">scene</text>
  <text x="270" y="348" text-anchor="middle" font-size="9" fill="#64748b">file parser</text>
  <text x="270" y="358" text-anchor="middle" font-size="9" fill="#64748b">scene description</text>

  <rect x="320" y="320" width="100" height="40" rx="6" fill="#e0e7ff"/>
  <text x="370" y="337" text-anchor="middle" font-size="10" fill="#3730a3">output</text>
  <text x="370" y="348" text-anchor="middle" font-size="9" fill="#64748b">PPM / PNG</text>
  <text x="370" y="358" text-anchor="middle" font-size="9" fill="#64748b">pixel buffer</text>

  <rect x="420" y="320" width="100" height="40" rx="6" fill="#e0e7ff"/>
  <text x="470" y="337" text-anchor="middle" font-size="10" fill="#3730a3">BVH</text>
  <text x="470" y="348" text-anchor="middle" font-size="9" fill="#64748b">acceleration</text>
  <text x="470" y="358" text-anchor="middle" font-size="9" fill="#64748b">(stretch goal)</text>

  <rect x="520" y="320" width="110" height="40" rx="6" fill="#e0e7ff"/>
  <text x="575" y="337" text-anchor="middle" font-size="10" fill="#3730a3">rasterizer</text>
  <text x="575" y="348" text-anchor="middle" font-size="9" fill="#64748b">framebuffer</text>
  <text x="575" y="358" text-anchor="middle" font-size="9" fill="#64748b">(stretch goal)</text>

  <!-- Tech labels -->
  <text x="340" y="400" text-anchor="middle" font-size="9" fill="#64748b">Rust · linear algebra · ray-object intersection · Phong shading · spatial acceleration</text>
</svg>
```
