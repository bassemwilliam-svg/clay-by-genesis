import "server-only";
import { env } from "@/lib/env";

/*
 * Embedding provider, a port so the concierge's semantic search never couples
 * to one vendor. Voyage AI is Anthropic's recommended embedding provider; its
 * voyage-3.5 model emits 1024-dim vectors, matching Product.embedding
 * vector(1024) and the HNSW index in prisma/sql/search-indexes.sql.
 *
 * `getEmbedder()` returns null when no provider key is configured. Callers MUST
 * treat semantic ranking as an enhancement and degrade to keyword/FTS search
 * when it's null, the concierge stays useful with zero embedding spend.
 */

export const EMBEDDING_DIM = 1024;

export type EmbeddingInputType = "query" | "document";

export interface Embedder {
  readonly model: string;
  readonly dim: number;
  embed(texts: string[], inputType: EmbeddingInputType): Promise<number[][]>;
}

const VOYAGE_MODEL = "voyage-3.5";
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

class VoyageEmbedder implements Embedder {
  readonly model = VOYAGE_MODEL;
  readonly dim = EMBEDDING_DIM;

  constructor(private readonly apiKey: string) {}

  async embed(
    texts: string[],
    inputType: EmbeddingInputType,
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        input_type: inputType,
        output_dimension: this.dim,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Voyage embeddings failed: ${res.status} ${await res.text()}`,
      );
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

let cached: Embedder | null | undefined;

export function getEmbedder(): Embedder | null {
  if (cached !== undefined) return cached;
  cached = env.VOYAGE_API_KEY ? new VoyageEmbedder(env.VOYAGE_API_KEY) : null;
  return cached;
}

/** Serialize a JS number[] into the pgvector text literal '[0.1,0.2,...]'. */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
