import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { listIssuesTool, searchIssuesTool, getIssueTool } from "../src/tools.js";

const [url, expectedRevision, startedAt, output] = process.argv.slice(2);
if (!url || !expectedRevision) throw new Error("Usage: tsx scripts/check-deployment.ts <MCP URL> <expected revision> [push epoch ms] [output JSON]");
const expected = `trackr-demo-001@${expectedRevision}`;
const began = Number(startedAt || Date.now());
const deadline = Date.now() + 600_000;
let last = "";
while (Date.now() < deadline) {
  const client = new Client({ name: "trackr-deployment-acceptance", version: "0.1.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)), { timeout: 10_000 });
    const version = client.getServerVersion()?.version;
    if (version !== expected) throw new Error(`Waiting for ${expected}; live ${version}`);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 3);
    for (const tool of [listIssuesTool, searchIssuesTool, getIssueTool]) assert.equal(tools.find(t => t.name === tool.name)?.description, tool.description);
    for (const tool of tools) for (const param of Object.values(tool.inputSchema.properties || {})) {
      assert.equal(Object.hasOwn(param as object, "description"), false);
    }
    const control = await client.callTool({ name: "get_issue", arguments: { id: "TRK-117" } });
    assert.equal(Boolean(control.isError), false);
    const invalid = await client.callTool({ name: "list_issues", arguments: { status: "active" } });
    assert.equal(invalid.isError, true);
    assert.deepEqual(invalid.content, [{ type: "text", text: "Invalid status: active" }]);
    const result = { url, expected_revision: expectedRevision, server_version: version, first_verified_at: new Date().toISOString(), elapsed_ms: Date.now() - began, checks: { revision_matches: true, baseline_descriptions_exact: true, no_parameter_descriptions: true, control_read: true, invalid_status_error: true } };
    console.log(JSON.stringify(result, null, 2));
    if (output) writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    await client.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== last) { console.log(message); last = message; }
  } finally { await client.close().catch(() => {}); }
  await delay(5_000);
}
throw new Error("Deployment did not pass within 10 minutes");
