# API Gateway - Claude Notes

## Project Overview
Production-ready API Gateway in Go. ~915 LOC. Features: request routing, rate limiting (token bucket), API key auth, round-robin load balancing, health checks with auto-failover.

## Stack
- Go (single binary)
- Modes: `gateway`, `backend`, `client`

## Build & Run
```bash
cd ~/Documents/Code/api-gateway
go build -o api-gateway .

# Start everything
./start.sh

# Or manually:
./api-gateway -mode gateway -port 8080 -backends http://localhost:8081,http://localhost:8082
./api-gateway -mode backend -port 8081 -name "Backend-1"
./api-gateway -mode backend -port 8082 -name "Backend-2"
```

## Testing
```bash
go run . -mode client -cmd health
go test ./...
```

## Key Flags
```
-mode gateway|backend|client
-port int
-backends string         # comma-separated URLs
-rate-limit int          # req/min per IP (default 100)
-key-rate-limit int      # req/min per API key (default 1000)
```

## Status
Done/stable. 915 LOC.
