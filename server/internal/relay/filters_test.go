package relay

import (
	"testing"

	"github.com/nbd-wtf/go-nostr"
)

func TestMatchFilterKinds(t *testing.T) {
	event := nostr.Event{Kind: 1}
	if !matchFilter(&event, map[string]interface{}{"kinds": []interface{}{float64(1)}}) {
		t.Fatal("expected kind 1 to match")
	}
	if matchFilter(&event, map[string]interface{}{"kinds": []interface{}{float64(7)}}) {
		t.Fatal("expected kind 1 not to match kind 7")
	}
}

func TestMatchFilterAuthorsAndIDs(t *testing.T) {
	event := nostr.Event{ID: "abc", PubKey: "def", Kind: 1}
	if !matchFilter(&event, map[string]interface{}{"authors": []interface{}{"def"}}) {
		t.Fatal("expected author to match")
	}
	if !matchFilter(&event, map[string]interface{}{"ids": []interface{}{"abc"}}) {
		t.Fatal("expected id to match")
	}
	if matchFilter(&event, map[string]interface{}{"authors": []interface{}{"other"}}) {
		t.Fatal("expected author mismatch to fail")
	}
}

func TestMatchFilterTimeRange(t *testing.T) {
	event := nostr.Event{CreatedAt: 1000}
	if !matchFilter(&event, map[string]interface{}{"since": float64(900), "until": float64(1100)}) {
		t.Fatal("expected timestamp in range to match")
	}
	if matchFilter(&event, map[string]interface{}{"since": float64(1001)}) {
		t.Fatal("expected since filter to exclude older event")
	}
}

func TestMatchFilterTags(t *testing.T) {
	event := nostr.Event{Kind: 9, Tags: nostr.Tags{{"h", "group-1"}}}
	if !matchFilter(&event, map[string]interface{}{"#h": []interface{}{"group-1"}}) {
		t.Fatal("expected h tag to match")
	}
	if matchFilter(&event, map[string]interface{}{"#h": []interface{}{"group-2"}}) {
		t.Fatal("expected h tag mismatch to fail")
	}
}
