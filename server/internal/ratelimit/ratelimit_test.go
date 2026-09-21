package ratelimit

import (
	"testing"
	"time"
)

func TestAllowConsumesBurstThenRejects(t *testing.T) {
	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	limiter := NewWithClock(1, 3, func() time.Time { return clock })

	for i := 0; i < 3; i++ {
		if !limiter.Allow("client") {
			t.Fatalf("request %d should be allowed within burst", i)
		}
	}
	if limiter.Allow("client") {
		t.Fatal("request beyond burst should be rejected")
	}
}

func TestAllowRefillsOverTime(t *testing.T) {
	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	limiter := NewWithClock(1, 1, func() time.Time { return clock })

	if !limiter.Allow("client") {
		t.Fatal("first request should be allowed")
	}
	if limiter.Allow("client") {
		t.Fatal("second request should be rejected")
	}

	clock = clock.Add(2 * time.Second)
	if !limiter.Allow("client") {
		t.Fatal("request should be allowed after refill")
	}
}

func TestAllowIsPerKey(t *testing.T) {
	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	limiter := NewWithClock(1, 1, func() time.Time { return clock })

	if !limiter.Allow("a") {
		t.Fatal("key a should be allowed")
	}
	if !limiter.Allow("b") {
		t.Fatal("key b should have its own bucket")
	}
}

func TestPruneRemovesIdleBuckets(t *testing.T) {
	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	limiter := NewWithClock(1, 1, func() time.Time { return clock })
	limiter.Allow("idle")

	clock = clock.Add(time.Hour)
	limiter.Prune(time.Minute)

	limiter.mu.Lock()
	remaining := len(limiter.buckets)
	limiter.mu.Unlock()
	if remaining != 0 {
		t.Fatalf("expected idle bucket to be pruned, got %d", remaining)
	}
}
