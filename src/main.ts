import { createServer } from "./server.js";
const server = createServer();
const address = await server.listen(Number(process.env.PORT || 3000));
console.log(`trackr listening at ${address.url}`);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void server.close().then(() => process.exit(0)); });
