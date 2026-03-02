import Router from "@koa/router";
import { ChatService } from "./chatService";
import { VectorStoreService } from "./vectorStore";

const router = new Router();

interface ChatRequest {
  question: string;
  k?: number;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export function createRouters(
  chatService: ChatService,
  vectorStore: VectorStoreService
) {
  router.post("/chat/stream", async (ctx) => {
    const { question, k, history } = ctx.request.body as ChatRequest;

    if (!question) {
      ctx.status = 400;
      ctx.body = { error: "question is required" };
      return;
    }

    ctx.request.socket.setTimeout(0);
    (ctx.req.socket as any).setNoDelay(true);
    (ctx.req.socket as any).setKeepAlive(true);

    ctx.respond = false;
    ctx.res.statusCode = 200;
    ctx.res.setHeader("Content-Type", "text/event-stream");
    ctx.res.setHeader("Cache-Control", "no-cache");
    ctx.res.setHeader("Connection", "keep-alive");
    ctx.res.setHeader("X-Accel-Buffering", "no");

    ctx.res.flushHeaders();

    const cleanup = () => {
      if (!ctx.res.writableEnded) {
        ctx.res.end();
      }
    };

    ctx.req.on("close", cleanup);
    ctx.req.on("finish", cleanup);
    ctx.req.on("error", cleanup);

    try {
      ctx.res.write(`: ping\n\n`);

      for await (const chunk of chatService.streamAnswer(
        question,
        k,
        history
      )) {
        if (ctx.res.writableEnded || ctx.res.destroyed) break;

        ctx.res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (error) {
      console.error("Chat stream error:", error);
      if (!ctx.res.writableEnded && !ctx.res.destroyed) {
        ctx.res.write(
          `data: ${JSON.stringify({
            type: "error",
            data: (error as Error).message,
          })}\n\n`
        );
      }
    } finally {
      if (!ctx.res.writableEnded && !ctx.res.destroyed) {
        ctx.res.end();
      }
      ctx.req.off("close", cleanup);
      ctx.req.off("finish", cleanup);
      ctx.req.off("error", cleanup);
    }
  });

  router.post("/chat", async (ctx) => {
    const { question, k, history } = ctx.request.body as ChatRequest;

    if (!question) {
      ctx.status = 400;
      ctx.body = { error: "question is required" };
      return;
    }

    try {
      const result = await chatService.answer(question, k, history);
      ctx.body = result;
    } catch (error) {
      console.error("Chat error:", error);
      ctx.status = 500;
      ctx.body = { error: (error as Error).message };
    }
  });

  router.get("/health", async (ctx) => {
    ctx.body = { status: "ok" };
  });

  return router;
}
