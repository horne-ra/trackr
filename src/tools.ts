import { z } from "zod";

export const listIssuesTool = {
  name: "list_issues",
  description: "List issues.",
  params: {
    status: z.string().optional(),
    assignee: z.string().optional(),
    include_comments: z.boolean().optional().describe("Boolean. Controls whether each returned issue includes its comments thread. Defaults to true, so comments are included unless set to false; pass false for smaller, summary-only responses."),
    limit: z.number().optional(),
  },
};

export const searchIssuesTool = {
  name: "search_issues",
  description: "Search issues.",
  params: {
    query: z.string(),
    include_comments: z.boolean().optional().describe("Boolean. Controls whether each matching issue includes its comments thread. Defaults to true, so comments are included unless set to false; pass false for smaller, summary-only responses. Search results are not limited in count."),
  },
};

export const getIssueTool = {
  name: "get_issue",
  description: "Get a single issue by its ID, for example TRK-117. Returns the title, status, assignee, body and full comment thread.",
  params: {
    id: z.string(),
  },
};
