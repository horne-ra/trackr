import { MCPServer } from "mcp-use";
import { z } from "zod";
import { execFileSync } from "node:child_process";
import { listIssuesTool, searchIssuesTool, getIssueTool } from "./tools.js";
import { listIssues, searchIssues, getIssue } from "./handlers.js";

export function deploymentVersion(env: NodeJS.ProcessEnv = process.env): string {
  let revision = env.RAILWAY_GIT_COMMIT_SHA || env.GIT_SHA;
  if (!revision) {
    try { revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
    catch { revision = "local"; }
  }
  return `${env.DEPLOYMENT_ID || "trackr-local"}@${revision}`;
}
export function createServer(version = deploymentVersion()) {
  const server = new MCPServer({ name: "trackr", version, host: "0.0.0.0", legacy: "stateless" });
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  server.tool({ name: listIssuesTool.name, description: listIssuesTool.description, inputSchema: z.object(listIssuesTool.params), annotations }, async args => listIssues(args));
  server.tool({ name: searchIssuesTool.name, description: searchIssuesTool.description, inputSchema: z.object(searchIssuesTool.params), annotations }, async args => searchIssues(args));
  server.tool({ name: getIssueTool.name, description: getIssueTool.description, inputSchema: z.object(getIssueTool.params), annotations }, async args => getIssue(args));
  return server;
}
