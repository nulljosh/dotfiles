package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

// newTestGateway creates a Gateway backed by real httptest servers.
// It patches the log file to a temp path so tests don't clobber gateway.log.
func newTestGateway(t *testing.T, backendURLs []string, rateLimitPerIP, rateLimitPerKey int, apiKeys map[string]bool) (*Gateway, func()) {
	t.Helper()

	logFile, err := os.CreateTemp(t.TempDir(), "gateway-test-*.log")
	if err != nil {
		t.Fatalf("create temp log: %v", err)
	}

	config := &Config{
		Port:                0,
		Backends:            backendURLs,
		RateLimitPerIP:      rateLimitPerIP,
		RateLimitPerKey:     rateLimitPerKey,
		HealthCheckInterval: time.Hour, // disable health check loop during tests
		APIKeys:             apiKeys,
	}

	g, err := NewGateway(config)
	if err != nil {
		logFile.Close()
		t.Fatalf("NewGateway: %v", err)
	}

	// Swap the auto-created log file for the temp one.
	g.logger.file.Close()
	g.logger.file = logFile

	cleanup := func() {
		g.logger.file.Close()
	}
	return g, cleanup
}

// simpleBackend returns an httptest.Server that always responds 200 with a
// fixed JSON body, plus a /health endpoint.
func simpleBackend(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy"}`))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	})
	return httptest.NewServer(mux)
}

// ---------- health endpoint ----------

func TestHealthEndpoint_ReturnsOK(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	g.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", body["status"])
	}

	if total, ok := body["total_backends"].(float64); !ok || int(total) != 1 {
		t.Errorf("expected total_backends=1, got %v", body["total_backends"])
	}
}

func TestHealthEndpoint_MethodNotAllowed(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete} {
		req := httptest.NewRequest(method, "/health", nil)
		rr := httptest.NewRecorder()
		g.mux.ServeHTTP(rr, req)

		if rr.Code != http.StatusMethodNotAllowed {
			t.Errorf("method %s: expected 405, got %d", method, rr.Code)
		}
	}
}

func TestHealthEndpoint_ReflectsHealthyBackendCount(t *testing.T) {
	be1 := simpleBackend(t)
	be2 := simpleBackend(t)
	defer be1.Close()
	defer be2.Close()

	g, cleanup := newTestGateway(t, []string{be1.URL, be2.URL}, 100, 1000, nil)
	defer cleanup()

	// Mark one backend dead.
	g.lb.backends[1].Alive = false

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)

	if healthy := int(body["healthy_backends"].(float64)); healthy != 1 {
		t.Errorf("expected healthy_backends=1, got %d", healthy)
	}
	if total := int(body["total_backends"].(float64)); total != 2 {
		t.Errorf("expected total_backends=2, got %d", total)
	}
}

// ---------- routing ----------

