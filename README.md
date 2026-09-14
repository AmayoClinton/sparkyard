# Sparkyard

A cross-platform (iOS + Android + Web) social and community app built on the **Nostr protocol**, designed for the Bitcoin/Lightning ecosystem. Sparkyard combines Ditto-style self-hostable community servers, YakiHonne-style long-form content and Lightning-native monetization, and Discord-style channels — all with a portable Nostr identity that no single server can take away.

> **Status:** Phases 1–5 complete — feed, groups, content, payments, Smart Widgets, NIP-17 encrypted DMs, broadcast channels, self-hosted relay mode, and push notifications are wired end-to-end and unit-tested.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Development](#development)
- [Nostr Protocol Support](#nostr-protocol-support)
- [Security](#security)
- [Build Phases](#build-phases)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Implemented (Phases 1–5)

- **Nostr Identity** — Sign in via NIP-07 browser extension or NIP-46 bunker signer. No email, no password, no server lock-in.
- **Real-time Feed** — Live timeline of kind-1 text notes from multiple relays with profile resolution (kind-0 metadata).
- **Composer + content** — Notes with 280-character limit, replies (NIP-10), reposts (NIP-18), reactions/votes (NIP-25), stories (NIP-40), and long-form articles (NIP-23).
- **Servers** — NIP-29 group directory, group metadata, join/leave, and channel messages with server-enforced roles.
- **Encrypted DMs** — NIP-17 rumor → NIP-44 seal → kind:1059 gift wrap, decrypted through the signer. NIP-04 is never used.
- **Broadcast channels** — Read-only NIP-29 kind:9 channels by group ID, no membership required.
- **Lightning zaps** — NIP-57 zap requests, LNURL-pay invoices, payment via WebLN or NWC, and signed kind:9735 receipts.
- **NWC wallet** — NIP-47 connection strings with AES-GCM encrypted secrets and non-extractable device keys. Supports get_balance, pay_invoice, get_info.
- **Cashu ecash** — Curated mint allowlist only, cashuA token codec, proof validation, balance, and local send/receive.
- **Smart Widgets** — kind:30033 apps in a script-only sandboxed iframe (opaque origin) behind a reputation gate.
- **Self-hosted relay** — Settings toggle adds `ws://localhost:8081` to the relay pool.
- **Push notifications** — Browser Notification API plus Capacitor `PushNotifications` bridge, triggered by DMs and mentions.
- **Deterministic Avatars** — Zero-upload avatar generation from pubkey hash. Geometric identicon + initial letter.
- **4-Mode Theme System** — Light / Dark (default) / Black (AMOLED) / System. Respects `prefers-reduced-motion`.
- **Multi-Relay Pool** — Auto-connect, subscription multiplexing, exponential backoff reconnect, and publish to all writable relays.
- **Mobile-First UI** — Bottom tab navigation, sticky header, responsive layout optimized for iOS/Android via Capacitor.
- **Relay hardening** — Per-IP token-bucket rate limiting before the WebSocket upgrade.

### Coming Soon

- Native store builds (Capacitor projects + APNS/FCM credentials)
- Full NIP-46 bunker signer with `nip44_decrypt`
- NIP-42 relay authentication
- Local persistence for sent DMs

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript (strict) + Vite |
| **Styling** | Tailwind CSS + shadcn/ui primitives |
| **State / Data** | TanStack Query (relay subscriptions + caching) |
| **Protocol** | `nostr-tools` / Nostrify for events, signing, relay pooling |
| **Mobile** | Capacitor (wraps web build for native iOS/Android) |
| **Backend** | Go 1.22 + `go-nostr` |
| **Database** | PostgreSQL (event indexing, full-text search, group metadata) |
| **Transport** | WebSocket (NIP-01 relay protocol) |

---

## Architecture

```
sparkyard/
├── frontend/                    # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/          # UI primitives, shared components
│   │   ├── pages/               # Feed, Servers, Messages, Wallet
│   │   ├── services/            # Nostr relay, auth, identity, theme
│   │   ├── types/               # Nostr type definitions
│   │   └── lib/                 # Utility helpers (cn)
│   ├── tests/                   # Vitest unit tests
│   └── capacitor.config.ts      # Mobile wrapper config
│
└── server/                      # Go relay + API
    ├── cmd/relay/
    │   └── main.go              # HTTP server entry
    └── internal/
        ├── relay/               # WebSocket handler (NIP-01)
        ├── db/                  # Postgres pool, migrations, queries
        ├── nip29/               # Server-side permission enforcement
        └── auth/                # NIP-42 auth, rate limiting hooks
```

### Key Design Decisions

- **No raw nsec in browser storage** — Primary auth is NIP-07 extension or NIP-46 remote bunker signer.
- **Server-enforced NIP-29 permissions** — All admin/mod/member checks run in the Go backend. Client role claims are treated as untrusted input.
- **Deterministic avatars** — Generated client-side from the pubkey hash. No upload infrastructure, no storage costs.
- **Theme preference is device-local** — Stored in localStorage / NIP-78 app data, never baked into the account.

---

## Quick Start

### Prerequisites

- Node.js 20+
- Go 1.22+
- PostgreSQL 15+
- (Optional) Docker for Postgres

### 1. Clone & Frontend Setup

```bash
git clone <repo-url>
cd sparkyard/frontend
npm install
npm run dev          # http://localhost:8080
```

### 2. Backend Setup

```bash
cd ../server

# Start Postgres (Docker)
docker run -d   --name sparkyard-db   -e POSTGRES_PASSWORD=postgres   -p 5432:5432   postgres:16

# Copy env and run
cp .env.example .env
go mod tidy
go run ./cmd/relay   # http://localhost:8081
```

### 3. Run Tests

```bash
# Frontend
cd frontend
npm test             # type-check, lint, unit tests, prod build

# Backend
cd server
go test ./...
```

### 4. Run with Docker

The full stack (Postgres + Go relay + built frontend) runs with Docker Compose:

```bash
cd ~/sparkyard
docker-compose build
docker-compose up -d

# Frontend: http://localhost:8080
# Relay:    ws://localhost:8081
```

Stop the stack with `docker-compose down` (add `-v` to also remove the Postgres volume).

---

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 8080) |
| `npm run build` | TypeScript compile + production build |
| `npm run preview` | Preview production build locally |
| `npm run test` | Full test suite (tsc, eslint, vitest, build) |
| `npm run lint` | ESLint only |
| `npm run cap:sync` | Sync web build into native projects |
| `npm run cap:add:android` | Create the Android native project (one-time) |
| `npm run cap:add:ios` | Create the iOS native project (one-time) |
| `go run ./cmd/relay` | Start Go relay server |
| `go test ./...` | Run Go unit tests |

### Adding a NIP-29 Group Server

The backend enforces group permissions server-side. To create a group, insert into the `groups` and `group_members` tables:

```sql
INSERT INTO groups (id, name, description, created_by)
VALUES ('my-group', 'My Community', 'A test group', decode('PUBKEY_HEX', 'hex'));

INSERT INTO group_members (group_id, pubkey, role)
VALUES ('my-group', decode('PUBKEY_HEX', 'hex'), 'owner');
```

All group events must include an `h` tag with the group ID. The relay rejects unauthorized actions before storage.

### Mobile Build

Capacitor 6 is installed. Create the native projects once, then sync the web build:

```bash
cd frontend
npm run cap:add:android   # or: npm run cap:add:ios
npm run build
npm run cap:sync
npm run cap:open:android  # or: npm run cap:open:ios
```

iOS builds require macOS + Xcode; Android builds require Android Studio. Push notifications need APNS/FCM credentials configured in the native projects.

---

## Nostr Protocol Support

| Feature | NIP | Status |
|---------|-----|--------|
| Base events, relay comms | NIP-01 | ✅ Live |
| Groups / servers / channels | NIP-29 | ✅ Backend enforced, UI wired |
| Long-form articles | NIP-23 | ✅ Live |
| Replies / threads | NIP-10 | ✅ Live |
| Reposts | NIP-18 | ✅ Live |
| Reactions / voting | NIP-25 | ✅ Live |
| Zaps | NIP-57 | ✅ Live |
| Wallet Connect | NIP-47 | ✅ Live |
| Cashu wallet | NIP-60 / NIP-61 | ✅ Curated mints, token codec |
| Encrypted DMs | NIP-17 + NIP-44 | ✅ Live (NIP-04 never) |
| Broadcast channels | NIP-29 | ✅ Read-only kind:9 |
| Push notifications | — | ✅ Browser + Capacitor bridge |
| Status / stories | NIP-40 | ✅ Live |
| Human-readable identity | NIP-05 | ✅ Displayed in feed |
| Relay auth | NIP-42 | ⏳ Planned |
| Remote signing | NIP-46 | 🔄 Skeleton |
| Smart Widgets | kind:30033 | ✅ Sandboxed iframe |

---

## Security

Non-negotiable requirements built in from the first commit:

- **Key management** — Raw nsec is never persisted in localStorage, sessionStorage, or any JS-reachable storage. Use NIP-07 or NIP-46 only.
- **Relay permissions** — NIP-29 group checks (admin, mod, member, ban) are enforced server-side. Never trust a client-supplied role claim.
- **DM encryption** — NIP-17 + NIP-44 only. NIP-04 is explicitly not implemented and will not be added.
- **Smart Widgets** — Will render in sandboxed iframes with `sandbox` attribute and CSP blocking access to app storage.
- **Payments** — NWC connection strings treated as bearer credentials (never logged, never stored plaintext). Curated Cashu mint list by default.
- **Rate limiting** — Hook points in relay handler; add token-bucket middleware before public launch.
- **Secrets** — All secrets in `.env` / secrets manager. `.env` is gitignored from commit one.

---

## Build Phases

1. **Core loop** — Auth (NIP-07/NIP-46), feed, basic zaps, avatar generation. ✅ **Complete**
2. **Servers** — NIP-29 groups/channels, server-enforced roles. ✅ **Complete**
3. **Content layer** — Long-form (NIP-23), voting/sorting (NIP-25), status/stories (NIP-40). ✅ **Complete**
4. **Payments & widgets** — NIP-57 zaps, NIP-47 NWC, Cashu wallet, sandboxed Smart Widgets. ✅ **Complete**
5. **Mobile + messaging** — NIP-17 DMs, broadcast channels, push notifications, self-hosted relay mode. ✅ **Complete**

---

## Contributing

- TypeScript strict mode (frontend); `gofmt` + `golangci-lint` clean (backend).
- Every relay-facing permission check must be tested server-side.
- Write unit tests for NIP event construction/parsing before wiring up UI.
- No secrets committed — use `.env` + `.gitignore`.
- Small, reviewable PRs per phase item.
- Comment any deviation from a NIP spec with a link to the spec being extended.
- Keep NIP-29 permission logic and signing/key-handling code in a single coherent scope — don't split security-critical logic across parallel agents.

---

## License

MIT

---

> **Sparkyard** — Your keys, your identity, your community. No single admin or company can permanently deplatform you.
