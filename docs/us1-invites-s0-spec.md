# US1 Invites S0 Spec

1. Invite status lifecycle:
   - `pending | accepted | declined | expired | canceled`
2. Expiration:
   - `expiresAt = createdAt + 5 minutes`
   - No scheduler/cron required in S1.
   - On read/action, if `pending` and `now > expiresAt`, status transitions to
     `expired`.
3. Permission rules:
   - Only the current room host can send invites.
   - Invites only target rooms in waiting/pre-start state.
   - Cannot invite users already in the room.
   - Cannot invite if room is full.
4. Eligibility rules:
   - Block duplicate `pending` invites for same `(roomId, inviteeId)`.
   - Allow simultaneous pending invites from different rooms.
   - "Invitee already in another game" remains a future/desirable rule.

## Data Model

Invite record (`InviteRecord`):

- `inviteId: string`
- `roomId: string`
- `gameType: "monopoly"` (future-proof type field kept now)
- `inviterId: string`
- `inviteeId: string`
- `status: "pending" | "accepted" | "declined" | "expired" | "canceled"`
- `createdAt: string` (ISO)
- `updatedAt: string` (ISO)
- `expiresAt: string` (ISO)
- `respondedAt?: string` (ISO, set on accepted/declined)
- `canceledAt?: string` (ISO, set on canceled)

Indexes:

- Unique partial index on `(roomId, inviteeId)` where `status = "pending"`.
- Lookup index on `(inviteeId, status, createdAt desc)`.
- Lookup index on `(inviterId, status, createdAt desc)` for inviter-side
  status views.

## States

Allowed transitions:

- `pending -> accepted`
- `pending -> declined`
- `pending -> expired`
- `pending -> canceled`

Terminal states:

- `accepted`, `declined`, `expired`, `canceled`

Invalid transitions:

- Any transition from terminal states.
- `accept/decline/cancel` attempted after lazy-expiration check marks invite
  `expired`.

## Permissions

Actor: inviter (also host under current rules)

- send: allowed if inviter is current host and validations pass
- cancel: allowed for pending invites they sent
- accept/decline: not allowed

Actor: invitee

- list own invites: allowed
- accept: allowed only on own pending invite
- decline: allowed only on own pending invite
- cancel: not allowed

Actor: other users

- no invite actions allowed

## API

Base path: `/api/invite`

### `POST /send`

Purpose:

- Create a pending invite.

Request body:

- `auth`
- `payload: { roomId: string, inviteeUsername: string }`

Response on success:

- `200` with invite summary.

Validation failures:

- non-host sender
- room missing/not waiting/full
- invitee missing/already in room
- duplicate pending invite

### `GET /mine`

Purpose:

- List invitee's actionable invites.

Behavior:

- Default returns only actionable invites (pending and not expired after lazy
  check).
- Optional `includeHistory=true` returns terminal states too.

### `POST /:inviteId/accept`

Purpose:

- Accept invite and attempt room join.

Behavior:

- Lazy-expire first.
- If valid: join room, mark invite `accepted`, set `respondedAt`.
- If room full or gone: return clear error and mark invite non-actionable
  (`expired` recommended for gone/invalid context).

### `POST /:inviteId/decline`

Purpose:

- Decline own pending invite.

Behavior:

- Lazy-expire first.
- If valid: mark `declined`, set `respondedAt`.

### `POST /:inviteId/cancel`

Purpose:

- Cancel pending invite by inviter/host.

Behavior:

- Lazy-expire first.
- If valid: mark `canceled`, set `canceledAt`.

## Error Contract

Status code usage:

- `400`: malformed request payload
- `403`: auth or permission failure
- `404`: invite/room/user not found
- `409`: conflict/invalid state (duplicate pending, already in room, room
  full, non-pending action)
- `410`: invite expired

All errors return:

- `{ "error": "clear human-readable message" }`

## Realtime Delivery

Requirement:

- New invites must appear without page refresh.

- Use socket push for live updates, plus REST fetch on page load.

Proposed socket events:

- `inviteCreated` (to invitee)
- `inviteUpdated` (to invitee and optionally inviter view)

Fallback:

- UI always calls `GET /mine` on load/reconnect to reconcile state.

## Requirement Traceability (US1 Essential)

1.1 Invite UI selection: supported by `POST /send` contract and frontend
invite picker. 1.2 Host-only invites: permission checks in send endpoint. 1.3
Cannot invite user already in room: send validation. 1.4 Recipient sees invite
without refresh: socket push + `GET /mine`. 1.5 Invite item includes
inviter/game/room/timestamp: invite summary shape. 1.6 Accept from home:
`POST /:inviteId/accept` + home action UI. 1.7 Decline from home:
`POST /:inviteId/decline` + home action UI. 1.8 Full/deleted room accept
failure and cleanup: accept semantics + clear errors. 1.9 Duplicate pending
blocked: unique partial index + send validation.
