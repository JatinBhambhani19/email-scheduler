# Email Job Scheduler (Express + BullMQ + Redis + Postgres + React)

## Run
```bash
docker compose up -d                       # Postgres, Redis (AOF), Elasticsearch
cd backend && cp .env.example .env && npm i && npm run dev   # API + worker (also: npm run worker for extra worker processes)
cd frontend && npm i && npm run dev        # http://localhost:5173
```
Bull Board (live queue view): http://localhost:4000/admin/queues

## Setup
- **Ethereal**: nothing manual. On first boot `SENDER_COUNT` accounts are created via `nodemailer.createTestAccount()` and stored in the `senders` table. View sent mail at https://ethereal.email/messages (log in with the `senders` credentials).
- **Google OAuth**: create a Web OAuth client, redirect URI `http://localhost:5173/auth/google/callback`, set `GOOGLE_CLIENT_ID/SECRET`.
- **Slack OAuth**: create a Slack app, add scope `incoming-webhook`, redirect URL `http://localhost:5173/auth/slack/callback` (use an https tunnel such as ngrok if Slack rejects http; then set `BASE_URL` to it), set `SLACK_CLIENT_ID/SECRET`.

## Architecture
- **Scheduling**: `POST /api/schedule` inserts one row per recipient in Postgres and adds a BullMQ delayed job (`jobId=email-<rowId>`). No cron. Senders are assigned round-robin; recipient *i* is delayed by `start + i*delay`.
- **Persistence**: jobs live in Redis (AOF on) and rows in Postgres. After a restart the worker resumes and delayed jobs fire at their original time.
- **Idempotency**: deterministic `jobId`, plus the worker atomically claims a row (`UPDATE ... WHERE status='scheduled'`) before sending, so a job can never send twice.
- **Concurrency**: `WORKER_CONCURRENCY` (default 5).
- **Min delay between sends**: BullMQ worker limiter, 1 job per `MIN_DELAY_MS` (default **2000 ms**), global across all workers.
- **Hourly limit**: Redis `INCR` on `rl:<sender>:<hourWindow>` (atomic, shared by all workers/instances). Limit = compose form value, else `MAX_EMAILS_PER_HOUR_PER_SENDER`. Over the limit, the counter is rolled back and the job is moved to the next hour window (`moveToDelayed`, offset by row id to keep order). Nothing is dropped.
- **Slack**: on the first limit hit per sender/hour a message is posted to the user's stored webhook. Not connected means it is skipped; connecting later works with no redeploy.
- **Search**: emails are indexed in Elasticsearch on schedule and on send; `GET /api/search?q=`.
- **1000+ emails at once**: all are queued as delayed jobs; the limiter spaces sends, hourly counters push the overflow to later hours.

## Features
Backend: scheduler, persistence, idempotency, concurrency, min delay, hourly limits, Slack OAuth + alerts, Elasticsearch, Bull Board, Google OAuth (JWT cookie).
Frontend: Google login, header with name/email/avatar/logout, Scheduled/Sent tabs, compose modal with CSV parsing, loading/empty/error states, Slack connect.

## Assumptions / trade-offs
- Delivery is at-most-once: a crash between claiming and sending leaves the row in `sending` rather than risking a duplicate.
- UI is a clean approximation; I could not open the Figma file, so pixel-matching is left to you.
- Schedule inserts run sequentially (fine for thousands; batch for more). No automated tests.
