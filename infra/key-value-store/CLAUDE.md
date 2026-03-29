# Key-Value Store - Claude Notes

## Overview
Persistent key-value DB in Rust. Bitcask-inspired: log-structured storage, hash index, TCP server.

## Build & Run
```bash
cd ~/Documents/Code/key-value-store
cargo build --release
cargo run --bin server   # start TCP server
cargo run --bin client   # CLI client
```

## Operations
- `get <key>`, `set <key> <value>`, `delete <key>`
- Log compaction, crash recovery from WAL
- TCP server for client access

## Status
Done/stable. ~800 LOC Rust.
