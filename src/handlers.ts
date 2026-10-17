import { readFileSync } from "node:fs";
import { STATUS_VALUES } from "./validation.js";
import type { Issue } from "./types.js";

export const issues = JSON.parse(readFileSync(new URL("../fixtures/issues.json", import.meta.url), "utf8")) as Issue[];
const textResult = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
const errorResult = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true as const });
function project(issue: Issue, include: boolean) {
  if (include) return issue;
  const { comments: _comments, ...summary } = issue;
  return summary;
}

export function listIssues(args: { status?: string; assignee?: string; include_comments?: boolean; limit?: number }) {
  if (args.status !== undefined && !(STATUS_VALUES as readonly string[]).includes(args.status)) {
    return errorResult(`Invalid status: ${args.status}`);
  }
  let matches = issues.filter(issue => args.status === undefined || issue.status === args.status);
  if (args.assignee !== undefined) {
    const name = args.assignee.toLowerCase();
    matches = matches.filter(issue => issue.assignee.username.toLowerCase() === name || issue.assignee.name.toLowerCase() === name);
  }
  return textResult(matches.slice(0, args.limit ?? 50).map(issue => project(issue, args.include_comments ?? true)));
}

export function searchIssues(args: { query: string; include_comments?: boolean }) {
  const query = args.query.toLowerCase();
  return textResult(issues.filter(issue => issue.title.toLowerCase().includes(query) || issue.body.toLowerCase().includes(query)).map(issue => project(issue, args.include_comments ?? true)));
}

export function getIssue(args: { id: string }) {
  const issue = issues.find(issue => issue.id === args.id);
  return issue ? textResult(issue) : errorResult("Issue not found");
}
