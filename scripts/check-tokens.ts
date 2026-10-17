import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import { listIssues } from "../src/handlers.js";
const client = new Anthropic({ maxRetries: 0 });
const model = process.env.AXLINT_MODEL;
if (!model) throw new Error("Missing AXLINT_MODEL");
const counts: Record<string, number> = {};
for (const [condition, include_comments] of [["with_comments", true], ["without_comments", false]] as const) {
  const result = listIssues({ status: "open", assignee: "maria", include_comments });
  const usage = await client.messages.countTokens({ model, messages: [{ role: "user", content: JSON.stringify(result) }] });
  counts[condition] = usage.input_tokens;
}
console.log(JSON.stringify({ model, counts, method: "Anthropic countTokens; includes message framing" }, null, 2));
if (counts.with_comments! < 5000 || counts.without_comments! >= 500) throw new Error("Fixture token budget failed");
writeFileSync(new URL("../docs/fixture-token-counts.json", import.meta.url), JSON.stringify({ model, counts, method: "Anthropic countTokens; includes message framing", checked_at: new Date().toISOString() }, null, 2) + "\n");