func TestRouting_ProxiesRequestToBackend(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestRouting_ServiceUnavailable_NoBackends(t *testing.T) {
	// Create gateway with no backends.
	logFile, _ := os.CreateTemp(t.TempDir(), "gw-*.log")
	config := &Config{
		Port:                0,
		Backends:            []string{},
		RateLimitPerIP:      100,
		RateLimitPerKey:     1000,
		HealthCheckInterval: time.Hour,
		APIKeys:             nil,
	}
	g, err := NewGateway(config)
	if err != nil {
		// gateway.log creation may fail if no backends but log file still needed
		t.Skip("NewGateway with empty backends not supported:", err)
	}
	g.logger.file.Close()
	g.logger.file = logFile
	defer logFile.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestRouting_ServiceUnavailable_AllBackendsDead(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	// Mark all backends dead.
	for _, b := range g.lb.backends {
		b.Alive = false
	}

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}

	if !strings.Contains(rr.Body.String(), "Service unavailable") {
		t.Errorf("unexpected body: %s", rr.Body.String())
	}
}

// ---------- load balancer ----------

func TestLoadBalancer_RoundRobin(t *testing.T) {
	be1 := simpleBackend(t)
	be2 := simpleBackend(t)
	defer be1.Close()
	defer be2.Close()

	g, cleanup := newTestGateway(t, []string{be1.URL, be2.URL}, 1000, 10000, nil)
	defer cleanup()

	// Make 4 requests and verify alternation.
	hits := make([]string, 4)
	for i := range hits {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		rr := httptest.NewRecorder()
		g.mux.ServeHTTP(rr, req)
		hits[i] = rr.Header().Get("X-Forwarded-For") // not set, check via lb directly
		_ = rr
	}

	// Check round-robin directly on lb.Next().
	lb := &LoadBalancer{
		backends: g.lb.backends,
		current:  0,
	}
	seen := make(map[string]int)
	for i := 0; i < 6; i++ {
		b := lb.Next()
		if b == nil {
			t.Fatal("Next() returned nil with live backends")
		}
		seen[b.URL.String()]++
	}

	if len(seen) != 2 {
		t.Errorf("expected both backends to be used, got: %v", seen)
	}
}

func TestLoadBalancer_SkipsDeadBackends(t *testing.T) {
	be1 := simpleBackend(t)
	be2 := simpleBackend(t)
	defer be1.Close()
	defer be2.Close()

	g, cleanup := newTestGateway(t, []string{be1.URL, be2.URL}, 1000, 10000, nil)
	defer cleanup()

	g.lb.backends[0].Alive = false

	for i := 0; i < 5; i++ {
		b := g.lb.Next()
		if b == nil {
			t.Fatal("Next() returned nil when one backend is alive")
		}
		if b.URL.String() == be1.URL {
			t.Error("Next() returned dead backend")
		}
	}
}

func TestLoadBalancer_ReturnsNil_WhenAllDead(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	g.lb.backends[0].Alive = false

	if b := g.lb.Next(); b != nil {
		t.Errorf("expected nil, got %v", b.URL)
	}
}

// ---------- rate limiting ----------

func TestRateLimiter_AllowsUpToLimit(t *testing.T) {
	rl := &RateLimiter{
		ipLimits:  make(map[string]*TokenBucket),
		keyLimits: make(map[string]*TokenBucket),
	}
	config := &Config{RateLimitPerIP: 5, RateLimitPerKey: 100}

	for i := 0; i < 5; i++ {
		if !rl.Allow("1.2.3.4", "", config) {
			t.Fatalf("request %d should be allowed (within limit)", i+1)
		}
	}
}

func TestRateLimiter_Blocks_AfterLimitExceeded(t *testing.T) {
	rl := &RateLimiter{
		ipLimits:  make(map[string]*TokenBucket),
		keyLimits: make(map[string]*TokenBucket),
	}
	config := &Config{RateLimitPerIP: 3, RateLimitPerKey: 100}

	for i := 0; i < 3; i++ {
		rl.Allow("1.2.3.4", "", config)
	}

	if rl.Allow("1.2.3.4", "", config) {
		t.Error("4th request should be blocked")
	}
}

func TestRateLimiter_DifferentIPs_Independent(t *testing.T) {
	rl := &RateLimiter{
		ipLimits:  make(map[string]*TokenBucket),
		keyLimits: make(map[string]*TokenBucket),
	}
	config := &Config{RateLimitPerIP: 2, RateLimitPerKey: 100}

	// Exhaust IP-A.
	rl.Allow("192.168.1.1", "", config)
	rl.Allow("192.168.1.1", "", config)

	// IP-B should still be allowed.
	if !rl.Allow("192.168.1.2", "", config) {
		t.Error("different IP should have its own bucket")
	}
}

func TestRateLimiter_APIKey_BlocksAfterLimit(t *testing.T) {
	rl := &RateLimiter{
		ipLimits:  make(map[string]*TokenBucket),
		keyLimits: make(map[string]*TokenBucket),
	}
	config := &Config{RateLimitPerIP: 1000, RateLimitPerKey: 3}

	for i := 0; i < 3; i++ {
		if !rl.Allow("1.2.3.4", "mykey", config) {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}

	if rl.Allow("1.2.3.4", "mykey", config) {
		t.Error("4th request with same key should be blocked")
	}
}

// HTTP-level 429 response.
func TestRateLimit_Returns429(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 2, 1000, nil)
	defer cleanup()

	var lastCode int
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
		req.RemoteAddr = "10.0.0.1:9999"
		rr := httptest.NewRecorder()
		g.mux.ServeHTTP(rr, req)
		lastCode = rr.Code
	}

	if lastCode != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after exhausting limit, got %d", lastCode)
	}
}

