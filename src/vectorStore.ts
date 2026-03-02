import { Pool } from "pg";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";

export interface RagSettings {
  RAG_OPENAI_API_KEY?: string;
  RAG_OPENAI_BASE_URL?: string;
  RAG_EMBEDDING_MODEL?: string;
  RAG_CHAT_API_KEY?: string;
  RAG_CHAT_BASE_URL?: string;
  RAG_CHAT_MODEL?: string;
  RAG_RETRIEVAL_K?: number;
  RAG_SCORE_THRESHOLD?: number;
  RAG_CHUNK_SIZE?: number;
  RAG_CHUNK_OVERLAP?: number;
  RAG_TEMPERATURE?: number;
}

export class VectorStoreService {
  private static instance: VectorStoreService;
  private pool: Pool;
  private initialized = false;

  private constructor(pool: Pool) {
    this.pool = pool;
  }

  public static getInstance(pool: Pool): VectorStoreService {
    if (!VectorStoreService.instance) {
      VectorStoreService.instance = new VectorStoreService(pool);
    }
    return VectorStoreService.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async getRagSettings(): Promise<RagSettings> {
    try {
      const result = await this.pool.query(
        `SELECT settings FROM integrations 
         WHERE service = 'rag' AND type = 'post'
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return {};
      }

      return result.rows[0].settings || {};
    } catch (error) {
      console.error("Failed to fetch team RAG settings:", error);
      return {};
    }
  }

  private getEmbeddings(settings: RagSettings = {}): OpenAIEmbeddings {
    return new OpenAIEmbeddings({
      apiKey: settings.RAG_OPENAI_API_KEY || "",
      batchSize: 512,
      model: settings.RAG_EMBEDDING_MODEL || "text-embedding-3-small",
      configuration: settings.RAG_OPENAI_BASE_URL
        ? { baseURL: settings.RAG_OPENAI_BASE_URL }
        : undefined,
    });
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }

  public async similaritySearchWithScore(
    query: string,
    k: number,
    settings: RagSettings,
    filter?: Record<string, unknown>
  ): Promise<any[]> {
    const embeddings = this.getEmbeddings(settings);
    const vectorStore = new PGVectorStore(embeddings, {
      pool: this.pool,
      tableName: "rag_vectors",
      collectionName: "outline_documents",
      collectionTableName: "rag_collections",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    });

    const queryVector = await embeddings.embedQuery(query);
    return vectorStore.similaritySearchVectorWithScore(
      queryVector,
      k,
      filter as any
    );
  }

  public async similaritySearch(
    query: string,
    k: number,
    settings: RagSettings,
    filter?: Record<string, unknown>
  ): Promise<any[]> {
    const embeddings = this.getEmbeddings(settings);
    const vectorStore = new PGVectorStore(embeddings, {
      pool: this.pool,
      tableName: "rag_vectors",
      collectionName: "outline_documents",
      collectionTableName: "rag_collections",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    });

    return vectorStore.similaritySearch(query, k, filter as any);
  }

  public async cleanup(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    this.initialized = false;
  }
}
