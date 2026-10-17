# trackr

A read-only MCP issue tracker for the fictional Larkspur Goods engineering team. All 40 issues and comment threads are fake, generated deterministically with seed 20261017.

Run `pnpm install`, `pnpm fixtures`, `pnpm test`, then `pnpm start`. The streamable HTTP MCP endpoint is `http://127.0.0.1:3000/mcp`. `pnpm typecheck` checks TypeScript. `pnpm check:tokens` measures Maria's open-issue payloads using the configured Anthropic model and requires a gitignored `.env` with `ANTHROPIC_API_KEY` and `AXLINT_MODEL`.

Tools: `list_issues`, `search_issues`, and `get_issue`. Their baseline descriptions and parameter schemas follow [the frozen spec](docs/SPEC.md). Status validation happens in the handler using `STATUS_VALUES`; tool behavior never changes with metadata patches.

Deploy the `horne-ra/trackr` GitHub repository on Railway from `main`, with auto-deploy enabled. Set `DEPLOYMENT_ID=trackr-demo-001`. Railway supplies `PORT` and `RAILWAY_GIT_COMMIT_SHA`; do not hard-code the revision. Start command: `pnpm start`. Generate a public domain and use its `/mcp` endpoint. No API key is needed by this server. Deployment identity appears in MCP initialize as `<DEPLOYMENT_ID>@<RAILWAY_GIT_COMMIT_SHA>`.

S2 local validation: 18 tests in 3 files pass, including live MCP baseline metadata, handler behavior, fixture counts, and seeded reproducibility. Anthropic countTokens on the full Maria open-issue MCP response measures 10,408 tokens with comments and 441 without. The first measurement was 10,487 / 520 and failed the summary budget; shortening the fictional issue bodies fixed it without changing handlers, tool metadata, or benchmark tasks. See `docs/fixture-token-counts.json` for the recorded measurement.

Railway acceptance is pending: the new service must be connected to this GitHub repository with automatic deploys from main, then initialize identity and push-to-live revision timing must be checked on its public endpoint.
