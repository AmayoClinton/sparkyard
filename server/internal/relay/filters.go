package relay

import (
	"strings"

	"github.com/nbd-wtf/go-nostr"
)

func (r *Relay) broadcastEvent(event *nostr.Event) {
	r.subMutex.RLock()
	defer r.subMutex.RUnlock()

	for _, sub := range r.subs {
		for _, f := range sub.filters {
			if matchFilter(event, f) {
				ev := map[string]interface{}{
					"id":         event.ID,
					"pubkey":     event.PubKey,
					"created_at": event.CreatedAt,
					"kind":       event.Kind,
					"tags":       event.Tags,
					"content":    event.Content,
					"sig":        event.Sig,
				}
				r.sendEvent(sub.client, sub.id, ev)
				break
			}
		}
	}
}

func matchFilter(event *nostr.Event, filter map[string]interface{}) bool {
	if kinds, ok := filter["kinds"].([]interface{}); ok {
		found := false
		for _, k := range kinds {
			if f, ok := k.(float64); ok && int(f) == event.Kind {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if authors, ok := filter["authors"].([]interface{}); ok {
		found := false
		for _, a := range authors {
			if s, ok := a.(string); ok && s == event.PubKey {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if ids, ok := filter["ids"].([]interface{}); ok {
		found := false
		for _, id := range ids {
			if s, ok := id.(string); ok && s == event.ID {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if since, ok := filter["since"].(float64); ok {
		if int64(event.CreatedAt) < int64(since) {
			return false
		}
	}
	if until, ok := filter["until"].(float64); ok {
		if int64(event.CreatedAt) > int64(until) {
			return false
		}
	}
	for key, val := range filter {
		if !strings.HasPrefix(key, "#") || len(key) != 2 {
			continue
		}
		tagName := key[1:]
		wanted, ok := val.([]interface{})
		if !ok {
			continue
		}
		found := false
		for _, tag := range event.Tags {
			if len(tag) >= 2 && tag[0] == tagName {
				for _, w := range wanted {
					if s, ok := w.(string); ok && s == tag[1] {
						found = true
						break
					}
				}
			}
			if found {
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
