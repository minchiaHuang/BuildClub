# STATUS

Remake phase 1 (PR #4) and 2a stage board (PR #5) are merged into fork main (2026-10-31). Phase 2b (shot checklist and real-footage takes) is merged (PR #6, 4277192, 2026-10-31). Phase 2c (edit to a publishable MP4, then Annie's approval) is split into 2c-1 and 2c-2. 2c-1 ("Make the video") is implemented on `feat/remake-rough-cut`, final review done, PR pending; 2c-2 (Annie approves the finished video on the no-login review link) is implemented on `feat/remake-cut-approval`, e2e done at 1440 and 390, PR pending.

## Last verification (2026-11-01)
- feat/remake-rough-cut @ 678b5a5: `bash bin/verify.sh` GREEN (backend 410 passed, 1 skipped; unit 78); `npm run build` and `npm run lint` exit 0. Final Opus review: With fixes, all fixed and re-reviewed clean.
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

## Phase 2c-1 make the video (2026-11-01 AEDT, branch feat/remake-rough-cut)
- Plan: `docs/phase2-2c1-plan.md`. An approved plan with a chosen take on every shot gets "Make the video": speed 1x / 1.1x / 1.25x, optional own music (licence tick required), progress steps, preview, Download. Output in `backend/media/<ideaId>/cut/final.mp4`; the old output stays until a new one succeeds.
- End-to-end on a demo backend (8813) with real ffmpeg and real whisper.cpp (large-v3-turbo-q5_0), synthetic takes (testsrc plus 440 Hz tone with 1.5 s silence, a landscape take, a macOS `say` take with two "um").
- 1440 wide, checks 1-8: pass 1 (disabled, "0 of 2" then "1 of 2"), 2 (steps Checking the takes, Listening for words, Rendering), 3, 5, 7, 8. FAIL 4 (stale notice only after a reload), FAIL 6 (new output not shown until reload).
- 390 wide, checks 1-9: pass 1, 2, 3 (file checked once, see below), 5, 7, 8, 9 (scrollWidth 390 on the plan page); FAIL 4 and 6 for the same two reasons. Check 10 (missing-tool errors) is pytest-only by design.
- Check 3 detail: played in the page, downloaded via the Download link (`remake-<id>.mp4`), ffprobe: h264 High, yuv420p, 1080x1920, 30/1 fps, aac LC 48 kHz stereo 192 kbps, loudness -13.0 / -13.1 LUFS (LRA 2.4-2.6 LU for the tone; target -13).
- Cut time (queued to done, tiny 6-10 s inputs): 6.6 s, 3.7 s, 4.7 s, 5.5 s. Long footage is still unmeasured. Backend suite (2026-11-01): 410 passed, 1 skipped in 21.6 s.
- Real whisper: the `say` take was transcribed as "Hello UM this is a test of the UM video cutting tool"; both "um" were cut (3.11 s take plus a 4 s tone take became 2.37 s at 1.25x and 2.90 s at 1x). The pure-tone takes returned no words: with no words at all the whole video is kept (R6; whisper hallucinations on B-roll noise can leave a silent take unprotected) (9.13 s at 1.1x). `-l auto` worked on this English clip.
- Not verified: a real iPhone HDR clip (10-bit HLG/HEVC; no tone mapping, so it may look washed out), a real human-speech clip end to end, real human speech (breath, cough, background noise), long or large takes, disk use, non-English, Instagram/TikTok upload limits, missing ffmpeg/whisper (pytest only), the review page overflow at 390, restart recovery in a browser.
- Known issues found (items 1-3 fixed; E2E recheck passed at 1440 and 390 widths, 2026-11-01):
  1. After choosing another take, the "The takes changed after this was made" notice only appears after a reload (CutPanel does not refetch when the takes change). The backend `stale` flag is correct. FIXED in a2813b7.
  2. After a re-cut finishes, the preview `<video>` keeps playing the old file until a reload (same src URL, browser keeps the old file; seen at 1440 and 390: shown 9.13 s / 2.90 s while the new file was 2.37 s / 2.67 s). The size/length text beside Download updates. FIXED in 9001b4d.
  3. A take with no speech next to takes with speech is cut away completely (gaps over 0.4 s are removed), e.g. a silent B-roll shot disappears. FIXED in 8c7dc49 (R6: a take with no transcribed words is kept whole).
  4. The Edit button asks "Continue?" in a modal; not a bug, but automation must click Continue.

## Phase 2c-2 cut approval (2026-11-01 AEDT, branch feat/remake-cut-approval)
- Plan: `docs/phase2-2c2-plan.md`. After "Make the video", the team sends the finished video to the manager from the plan page ("Send to <manager> for approval"). The approver sees it on the no-login review link under "Videos to approve" (played in the page, no download link) and approves it or sends it back with a required reason. The CutPanel shows waiting / approved / sent back with the reason. Making the video again clears the approval and the approver's card; a video replaced while the approver is watching returns "This video was replaced while you were watching. Here is the new one." Reopening the plan with Edit hides the card.
- End-to-end on a demo backend (8814) with real ffmpeg and whisper.cpp, synthetic takes (testsrc 720x1280 plus 440 Hz tone, 4 s each, 2 shots), headless Chrome (playwright-core) with a separate no-cookie context for the approver (the Playwright MCP browser was held by another session). The plan and ideas were seeded through `PUT /api/ideas` (the video was shortlisted once in the UI so it is in the library); takes were uploaded through the API; making the video, sending, the review page and every decision went through the UI.
- 1440 wide, 16 of 16 pass. 390 wide, 16 of 16 pass. Checks: (1) send with no review link -> "This client's review link is turned off. Make a new one on the Shortlist first."; (2) after Get review link, send -> "Waiting for Annie's approval · sent 1 Nov", still there after a reload; (3) the review page shows "2 to review" (plan + video), one `<video>` that plays (currentTime 1.15 s of 7.33 s), no download link and no "Download" text, signed-out `GET /api/ideas/<id>/cut/file` -> 401, approver file route 200 with no Content-Disposition even with `?download=1`; (4) Send back button disabled with an empty box, enabled after typing, card disappears, CutPanel shows "Annie sent this back · 1 Nov" plus the quoted reason; (5) resend, Approve -> "Annie approved this video · 1 Nov" after a reload, with "Making it again clears Annie's approval."; (6) making the video again -> approval gone, approver page has no video card; (7) approver page open on the old video while the team re-cuts and resends, Approve -> replaced text, `<video>` src changes from `?v=...029` to `?v=...926`; (8) Edit then Continue -> `cuts` is empty on `GET /api/review/<token>`, no video card; (9) scrollWidth 1440 at 1440 and 390 at 390 on the review page (with a 200-char unbreakable URL in the plan's "Note to approver" and both card types shown) and on the plan page.
- Not verified: restarting the server and keeping the data (`isolated-backend.sh` uses a fresh temp dir on every start, so only a reload was checked; pytest covers recover); the TikTok iframe on the review page was not the cause of the 390 overflow but its own 403/429 console noise was not checked; "can't download" is the interface only (anyone who can see the `<video>` can still save the file); a real iPhone clip, long or large takes and real speech (see 2c-1); two browser tabs deciding at the same moment (pytest `test_second_decision_404_not_waiting` only); the review link has no expiry (phase 1 design).
- Cut time was not measured separately in this run.

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
- FIXED in 2c-2 (dd04914): the approver's review page (`/review/<token>`) overflowed at 390 (scrollWidth 1200, measured 2026-10-31). Cause: grid tracks sized to the content (a long unbreakable string such as a URL in a note widened them); fixed with `minmax(0,1fr)` tracks, `min-width:0` and `overflow-wrap:anywhere` under `.shared-review`. Rechecked 2026-11-01 with a 200-char URL in a note, plan and video cards both shown: scrollWidth 390 at 390, 1440 at 1440.
- The team's plan page overflows with a long unbreakable "Note to approver" (a 200-char URL gave scrollWidth 2447 at 1440, seen once on 2026-11-01 while the plan waited); not investigated, not part of 2c-2, so the 2c-2 e2e used a short note on the plan page.

## Next steps
1. User testing on the 8805 environment.
2. Phase 2 inventory done (2026-10-31): see `docs/phase2-scope.md`. User approved scope 2a-2c (stage board, shot checklist + real-footage upload, ffmpeg rough cut), real footage only. 2a stage board done on `feat/remake-stage-board` (PR to the fork, base `feat/remake-e2e`), waiting for review. Next: 2b plan after 2a merges. Still open: rough cut vs finished cut, Annie approving the cut, video storage location.
