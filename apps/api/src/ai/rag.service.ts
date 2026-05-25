import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsClient } from './embeddings.client';

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

interface RetrievedChunk {
  id: string;
  title: string;
  content: string;
  score: number;
}

export type { RetrievedChunk };

@Injectable()
export class RagService {
  private readonly logger = new Logger('RAG');

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsClient,
  ) {}

  /**
   * Chunk text into overlapping windows by character count, with sentence-aware
   * boundary preference. Cheap and effective for FAQ-shaped knowledge.
   */
  chunk(text: string): string[] {
    const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (clean.length === 0) return [];
    if (clean.length <= CHUNK_SIZE) return [clean];
    const chunks: string[] = [];
    let i = 0;
    while (i < clean.length) {
      let end = Math.min(i + CHUNK_SIZE, clean.length);
      if (end < clean.length) {
        const tail = clean.slice(i, end);
        const lastBreak = Math.max(
          tail.lastIndexOf('\n\n'),
          tail.lastIndexOf('. '),
          tail.lastIndexOf('? '),
          tail.lastIndexOf('! '),
        );
        if (lastBreak > CHUNK_SIZE / 2) end = i + lastBreak + 1;
      }
      chunks.push(clean.slice(i, end).trim());
      // Guarantee forward progress: advance at least 1 char even if overlap math says otherwise.
      const next = end - CHUNK_OVERLAP;
      i = next > i ? next : end;
    }
    return chunks.filter((c) => c.length > 0);
  }

  async ingest(args: {
    knowledgeBaseId: string;
    title: string;
    content: string;
  }): Promise<{ chunks: number }> {
    if (!this.embeddings.isConfigured()) {
      // No embeddings — still store the document for later re-indexing.
      await this.prisma.kBDocument.create({
        data: {
          knowledgeBaseId: args.knowledgeBaseId,
          title: args.title,
          content: args.content,
        },
      });
      return { chunks: 0 };
    }
    const chunks = this.chunk(args.content);
    const embeddings = await this.embeddings.embed(chunks);
    let count = 0;
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx]!;
      const vec = embeddings[idx]!;
      const id = await this.prisma.kBDocument.create({
        data: {
          knowledgeBaseId: args.knowledgeBaseId,
          title: chunks.length > 1 ? `${args.title} (${idx + 1}/${chunks.length})` : args.title,
          content: chunk,
        },
        select: { id: true },
      });
      // pgvector value goes through raw SQL since Prisma uses Unsupported type.
      await this.prisma.$executeRawUnsafe(
        `UPDATE "KBDocument" SET embedding = $1::vector WHERE id = $2`,
        toVectorLiteral(vec),
        id.id,
      );
      count++;
    }
    return { chunks: count };
  }

  async retrieve(knowledgeBaseId: string, query: string, k = 5): Promise<RetrievedChunk[]> {
    if (!this.embeddings.isConfigured()) return [];
    const vec = await this.embeddings.embedOne(query);
    const literal = toVectorLiteral(vec);
    const rows = await this.prisma.$queryRawUnsafe<
      { id: string; title: string; content: string; distance: number }[]
    >(
      `SELECT id, title, content, embedding <=> $1::vector AS distance
         FROM "KBDocument"
        WHERE "knowledgeBaseId" = $2 AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $3`,
      literal,
      knowledgeBaseId,
      k,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      score: 1 - r.distance,
    }));
  }
}

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