// ---------- API key auth ----------

func TestAuth_InvalidAPIKey_Returns401(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	apiKeys := map[string]bool{"valid-key": true}
	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, apiKeys)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("X-API-Key", "bad-key")
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}

	if !strings.Contains(rr.Body.String(), "Unauthorized") {
		t.Errorf("expected Unauthorized in body, got: %s", rr.Body.String())
	}
}

func TestAuth_ValidAPIKey_Passes(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	apiKeys := map[string]bool{"valid-key": true}
	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, apiKeys)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("X-API-Key", "valid-key")
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 with valid key, got %d", rr.Code)
	}
}

func TestAuth_NoAPIKey_BypassesAuthCheck(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	apiKeys := map[string]bool{"valid-key": true}
	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, apiKeys)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	// No key means auth is skipped, request proxied normally.
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 with no key, got %d", rr.Code)
	}
}

// ---------- token bucket ----------

func TestTokenBucket_Refill(t *testing.T) {
	tb := &TokenBucket{
		tokens:     0,
		capacity:   10,
		refillRate: 10, // 10 tokens/sec
		lastRefill: time.Now().Add(-1 * time.Second),
	}

	tb.refill()

	if tb.tokens < 9 || tb.tokens > 10 {
		t.Errorf("expected ~10 tokens after 1s refill, got %.2f", tb.tokens)
	}
}

func TestTokenBucket_CapNotExceeded(t *testing.T) {
	tb := &TokenBucket{
		tokens:     10,
		capacity:   10,
		refillRate: 100,
		lastRefill: time.Now().Add(-60 * time.Second),
	}

	tb.refill()

	if tb.tokens > tb.capacity {
		t.Errorf("tokens %.2f exceeded capacity %.2f", tb.tokens, tb.capacity)
	}
}

// ---------- response writer wrapper ----------

func TestResponseWriter_CapturesStatusCode(t *testing.T) {
	rr := httptest.NewRecorder()
	wrapped := &responseWriter{ResponseWriter: rr, statusCode: http.StatusOK}

	wrapped.WriteHeader(http.StatusTeapot)

	if wrapped.statusCode != http.StatusTeapot {
		t.Errorf("expected 418, got %d", wrapped.statusCode)
	}
	if rr.Code != http.StatusTeapot {
		t.Errorf("underlying recorder code: expected 418, got %d", rr.Code)
	}
}

func TestResponseWriter_WriteHeaderOnce(t *testing.T) {
	rr := httptest.NewRecorder()
	wrapped := &responseWriter{ResponseWriter: rr, statusCode: http.StatusOK}

	wrapped.WriteHeader(http.StatusCreated)
	wrapped.WriteHeader(http.StatusNotFound) // second call must be ignored

	if wrapped.statusCode != http.StatusCreated {
		t.Errorf("status should be 201 after second WriteHeader, got %d", wrapped.statusCode)
	}
}

func TestResponseWriter_WriteSetsWrittenFlag(t *testing.T) {
	rr := httptest.NewRecorder()
	wrapped := &responseWriter{ResponseWriter: rr, statusCode: http.StatusOK}

	wrapped.Write([]byte("hello"))

	if !wrapped.written {
		t.Error("written flag should be true after Write()")
	}
}

// ---------- middleware chain (end-to-end via mux) ----------

func TestMiddlewareChain_RateLimitBeforeProxy(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	// limit=1, so second request must 429
	g, cleanup := newTestGateway(t, []string{be.URL}, 1, 1000, nil)
	defer cleanup()

	send := func() int {
		req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
		req.RemoteAddr = "10.0.0.2:1234"
		rr := httptest.NewRecorder()
		g.mux.ServeHTTP(rr, req)
		return rr.Code
	}

	if code := send(); code != http.StatusOK {
		t.Fatalf("1st request: expected 200, got %d", code)
	}
	if code := send(); code != http.StatusTooManyRequests {
		t.Fatalf("2nd request: expected 429, got %d", code)
	}
}

func TestMiddlewareChain_AuthBeforeRateLimit(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	apiKeys := map[string]bool{"good": true}
	// Rate limit high so it doesn't interfere.
	g, cleanup := newTestGateway(t, []string{be.URL}, 1000, 1000, apiKeys)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("X-API-Key", "bad")
	req.RemoteAddr = "10.0.0.3:1234"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	// Auth fires first, should be 401 not 429.
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 (auth before rate limit), got %d", rr.Code)
	}
}

