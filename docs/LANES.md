# AX Lint: Saturday Parallel Plan

Sat Oct 17 · start 11:45 AM · **submission due Sun 10:00 AM** · tracks: Manufact + Armature only

Companion to `docs/SPEC.md` and `docs/STORIES.md`. This replaces the story schedule table: the same stories, run as parallel lanes.

## Ground rules for parallel sessions

- **One Claude Code session per lane**, each in its own git worktree on its own branch. A lane only edits the folders it owns (listed per lane).
- **Only Step 0 touches root config** (`package.json`, lockfile, `tsconfig`, workspace file). If a lane must add a dependency, it says so; at the checkpoint, keep both sides of any lockfile conflict and reinstall.
- **Merge to `main` only at checkpoints**, not continuously.
- Each worktree gets its own copy of the gitignored `.env`.
- Never hide failed trials, and never change prompts to make a baseline fail.

## Step 0 · Setup (you, 20 min)

1. Accounts and keys in `.env`: model provider key, Railway, **Blaxel (sign up with your hackathon email for the $500 credits)**, Manufact Cloud (grab the copy-paste prompt on their site and give it to the Lane C session).
2. Pick the pinned model ID for trials and put it in `.env` as `AXLINT_MODEL`.
3. Copy `SPEC.md`, `STORIES.md` and this file into `docs/` in **both** repos.
4. In the `axlint` repo, run one session with:

   > Set up this repo per the "Repo layout" in `docs/STORIES.md`: one pnpm workspace in TypeScript with vitest, tsx, zod, mcp-use, @modelcontextprotocol/sdk, the model provider's SDK and the Blaxel SDK. Add `.env.example` and gitignore `.env` and `vendor/`. Create empty folders `src/core`, `src/tools`, `src/blaxel`, `runner`, `scripts`, `examples`, `test/fixtures`, `viewer`. No application code. Commit and push.

5. Make the worktrees:

   ```bash
   git worktree add ../axlint-gate     -b lane/gate
   git worktree add ../axlint-platform -b lane/platform
   git worktree add ../axlint-core     -b lane/core
   ```

## Phase 1 · 12:00 – 2:30 · four lanes

| Lane | Where | Story | Keys | Owns |
| --- | --- | --- | --- | --- |
| A · trackr | `trackr` repo | S2 | Railway | the whole `trackr` repo |
| B · Real-server gate | `axlint-gate` | S3 (memory first, then trackr) | model | `scripts/hand-run*.ts`, `vendor/` |
| C · Platforms | `axlint-platform` | S4 | Blaxel, Manufact, model | `scripts/blaxel-spike.ts`, `src/server.ts` (ping only), `docs/platform-notes.md`, deploy config |
| D · Core | `axlint-core` | S5 | none | `src/core/`, `test/` |

**Lane A prompt** (in `trackr`):

> Implement story S2 from `docs/STORIES.md`. The full spec is in `docs/SPEC.md`; follow it exactly and don't add anything the story doesn't ask for. For the Railway steps, tell me exactly what to click or set when you need me. Stop when every acceptance check passes, and tell me which ones you ran.

**Lane B prompt** (in `axlint-gate`):

> Implement only the real-server benchmark from story S3 in `docs/STORIES.md`: `scripts/hand-run-memory.ts`. Clone the official MCP servers repo at commit `bbb701e` into `vendor/` and build the memory server. Follow every rule in S3: the model sees all nine tools; only `read_graph`, `search_nodes` and `open_nodes` execute, enforced in the code that executes calls; one fresh server process per trial with its own copy of the seed graph; a seeded fictional graph large enough that `read_graph` is expensive. Use `AXLINT_MODEL`, the temperature parameter omitted for Sonnet 5.5, single turn, and the spec's neutral system prompt. Write a compact patch to the three read-tool descriptions in the spec's compact style and show it to me before running. Print every trial: task, condition, tool, arguments, pass/fail, result tokens. Touch only `scripts/` and `vendor/`. Stop when it runs end to end and show me the table.

Then, once Lane A has `trackr` running (a local URL is fine before Railway):

> Now write `scripts/hand-run.ts` from S3 against `TRACKR_URL`: the spec's four tasks, 3 trials each, baseline versus the spec's compact patch applied by hand. Print all 24 trials the same way.

**Lane C prompt** (in `axlint-platform`):

