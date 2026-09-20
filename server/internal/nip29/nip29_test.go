package nip29

import (
	"testing"

	"github.com/nbd-wtf/go-nostr"
)

func TestExtractGroupID(t *testing.T) {
	if got := ExtractGroupID(nostr.Tags{{"h", "group-1"}}); got != "group-1" {
		t.Fatalf("expected group-1, got %q", got)
	}
	if got := ExtractGroupID(nostr.Tags{{"e", "event"}}); got != "" {
		t.Fatalf("expected empty group id, got %q", got)
	}
	if got := ExtractGroupID(nostr.Tags{{"h"}}); got != "" {
		t.Fatalf("expected empty group id for short tag, got %q", got)
	}
}

func TestIsAdminAction(t *testing.T) {
	adminKinds := []int{
		KindAddUser, KindRemoveUser, KindEditMetadata, KindAddPermission,
		KindRemovePermission, KindDeleteEvent, KindDeleteGroup,
		KindAcceptJoinReq, KindRejectJoinReq,
	}
	for _, kind := range adminKinds {
		if !IsAdminAction(kind) {
			t.Fatalf("expected kind %d to be an admin action", kind)
		}
	}
	for _, kind := range []int{KindGroupMessage, KindGroupReply, KindGroupReaction, KindJoinRequest} {
		if IsAdminAction(kind) {
			t.Fatalf("expected kind %d not to be an admin action", kind)
		}
	}
}