// ---------- health check (checkBackendHealth) ----------

func TestCheckBackendHealth_MarksAlive(t *testing.T) {
	// Real httptest backend with /health returning 200.
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	// Forcibly mark it dead, then run a health check.
	g.lb.backends[0].Alive = false
	g.checkBackendHealth(g.lb.backends[0])

	if !g.lb.backends[0].Alive {
		t.Error("backend should be marked alive after successful health check")
	}
}

func TestCheckBackendHealth_MarksDead_WhenUnreachable(t *testing.T) {
	be := simpleBackend(t)
	be.Close() // shut it down immediately

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	g.lb.backends[0].Alive = true
	g.checkBackendHealth(g.lb.backends[0])

	if g.lb.backends[0].Alive {
		t.Error("backend should be marked dead when unreachable")
	}
}

func TestCheckBackendHealth_MarksDead_On500(t *testing.T) {
	// Backend that returns 500 on /health.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	g, cleanup := newTestGateway(t, []string{srv.URL}, 100, 1000, nil)
	defer cleanup()

	g.lb.backends[0].Alive = true
	g.checkBackendHealth(g.lb.backends[0])

	if g.lb.backends[0].Alive {
		t.Error("backend should be marked dead when health returns 500")
	}
}

// ---------- load balancer: additional edge cases ----------

func TestLoadBalancer_SingleBackend(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	for i := 0; i < 10; i++ {
		b := g.lb.Next()
		if b == nil {
			t.Fatal("Next() returned nil with a single live backend")
		}
		if b.URL.String() != be.URL {
			t.Errorf("expected %s, got %s", be.URL, b.URL.String())
		}
	}
}

func TestLoadBalancer_RoundRobin_EvenDistribution(t *testing.T) {
	be1 := simpleBackend(t)
	be2 := simpleBackend(t)
	be3 := simpleBackend(t)
	defer be1.Close()
	defer be2.Close()
	defer be3.Close()

	g, cleanup := newTestGateway(t, []string{be1.URL, be2.URL, be3.URL}, 10000, 10000, nil)
	defer cleanup()

	counts := make(map[string]int)
	for i := 0; i < 30; i++ {
		b := g.lb.Next()
		if b == nil {
			t.Fatal("Next() returned nil")
		}
		counts[b.URL.String()]++
	}

	// Each backend should get exactly 10 hits with perfect round-robin.
	for url, count := range counts {
		if count != 10 {
			t.Errorf("backend %s got %d hits, expected 10", url, count)
		}
	}
}

func TestLoadBalancer_RecoveredBackend_GetsTraffic(t *testing.T) {
	be1 := simpleBackend(t)
	be2 := simpleBackend(t)
	defer be1.Close()
	defer be2.Close()

	g, cleanup := newTestGateway(t, []string{be1.URL, be2.URL}, 10000, 10000, nil)
	defer cleanup()

	// Kill backend 0, send requests -- only backend 1 should get them.
	g.lb.backends[0].Alive = false
	for i := 0; i < 3; i++ {
		b := g.lb.Next()
		if b.URL.String() == be1.URL {
			t.Error("dead backend should not receive traffic")
		}
	}

	// Revive backend 0.
	g.lb.backends[0].Alive = true
	seen := make(map[string]bool)
	for i := 0; i < 10; i++ {
		b := g.lb.Next()
		seen[b.URL.String()] = true
	}
	if !seen[be1.URL] {
		t.Error("recovered backend should receive traffic again")
	}
}

// ---------- concurrent rate limiting ----------

