# Periodic Updates Implementation Notes

## Decision: Use Project-level Heartbeat (§4a) for Daily Briefing
- Daily briefing is NOT end-user-driven, it's a project-level admin cron
- Use `manus-heartbeat create` CLI to create the cron (project owner identity)
- Handler at `/api/scheduled/daily-briefing`
- Cron: `0 0 0 * * *` = daily 00:00 UTC = 08:00 SGT/CST

## Implementation Steps
1. Add Express handler in `server/_core/index.ts`: `app.post("/api/scheduled/daily-briefing", dailyBriefingHandler)`
2. Write handler in `server/scheduled/dailyBriefing.ts`:
   - Authenticate via `sdk.authenticateRequest(req)`, check `user.isCron`
   - Fetch all 5 clients' MEDDPICC data + recent signals + completed actions
   - Call LLM to generate briefing text
   - POST to Feishu Webhook URL (stored in DB config table)
3. Add config table for Feishu Webhook URL + enable/disable toggle
4. Add frontend config UI in POD Center or CRM Integration page
5. After deploy: `manus-heartbeat create --name daily-briefing --cron "0 0 0 * * *" --path /api/scheduled/daily-briefing`

## Key Facts
- Handler MUST be mounted BEFORE Vite fallthrough in index.ts
- Cron is 6-field: `sec min hour dom mon dow` (UTC)
- 08:00 SGT = 00:00 UTC → `0 0 0 * * *`
- Site MUST be deployed before creating the cron
- Handler must return 2xx within 2 minutes
