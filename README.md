# Agency Dashboard

Internal tool for a small agency to keep track of client projects, assign and
follow up on tasks, and see what the team is doing in real time instead of
pinging people on Slack to ask "hey is this done yet".

## Stack

- Frontend: React + TypeScript, built with Vite
- Backend: Node.js + Express + TypeScript
- DB: PostgreSQL, using Prisma as the ORM
- Real-time: Socket.io
- Cron: node-cron for the overdue sweep
- Auth: JWT access token kept in memory on the client, refresh token in an HttpOnly cookie

## Running it locally

Postgres runs in Docker, everything else runs with plain npm.

```bash
# spin up postgres
docker compose up -d

# install everything (root workspace covers server + client)
npm install

# env files
cp server/.env.example server/.env
cp client/.env.example client/.env

# schema + seed data
cd server
npx prisma migrate dev --name init
npm run seed
cd ..

# run both
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

Everything seeded uses `password123` as the password:

| Role | Email |
|---|---|
| Admin | admin@agency.dev |
| PM | pm1@agency.dev, pm2@agency.dev |
| Developer | dev1@agency.dev through dev4@agency.dev |

## The schema, roughly

**User** holds `role` (ADMIN/PM/DEVELOPER) and is indexed on that column since basically every query filters by it one way or another.

**RefreshToken** is one row per issued token rather than one column on User, so a single session can be revoked/rotated without touching anything else. Indexed on `userId`.

**Client** is just the agency's clients — a Project hangs off one of these.

**Project** belongs to a Client and to a PM (`managerId`). Indexed on `managerId` because "give me this PM's projects" is one of the most common queries in the app, and on `clientId`.

**Task** is the busiest table — belongs to a Project, optionally has an assignee, and carries `status`, `priority`, `dueDate`, `isOverdue`. I also gave it a plain auto-incrementing `number` field alongside the cuid primary key, purely so the activity feed can say "Task #12" instead of a 25-character id. It's indexed on `projectId`, `assigneeId`, `status`, `priority`, `dueDate`, and `isOverdue` — that's the full list of things the filter bar and dashboards query on, so I didn't want any of those falling back to a table scan.

**ActivityLog** is append-only: project, task, who did it, what action, from/to values, when. This is the actual source of truth for the feed — nothing gets reconstructed after the fact from task history. Indexed on `(projectId, createdAt)` since "recent activity for this project, newest first" is the standard query shape, plus `taskId` for pulling a single task's history.

**Notification** is recipient + type + message + read flag. Indexed on `(recipientId, isRead)` for the unread badge count and `(recipientId, createdAt)` for the dropdown list.

## Why I picked what I picked

**Express, not Fastify.** Nothing here is CPU-bound or needs Fastify's extra throughput — it's a fairly standard CRUD app with some websocket wiring on top, and Express's middleware ecosystem made that wiring easier.

**Socket.io, not a raw WebSocket.** The feed needs rooms — per project, per user, one for admins — plus reconnection handling and a polling fallback for anyone behind a flaky proxy. All of that is already built into Socket.io. Writing my own reconnect/heartbeat logic on top of the `ws` package would just mean rebuilding a worse version of something that already works.

**node-cron, not Bull.** There's exactly one background job — flip `isOverdue` to true on tasks past their due date — running once a minute. That doesn't need retries, doesn't need a queue, and doesn't need Redis as a dependency. Bull earns its place when you've got several job types or need jobs to survive a restart; neither is true here, so it felt like the wrong tool for a single `UPDATE ... WHERE dueDate < now()`.

**Refresh token in a cookie, access token in memory.** The access token lives only in a JS variable — never localStorage — so an XSS bug can't just read it out of storage. It gets fetched again from `/api/auth/refresh` on page load and whenever a request comes back 401. The refresh token sits in an HttpOnly, SameSite=Lax cookie scoped to `/api/auth`, and gets rotated every time it's used (old one deleted, new one issued), so replaying an old refresh token just fails.

**Roles are checked on the server, full stop.** Every route goes through `requireAuth` and `requireRole`, and the list/detail endpoints also filter by `managerId` or `assigneeId` directly in the Prisma query — not after fetching everything and filtering in JS. A developer's token, no matter how it's used, can't pull back another developer's task or another PM's project.

**The real-time feed follows the same rules as the REST API.** When a socket connects it joins `user:{id}`, and admins additionally join `role:admin`. Opening a project page joins `project:{id}` for as long as you're looking at it. Every activity event gets emitted to exactly the rooms that should see it — the project room, the admin room, the owning PM's room, and the assignee's room if there is one. If you were offline and come back, the client just calls `GET /api/activity` (role-scoped, last 20, read straight from Postgres) to catch up — there's no separate in-memory cache that could get out of sync with what you're actually allowed to see.

## What's not here

- No password reset or email flow — users only come from the seed script for now.
- Lists are capped rather than properly paginated. Fine for an agency-sized dataset, would need cursor pagination if this ever had thousands of tasks.
- The overdue check runs every minute in the same process as the API server. If the server's down, overdue flags just catch up on the next tick once it's back — nothing time-critical depends on the exact minute.
- No attachments on tasks.
- One Postgres instance, no replica. Not something this scale needs.
- The hosted backend runs on Render's free tier, which spins down after ~15 minutes idle. The first request after that can take 30-60s while it wakes back up — a real user just sees a slow first load, not an error.
