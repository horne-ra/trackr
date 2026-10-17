import { describe, expect, test } from "vitest";
import { listIssues, searchIssues, getIssue, issues } from "../src/handlers.js";
import { STATUS_VALUES } from "../src/validation.js";
const data = (result: ReturnType<typeof listIssues>) => JSON.parse(result.content[0]!.text);
describe("read-only runtime behavior", () => {
 test("list defaults to 50 with full comments", () => { const rows = data(listIssues({})); expect(rows).toHaveLength(40); expect(rows.every((row: any) => row.comments.length >= 8)).toBe(true); });
 test.each(STATUS_VALUES)("filters exact status %s", status => { const rows = data(listIssues({ status })); expect(rows.length).toBeGreaterThan(0); expect(rows.every((row: any) => row.status === status)).toBe(true); });
 test.each(["active", "OPEN", "in progress", ""])("returns Invalid status: %s", status => { expect(listIssues({ status })).toEqual({ isError: true, content: [{ type: "text", text: `Invalid status: ${status}` }] }); });
 test("matches username and display name case-insensitively with combined filters", () => { const a = data(listIssues({ status: "open", assignee: "MARIA" })); expect(a).toHaveLength(4); expect(data(listIssues({ status: "open", assignee: "mArIa LoPeZ" }))).toEqual(a); expect(data(listIssues({ assignee: "unknown" }))).toEqual([]); });
 test("comments are omitted only when false and limit is applied", () => { expect(data(listIssues({ limit: 2, include_comments: false }))).toHaveLength(2); expect(data(listIssues({ include_comments: false })).every((row: any) => !("comments" in row))).toBe(true); expect(data(listIssues({ limit: 0 }))).toEqual([]); });
 test("search matches title and body substrings case-insensitively", () => { expect(data(searchIssues({ query: "CHECKOUT" }))).toHaveLength(5); expect(data(searchIssues({ query: "returning customer" }))).toHaveLength(40); expect(data(searchIssues({ query: "no-such-topic" }))).toEqual([]); expect(data(searchIssues({ query: "checkout", include_comments: false })).every((row: any) => !("comments" in row))).toBe(true); expect(data(searchIssues({ query: "checkout" }))[0].comments.length).toBeGreaterThan(0); });
 test("get_issue includes the full record and errors on unknown IDs", () => { expect(data(getIssue({ id: "TRK-117" }))).toEqual(issues[16]); expect(getIssue({ id: "unknown" })).toEqual({ isError: true, content: [{ type: "text", text: "Issue not found" }] }); });
 test("calls do not mutate fixtures", () => { const before=JSON.stringify(issues); listIssues({}); searchIssues({query:"checkout"}); getIssue({id:"TRK-117"}); expect(JSON.stringify(issues)).toBe(before); });
});