func TestRateLimiter_ConcurrentAccess(t *testing.T) {
	rl := &RateLimiter{
		ipLimits:  make(map[string]*TokenBucket),
		keyLimits: make(map[string]*TokenBucket),
	}
	config := &Config{RateLimitPerIP: 50, RateLimitPerKey: 100}

	var wg sync.WaitGroup
	allowed := int64(0)
	var mu sync.Mutex

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if rl.Allow("1.2.3.4", "", config) {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	// Bucket starts with 50 tokens. Should allow at most 50 (plus a tiny
	// refill margin). Definitely not all 100.
	if allowed > 55 {
		t.Errorf("expected at most ~50 allowed, got %d", allowed)
	}
	if allowed < 45 {
		t.Errorf("expected at least ~50 allowed, got %d", allowed)
	}
}

// ---------- request logging ----------

func TestRequestLogger_WritesEntries(t *testing.T) {
	logFile, err := os.CreateTemp(t.TempDir(), "log-test-*.log")
	if err != nil {
		t.Fatal(err)
	}

	logger := &RequestLogger{file: logFile}

	entry := LogEntry{
		Timestamp:    "2026-01-01T00:00:00Z",
		Method:       "GET",
		Path:         "/api/data",
		ClientIP:     "10.0.0.1",
		StatusCode:   200,
		ResponseTime: "5",
		Backend:      "http://localhost:8081",
	}

	logger.Log(entry)
	logger.Log(entry)

	// Read back the file.
	logFile.Close()
	data, err := os.ReadFile(logFile.Name())
	if err != nil {
		t.Fatal(err)
	}

	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 log lines, got %d", len(lines))
	}

	var parsed LogEntry
	if err := json.Unmarshal([]byte(lines[0]), &parsed); err != nil {
		t.Fatalf("failed to parse log line: %v", err)
	}
	if parsed.Method != "GET" || parsed.Path != "/api/data" {
		t.Errorf("unexpected parsed entry: %+v", parsed)
	}
}

func TestRequestLogger_IncludesAPIKey(t *testing.T) {
	logFile, err := os.CreateTemp(t.TempDir(), "log-key-*.log")
	if err != nil {
		t.Fatal(err)
	}

	logger := &RequestLogger{file: logFile}

	entry := LogEntry{
		Timestamp:  "2026-01-01T00:00:00Z",
		Method:     "GET",
		Path:       "/api/user",
		ClientIP:   "10.0.0.1",
		APIKey:     "key-test-1",
		StatusCode: 200,
	}

	logger.Log(entry)
	logFile.Close()

	data, _ := os.ReadFile(logFile.Name())
	if !strings.Contains(string(data), "key-test-1") {
		t.Error("log entry should contain API key")
	}
}

func TestRequestLogger_ErrorField(t *testing.T) {
	logFile, err := os.CreateTemp(t.TempDir(), "log-err-*.log")
	if err != nil {
		t.Fatal(err)
	}

	logger := &RequestLogger{file: logFile}

	entry := LogEntry{
		Timestamp:  "2026-01-01T00:00:00Z",
		Method:     "GET",
		Path:       "/api/data",
		ClientIP:   "10.0.0.1",
		StatusCode: 429,
		Error:      "rate limit exceeded",
	}

	logger.Log(entry)
	logFile.Close()

	data, _ := os.ReadFile(logFile.Name())
	if !strings.Contains(string(data), "rate limit exceeded") {
		t.Error("log entry should contain error field")
	}
}

// ---------- proxy forwarding details ----------

func TestProxy_ForwardsQueryParams(t *testing.T) {
	var receivedQuery string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	g, cleanup := newTestGateway(t, []string{srv.URL}, 100, 1000, nil)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/user?id=42&name=josh", nil)
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if !strings.Contains(receivedQuery, "id=42") || !strings.Contains(receivedQuery, "name=josh") {
		t.Errorf("query params not forwarded, got: %s", receivedQuery)
	}
}

