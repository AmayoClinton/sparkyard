package ratelimit

import (
	"sync"
	"time"
)

type bucket struct {
	tokens float64
	last   time.Time
}

// Limiter is a per-key token bucket used to throttle relay clients.
type Limiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    float64
	burst   float64
	now     func() time.Time
}

func New(rate, burst float64) *Limiter {
	return NewWithClock(rate, burst, time.Now)
}

func NewWithClock(rate, burst float64, now func() time.Time) *Limiter {
	return &Limiter{
		buckets: make(map[string]*bucket),
		rate:    rate,
		burst:   burst,
		now:     now,
	}
}

// Allow reports whether a request for key may proceed, consuming one token.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}

	elapsed := now.Sub(b.last).Seconds()
	if elapsed > 0 {
		b.tokens += elapsed * l.rate
		if b.tokens > l.burst {
			b.tokens = l.burst
		}
		b.last = now
	}

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// Prune drops buckets that have not been used for longer than maxIdle.
func (l *Limiter) Prune(maxIdle time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := l.now().Add(-maxIdle)
	for key, b := range l.buckets {
		if b.last.Before(cutoff) {
			delete(l.buckets, key)
		}
	}
}
