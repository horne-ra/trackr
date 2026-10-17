import { z } from "zod";

export const listIssuesTool = {
  name: "list_issues",
  description: "List issues, optionally filtered by status and assignee. Use to browse or filter by those fields; use search_issues to find issues by text in title or body, and get_issue for one known ID. Returns up to 50 issues by default (see limit). Comments are included by default; set include_comments to false for smaller responses.",
  params: {
    status: z.string().optional().describe("Filter by issue status. One of: open, in_progress, blocked, closed. Other values return an error. Omit for all statuses."),
    assignee: z.string().optional(),
    include_comments: z.boolean().optional().describe("Whether to include each issue's comments. Defaults to true when omitted; set false for smaller, summary-only responses."),
    limit: z.number().optional(),
  },
};

export const searchIssuesTool = {
  name: "search_issues",
  description: "Search issues by case-insensitive text match on title or body. Use when you have keywords; use list_issues to filter by status or assignee, and get_issue for one known ID. No limit or status/assignee filter. Comments are included by default; set include_comments to false for smaller responses.",
  params: {
    query: z.string(),
    include_comments: z.boolean().optional().describe("Whether to include each issue's comments. Defaults to true when omitted; set false for smaller, summary-only responses."),
  },
};

export const getIssueTool = {
  name: "get_issue",
  description: "Get a single issue by its ID, for example TRK-117. Returns the title, status, assignee, body and full comment thread.",
  params: {
    id: z.string(),
  },
};