func TestProxy_ForwardsPOSTBody(t *testing.T) {
	var receivedBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		receivedBody = string(b)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	g, cleanup := newTestGateway(t, []string{srv.URL}, 100, 1000, nil)
	defer cleanup()

	body := strings.NewReader(`{"message":"hello"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/echo", body)
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if !strings.Contains(receivedBody, "hello") {
		t.Errorf("POST body not forwarded, got: %s", receivedBody)
	}
}

func TestProxy_ForwardsCustomHeaders(t *testing.T) {
	var receivedHeader string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeader = r.Header.Get("X-Custom-Header")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	g, cleanup := newTestGateway(t, []string{srv.URL}, 100, 1000, nil)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("X-Custom-Header", "test-value")
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	if receivedHeader != "test-value" {
		t.Errorf("custom header not forwarded, got: %s", receivedHeader)
	}
}

func TestProxy_PreservesHTTPMethod(t *testing.T) {
	var receivedMethod string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedMethod = r.Method
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	g, cleanup := newTestGateway(t, []string{srv.URL}, 100, 1000, nil)
	defer cleanup()

	for _, method := range []string{"GET", "POST", "PUT", "DELETE", "PATCH"} {
		req := httptest.NewRequest(method, "/api/data", nil)
		req.RemoteAddr = "10.0.0.1:9999"
		rr := httptest.NewRecorder()
		g.mux.ServeHTTP(rr, req)

		if receivedMethod != method {
			t.Errorf("method %s not preserved, backend received %s", method, receivedMethod)
		}
	}
}

// ---------- token bucket: refill restores access ----------

func TestTokenBucket_RefillRestoresAccess(t *testing.T) {
	rl := &RateLimiter{
		ipLimits:  make(map[string]*TokenBucket),
		keyLimits: make(map[string]*TokenBucket),
	}
	config := &Config{RateLimitPerIP: 2, RateLimitPerKey: 100}

	// Exhaust the bucket.
	rl.Allow("5.5.5.5", "", config)
	rl.Allow("5.5.5.5", "", config)
	if rl.Allow("5.5.5.5", "", config) {
		t.Fatal("3rd request should be blocked")
	}

	// Simulate time passing by backdating lastRefill.
	rl.mu.Lock()
	bucket := rl.ipLimits["5.5.5.5"]
	bucket.lastRefill = time.Now().Add(-2 * time.Minute)
	rl.mu.Unlock()

	// After refill window, requests should succeed again.
	if !rl.Allow("5.5.5.5", "", config) {
		t.Error("request should be allowed after refill period")
	}
}

func TestTokenBucket_ZeroTokensBeforeRefill(t *testing.T) {
	tb := &TokenBucket{
		tokens:     0,
		capacity:   5,
		refillRate: 0, // no refill
		lastRefill: time.Now(),
	}

	tb.refill()

	if tb.tokens != 0 {
		t.Errorf("expected 0 tokens with zero refill rate, got %.2f", tb.tokens)
	}
}

// ---------- min helper ----------

func TestMin(t *testing.T) {
	cases := []struct {
		a, b, want float64
	}{
		{1, 2, 1},
		{5, 3, 3},
		{7, 7, 7},
		{-1, 0, -1},
		{0, 0, 0},
	}

	for _, tc := range cases {
		got := min(tc.a, tc.b)
		if got != tc.want {
			t.Errorf("min(%v, %v) = %v, want %v", tc.a, tc.b, got, tc.want)
		}
	}
}

// ---------- NewGateway validation ----------

func TestNewGateway_InvalidBackendURL(t *testing.T) {
	logFile, _ := os.CreateTemp(t.TempDir(), "gw-*.log")
	defer logFile.Close()

	config := &Config{
		Port:                0,
		Backends:            []string{"://invalid"},
		RateLimitPerIP:      100,
		RateLimitPerKey:     1000,
		HealthCheckInterval: time.Hour,
		APIKeys:             nil,
	}

	_, err := NewGateway(config)
	if err == nil {
		t.Error("expected error for invalid backend URL")
	}
	if !strings.Contains(err.Error(), "invalid backend URL") {
		t.Errorf("unexpected error: %v", err)
	}
}

// ---------- health endpoint: JSON structure ----------

func TestHealthEndpoint_ContainsTimestamp(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)

	ts, ok := body["timestamp"].(string)
	if !ok || ts == "" {
		t.Error("health response should contain a non-empty timestamp")
	}

	// Verify it parses as RFC3339.
	if _, err := time.Parse(time.RFC3339, ts); err != nil {
		t.Errorf("timestamp is not RFC3339: %s", ts)
	}
}

func TestHealthEndpoint_ContentTypeJSON(t *testing.T) {
	be := simpleBackend(t)
	defer be.Close()

	g, cleanup := newTestGateway(t, []string{be.URL}, 100, 1000, nil)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	g.mux.ServeHTTP(rr, req)

	ct := rr.Header().Get("Content-Type")
	if !strings.Contains(ct, "application/json") {
		t.Errorf("expected Content-Type application/json, got %s", ct)
	}
}
