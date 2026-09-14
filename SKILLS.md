# Skills for Sparkyard

Skills and knowledge areas relevant to building and maintaining this project.

## Phase 2 — NIP-29 Servers/Groups (current focus)

- **Nostr protocol (NIP-29 / NIP-01)**
  - Group metadata (`kind:39000`), join requests (`kind:9021`), add-user/admin events, and group/channel messages (`kind:9` with `["h","group-id"]`).
  - Tag/filter semantics (e.g. `#h` filters), event construction, signing, verification, and `EVENT/EOSE/OK` handling.

- **React + TypeScript (strict)**
  - Wiring UI from mock data to live relay subscriptions (TanStack Query patterns used in the feed).
  - Routing to channel views and state handling for join/publish flows.

- **nostr-tools / relay client work**
  - Composing filters, subscribing/publishing via the existing relay pool, and handling idempotency.

- **Go backend (relay/API)**
  - Extending the NIP-01 WebSocket handler and `internal/nip29` permission checks.
  - Preserving the invariant: **never trust client role claims** — enforce permissions server-side.

- **PostgreSQL**
  - Using existing `groups` / `group_members` / `group_bans` schema, queries/migrations, and consistency between stored membership and accepted events.

- **Security-minded engineering**
  - Server-side authorization for all group actions, safe event validation, and awareness of relay abuse/rate-limiting hooks.

## Broader project skills (later phases / general)

- **Nostr/NIPs depth**: NIP-23/10/18/25/40 (content), NIP-57/47/60/61 (zaps/NWC/Cashu), NIP-17+NIP-44 encrypted DMs (**never NIP-04**), NIP-05/42/46.
- **Bitcoin/Lightning/Cashu**: LNURL/zap flow, NWC credential handling (bearer-secret hygiene), curated-mint trust model.
- **Mobile (Capacitor)**: iOS/Android wrapping, push notifications (APNs/FCM), platform constraints.
- **Frontend architecture/UX**: real-time data, optimistic updates, offline/latency handling, accessibility/mobile-first UI.
- **Testing & quality**: Vitest (frontend), `go test` + permission-path tests for relay/NIP-29, lint/typecheck discipline.
- **DevOps**: Docker/Postgres, env/secrets management, relay/API deployment, rate limiting/observability.
