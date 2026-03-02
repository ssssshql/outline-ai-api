import { ChatOpenAI } from "@langchain/openai";
import { VectorStoreService, RagSettings } from "./vectorStore";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class ChatService {
  private static instance: ChatService;
  private vectorStore: VectorStoreService;

  private constructor(vectorStore: VectorStoreService) {
    this.vectorStore = vectorStore;
  }

  public static getInstance(vectorStore: VectorStoreService): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService(vectorStore);
    }
    return ChatService.instance;
  }

  private getChatModel(settings: RagSettings): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: settings.RAG_CHAT_API_KEY || "",
      model: settings.RAG_CHAT_MODEL || "gpt-4o-mini",
      temperature:
        settings.RAG_TEMPERATURE !== undefined
          ? settings.RAG_TEMPERATURE / 10
          : 0.4,
      modelKwargs: {
        thinking: {
          type: "disabled",
        },
      },
      configuration: settings.RAG_CHAT_BASE_URL
        ? { baseURL: settings.RAG_CHAT_BASE_URL }
        : undefined,
      maxRetries: 1,
    });
  }

  public async *streamAnswer(
    question: string,
    k?: number,
    history: ChatMessage[] = []
  ): AsyncGenerator<{
    type: "sources" | "chunk" | "done";
    data?: any;
  }> {
    const settings = await this.vectorStore.getRagSettings();

    if (!settings.RAG_OPENAI_API_KEY || !settings.RAG_CHAT_API_KEY) {
      yield {
        type: "chunk",
        data: "RAG 未配置，请联系管理员配置 RAG 设置。",
      };
      yield {
        type: "done",
      };
      return;
    }

    const effectiveK = k || settings.RAG_RETRIEVAL_K || 10;

    let retrievedDocs = await this.vectorStore.similaritySearchWithScore(
      question,
      effectiveK,
      settings,
      {}
    );

    const scoreThreshold = settings.RAG_SCORE_THRESHOLD
      ? settings.RAG_SCORE_THRESHOLD / 100
      : 0.4;
    retrievedDocs = retrievedDocs.filter(([, score]) => score < scoreThreshold);

    const sources = retrievedDocs.map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      score,
    }));

    yield {
      type: "sources",
      data: sources,
    };

    if (retrievedDocs.length === 0) {
      yield {
        type: "chunk",
        data: "没有找到相关的文档来回答这个问题。",
      };
      yield {
        type: "done",
      };
      return;
    }

    const chatModel = this.getChatModel(settings);

    const context = retrievedDocs
      .map(([doc]) => doc.pageContent)
      .join("\n\n---\n\n");

    const messages = [
      {
        type: "system",
        content: `你是Outline知识库的智能AI助手。
使用以下上下文回答用户的问题。
如果答案不在上下文中，就说你不知道，不要试图编造答案。
保持答案简洁明了。

重要提示：
1. 上下文包含Markdown格式的文本和图片链接。
2. 请直接输出Markdown格式的回答，不要使用代码块（\`\`\`）包裹整个回答。
3. 如果引用了上下文中的图片，请保留图片的原始Markdown格式（如 ![]()），确保图片能正常显示。

上下文:
${context}`,
      },
      ...history.map((msg) => ({ type: msg.role, content: msg.content })),
      { type: "human", content: question },
    ];

    const stream = await chatModel.stream(messages as any);

    for await (const chunk of stream) {
      if (chunk.content) {
        yield {
          type: "chunk",
          data: chunk.content,
        };
      }
    }

    yield {
      type: "done",
    };
  }

  public async answer(
    question: string,
    k?: number,
    history: ChatMessage[] = []
  ): Promise<{
    answer: string;
    sources: Array<{ content: string; metadata: any; score: number }>;
  }> {
    const settings = await this.vectorStore.getRagSettings();

    if (!settings.RAG_OPENAI_API_KEY || !settings.RAG_CHAT_API_KEY) {
      return {
        answer: "RAG 未配置，请联系管理员配置 RAG 设置。",
        sources: [],
      };
    }

    const effectiveK = k || settings.RAG_RETRIEVAL_K || 10;

    let retrievedDocs = await this.vectorStore.similaritySearchWithScore(
      question,
      effectiveK,
      settings,
      {}
    );

    const scoreThreshold = settings.RAG_SCORE_THRESHOLD
      ? settings.RAG_SCORE_THRESHOLD / 100
      : 0.4;
    retrievedDocs = retrievedDocs.filter(([, score]) => score < scoreThreshold);

    const sources = retrievedDocs.map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      score,
    }));

    if (retrievedDocs.length === 0) {
      return {
        answer: "没有找到相关的文档来回答这个问题。",
        sources,
      };
    }

    const chatModel = this.getChatModel(settings);

    const context = retrievedDocs
      .map(([doc]) => doc.pageContent)
      .join("\n\n---\n\n");

    const messages = [
      {
        type: "system",
        content: `你是Outline知识库的智能AI助手。
使用以下上下文回答用户的问题。
如果答案不在上下文中，就说你不知道，不要试图编造答案。
保持答案简洁明了。

重要提示：
1. 上下文包含Markdown格式的文本和图片链接。
2. 请直接输出Markdown格式的回答，不要使用代码块（\`\`\`）包裹整个回答。
3. 如果引用了上下文中的图片，请保留图片的原始Markdown格式（如 ![]()），确保图片能正常显示。

上下文:
${context}`,
      },
      ...history.map((msg) => ({ type: msg.role, content: msg.content })),
      { type: "human", content: question },
    ];

    const response = await chatModel.invoke(messages as any);

    return {
      answer: String(response.content),
      sources,
    };
  }
}
