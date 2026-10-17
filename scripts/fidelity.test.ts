import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

type WireOp = { op: "set_tool_description" | "set_param_description"; tool: string; param?: string; value: string };
type Patch = { wire_ops: WireOp[]; source_edits: { file: string; find: string; replace: string }[]; base_source_hashes?: Record<string, string> };
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = resolve(root, "test/fixtures/compact.patch.json");
const sha = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, stable(val)]));
  return value;
}
const canonical = (tools: Tool[]) => stable([...tools].sort((a, b) => a.name.localeCompare(b.name)));
async function stop(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const kill = setTimeout(() => child.kill("SIGKILL"), 3000);
  try { await exited; } finally { clearTimeout(kill); }
}
async function readTools(copy: string): Promise<Tool[]> {
  const child = spawn(process.execPath, ["--import", "tsx", "src/main.ts"], {
    cwd: copy,
    // Do not copy provider credentials or load the real repository's .env.
    env: { PATH: process.env.PATH, NODE_ENV: "test", PORT: "0", HOST: "127.0.0.1", DEPLOYMENT_ID: "trackr-fidelity", GIT_SHA: "fidelity" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const client = new Client({ name: "trackr-source-fidelity", version: "1.0.0" });
  try {
    const url = await new Promise<string>((accept, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error("Fidelity server startup timed out")), 15000);
      child.on("error", error => { clearTimeout(timeout); reject(error); });
      child.on("exit", code => { clearTimeout(timeout); reject(new Error(`Fidelity server exited before readiness (${code})`)); });
      child.stderr?.on("data", () => {});
      child.stdout?.on("data", chunk => {
        output += String(chunk);
        const match = /trackr listening at (http:\/\/[^\s]+)/.exec(output);
        if (match) { clearTimeout(timeout); accept(match[1]!); }
      });
    });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)), { timeout: 10000 });
    return (await client.listTools()).tools;
  } finally { await client.close().catch(() => {}); await stop(child); }
}

export async function verifyFidelity(patchPath: string): Promise<void> {
  const patch = JSON.parse(await readFile(resolve(patchPath), "utf8")) as Patch;
  assert(Array.isArray(patch.wire_ops) && patch.wire_ops.length > 0, "Patch needs nonempty wire_ops");
  assert(Array.isArray(patch.source_edits) && patch.source_edits.length > 0, "Patch needs nonempty source_edits");
  for (const [file, expected] of Object.entries(patch.base_source_hashes || {})) {
    assert(!isAbsolute(file) && !relative(root, resolve(root, file)).startsWith(".."), "Source hash path escapes repository");
    assert.equal(sha(await readFile(resolve(root, file), "utf8")), expected, `Stale source: ${file}`);
  }
  const directory = await mkdtemp(resolve(tmpdir(), "trackr-fidelity-"));
  const copy = resolve(directory, "trackr");
  try {
    await cp(root, copy, { recursive: true, filter: source => {
      const name = basename(source);
      return ![".git", "node_modules", ".mcp-use", "dist", "coverage", ".DS_Store", "vendor"].includes(name) && !name.startsWith(".env");
    } });
    await symlink(resolve(root, "node_modules"), resolve(copy, "node_modules"), "dir");
    const baseline = await readTools(copy);
    const expected = structuredClone(baseline);
    for (const op of patch.wire_ops) {
      assert.equal(typeof op.value, "string", "Description must be a string");
      const tool = expected.find(tool => tool.name === op.tool);
      assert(tool, `Unknown tool: ${op.tool}`);
      if (op.op === "set_tool_description") tool.description = op.value;
      else {
        assert.equal(op.op, "set_param_description", "Only description operations are allowed");
        assert(op.param, "Parameter operation needs param");
        const params = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
        assert(Object.hasOwn(params, op.param), `Unknown parameter: ${op.tool}.${op.param}`);
        params[op.param]!.description = op.value;
      }
    }
    for (const edit of patch.source_edits) {
      assert.equal(edit.file, "src/tools.ts", "Fidelity patches may edit only src/tools.ts");
      assert.equal(typeof edit.find, "string"); assert(edit.find.length > 0);
      assert.equal(typeof edit.replace, "string");
      const path = resolve(copy, edit.file);
      const content = await readFile(path, "utf8");
      assert.equal(content.split(edit.find).length - 1, 1, "Each source edit must match exactly once");
      await writeFile(path, content.replace(edit.find, () => edit.replace));
    }
    const candidate = await readTools(copy);
    assert.deepEqual(canonical(candidate), canonical(expected), "Actual tools/list differs from baseline plus authoritative wire_ops");
    for (const op of patch.wire_ops) {
      const tool = candidate.find(tool => tool.name === op.tool)!;
      const description = op.op === "set_tool_description" ? tool.description : (tool.inputSchema.properties?.[op.param!] as Record<string, unknown>)?.description;
      assert.equal(description, op.value, `Description mismatch: ${op.tool}${op.param ? "." + op.param : ""}`);
      console.log(`PASS exact wire description: ${op.tool}${op.param ? "." + op.param : ""}`);
      if (op.op === "set_param_description") {
        const base = baseline.find(tool => tool.name === op.tool)!;
        const required = tool.inputSchema.required ?? [];
        assert.deepEqual(required, base.inputSchema.required ?? [], "Parameter requiredness changed");
        console.log(`EMITTED ${op.tool}.${op.param}: ${JSON.stringify({ schema: tool.inputSchema.properties?.[op.param!], required })}`);
      }
    }
    console.log("PASS source fidelity: real mcp-use tools/list equals baseline plus wire_ops; all non-description metadata unchanged");
  } finally {
    await rm(directory, { recursive: true, force: true });
    console.log("PASS cleanup: temporary trackr source and server processes removed");
  }
}

if (process.env.VITEST) {
  const { test } = await import("vitest");
  test("compact source edits reproduce exact descriptions through the real MCP server", async () => {
    await verifyFidelity(process.env.TRACKR_FIDELITY_PATCH || fixture);
  }, 30000);
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const patchPath = process.argv[2];
  if (!patchPath) throw new Error("Usage: pnpm exec tsx scripts/fidelity.test.ts <patch.json>");
  await verifyFidelity(patchPath);
}
