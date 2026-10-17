# AX Lint: End-to-End Technical Spec

Oct 13, 2026 · Ransom Horne · v3, frozen for implementation

**Authorized implementation update, Oct 17:** `AXLINT_MODEL=claude-sonnet-5-5`. Anthropic recognizes this model but rejects `temperature: 0` with HTTP 400, "temperature is deprecated for this model." The user authorized omitting the parameter. Both conditions use the model default sampling behavior; no temperature value is claimed in run config. All 24 original rejected memory trials remain recorded. All other frozen requirements remain in force.

## The rule

AX Lint verifies a candidate interface. The coding agent may apply it only after the verifier shows the candidate improves observed agent behavior without violating the interface contract. The final source must then reproduce the verified interface exactly.

## Scope

This spec defines one complete loop against one controlled server, precisely enough to hand to a coding agent: audit an MCP server, propose a metadata patch, verify it against baseline, apply it, and confirm the applied source reproduces what was verified. Research is frozen; anything not needed for this loop is out.

**The loop, in order:**

1. `audit_server(server_url)` reads the live `tools/list` and returns findings.
2. `propose_patch(audit, source_files)` returns a PatchSpec: metadata operations (authoritative) plus source edits generated from them in code. Nothing is written to disk.
3. `verify_patch(server_url, patch, tasks, trials)` starts a verification job in a Blaxel sandbox and returns its `run_id` immediately.
4. `get_verification_result(run_id)` returns progress, then the per-task result and a verdict.
5. On an Improved verdict, the coding agent applies the source edits, commits and pushes; Railway redeploys `trackr` on the new commit.
6. `confirm_patch(server_url, run_id, expected_revision)` checks the server is the same deployment now running the patched revision, then checks its `tools/list` equals the exact candidate stored with that run.

**Generality, stated plainly (also goes in the README):** the verification architecture (audit, wire-op candidate, A/B trials against one server, confirm) is general to any MCP server. The source-edit generator supports exactly one TypeScript layout this weekend.

**Invariants (any violation is a bug):**

- **Tool behavior is identical in both conditions, including validation.** Baseline and candidate trials call the same running server. Only the metadata shown to the model differs. Improvements are therefore attributable to the interface alone.
- **Patches touch descriptive metadata only.** Allowed in the MVP: tool descriptions and descriptions of existing parameters. Not allowed: `enum`, `default`, renames, type changes, `required` changes, or adding/removing tools or parameters. Allowed values and defaults may be stated in description text.
- **Scoring is programmatic.** Tool choice and arguments are checked in code. No LLM judge anywhere in verification.
- **Nothing is hidden.** Every trial, including failures and infrastructure errors, appears in the result. Results at N=3 are labeled provisional.
- **AX Lint never writes to the repo and holds no run state.** It reads source passed in by the coding agent and returns data; run state lives in the Blaxel sandbox.

**Non-goals for this weekend:** enum and default patching, multi-turn task completion, write/mutating tools, arbitrary public-server execution (public servers are audited read-only), patching any source layout other than `trackr`'s, baseline caching, automatic test generation, the PR gate, harness-specific behavior such as Tool Search, dashboards (a read-only presentation viewer that reads run files is a polish item, not part of the product contract), and the Manufact eval-action exporter unless a minimal case is proven first.

## The target: `trackr`, a read-only issue tracker

**What it is.** The bug tracker for a fictional small online store, Larkspur Goods, whose four-person engineering team has filed 40 issues about the checkout page, login, search, the cart and so on. `trackr` exposes those issues to agents through MCP so an assistant can answer things like "what's blocked?", "what is Maria working on?" or "find the checkout bugs." It's deliberately the shape of real issue-tracker MCP servers (GitHub, Linear, Jira), which every developer recognizes and which the study scored among the weakest.

**Where it lives.** Its own GitHub repo, separate from AX Lint, deployed on Railway. During the demo the coding agent works in the `trackr` repo, the way a real maintainer would work in their own server's repo.

A small TypeScript MCP server over streamable HTTP, deployed on Railway from GitHub with auto-deploy on push, with three deliberately flawed interfaces and one clean one. Every tool is read-only, so state never changes between trials.

