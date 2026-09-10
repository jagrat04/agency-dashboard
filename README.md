# Agency Dashboard

Internal tool for a small agency to manage client projects, track tasks, and
watch team activity in real time.

## Stack

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via Prisma
- **Real-time**: Socket.io
- **Background jobs**: node-cron
- **Auth**: JWT access token (in memory, client side) + refresh token (HttpOnly cookie)

## Local setup (Docker for Postgres)

```bash
# 1. start Postgres
docker compose up -d

# 2. install deps (root workspace covers both server and client)
npm install

# 3. configure env
cp server/.env.example server/.env
cp client/.env.example client/.env

# 4. create schema + seed data
cd server
npx prisma migrate dev --name init
npm run seed
cd ..

# 5. run both apps
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Seed accounts (password `password123` for all):

| Role | Email |
|---|---|
| Admin | admin@agency.dev |
| PM | pm1@agency.dev, pm2@agency.dev |
| Developer | dev1@agency.dev .. dev4@agency.dev |

## Database schema

- **User** — `id, name, email, passwordHash, role`. Indexed on `role` (role-scoped queries run on almost every request).
- **RefreshToken** — one row per issued refresh token, so tokens can be individually revoked/rotated. Indexed on `userId`.
- **Client** — the agency's clients. A `Project` belongs to one client.
- **Project** — belongs to a `Client` and to a managing `User` (PM). Indexed on `managerId` (every PM-scoped query filters by it) and `clientId`.
- **Task** — belongs to a `Project`, optionally assigned to a `User`. Carries `status`, `priority`, `dueDate`, `isOverdue`. Also has a separate `number` (auto-increment int) purely for human-friendly display ("Task #12") since the primary key is a cuid. Indexed on `projectId`, `assigneeId`, `status`, `priority`, `dueDate`, `isOverdue` — these are exactly the columns every list/filter/dashboard query touches.
- **ActivityLog** — append-only audit trail: `projectId, taskId, actorId, action, fromValue, toValue, createdAt`. This is the source of truth for the activity feed — nothing about "who changed what" is derived or recomputed. Indexed on `(projectId, createdAt)` (the feed always queries "recent activity for this scope, newest first") and `taskId`.
- **Notification** — `recipientId, type, message, taskId, isRead`. Indexed on `(recipientId, isRead)` (unread badge count) and `(recipientId, createdAt)` (dropdown list).

## Architectural decisions

**Express over Fastify.** This is a CRUD-heavy internal tool with moderate traffic; Express's middleware ecosystem and familiarity outweigh Fastify's raw throughput advantage here.

**Socket.io over raw WebSocket.** The spec needs rooms (per-project viewers, per-user, admin-wide), reconnection with backoff, and a fallback transport — all things Socket.io already handles correctly. Implementing reconnection/heartbeat logic by hand on top of `ws` would just reproduce a worse version of what Socket.io ships.

**node-cron over Bull/BullMQ for the overdue job.** There's exactly one background job (sweep overdue tasks) with no retries, no queueing of arbitrary jobs, and no need for a second infrastructure dependency (Redis). Bull earns its keep when you have many job types, need retries/backoff, or want job persistence across restarts — none of which applies to a single `UPDATE ... WHERE dueDate < now()` running every minute.

**Refresh token in an HttpOnly cookie, access token in memory.** The access token never touches `localStorage`, so it isn't reachable by an XSS payload; it lives only in a JS variable and is re-acquired via `/api/auth/refresh` on page load and on 401. The refresh token is HttpOnly + SameSite=Lax, scoped to `/api/auth`, and rotated on every use (old token deleted, new one issued) — reuse of a stale token fails closed.

**Role enforcement lives entirely on the server.** Every route runs `requireAuth` + `requireRole`, and list/detail endpoints additionally filter by ownership (`managerId`, `assigneeId`) in the Prisma query itself — a developer's JWT simply cannot retrieve another developer's task or another PM's project, regardless of what the frontend renders.

**Real-time role-filtered feed.** On connect, a socket auto-joins `user:{id}` and, for admins, `role:admin`. Viewing a project additionally joins `project:{id}`. Every activity write emits to exactly the rooms that should see it: the project room, `role:admin`, the owning PM's room, and (if assigned) the developer's room. A client that reconnects after being offline calls `GET /api/activity` (role-scoped, `limit=20`, straight from Postgres — no in-memory cache) to backfill whatever it missed.

## Known limitations

- No password reset / email flow — accounts are provisioned via the seed script only.
- No pagination on task/activity lists beyond the fixed `take` limits; fine at agency scale, would need cursor pagination at real scale.
- The overdue sweep runs every minute in-process; if the server is down for a stretch, overdue flags catch up on the next tick rather than the exact due instant.
- No file attachments on tasks.
- Single Postgres instance, no read replica — not a concern at this scale.
