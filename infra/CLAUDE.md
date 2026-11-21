# Infra

## Rules

- Each project is standalone, no shared dependencies
- Rust: `cargo fmt`, `cargo clippy`
- Go: `gofmt`, standard library preferred
- Python: snake_case, type hints, pytest

## Run

```bash
# key-value-store
cd key-value-store && cargo run && cargo test

# api-gateway
cd api-gateway && go run main.go && go test ./...

# search-engine
cd search-engine && pip install -r requirements.txt && pytest

# graphics-renderer
cd graphics-renderer && cargo run && cargo test
```
