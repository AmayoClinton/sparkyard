package relay

import (
	"net/http/httptest"
	"testing"

	"sparkyard/internal/ratelimit"
)

func TestClientIPPrefersProxyHeaders(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "10.0.0.1:1234"

	req.Header.Set("X-Forwarded-For", "203.0.113.7, 10.0.0.1")
	if got := clientIP(req); got != "203.0.113.7" {
		t.Fatalf("clientIP with X-Forwarded-For = %q", got)
	}

	req.Header.Del("X-Forwarded-For")
	req.Header.Set("X-Real-IP", "198.51.100.9")
	if got := clientIP(req); got != "198.51.100.9" {
		t.Fatalf("clientIP with X-Real-IP = %q", got)
	}

	req.Header.Del("X-Real-IP")
	if got := clientIP(req); got != "10.0.0.1" {
		t.Fatalf("clientIP fallback = %q", got)
	}
}

func TestNonWebSocketRequestReturnsUpgradeRequired(t *testing.T) {
	r := &Relay{limiter: ratelimit.New(10, 20)}
	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != 426 {
		t.Fatalf("status = %d, want 426", rec.Code)
	}
}
