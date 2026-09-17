package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Pool struct {
	*pgxpool.Pool
}

func NewPool(dsn string) (*Pool, error) {
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/sparkyard?sslmode=disable"
	}
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	config.MaxConns = 50
	config.ConnConfig.ConnectTimeout = 5 * time.Second

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, err
	}
	return &Pool{pool}, nil
}

func Migrate(p *Pool) error {
	ctx := context.Background()
	sql := `
CREATE TABLE IF NOT EXISTS events (
	id BYTEA PRIMARY KEY,
	pubkey BYTEA NOT NULL,
	created_at BIGINT NOT NULL,
	kind INTEGER NOT NULL,
	tags JSONB NOT NULL DEFAULT '[]',
	content TEXT NOT NULL DEFAULT '',
	sig BYTEA NOT NULL,
	received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_kind_created ON events(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN(tags);

CREATE TABLE IF NOT EXISTS groups (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT,
	created_by BYTEA NOT NULL,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
	group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
	pubkey BYTEA NOT NULL,
	role TEXT NOT NULL DEFAULT 'member',
	joined_at TIMESTAMPTZ DEFAULT NOW(),
	PRIMARY KEY (group_id, pubkey)
);

CREATE TABLE IF NOT EXISTS group_bans (
	group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
	pubkey BYTEA NOT NULL,
	banned_at TIMESTAMPTZ DEFAULT NOW(),
	PRIMARY KEY (group_id, pubkey)
);
`
	_, err := p.Exec(ctx, sql)
	return err
}

func InsertEvent(ctx context.Context, p *Pool, id, pubkey, sig []byte, createdAt int64, kind int, tags, content string) error {
	_, err := p.Exec(ctx, `
		INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
		ON CONFLICT (id) DO NOTHING
	`, id, pubkey, createdAt, kind, tags, content, sig)
	return err
}

func QueryEvents(ctx context.Context, p *Pool, filter map[string]interface{}) ([]map[string]interface{}, error) {
	query := `SELECT encode(id,'hex') as id, encode(pubkey,'hex') as pubkey, created_at, kind, tags, content, encode(sig,'hex') as sig FROM events WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if kinds, ok := filter["kinds"].([]interface{}); ok && len(kinds) > 0 {
		query += fmt.Sprintf(" AND kind = ANY($%d)", argIdx)
		args = append(args, kinds)
		argIdx++
	}
	if authors, ok := filter["authors"].([]interface{}); ok && len(authors) > 0 {
		query += fmt.Sprintf(" AND encode(pubkey,'hex') = ANY($%d)", argIdx)
		args = append(args, authors)
		argIdx++
	}
	if ids, ok := filter["ids"].([]interface{}); ok && len(ids) > 0 {
		query += fmt.Sprintf(" AND encode(id,'hex') = ANY($%d)", argIdx)
		args = append(args, ids)
		argIdx++
	}
	if since, ok := filter["since"].(float64); ok {
		query += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, int64(since))
		argIdx++
	}
	if until, ok := filter["until"].(float64); ok {
		query += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		args = append(args, int64(until))
		argIdx++
	}

	// Generic NIP-01 tag filters, e.g. "#h": ["group-id"]
	for key, val := range filter {
		if len(key) != 2 || key[0] != '#' {
			continue
		}
		tagName := key[1:2]
		values, ok := toStringSlice(val)
		if !ok || len(values) == 0 {
			continue
		}
		if len(values) == 1 {
			query += fmt.Sprintf(" AND tags @> $%d::jsonb", argIdx)
			args = append(args, fmt.Sprintf(`[["%s","%s"]]`, tagName, values[0]))
			argIdx++
			continue
		}
		parts := make([]string, 0, len(values))
		for _, v := range values {
			parts = append(parts, fmt.Sprintf("tags @> $%d::jsonb", argIdx))
			args = append(args, fmt.Sprintf(`[["%s","%s"]]`, tagName, v))
			argIdx++
		}
		query += " AND (" + strings.Join(parts, " OR ") + ")"
	}

	if limit, ok := filter["limit"].(float64); ok && limit > 0 {
		query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIdx)
		args = append(args, int(limit))
		argIdx++
	} else {
		query += " ORDER BY created_at DESC LIMIT 100"
	}

	rows, err := p.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, pubkey, sig string
		var createdAt int64
		var kind int
		var tags, content string
		if err := rows.Scan(&id, &pubkey, &createdAt, &kind, &tags, &content, &sig); err != nil {
			continue
		}
		var parsedTags interface{}
		if err := json.Unmarshal([]byte(tags), &parsedTags); err != nil {
			parsedTags = []interface{}{}
		}
		results = append(results, map[string]interface{}{
			"id":         id,
			"pubkey":     pubkey,
			"created_at": createdAt,
			"kind":       kind,
			"tags":       parsedTags,
			"content":    content,
			"sig":        sig,
		})
	}
	return results, rows.Err()
}

func toStringSlice(v interface{}) ([]string, bool) {
	arr, ok := v.([]interface{})
	if !ok {
		return nil, false
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		s, ok := item.(string)
		if !ok {
			continue
		}
		out = append(out, s)
	}
	return out, true
}

// Group helpers for NIP-29
func CreateGroup(ctx context.Context, p *Pool, id, name, description string, createdBy []byte) error {
	_, err := p.Exec(ctx, `
		INSERT INTO groups (id, name, description, created_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO NOTHING
	`, id, name, description, createdBy)
	return err
}

func AddGroupMember(ctx context.Context, p *Pool, groupID string, pubkey []byte, role string) error {
	_, err := p.Exec(ctx, `
		INSERT INTO group_members (group_id, pubkey, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (group_id, pubkey) DO NOTHING
	`, groupID, pubkey, role)
	return err
}

func RemoveGroupMember(ctx context.Context, p *Pool, groupID string, pubkey []byte) error {
	_, err := p.Exec(ctx, `
		DELETE FROM group_members WHERE group_id = $1 AND pubkey = $2
	`, groupID, pubkey)
	return err
}

func GetGroupMemberCount(ctx context.Context, p *Pool, groupID string) (int, error) {
	var count int
	err := p.QueryRow(ctx, `
		SELECT COUNT(*) FROM group_members WHERE group_id = $1
	`, groupID).Scan(&count)
	return count, err
}
