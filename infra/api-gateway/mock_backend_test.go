package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// testBackendMux builds a MockBackend's handler mux without starting a listener.
func testBackendMux(t *testing.T, name string) *http.ServeMux {
	t.Helper()
	mb := NewMockBackend(0, name)
	mb.mux.HandleFunc("/health", mb.handleHealth)
	mb.mux.HandleFunc("/api/echo", mb.handleEcho)
	mb.mux.HandleFunc("/api/user", mb.handleUser)
	mb.mux.HandleFunc("/api/data", mb.handleData)
	mb.mux.HandleFunc("/api/slow", mb.handleSlow)
	mb.mux.HandleFunc("/", mb.handleRoot)
	return mb.mux
}

// ---------- /health ----------

func TestMockBackend_Health_Healthy(t *testing.T) {
	mux := testBackendMux(t, "TestBE")
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var body map[string]string
	json.NewDecoder(rr.Body).Decode(&body)
	if body["status"] != "healthy" {
		t.Errorf("expected status=healthy, got %s", body["status"])
	}
	if body["backend"] != "TestBE" {
		t.Errorf("expected backend=TestBE, got %s", body["backend"])
	}
}

func TestMockBackend_Health_Unhealthy(t *testing.T) {
	mb := NewMockBackend(0, "TestBE")
	mb.healthy = false
	mb.mux.HandleFunc("/health", mb.handleHealth)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	mb.mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}

	var body map[string]string
	json.NewDecoder(rr.Body).Decode(&body)
	if body["status"] != "unhealthy" {
		t.Errorf("expected status=unhealthy, got %s", body["status"])
	}
}

// ---------- /api/echo ----------

func TestMockBackend_Echo(t *testing.T) {
	mux := testBackendMux(t, "EchoBE")
	body := strings.NewReader(`{"msg":"hello"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/echo", body)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp Response
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Backend != "EchoBE" {
		t.Errorf("expected backend=EchoBE, got %s", resp.Backend)
	}
	if resp.Path != "/api/echo" {
		t.Errorf("expected path=/api/echo, got %s", resp.Path)
	}
	if resp.Method != "POST" {
		t.Errorf("expected method=POST, got %s", resp.Method)
	}
	if resp.Status != "ok" {
		t.Errorf("expected status=ok, got %s", resp.Status)
	}
}

func TestMockBackend_Echo_ContentType(t *testing.T) {
	mux := testBackendMux(t, "EchoBE")
	req := httptest.NewRequest(http.MethodPost, "/api/echo", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	ct := rr.Header().Get("Content-Type")
	if !strings.Contains(ct, "application/json") {
		t.Errorf("expected Content-Type application/json, got %s", ct)
	}
}

// ---------- /api/user ----------

func TestMockBackend_User_DefaultID(t *testing.T) {
	mux := testBackendMux(t, "UserBE")
	req := httptest.NewRequest(http.MethodGet, "/api/user", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp Response
	json.NewDecoder(rr.Body).Decode(&resp)

	echo, ok := resp.Echo.(map[string]interface{})
	if !ok {
		t.Fatal("echo field should be a map")
	}
	if echo["id"] != "123" {
		t.Errorf("expected default id=123, got %v", echo["id"])
	}
}

func TestMockBackend_User_CustomID(t *testing.T) {
	mux := testBackendMux(t, "UserBE")
	req := httptest.NewRequest(http.MethodGet, "/api/user?id=42", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	var resp Response
	json.NewDecoder(rr.Body).Decode(&resp)

	echo := resp.Echo.(map[string]interface{})
	if echo["id"] != "42" {
		t.Errorf("expected id=42, got %v", echo["id"])
	}
}

func TestMockBackend_User_HasFields(t *testing.T) {
	mux := testBackendMux(t, "UserBE")
	req := httptest.NewRequest(http.MethodGet, "/api/user?id=1", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	var resp Response
	json.NewDecoder(rr.Body).Decode(&resp)

	echo := resp.Echo.(map[string]interface{})
	if echo["name"] != "Test User" {
		t.Errorf("expected name=Test User, got %v", echo["name"])
	}
	if echo["email"] != "user@example.com" {
		t.Errorf("expected email=user@example.com, got %v", echo["email"])
	}
}

// ---------- /api/data ----------

func TestMockBackend_Data(t *testing.T) {
	mux := testBackendMux(t, "DataBE")
	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)

	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", body["status"])
	}
	if body["backend"] != "DataBE" {
		t.Errorf("expected backend=DataBE, got %v", body["backend"])
	}

	data, ok := body["data"].([]interface{})
	if !ok {
		t.Fatal("data field should be an array")
	}
	if len(data) != 3 {
		t.Errorf("expected 3 data items, got %d", len(data))
	}
}

// ---------- /api/slow ----------

func TestMockBackend_Slow_ReturnsOK(t *testing.T) {
	mux := testBackendMux(t, "SlowBE")
	req := httptest.NewRequest(http.MethodGet, "/api/slow", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp Response
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Message != "Slow response" {
		t.Errorf("expected message=Slow response, got %s", resp.Message)
	}
}

// ---------- root / catchall ----------

func TestMockBackend_Root(t *testing.T) {
	mux := testBackendMux(t, "RootBE")
	req := httptest.NewRequest(http.MethodGet, "/some/random/path", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp Response
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.Backend != "RootBE" {
		t.Errorf("expected backend=RootBE, got %s", resp.Backend)
	}
	if resp.Path != "/some/random/path" {
		t.Errorf("expected path=/some/random/path, got %s", resp.Path)
	}
	if resp.Message != "Welcome to backend" {
		t.Errorf("expected Welcome to backend, got %s", resp.Message)
	}
}

// ---------- NewMockBackend constructor ----------

func TestNewMockBackend(t *testing.T) {
	mb := NewMockBackend(9999, "TestBE")
	if mb.port != 9999 {
		t.Errorf("expected port=9999, got %d", mb.port)
	}
	if mb.name != "TestBE" {
		t.Errorf("expected name=TestBE, got %s", mb.name)
	}
	if !mb.healthy {
		t.Error("new backend should start healthy")
	}
	if mb.mux == nil {
		t.Error("mux should not be nil")
	}
}

// ---------- echo reflects body exactly ----------

func TestMockBackend_Echo_ReflectsBody(t *testing.T) {
	mux := testBackendMux(t, "EchoBE")
	payload := `{"foo":"bar","count":42}`
	req := httptest.NewRequest(http.MethodPost, "/api/echo", strings.NewReader(payload))
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	raw, _ := io.ReadAll(rr.Body)
	if !strings.Contains(string(raw), `"foo"`) || !strings.Contains(string(raw), `"bar"`) {
		t.Errorf("echo response should contain the original body fields, got: %s", string(raw))
	}
}
