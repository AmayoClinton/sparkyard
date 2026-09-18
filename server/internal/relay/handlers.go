package relay

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"sparkyard/internal/db"
	"sparkyard/internal/nip29"

	"github.com/nbd-wtf/go-nostr"
)

func (r *Relay) handleEvent(client *Client, msg []interface{}) {
	if len(msg) < 2 {
		r.sendNotice(client, "EVENT missing payload")
		return
	}
	payload, err := json.Marshal(msg[1])
	if err != nil {
		r.sendNotice(client, "EVENT invalid payload")
		return
	}

	var event nostr.Event
	if err := json.Unmarshal(payload, &event); err != nil {
		r.sendNotice(client, fmt.Sprintf("EVENT parse error: %v", err))
		return
	}

	if event.GetID() != event.ID {
		r.sendOK(client, event.ID, false, "invalid: event ID mismatch")
		return
	}
	if ok, _ := event.CheckSignature(); !ok {
		r.sendOK(client, event.ID, false, "invalid: signature verification failed")
		return
	}

	if event.Kind == nip29.KindCreateGroup {
		groupID := nip29.ExtractGroupID(event.Tags)
		if groupID != "" {
			pubkeyBytes, _ := hex.DecodeString(event.PubKey)
			_ = db.CreateGroup(context.Background(), r.pool, groupID, "", "", pubkeyBytes)
			_ = db.AddGroupMember(context.Background(), r.pool, groupID, pubkeyBytes, nip29.RoleOwner)
		}
	}

	if isGroupKind(event.Kind) {
		groupID := nip29.ExtractGroupID(event.Tags)
		if groupID != "" {
			if err := nip29.CheckPermission(context.Background(), r.pool, groupID, event.PubKey, event.Kind); err != nil {
				r.sendOK(client, event.ID, false, fmt.Sprintf("invalid: %v", err))
				return
			}
			r.applyMembership(event, groupID)
		}
	}

	tagsJSON, _ := json.Marshal(event.Tags)
	idBytes, _ := hex.DecodeString(event.ID)
	pubkeyBytes, _ := hex.DecodeString(event.PubKey)
	sigBytes, _ := hex.DecodeString(event.Sig)

	if err := db.InsertEvent(context.Background(), r.pool, idBytes, pubkeyBytes, sigBytes, int64(event.CreatedAt), event.Kind, string(tagsJSON), event.Content); err != nil {
		r.sendOK(client, event.ID, false, fmt.Sprintf("error: %v", err))
		return
	}

	r.sendOK(client, event.ID, true, "")
	r.broadcastEvent(&event)
}

func isGroupKind(kind int) bool {
	return kind == nip29.KindGroupMetadata || (kind >= 9000 && kind <= 9023) || kind == 9 || kind == 10 || kind == 11
}

func firstTag(tags nostr.Tags, name string) string {
	for _, tag := range tags {
		if len(tag) >= 2 && tag[0] == name {
			return tag[1]
		}
	}
	return ""
}

// applyMembership keeps the local group membership table in sync with
// join/accept/remove events after the permission check has passed.
func (r *Relay) applyMembership(event nostr.Event, groupID string) {
	ctx := context.Background()
	switch event.Kind {
	case nip29.KindJoinRequest:
		if pubkey, err := hex.DecodeString(event.PubKey); err == nil {
			_ = db.AddGroupMember(ctx, r.pool, groupID, pubkey, nip29.RoleMember)
		}
	case nip29.KindAcceptJoinReq:
		if target := firstTag(event.Tags, "p"); target != "" {
			if pubkey, err := hex.DecodeString(target); err == nil {
				_ = db.AddGroupMember(ctx, r.pool, groupID, pubkey, nip29.RoleMember)
			}
		}
	case nip29.KindRemoveUser:
		if target := firstTag(event.Tags, "p"); target != "" {
			if pubkey, err := hex.DecodeString(target); err == nil {
				_ = db.RemoveGroupMember(ctx, r.pool, groupID, pubkey)
			}
		}
	}
}

func (r *Relay) handleReq(client *Client, msg []interface{}) {
	if len(msg) < 3 {
		r.sendNotice(client, "REQ missing subscription ID or filters")
		return
	}
	subID, ok := msg[1].(string)
	if !ok || subID == "" {
		r.sendNotice(client, "REQ invalid subscription ID")
		return
	}

	var filters []map[string]interface{}
	for i := 2; i < len(msg); i++ {
		f, ok := msg[i].(map[string]interface{})
		if !ok {
			r.sendNotice(client, "REQ invalid filter")
			return
		}
		filters = append(filters, f)
	}

	sub := &Subscription{id: subID, filters: filters, client: client}
	r.subMutex.Lock()
	r.subs[subID] = sub
	r.subMutex.Unlock()

	client.mu.Lock()
	client.subIds[subID] = true
	client.mu.Unlock()

	ctx := context.Background()
	for _, f := range filters {
		events, err := db.QueryEvents(ctx, r.pool, f)
		if err != nil {
			r.sendNotice(client, fmt.Sprintf("query error: %v", err))
			continue
		}
		for _, ev := range events {
			r.sendEvent(client, subID, ev)
		}
	}

	r.sendEOSE(client, subID)
}

func (r *Relay) handleClose(client *Client, msg []interface{}) {
	if len(msg) < 2 {
		return
	}
	subID, _ := msg[1].(string)
	if subID == "" {
		return
	}
	r.subMutex.Lock()
	delete(r.subs, subID)
	r.subMutex.Unlock()

	client.mu.Lock()
	delete(client.subIds, subID)
	client.mu.Unlock()
}