**Honesty rule for the baseline.** The flawed descriptions must look like real low-scoring servers, not sabotage. Model them on the study's examples of low-quality descriptions ("Retrieves the content of a specific email.", "Get detailed information about a specific place."): short, generic, technically true. No misleading text.

| Tool | Baseline description (verbatim) | Inputs | Runtime behavior | Planted flaw |
| --- | --- | --- | --- | --- |
| `list_issues` | "List issues." | `status?: string`, `assignee?: string`, `include_comments?: boolean`, `limit?: number` | Filters by exact status and case-insensitive assignee match on username or display name. `include_comments` defaults to `true`. `limit` defaults to 50. The handler validates `status` against `STATUS_VALUES` and returns `isError: true` with `Invalid status: <value>` otherwise | Overlaps `search_issues`; `status` is an undocumented free string; `include_comments` controls payload size but is undocumented |
| `search_issues` | "Search issues." | `query: string`, `include_comments?: boolean` | Case-insensitive substring match over title and body. Comments included by default | Overlaps `list_issues` |
| `get_issue` | "Get a single issue by its ID, for example TRK-117. Returns the title, status, assignee, body and full comment thread." | `id: string` | Returns one issue or `isError: true` with `Issue not found` | None; this is the control |

**Source layout.** This is the one layout `propose_patch` supports this weekend:

- `src/tools.ts` defines each tool in its own object: `name`, `description` as a single double-quoted string literal on one line, and `params` as a Zod shape with one parameter per line, e.g. `status: z.string().optional(),`. No `.describe()` in the baseline.
- `src/validation.ts` exports `STATUS_VALUES = ["open", "in_progress", "blocked", "closed"] as const`. The handler validates against it. The schema stays `z.string()` in both baseline and patched versions.
- `src/handlers.ts` holds handler logic. A valid patch never touches it.
- `fixtures/issues.json` is the data.

**Deployment identity.** `trackr` reports `serverInfo.version` in its MCP `initialize` response as `<DEPLOYMENT_ID>@<GIT_SHA>` (for example `trackr-demo-001@abc1234`), read from environment variables: `DEPLOYMENT_ID` is a fixed Railway service variable, and the SHA comes from the commit-SHA variable Railway injects on GitHub deploys (confirm its exact name in S2). Because Railway redeploys on every push, the revision changes automatically when the coding agent pushes the applied patch. This is how AX Lint knows which deployment and which source revision it is talking to.

**Fixtures:**

- 40 issues, `TRK-101` to `TRK-140`.
- Statuses: 14 `open`, 9 `in_progress`, 6 `blocked`, 11 `closed`.
- Assignees: `maria` (Maria Lopez), `dev` (Dev Patel), `sam` (Sam Okafor), `priya` (Priya Nair). Maria has 4 `open` issues.
- Five issues mention "checkout" in the title or body, across mixed statuses.
- Each issue has 8 to 15 comments of 60 to 120 words. Target: Maria's open issues with comments come to at least 5,000 tokens; without comments, under 500.
- `TRK-117` exists, is `in_progress`, and is assigned to `dev`.

## The four test tasks

All four are single-turn routing tasks: the trial passes or fails on the first tool call the model makes. One task per planted flaw, plus a control that should pass in both conditions. Prompts contain no hints about parameter names.

| ID | Prompt (verbatim) | Targets | Pass when the first tool call is |
| --- | --- | --- | --- |
| `t1-route` | "List the issues about the checkout page." | Tool ambiguity | `search_issues` with `query` containing "checkout" |
| `t2-status` | "Which issues is someone actively working on right now?" | Undocumented allowed values | `list_issues` with `status` equal to "in_progress" |
| `t3-payload` | "Give me a quick list of maria's open issues." | Undocumented payload control | `list_issues` with `status` equal to "open", `assignee` containing "maria", and `include_comments` equal to `false` |
| `t4-control` | "Pull up issue TRK-117." | Control | `get_issue` with `id` equal to "TRK-117" |

