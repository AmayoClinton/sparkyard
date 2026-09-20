package nip29

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/nbd-wtf/go-nostr"

	"sparkyard/internal/db"
)

// NIP-29 group event kinds
const (
	KindGroupMetadata    = 39000
	KindAddUser          = 9000
	KindRemoveUser       = 9001
	KindEditMetadata     = 9002
	KindAddPermission    = 9003
	KindRemovePermission = 9004
	KindDeleteEvent      = 9005
	KindCreateGroup      = 9007
	KindDeleteGroup      = 9008
	KindCreateInvite     = 9009
	KindAcceptInvite     = 9010
	KindJoinRequest      = 9021
	KindAcceptJoinReq    = 9022
	KindRejectJoinReq    = 9023
	KindGroupMessage     = 9
	KindGroupReply       = 10
	KindGroupReaction    = 11
)

// Role hierarchy
const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
)

var roleRank = map[string]int{
	RoleOwner:  3,
	RoleAdmin:  2,
	RoleMember: 1,
}

// IsAdminAction returns true if the kind requires admin-level permissions
func IsAdminAction(kind int) bool {
	switch kind {
	case KindAddUser, KindRemoveUser, KindEditMetadata, KindAddPermission,
		KindRemovePermission, KindDeleteEvent, KindDeleteGroup,
		KindAcceptJoinReq, KindRejectJoinReq:
		return true
	}
	return false
}

// CheckPermission verifies server-side that pubkey can perform action in group.
// NEVER trust client-side role claims.
func CheckPermission(ctx context.Context, p *db.Pool, groupID string, pubkeyHex string, actionKind int) error {
	// Decode pubkey
	pubkey, err := hex.DecodeString(pubkeyHex)
	if err != nil {
		return fmt.Errorf("invalid pubkey: %w", err)
	}

	// Creating a group requires no existing membership (creates the group)
	if actionKind == KindCreateGroup {
		return nil
	}

	// Check ban first
	var banned bool
	err = p.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM group_bans WHERE group_id = $1 AND pubkey = $2)
	`, groupID, pubkey).Scan(&banned)
	if err != nil {
		return fmt.Errorf("ban check failed: %w", err)
	}
	if banned {
		return fmt.Errorf("pubkey is banned from group")
	}

	// Get member role
	var role string
	err = p.QueryRow(ctx, `
		SELECT role FROM group_members WHERE group_id = $1 AND pubkey = $2
	`, groupID, pubkey).Scan(&role)
	if err != nil {
		// Not a member — only allow join requests or invite accepts
		if actionKind == KindJoinRequest || actionKind == KindAcceptInvite {
			return nil
		}
		return fmt.Errorf("not a member of group")
	}

	// Group metadata publication is admin/owner controlled.
	if actionKind == KindGroupMetadata || actionKind == KindEditMetadata {
		if roleRank[role] < roleRank[RoleAdmin] {
			return fmt.Errorf("insufficient permissions: need admin, got %s", role)
		}
		return nil
	}

	// Members can post messages/replies/reactions
	if !IsAdminAction(actionKind) {
		return nil
	}

	// Admin actions require admin or owner
	if roleRank[role] < roleRank[RoleAdmin] {
		return fmt.Errorf("insufficient permissions: need admin, got %s", role)
	}

	// Owner-only actions
	if actionKind == KindDeleteGroup && role != RoleOwner {
		return fmt.Errorf("only owner can delete group")
	}

	return nil
}

// ExtractGroupID parses the 'h' tag from event tags
func ExtractGroupID(tags nostr.Tags) string {
	for _, tag := range tags {
		if len(tag) >= 2 && tag[0] == "h" {
			return strings.TrimSpace(tag[1])
		}
	}
	return ""
}
