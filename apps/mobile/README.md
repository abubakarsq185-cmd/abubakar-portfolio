# GymGuide member app (Expo)

The Android-first member app. It shares `@gymguide/types` with the server and
calls exactly the same HTTP API as the web member portal — there is no separate
mobile backend and no privileged mobile endpoint.

## Running it

```bash
pnpm install
pnpm --filter @gymguide/web dev            # the API the app talks to
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 pnpm --filter @gymguide/mobile start
```

Use your machine's LAN IP rather than `localhost`: the phone is a different
device, and `localhost` on the phone is the phone.

## What is here

| Piece | File | Status |
| --- | --- | --- |
| App shell, tab navigation, Today screen | `App.tsx` | Working against the live API |
| Offline queue with idempotent replay | `src/lib/offline-queue.ts` | Complete, unit-tested contract |
| API client | `src/lib/api.ts` | Complete |
| Train / Plan / Progress / Support screens | `App.tsx` | Placeholders — the web portal at `/app` implements these flows in full |

## The offline contract

This is the part that matters on a gym floor:

1. A workout is cached under its `clientSessionId` as soon as it starts.
2. Every logged set updates that cache immediately — no debounce, no batching.
3. On finish, the session is queued.
4. The queue drains on app foreground, on reconnect and after finishing.
5. The server upserts on `(user_id, client_session_id)`, so replaying the queue
   updates one row instead of creating a second workout. The guarantee is a
   database unique index, not application logic.
6. A `4xx` other than `429` drops the item with a reason rather than retrying
   forever — a payload the server will never accept is a bug to surface, not to
   hide.

`tests/integration/webhook-idempotency.test.ts` proves point 5 against the real
database.

## Not configured

App-store distribution. The app builds and runs locally through Expo; signing
credentials, EAS configuration and store listings are deliberately absent rather
than faked. See `docs/INTEGRATIONS.md`.