**Task file format** (`tasks.json`). The matcher vocabulary mirrors Manufact eval-action's argument matching so an exporter later is a mapping, not a redesign:

```json
{
  "tasks": [
    {
      "id": "t1-route",
      "prompt": "List the issues about the checkout page.",
      "control": false,
      "expect": { "tool": "search_issues", "args": { "query": { "contains": "checkout" } } }
    },
    {
      "id": "t2-status",
      "prompt": "Which issues is someone actively working on right now?",
      "control": false,
      "expect": { "tool": "list_issues", "args": { "status": { "equals": "in_progress" } } }
    },
    {
      "id": "t3-payload",
      "prompt": "Give me a quick list of maria's open issues.",
      "control": false,
      "expect": {
        "tool": "list_issues",
        "args": {
          "status": { "equals": "open" },
          "assignee": { "contains": "maria" },
          "include_comments": { "equals": false }
        }
      }
    },
    {
      "id": "t4-control",
      "prompt": "Pull up issue TRK-117.",
      "control": true,
      "expect": { "tool": "get_issue", "args": { "id": { "equals": "TRK-117" } } }
    }
  ]
}
```

**Matchers:** `equals` (strict, after JSON parse), `contains` (case-insensitive substring, strings only), `oneOf` (array of allowed values), `absent` (argument must not be present), `any` (must be present). Arguments not listed in `args` are not checked. `contains` on a non-string fails.

## Contract: `audit_server`

Reads the live `tools/list` and returns findings. Read-only; never calls a tool. **All checks are deterministic for the MVP.** The study's model-scored six-component rubric is post-MVP: it adds cost and doesn't contribute to the audit → patch → verify demonstration. The `rubric` field below is omitted until then.

**Input:** `{ "server_url": "https://trackr.example/mcp" }`

**Output:**

```json
{
  "audit_id": "aud_7f3c",
  "server_url": "https://trackr.example/mcp",
  "server_version": "trackr-demo-001@abc1234",
  "tools_hash": "sha256:…",
  "static_tool_tokens": 412,
  "tools": [
    {
      "name": "list_issues",
      "description_chars": 12,
      "params": [
        { "name": "status", "type": "string", "required": false, "has_description": false, "has_enum": false },
        { "name": "include_comments", "type": "boolean", "required": false, "has_description": false, "has_enum": false }
      ]
    }
  ],
  "findings": [
    {
      "id": "F1",
      "kind": "sibling_overlap",
      "severity": "high",
      "tools": ["list_issues", "search_issues"],
      "message": "Both tools read the same resource, both descriptions are under 60 characters, and neither says when to use it instead of the other.",
      "evidence": { "shared_noun": "issues", "verbs": ["list", "search"], "description_chars": [12, 14], "cross_reference": false }
    },
    {
      "id": "F2",
      "kind": "unconstrained_string",
      "severity": "high",
      "tool": "list_issues",
      "param": "status",
      "message": "Free-form string with no description or allowed values."
    },
    {
      "id": "F3",
      "kind": "payload_control_undocumented",
      "severity": "medium",
      "tool": "list_issues",
      "param": "include_comments",
      "message": "Undocumented boolean whose name suggests it controls response size."
    }
  ]
}
```

**Finding kinds (closed set):** `unclear_purpose`, `missing_usage_guidelines`, `opaque_parameter` (no description), `unconstrained_string` (string with no description and no enum), `sibling_overlap`, `payload_control_undocumented` (undocumented boolean or number named `include_*`, `limit`, `verbose`, `fields`, `page_size`), `description_too_long` (over 1,000 characters; a warning, since the reported client truncation limit is unverified), `missing_output_schema`.

**Overlap check (deterministic).** Text similarity is the wrong test: "List issues." and "Search issues." share only one token. Instead, flag `sibling_overlap` when two tools:

- share a resource noun after splitting names on `_` (`list_issues`, `search_issues` → `issues`), **and**
- both use read verbs from a fixed set (`list`, `search`, `find`, `get`, `query`, `fetch`, `lookup`, `retrieve`), **and**
- neither description names the other tool, **and**
- at least one description is under 60 characters.

