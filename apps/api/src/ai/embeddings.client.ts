import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

@Injectable()
export class EmbeddingsClient {
  private readonly logger = new Logger('Embeddings');
  private readonly http: AxiosInstance | null;

  constructor() {
    this.http = env.OPENAI_API_KEY
      ? axios.create({
          baseURL: 'https://api.openai.com/v1',
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'content-type': 'application/json',
          },
          timeout: 30_000,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.http !== null;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.http) throw new Error('OPENAI_API_KEY not configured');
    const { data } = await this.http.post<{
      data: { embedding: number[]; index: number }[];
    }>('/embeddings', {
      model: env.EMBEDDING_MODEL,
      input: texts,
    });
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  async embedOne(text: string): Promise<number[]> {
    const r = await this.embed([text]);
    return r[0]!;
  }
}
