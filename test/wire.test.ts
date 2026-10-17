import { expect, test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer, deploymentVersion } from "../src/server.js";

test("live tools/list baseline is exact and runtime errors survive MCP",async()=>{
 const server=createServer("trackr-test@abc1234"); const address=await server.listen(0,{host:"127.0.0.1"});
 const client=new Client({name:"trackr-acceptance",version:"1.0.0"});
 try{
  await client.connect(new StreamableHTTPClientTransport(new URL(address.url)));
  expect(client.getServerVersion()?.version).toBe("trackr-test@abc1234");
  const {tools}=await client.listTools();expect(tools).toHaveLength(3);
  expect(Object.fromEntries(tools.map(tool=>[tool.name,tool.description]))).toEqual({list_issues:"List issues.",search_issues:"Search issues.",get_issue:"Get a single issue by its ID, for example TRK-117. Returns the title, status, assignee, body and full comment thread."});
  for(const tool of tools)for(const parameter of Object.values(tool.inputSchema.properties??{})){expect(parameter).not.toHaveProperty("description");expect(parameter).not.toHaveProperty("enum");expect(parameter).not.toHaveProperty("default");}
  expect(tools.find(t=>t.name==="list_issues")?.inputSchema.properties?.status).toMatchObject({type:"string"});
  expect(await client.callTool({name:"list_issues",arguments:{status:"active"}})).toMatchObject({isError:true,content:[{type:"text",text:"Invalid status: active"}]});
  expect(await client.callTool({name:"get_issue",arguments:{id:"missing"}})).toMatchObject({isError:true,content:[{type:"text",text:"Issue not found"}]});
  expect(await client.callTool({name:"list_issues",arguments:{include_comments:"false"}})).toMatchObject({isError:true});
 }finally{await client.close();await server.close();}
});
test("deployment identity uses Railway commit over local fallback",()=>{expect(deploymentVersion({DEPLOYMENT_ID:"trackr-demo-001",RAILWAY_GIT_COMMIT_SHA:"abc1234",GIT_SHA:"local"})).toBe("trackr-demo-001@abc1234");expect(deploymentVersion({DEPLOYMENT_ID:"trackr-local",GIT_SHA:"local"})).toBe("trackr-local@local");});
