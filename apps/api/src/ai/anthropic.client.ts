import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

@Injectable()
export class AnthropicClient {
  private readonly logger = new Logger('Anthropic');
  private readonly http: AxiosInstance | null;

  constructor() {
    this.http = env.ANTHROPIC_API_KEY
      ? axios.create({
          baseURL: 'https://api.anthropic.com/v1',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 60_000,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.http !== null;
  }

  async complete(args: {
    system: string;
    messages: ChatMessage[];
    maxTokens?: number;
  }): Promise<CompletionResult> {
    if (!this.http) throw new Error('ANTHROPIC_API_KEY not configured');
    const { data } = await this.http.post<{
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    }>('/messages', {
      model: env.ANTHROPIC_MODEL,
      max_tokens: args.maxTokens ?? 1024,
      system: args.system,
      messages: args.messages,
    });
    const text = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return {
      text,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  }
}
