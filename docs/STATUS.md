# STATUS

Remake phase 1 (end-to-end review flow, design system, new backends) is merged on `feat/remake-e2e` and passed the end-to-end test; waiting for user testing.

## Last verification (2026-10-31)
- `bash bin/verify.sh`: GREEN after every merge and at the final commit 47b27d8; `npm run build` and `npm run lint` exit 0.
- End-to-end test (login, client search, shortlist, plan, batch send, signed-out review link, send-back, resend, approve, double-approve guard, client memory, turn off link) passed at 1440 and 390 widths, against a fresh backend with `--demo-data`.

## Next-day environment (port 8805, real mode, no demo data)
- Account: tommycat997@gmail.com, password given in chat.
- Start (from the worktree root, detached): `nohup bash bin/isolated-backend.sh 8805 > /tmp/env-8805.log 2>&1 &`
- Stop: `kill $(lsof -nP -tiTCP:8805 -sTCP:LISTEN)`
- It runs from a throwaway temp dir (printed in the start log, `temp dir:`), with a fresh `backend/data.db` and the pinned searches copied from `backend/pinned`. The temp dir is deleted when the script stops, so the database and the account are lost on stop; start again and re-run `add-user`.
- Budgets are all 0, so no paid call can run (analyse channel, shot list and refresh trends will be rejected).
- Health check: `curl -s http://127.0.0.1:8805/api/health`

## Known issues
- Staff can only turn off a review link while a plan is waiting for approval; after the last approval there is no way to close it.
- Closed-link and already-reviewed messages are in English ("This link has been closed", "That plan was already reviewed"), not Chinese as the plan quotes.
- Console noise in tests: 403/429 from TikTok embeds and one unexplained 404; not investigated.
- No separate horizontal-overflow check at 390 width.

## Next steps
1. User testing on the 8805 environment.
2. Phase 2: inventory for filming and editing.
