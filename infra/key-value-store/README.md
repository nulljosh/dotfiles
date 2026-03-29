![Key-Value Store](icon.svg)

# Key-Value Store

![version](https://img.shields.io/badge/version-v0.1.0-blue)

A persistent key-value database in Rust, inspired by Bitcask/RocksDB.

## Scope
- In-memory hash index with disk-backed log
- Get, set, delete operations
- Log-structured storage with compaction
- Simple TCP server for client access
- Crash recovery from write-ahead log
- Concurrent access (stretch goal)

## Learning Goals
- Log-structured storage engines
- File I/O and serialization in Rust
- Hash indexes and storage trade-offs
- Ownership and borrowing in a real system
- Network programming basics

## Project Map

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 340" width="680" height="340" style="font-family:monospace;background:#f8fafc;border-radius:12px">
  <rect width="680" height="340" rx="12" fill="#f8fafc"/>
  <text x="340" y="28" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e293b">Key-Value Store — Rust Bitcask Structure</text>
  <rect x="240" y="44" width="200" height="32" rx="6" fill="#0071e3" opacity="0.9"/>
  <text x="340" y="65" text-anchor="middle" font-size="11" fill="white" font-weight="bold">key-value-store/ (root)</text>
  <rect x="60" y="118" width="100" height="28" rx="5" fill="#e0f2fe" stroke="#7dd3fc" stroke-width="1"/>
  <text x="110" y="136" text-anchor="middle" font-size="10" fill="#0369a1">Cargo.toml</text>
  <rect x="180" y="118" width="80" height="28" rx="5" fill="#6366f1" opacity="0.85"/>
  <text x="220" y="136" text-anchor="middle" font-size="10" fill="white">src/</text>
  <rect x="280" y="118" width="90" height="28" rx="5" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
  <text x="325" y="136" text-anchor="middle" font-size="10" fill="#166534">CLAUDE.md</text>
  <rect x="390" y="118" width="90" height="28" rx="5" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
  <text x="435" y="136" text-anchor="middle" font-size="10" fill="#166534">README.md</text>
  <rect x="500" y="118" width="80" height="28" rx="5" fill="#e0f2fe" stroke="#7dd3fc" stroke-width="1"/>
  <text x="540" y="136" text-anchor="middle" font-size="10" fill="#0369a1">setup.md</text>
  <line x1="340" y1="76" x2="110" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="340" y1="76" x2="220" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="340" y1="76" x2="325" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="340" y1="76" x2="435" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="340" y1="76" x2="540" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <rect x="140" y="190" width="90" height="28" rx="5" fill="#e0e7ff" stroke="#818cf8" stroke-width="1"/>
  <text x="185" y="208" text-anchor="middle" font-size="10" fill="#3730a3">main.rs</text>
  <rect x="250" y="190" width="90" height="28" rx="5" fill="#e0e7ff" stroke="#818cf8" stroke-width="1"/>
  <text x="295" y="208" text-anchor="middle" font-size="10" fill="#3730a3">storage.rs</text>
  <rect x="350" y="190" width="90" height="28" rx="5" fill="#e0e7ff" stroke="#818cf8" stroke-width="1"/>
  <text x="395" y="208" text-anchor="middle" font-size="10" fill="#3730a3">index.rs</text>
  <line x1="220" y1="146" x2="185" y2="190" stroke="#818cf8" stroke-width="1.5"/>
  <line x1="220" y1="146" x2="295" y2="190" stroke="#818cf8" stroke-width="1.5"/>
  <line x1="220" y1="146" x2="395" y2="190" stroke="#818cf8" stroke-width="1.5"/>
  <rect x="80" y="270" width="520" height="28" rx="5" fill="#fef3c7" stroke="#fbbf24" stroke-width="1"/>
  <text x="340" y="288" text-anchor="middle" font-size="10" fill="#92400e">Bitcask-style persistent KV store in Rust — append-only log + in-memory index</text>
</svg>
```

## Project Map

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 420" width="680" height="420" style="font-family:monospace;background:#f8fafc;border-radius:12px">
  <rect width="680" height="420" rx="12" fill="#f8fafc"/>
  <text x="340" y="28" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e293b">key-value-store — File Structure</text>
  <rect x="240" y="44" width="200" height="32" rx="6" fill="#0071e3" opacity="0.9"/>
  <text x="340" y="65" text-anchor="middle" font-size="11" fill="white" font-weight="bold">key-value-store/ (root)</text>
  <rect x="160" y="118" width="100" height="28" rx="5" fill="#e0f2fe" stroke="#7dd3fc" stroke-width="1"/>
  <text x="210" y="136" text-anchor="middle" font-size="10" fill="#0369a1">Cargo.toml</text>
  <rect x="270" y="118" width="80" height="28" rx="5" fill="#6366f1" opacity="0.85"/>
  <text x="310" y="136" text-anchor="middle" font-size="10" fill="white">src/</text>
  <rect x="360" y="118" width="80" height="28" rx="5" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
  <text x="400" y="136" text-anchor="middle" font-size="10" fill="#166534">README.md</text>
  <rect x="450" y="118" width="80" height="28" rx="5" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
  <text x="490" y="136" text-anchor="middle" font-size="10" fill="#166534">setup.md</text>
  <line x1="340" y1="76" x2="210" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="340" y1="76" x2="310" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="340" y1="76" x2="400" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="340" y1="76" x2="490" y2="118" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,2"/>
  <rect x="220" y="200" width="80" height="28" rx="5" fill="#e0e7ff" stroke="#818cf8" stroke-width="1"/>
  <text x="260" y="218" text-anchor="middle" font-size="10" fill="#3730a3">main.rs</text>
  <rect x="310" y="200" width="80" height="28" rx="5" fill="#e0e7ff" stroke="#818cf8" stroke-width="1"/>
  <text x="350" y="218" text-anchor="middle" font-size="10" fill="#3730a3">store.rs</text>
  <rect x="400" y="200" width="80" height="28" rx="5" fill="#e0e7ff" stroke="#818cf8" stroke-width="1"/>
  <text x="440" y="218" text-anchor="middle" font-size="10" fill="#3730a3">disk.rs</text>
  <line x1="310" y1="146" x2="260" y2="200" stroke="#818cf8" stroke-width="1.5"/>
  <line x1="310" y1="146" x2="350" y2="200" stroke="#818cf8" stroke-width="1.5"/>
  <line x1="310" y1="146" x2="440" y2="200" stroke="#818cf8" stroke-width="1.5"/>
  <rect x="160" y="310" width="360" height="40" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
  <text x="340" y="335" text-anchor="middle" font-size="10" fill="#64748b">Bitcask-style persistent KV store · Rust</text>
  <rect x="20" y="368" width="12" height="12" rx="2" fill="#6366f1"/>
  <text x="38" y="379" font-size="9" fill="#64748b">Rust source</text>
  <rect x="120" y="368" width="12" height="12" rx="2" fill="#e0f2fe" stroke="#7dd3fc" stroke-width="1"/>
  <text x="138" y="379" font-size="9" fill="#64748b">config</text>
  <rect x="200" y="368" width="12" height="12" rx="2" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
  <text x="218" y="379" font-size="9" fill="#64748b">docs</text>
</svg>
```
