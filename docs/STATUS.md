# STATUS

Remake phase 1 (PR #4) and 2a stage board (PR #5) are merged into fork main (2026-10-31). Phase 2b (shot checklist and real-footage takes) is merged (PR #6, 4277192, 2026-10-31). Phase 2c (edit to a publishable MP4, then Annie's approval) is being planned on `feat/remake-rough-cut`, split into 2c-1 and 2c-2.

## Last verification (2026-10-31)
- `bash bin/verify.sh`: GREEN after every merge and at the final commit 47b27d8; `npm run build` and `npm run lint` exit 0.
- End-to-end test (login, client search, shortlist, plan, batch send, signed-out review link, send-back, resend, approve, double-approve guard, client memory, turn off link) passed at 1440 and 390 widths, against a fresh backend with `--demo-data`.

## Review fixes (2026-10-31)
- `bash bin/verify.sh` GREEN at the fix commits. `npm run build` and `npm run lint` were clean after each merge. The end-to-end test passed 12/12 at both 1440 and 390, in demo mode.
- Checked in a real browser:
  - Real mode with an empty account shows "No clients yet" with no page errors, and sample clients are not saved.
  - A plan edit made while the session was expired is kept through a page refresh and saved after signing in again.
  - "Preview as Annie" is read-only: the decide buttons are hidden and the server status does not change.
- Not checked in a browser:
  - The Google sign-in error messages (unit tests only).
  - The "via review link" label on comments.
  - Comment seeking in a real TikTok player.

## Phase 2a stage board (2026-10-31, branch feat/remake-stage-board)
- Plan: `docs/phase2-2a-plan.md`. Approved plans move Ready to film → Filming → Editing → Posted (board row "In production", stage select on cards and the plan page, "N posted this month").
- The backend keeps a stage only on approved plans; the review link never shows it.
- Also fixed (phase 1): `approvedAt`, `managerNote`, `shotComments` were dropped on every save; a new review-link decision now clears an old "approve with changes" note.
- `bash bin/verify.sh` GREEN (backend 296, unit 57); `npm run build`, `npm run lint` exit 0.
- End-to-end on a demo backend (8811) passed at 1440 and 390: stage survives reload, review link has no stage, Edit clears the stage and keeps approvedAt, no horizontal overflow on the board or plan page at 390.

## Phase 2b shot checklist and takes (2026-10-31, branch feat/remake-shot-takes)
- Plan: `docs/phase2-2b-plan.md`. An approved plan's page has a "Shot checklist": upload .mp4/.mov takes per shot (200 MB cap, `ftyp` check, 10 per shot), watch them, choose one, delete. Rows in the SQLite `takes` table, files in `backend/media/<ideaId>/` (git-ignored). Edit reopens the plan and leaves the takes read-only. The review link never shows takes.
- `bash bin/verify.sh` GREEN (backend 320, unit 65); `npm run build`, `npm run lint` exit 0.
- Opus whole-branch review: 0 Critical, 3 Important (plus 2 re-graded from Minor), all fixed: reopen during an upload, `..` idea id leaving the media folder (both with tests that failed first), stale list after a long upload, one busy flag for all shots, checklist not reset between plans.
- End-to-end on a demo backend (8812) at 1440 and 390 passed 9/9 (upload, choose, reload, delete, fake .mp4 rejected, no overflow at 390, read-only after Edit, no takes on the review link); after the fixes, concurrent uploads and delete-during-upload passed.
- Deferred minors: blocking writes inside the async upload handler; an orphan file if the INSERT fails; a non-integer shot gets FastAPI's `{"detail"}` shape; the progress copy "have a take" counts chosen takes; no retry after the takes list fails to load; an upload error stays visible after Edit.

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
- The approver's review page (`/review/<token>`) overflows at 390 (scrollWidth 1200, measured once on 2026-10-31); cause not investigated, possibly the TikTok embed.

## Next steps
1. User testing on the 8805 environment.
2. Phase 2 inventory done (2026-10-31): see `docs/phase2-scope.md`. User approved scope 2a-2c (stage board, shot checklist + real-footage upload, ffmpeg rough cut), real footage only. 2a stage board done on `feat/remake-stage-board` (PR to the fork, base `feat/remake-e2e`), waiting for review. Next: 2b plan after 2a merges. Still open: rough cut vs finished cut, Annie approving the cut, video storage location.
