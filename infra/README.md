![Infra](icon.svg)

# Infra

![version](https://img.shields.io/badge/version-v1.0.0-blue)

Infrastructure monorepo. Persistence, networking, search, graphics, and distributed systems.

## Projects

- **key-value-store** (Rust) -- Persistent KV database, Bitcask-style. Log-structured storage, crash recovery, TCP server. 35/35 tests
- **api-gateway** (Go) -- Production-ready API gateway. Routing, rate limiting, load balancing, health checks
- **search-engine** (Python) -- TF-IDF search engine. Indexer + CLI working; crawler and BM25 incomplete
- **graphics-renderer** (Rust) -- Ray tracer. Phong lighting, shadows, reflections, PPM/PNG output

## Run

```bash
cd key-value-store && cargo run
cd api-gateway && go run main.go -mode gateway
cd search-engine && pip install -r requirements.txt && python -m src.query.search "query"
cd graphics-renderer && cargo run
```

## Roadmap

- key-value-store: compaction, TTL expiration, replication
- search-engine: web crawler, BM25, REST API
- graphics-renderer: triangle meshes, texture mapping

## License

MIT 2026 Joshua Trommel
