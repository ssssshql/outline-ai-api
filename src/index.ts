import "dotenv/config";
import path from "path";
const envPath = path.resolve(__dirname, "../../.env");
require("dotenv").config({ path: envPath });

import Koa from "koa";
import { Pool } from "pg";
import { loadConfig } from "./config";
import { VectorStoreService } from "./vectorStore";
import { ChatService } from "./chatService";
import { createRouters } from "./routes";
import bodyParser from "koa-bodyparser";

async function main() {
  const config = loadConfig();

  console.log("Starting AI API server...");
  console.log(
    "Database URL:",
    config.database.url.replace(/:[^:@]+@/, ":***@")
  );

  const pool = new Pool({
    connectionString: config.database.url,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  try {
    await pool.query("SELECT 1");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }

  const vectorStore = VectorStoreService.getInstance(pool);
  await vectorStore.initialize();

  const chatService = ChatService.getInstance(vectorStore);

  const app = new Koa();
  const router = createRouters(chatService, vectorStore);

  app.use(async (ctx, next) => {
    const origin = ctx.request.header.origin;
    if (origin) {
      ctx.set("Access-Control-Allow-Origin", origin);
    }
    ctx.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    ctx.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (ctx.method === "OPTIONS") {
      ctx.status = 204;
      return;
    }
    await next();
  });

  app.use(bodyParser());

  app.use(router.routes());
  app.use(router.allowedMethods());

  const server = app.listen(config.port, () => {
    console.log(`AI API server running on port ${config.port}`);
    console.log("Endpoints:");
    console.log("  POST /chat        - Chat (non-stream)");
    console.log("  POST /chat/stream - Chat (stream)");
    console.log("  GET  /health      - Health check");
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    server.close();
    await vectorStore.cleanup();
    await pool.end();
    process.exit(0);
  });
}

main().catch(console.error);
