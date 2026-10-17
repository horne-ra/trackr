import { z } from "zod";

export const listIssuesTool = {
  name: "list_issues",
  description: "Lists issues, optionally filtered by status and/or assignee. Use to browse or enumerate issues by those fields; use search_issues to match text in title or body, and get_issue for one known ID. Returns at most limit issues (default 50), with comments included by default. Cannot search text.",
  params: {
    status: z.string().optional().describe("Filter by issue status. One of: open, in_progress, blocked, closed. Any other value returns an error. Omit to include all statuses."),
    assignee: z.string().optional(),
    include_comments: z.boolean().optional().describe("Whether to include each issue's comments. Defaults to true when omitted; set false for a smaller, summary-only response."),
    limit: z.number().optional(),
  },
};

export const searchIssuesTool = {
  name: "search_issues",
  description: "Searches issues by case-insensitive substring match on title or body. Use when you have keywords; use list_issues to filter by status or assignee, and get_issue for one known ID. Cannot filter by status or assignee and has no limit; comments are included by default.",
  params: {
    query: z.string(),
    include_comments: z.boolean().optional(),
  },
};

export const getIssueTool = {
  name: "get_issue",
  description: "Get a single issue by its ID, for example TRK-117. Returns the title, status, assignee, body and full comment thread.",
  params: {
    id: z.string(),
  },
};