Single-resource lookups by ID (`get_issue` with a required `id`) are excluded, since a required identifier already disambiguates them. Severity is fixed per kind.

## Contract: `propose_patch` and the PatchSpec

**`wire_ops` are authoritative.** The model proposes metadata operations only. AX Lint derives the source edits from them in code, so the two cannot disagree by construction. `confirm_patch` remains the end-to-end check.

**Input:**

```json
{
  "audit": { "...": "the audit_server output" },
  "source_files": [ { "path": "src/tools.ts", "content": "..." } ],
  "finding_ids": ["F1", "F2", "F3"],
  "style": "compact"
}
```

`style` is `compact` (default: purpose, when to use, limitations; no examples) or `full` (all six rubric components including examples, the study's naive augmentation). `full` exists for the demo's optional second patch.

**Allowed wire ops (closed set):** `set_tool_description` and `set_param_description`. Anything else is rejected.

**Deterministic source-edit generation (for `trackr`'s layout only):**

- `set_tool_description(tool, value)` replaces the `description: "…",` literal inside that tool's object with the new value, JSON-escaped.
- `set_param_description(tool, param, value)` inserts `.describe("…")` immediately before the trailing comma on that parameter's line inside that tool's object, or replaces an existing `.describe(…)`.
- If the expected line pattern isn't found exactly once, `propose_patch` fails with `unsupported_layout` rather than guessing.
- The unified diff is computed from the resulting file with a standard diff library.
- `base_source_hashes` records the SHA-256 of each source file as received. The coding agent must check the file on disk still has that hash before applying; if it doesn't, it re-runs `propose_patch` rather than applying to a different revision. The README states this as the apply procedure.

**Source fidelity is proven by a test, not assumed.** A string edit being deterministic doesn't make it correct; what matters is the JSON Schema mcp-use actually emits. Before Saturday, an integration test applies the hand-written compact patch's source edits to `trackr`, starts it, calls `tools/list`, and asserts every description in the output equals the wire-op value exactly. If it fails, the generator's edit pattern is changed until it passes. That test then runs in CI for the generator.

**Output:**

```json
{
  "patch_id": "pat_19ab",
  "base_server_version": "trackr-demo-001@abc1234",
  "base_source_hashes": { "src/tools.ts": "sha256:…" },
  "base_tools_hash": "sha256:…",
  "candidate_tools": [ "…the full candidate tools/list, canonicalized…" ],
  "candidate_tools_hash": "sha256:…",
  "wire_ops": [
    {
      "op": "set_tool_description",
      "tool": "search_issues",
      "value": "Full-text search over issue titles and bodies. Use when the user describes issues by topic or keyword. To filter by status or assignee, use list_issues.",
      "finding_ids": ["F1"]
    }
  ],
  "source_edits": [
    { "file": "src/tools.ts", "find": "description: \"Search issues.\",", "replace": "description: \"Full-text search over issue titles and bodies. ...\"," }
  ],
  "unified_diff": "--- a/src/tools.ts\n+++ b/src/tools.ts\n@@ ...",
  "static_tool_tokens": { "before": 412, "after": 560 }
}
```

**The full compact patch for `trackr`** (four wire ops; the target the generator should land close to):

| Op | Target | Value |
| --- | --- | --- |
| `set_tool_description` | `list_issues` | "Filter issues by structured fields (status, assignee). Does not search text; to find issues by topic or keyword, use search_issues." |
| `set_tool_description` | `search_issues` | "Full-text search over issue titles and bodies. Use when the user describes issues by topic or keyword. To filter by status or assignee, use list_issues." |
| `set_param_description` | `list_issues.status` | "One of: open, in_progress, blocked, closed. open: not started. in_progress: someone is actively working on it. blocked: waiting on something. closed: done." |
| `set_param_description` | `list_issues.include_comments` | "Include full comment threads, roughly 1 to 2K tokens per issue. Defaults to true. Set false when only titles and status are needed." |

**Validation, enforced in code** (the model's `wire_ops` are parsed against a Zod schema; one retry with the error message on failure, then a hard error):

- Every `tool` and `param` exists in the audited `tools/list`.
- Applying `wire_ops` to the baseline produces a candidate in which no property other than `description` differs.
- Any allowed values a description states for a parameter must match a constant found in the provided source (for `trackr`, `STATUS_VALUES`); otherwise a warning is attached.
- Descriptions over 1,000 characters produce a warning, not an error.

## Contract: `verify_patch` and `get_verification_result`

**Where the job runs.** Manufact Cloud may scale horizontally and restart instances, and mcp-use's in-memory state is per-instance, so AX Lint keeps no run state. `verify_patch` starts a Blaxel sandbox, writes the job input to it, and starts the verification runner there. The `run_id` is the sandbox identifier. The runner writes `progress.json` and `result.json` to the sandbox filesystem; `get_verification_result` reads them. Any AX Lint instance can answer any poll.

**Where the "proxy" lives.** The runner itself is the MCP client. It fetches the real `tools/list`, shows the model either the baseline or the stored candidate, and executes the model's chosen call against the same real server either way. No separate proxy process is needed, and identical tool behavior holds by construction.

**The agent under test** is a direct model API call, not Claude Code or another harness. Harness-specific behavior is a non-goal.

**`verify_patch` input:**

```json
{
  "server_url": "https://trackr.example/mcp",
  "patch": { "...": "a PatchSpec" },
  "tasks": { "...": "the tasks.json content" },
  "trials": 3,
  "model": "default"
}
```

`trials` must be odd, 1 to 9. `model` is `default` (a pinned model ID set in config, never a floating alias) or an explicit model ID.

**`verify_patch` output:** `{ "run_id": "<sandbox id>", "status": "queued", "total_trials": 24 }`

**`get_verification_result` input:** `{ "run_id": "<sandbox id>" }`. While running it returns `status` and `progress: { "done": 11, "total": 24 }`. When complete it also returns `result`.

**Statuses and lifecycle:**

| Status | Meaning |
| --- | --- |
| `queued` | Sandbox created, runner not yet writing progress |
| `running` | `progress.json` updated within the last 60 seconds |
| `complete` | `result.json` written |
| `failed` | The runner wrote an error to `result.json` (for example `stale_patch`) |
| `stalled` | `progress.json` not updated for more than 60 seconds while not complete; the runner is presumed dead |
| `run_unavailable` | The sandbox can't be reached right now; retry |
| `run_expired` | The sandbox no longer exists. Runs are kept for 2 hours after completion; the coding agent must re-run `verify_patch` |

Never return an empty or missing result silently; every poll maps to one of these.

```json
{
  "run_id": "<sandbox id>",
  "provisional": true,
  "label": "Provisional: 3 trials per condition. A demonstration, not a statistical claim.",
  "config": {
    "model": "<pinned model id>",
    "trials": 3,
    "server_version": "trackr-demo-001@abc1234",
    "tasks_hash": "sha256:…",
    "baseline_tools_hash": "sha256:…",
    "candidate_tools_hash": "sha256:…"
  },
  "candidate_tools": [ "…the exact candidate that was verified…" ],
  "static_tool_tokens": { "baseline": 412, "candidate": 560 },
  "tasks": [
    {
      "id": "t1-route",
      "control": false,
      "baseline": { "passed": 0, "of": 3, "infra_errors": 0 },
      "candidate": { "passed": 3, "of": 3, "infra_errors": 0 },
      "representative": { "baseline_trial": 1, "candidate_trial": 1 },
      "trials": [
        {
          "condition": "baseline",
          "index": 1,
          "passed": false,
          "failure": "wrong_tool",
          "chosen_tool": "list_issues",
          "args": { "limit": 50 },
          "checks": [ { "what": "tool", "expected": "search_issues", "actual": "list_issues", "passed": false } ],
          "explanation": "Expected search_issues(query contains \"checkout\"); got list_issues(limit=50). Related finding F1: both tools read issues and neither says when to use it instead of the other.",
          "model_text": null,
          "input_tokens": 640,
          "output_tokens": 48,
          "result_tokens": 31200,
          "latency_ms": 2100
        }
      ]
    }
  ],
  "totals": {
    "baseline": { "passed": 3, "of": 12, "result_tokens": 88400 },
    "candidate": { "passed": 12, "of": 12, "result_tokens": 7300 }
  },
  "verdict": "improved",
  "verdict_reasons": [
    "t1-route rose 0/3 to 3/3",
    "t2-status rose 1/3 to 3/3",
    "t3-payload rose 0/3 to 3/3",
    "t4-control unchanged at 3/3"
  ]
}
```

The numbers above illustrate the shape only; real values come from recorded runs.

**Metrics, defined:**

| Field | Meaning |
| --- | --- |
| `static_tool_tokens` | Token count of the exposed tool definitions alone: the per-turn context cost of the interface, reported separately because prompt caching hides it in usage figures |
| `input_tokens`, `output_tokens` | Actual usage reported by the provider for the trial's model call |
| `result_tokens` | Token count of the tool result the real server returned when the chosen call was executed. This is potential context cost: in a single-turn trial the model never consumes it |
| `latency_ms` | End-to-end time for the model call plus tool execution |

**Field rules:**

- `failure` is one of `wrong_tool`, `bad_args`, `no_tool_call`, `infra` (API error, timeout, server unreachable), or `null` when passed.
- `explanation` is generated deterministically from the failed checks plus the audit finding that targets that tool or parameter. It's what the demo shows. `model_text` records any text the model emitted before its tool call, if it emitted any; it's never requested and never scored.
- `infra` trials are excluded from `passed`/`of` and counted in `infra_errors`. A task with more than one infra error in a condition is marked `insufficient_data` and can't drive the verdict.
- `representative` points to the trial to show on screen: the first trial whose pass/fail matches the majority for that condition. Pass counts and every individual trial are always shown alongside it.

## Contract: `confirm_patch`

Closes the gap between what was verified and what ships. Called after the coding agent has applied the source edits and restarted the server.

**Input:** `{ "server_url": "https://trackr.example/mcp", "run_id": "<sandbox id>", "expected_revision": "def5678" }`

`expected_revision` is the git SHA of the commit containing the applied patch, supplied by the coding agent.

**Gates, checked in order, each with its own error:**

1. **The run passed.** The run's status is `complete` and its verdict is `improved`. Otherwise `run_not_approved`; nothing can be confirmed that never passed the gate.
2. **Same deployment.** The live `serverInfo.version` has the same deployment ID as the run's `server_version`. Otherwise `wrong_deployment`.
3. **New code is running.** The live revision equals `expected_revision` and differs from the run's baseline revision. Otherwise `revision_mismatch`; this catches confirming against a server that was never restarted.
4. **Metadata matches.** The canonicalized live `tools/list` equals the run's stored `candidate_tools`.

**Output:**

```json
{
  "match": false,
  "gates": { "run_approved": true, "same_deployment": true, "revision_updated": true, "metadata_match": false },
  "live_server_version": "trackr-demo-001@def5678",
  "live_tools_hash": "sha256:…",
  "verified_tools_hash": "sha256:…",
  "diffs": [
    {
      "path": "tools.list_issues.inputSchema.properties.status.description",
      "verified": "One of: open, in_progress, blocked, closed. ...",
      "live": "One of: open, in_progress."
    }
  ]
}
```

**Comparison rules:**

- The reference is the exact `candidate_tools` stored in that run's result, not a reconstruction.
- Canonicalization only sorts object keys and orders tools by name. It never drops or rewrites fields; validation-related properties such as `additionalProperties` and `required` are compared as-is.
- Any difference is reported with its JSON path.
- `match: true` requires all four gates. On `false`, the coding agent fixes whatever gate failed and calls `confirm_patch` again; the verdict doesn't carry over to code that doesn't match.

## Verification procedure and verdict rules

**Procedure (runs inside the Blaxel sandbox):**

1. Connect to `server_url`, fetch `tools/list`, canonicalize it, and check its hash equals `patch.base_tools_hash`. If not, fail with `stale_patch`: the server changed since the audit.
2. Check the stored `candidate_tools` hash equals `patch.candidate_tools_hash`.
3. Build the trial list (tasks × trials × conditions), shuffle it with a fixed seed so baseline and candidate trials interleave, and run with a concurrency limit of 4.
4. For each trial, make one model call:
    - System prompt, verbatim: "You are an assistant with access to an issue tracker. Use the available tools to help the user."
    - User message: the task prompt.
    - Tools: the condition's list, converted to the provider's tool format.
    - Omit the temperature parameter for Sonnet 5.5, tool choice automatic, max 300 output tokens.
5. Take the first tool call as the trial's answer and any preceding text as `model_text`. No tool call means `no_tool_call`.
6. Score the call against `expect` with the matchers. Wrong tool is `wrong_tool`; right tool with a failed argument check is `bad_args`. Generate `explanation`.
7. Execute the chosen call against the real server and count `result_tokens`. The result is not sent back to the model; trials are single-turn.
8. On a provider 429 or 5xx, retry twice with backoff, then mark `infra`.
9. Count `static_tool_tokens` for both lists with the provider's token-counting endpoint (count with tools minus count without). Use the same endpoint for `result_tokens`, falling back to characters ÷ 4 labeled approximate.
10. Write `progress.json` after every trial. Aggregate per task, pick representative trials, apply the verdict rules, write `result.json`.

**Verdict rules** (deltas are candidate passes minus baseline passes, out of N). Evaluated in order:

| Verdict | When |
| --- | --- |
| **Regressed** | Among tasks with sufficient data in both conditions: the control task's candidate passes are lower than baseline, **or** any task falls by 2 or more. Observed regressions always win |
| **Inconclusive** | **Any** task is `insufficient_data` in either condition. Missing evidence can never produce Improved, and a missing control is the clearest case |
| **Improved** | Every task has sufficient data, **and** no task falls at all, **and** at least one non-control task rises by 2 or more |
| **Inconclusive** | Everything else, including any single-task drop of 1 (noise-level at N=3) and patches that change nothing |

Tokens don't decide the verdict. Task success comes first. The result always reports token deltas next to the verdict, so an Improved patch that costs much more is visible as such. Every verdict carries the provisional label.

## Saturday 5 PM acceptance test

The core milestone is met when all seven pass, from Claude Code, against deployed AX Lint and `trackr`:

- [ ] Claude Code successfully invokes deployed AX Lint
- [ ] `audit_server` returns real findings from `trackr`
- [ ] `propose_patch` returns a validated, non-destructive patch
- [ ] `verify_patch` executes baseline and candidate model calls
- [ ] `get_verification_result` returns all trial results and a verdict
- [ ] The coding agent applies an approved patch
- [ ] `confirm_patch` validates the restarted server's identity, revision and metadata

Not required for the milestone: the `full`-style second patch, public-server audits, and the eval-action exporter. The model-scored rubric is out of the weekend entirely.

## Expected outcomes and how to check them Wednesday

These are hypotheses, not results. The first thing to build is a 50-line script that runs the four tasks against the baseline and the hand-written compact patch, before any AX Lint code exists. If the hypotheses don't hold, fix the target, not the numbers.

| Task | Baseline hypothesis | Candidate hypothesis | Why |
| --- | --- | --- | --- |
| `t1-route` | Mostly fails: picks `list_issues` because the prompt says "List" | Passes: the new descriptions say which tool searches text | Sibling overlap is the study's most common routing failure |
| `t2-status` | Mostly fails: guesses "in progress", "active" or "open" | Passes: the description lists the allowed values and glosses `in_progress` | Undocumented string parameters force guessing |
| `t3-payload` | Fails: omits `include_comments`, server returns thousands of tokens | Passes: the parameter description tells it to set `false` for summaries | The model can't use a control it can't see explained |
| `t4-control` | Passes | Passes | The clean tool shouldn't be affected; if it is, that's a regression signal |

**What to do if a hypothesis fails:**

- **Baseline passes a flaw task 3/3:** don't add misleading text. Check whether the prompt leaks the answer, then pick a realistically worse baseline modeled on a real low-scoring server. If it still passes, drop that flaw from the demo and say so; two strong tasks beat three staged ones.
- **Candidate still fails:** iterate on the compact descriptions until the hand-written patch reliably passes; that becomes the target `propose_patch` must reproduce.
- **Control task fails in the baseline:** the harness or tool conversion is broken. Fix it before anything else.

## Build sequence

**First, check the rules.** Ask the organizers what may be prepared before Saturday 10:30 AM. A test target and fixtures are usually fine; product code may not be.

**Before the event (personal machine and accounts only):**

- [ ] **Wed:** ask the organizers about pre-built code
- [ ] **Wed:** write `trackr` and the hand-run script (if allowed; otherwise design them on paper). Confirm the four hypotheses or adjust per the rules above
- [ ] **Wed:** read the invention-assignment agreement and any personal open-source policy
- [ ] **Thu:** prove the Blaxel job lifecycle on its own, outside AX Lint, in five steps: (1) create a sandbox and get a stable ID; (2) start a detached process that keeps running after the request that started it returns; (3) have it write `progress.json` repeatedly; (4) from a separate request, find the same sandbox by ID; (5) read `result.json` after the original request has ended. Record the sandbox timeout and expiry behavior
- [ ] **Thu:** deploy `trackr` on Railway from GitHub with auto-deploy on push, confirm `serverInfo.version` shows the deployment ID and commit SHA, and time a push-to-live redeploy (it's dead air in the demo); deploy a hello-world mcp-use server to Manufact Cloud and mount it from Claude Code
- [ ] **Thu:** the source-fidelity integration test: apply the hand-written patch, start `trackr`, assert `tools/list` descriptions equal the wire-op values exactly
- [ ] **Fri (if allowed):** the deterministic core with unit tests: Zod contracts, matchers, canonicalization and hashing, wire-op application, source-edit generation, the overlap heuristic, the confirm gates, and the verdict evaluator, including the insufficient-data case

**Saturday (hacking starts 10:30 AM):**

1. **10:30–1:30** Verification runner in Blaxel: model calls, MCP execution, scoring, progress and result files. This is the riskiest piece, so it goes first
2. **1:30–2:30** `verify_patch` and `get_verification_result` wired to the runner
3. **2:30–3:30** `propose_patch`: model proposes `wire_ops`, code validates and generates source edits
4. **3:30–4:15** `audit_server`: deterministic checks, including the overlap heuristic
5. **4:15–5:00** `confirm_patch`; deploy to Manufact Cloud; run the acceptance test
6. **5:00** Milestone check. Nothing below starts until all seven items pass
7. **6:00–8:00** Read-only audits of two public servers into `/examples`; README, including the generality statement and the apply procedure
8. **8:00–10:00** The `full`-style second patch for the demo; the eval-action exporter only if one hand-written case runs through the action first
9. **10:00–midnight** Record a fallback run; rehearse twice; fix only what breaks the demo

If Friday prep isn't allowed, the deterministic core moves into block 1 and blocks 1–2 extend to 3:00.

**Open questions to settle by Thursday** (the first two are answered by Thursday's tests):

- [ ] Does the Blaxel job lifecycle work from a Manufact Cloud deployment, and what are the sandbox timeout and expiry?
- [ ] What exactly does mcp-use emit in `tools/list` for a Zod `.describe()` on an optional parameter?
- [ ] Which pinned model ID is the default, and does it accept the temperature parameter omitted for Sonnet 5.5 with tools?
- [ ] Does the provider's token-counting endpoint accept a tools list without a real conversation?
- [ ] Does mcp-use let a server set `serverInfo.version` from an environment variable?

**This spec is frozen.** Changes after this point come from failing tests or the Thursday checks, not from new reviews, sponsors, features or research.

## Deferred: enum patching

Enums carry routing better than prose, so this is the first post-MVP addition. It needs a way to add `enum` to the exposed schema without changing runtime validation (for example, a framework hook that sets JSON Schema metadata on a `z.string()`), plus a probe that calls the tool with a valid fixture argument set and each enum value substituted, and a negative probe with an invalid value to show the server enforces the restriction.