> Implement story S4 from `docs/STORIES.md`, Blaxel first (`scripts/blaxel-spike.ts`), then the Manufact `ping` server. Tell me when you need me to log in, click something, or mount the server in Claude Code. Record lifetimes, retention and every error you hit in `docs/platform-notes.md`. Then one extra check, time-boxed to 30 minutes: make `ping` also return a trivial MCP App widget with mcp-use and tell me whether it renders in Claude. Touch only `scripts/blaxel-spike.ts`, `src/server.ts`, `docs/platform-notes.md` and deploy config.

**Lane D prompt** (in `axlint-core`):

> Implement story S5 from `docs/STORIES.md`. The full spec is in `docs/SPEC.md`; follow it exactly. Touch only `src/core/` and `test/`. Until the real `trackr` source exists, build `test/fixtures/trackr-tools.ts` from the spec's `src/tools.ts` layout; it gets replaced at the checkpoint. The acceptance check that needs S3's fidelity test can't run yet: skip it and say so. Stop when every other check passes, and tell me which ones you ran.

## Checkpoint 1 · ~2:30 (you, 20 min)

- Merge `lane/gate`, `lane/platform`, `lane/core` into `main`. Replace the `trackr` test fixture with the real `src/tools.ts` at a pinned commit.
- **Real-server gate:** decide with the table in S3. Recommendation: unless the memory results land clearly in the first row, keep `trackr` as the primary demo, and use the memory numbers as one slide plus a read-only audit in `examples/`. Switching costs about 2 hours of spec changes (stdio inside the sandbox, a second source adapter, commit-based confirm) on a day with no slack.
- **Blaxel:** works, continue. Fails, choose the fallback now (a local runner behind a tunnel) and note it in the spec.
- **MCP App check:** renders in Claude, Lane G builds the viewer as an MCP App first. Doesn't, Lane G builds the web page first.
- Re-make worktrees for Phase 2 from the new `main`.

## Phase 2 · 2:30 – 6:30 · three lanes (plus A finishing)

| Lane | Story | Owns |
| --- | --- | --- |
| E · Runner and run tools | S6 | `runner/`, `src/blaxel/`, `src/tools/verify*`, `src/tools/get*` |
| F · Audit, propose, confirm | S7 | `src/tools/audit*`, `src/tools/propose*`, `src/tools/confirm*` |
| G · Viewer | S9 item 1 | `viewer/`, plus the widget hookup in `src/tools/get*` at the end |
| A · trackr | `scripts/fidelity.test.ts` from S3 | `trackr` repo |

Lanes E and F use the standard per-story prompt from `STORIES.md`. **Lane G prompt:**

> Implement the presentation viewer from story S9, item 1, in `viewer/`, against fixture run files: write a `progress.json` and `result.json` that validate against the core schemas in `src/core/`, and build the page to read them. The design is the run page mockup: Audit, Patch, Trials grid, One trial up close, Verdict, Confirm; dark background; blue for pass, dashed orange for fail; nothing under 16px. Then return the same view as an MCP App widget from `get_verification_result` with mcp-use. Touch only `viewer/` until Lane E's `get_verification_result` is merged; then wire the widget in.

The MCP App is **not** a stretch any more: Manufact pitched MCP Apps from the stage.

## Checkpoint 2 · ~6:30 → S8 milestone by ~7:30

Merge E, F, G. Run S8: deploy to Manufact Cloud, then the seven checks from Claude Code in the `trackr` repo. Nothing else starts until all seven pass.

## Phase 3 · 7:30 – 11:30

1. Wire the viewer to live runs and confirm the MCP App renders the real result in Claude.
2. Read-only audit of the memory server into `examples/` (S9 item 2).
3. `README.md` (S9 item 3).
4. Replay mode for the viewer.

Leaving after midnight means no re-entry until 6 AM: decide by 11:30 whether you stay.

## Phase 4 · 11:30 PM – 2 AM

- Save a complete recorded run (replay files) and a full screen recording of the loop.
- Write `docs/demo.md` (S10).
- **Record the submission video tonight.** Only a few teams present live, so the video may be all the judges see.

## Sunday

- 7:00 – 9:00: two clean rehearsals from a fresh state. Fix only what breaks the demo.
- **Submit by 9:30** (deadline 10:00). Tick Manufact and Armature only.

## Cut list if behind, in order

1. Eval-action exporter
2. `full`-style second patch
3. `yfinance` public audit
4. Replay mode (keep the screen recording)
5. README polish beyond the essentials

Never cut: the seven S8 checks, the MCP App view of the verdict, the submission video.
