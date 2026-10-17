import { expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { issues } from "../src/handlers.js";
test("all frozen fixture counts and comment lengths", () => {
 expect(issues).toHaveLength(40);
 expect(issues.map(issue => issue.id)).toEqual(Array.from({length:40},(_,i)=>`TRK-${101+i}`));
 expect(Object.fromEntries(["open","in_progress","blocked","closed"].map(status=>[status,issues.filter(issue=>issue.status===status).length]))).toEqual({open:14,in_progress:9,blocked:6,closed:11});
 expect(new Set(issues.map(issue=>`${issue.assignee.username}:${issue.assignee.name}`))).toEqual(new Set(["maria:Maria Lopez","dev:Dev Patel","sam:Sam Okafor","priya:Priya Nair"]));
 expect(issues.filter(issue=>issue.status==="open"&&issue.assignee.username==="maria")).toHaveLength(4);
 const checkout=issues.filter(issue=>/checkout/i.test(issue.title+issue.body)); expect(checkout).toHaveLength(5); expect(new Set(checkout.map(issue=>issue.status)).size).toBeGreaterThan(1);
 for(const issue of issues){ expect(issue.comments.length).toBeGreaterThanOrEqual(8); expect(issue.comments.length).toBeLessThanOrEqual(15); for(const comment of issue.comments){ const count=comment.body.split(/\s+/).length;expect(count).toBeGreaterThanOrEqual(60);expect(count).toBeLessThanOrEqual(120); } }
 expect(issues.find(issue=>issue.id==="TRK-117")).toMatchObject({status:"in_progress",assignee:{username:"dev"}});
});
test("seeded generator is reproducible",()=>{const path=new URL("../fixtures/issues.json",import.meta.url);const before=readFileSync(path,"utf8");execFileSync(process.execPath,["--import","tsx","scripts/gen-fixtures.ts"],{cwd:process.cwd()});expect(readFileSync(path,"utf8")).toBe(before);});
