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

/**
 * LLM client. Despite the file name (kept for import-compat), this client
 * speaks to whichever provider is configured: OpenAI takes priority when
 * OPENAI_API_KEY is set, otherwise it falls back to Anthropic. Both expose
 * the same `isConfigured()` / `complete()` shape so callers don't change.
 */
@Injectable()
export class AnthropicClient {
  private readonly logger = new Logger('LLM');
  private readonly http: AxiosInstance | null;
  private readonly mode: 'openai' | 'anthropic' | null;

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.mode = 'openai';
      this.http = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        timeout: 60_000,
      });
    } else if (env.ANTHROPIC_API_KEY) {
      this.mode = 'anthropic';
      this.http = axios.create({
        baseURL: 'https://api.anthropic.com/v1',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 60_000,
      });
    } else {
      this.mode = null;
      this.http = null;
    }
  }

  isConfigured(): boolean {
    return this.http !== null;
  }

  async complete(args: {
    system: string;
    messages: ChatMessage[];
    maxTokens?: number;
  }): Promise<CompletionResult> {
    if (!this.http || !this.mode) throw new Error('No LLM provider configured');

    if (this.mode === 'openai') {
      // OpenAI Chat Completions: system prompt is the first message with role=system.
      const messages = [
        { role: 'system' as const, content: args.system },
        ...args.messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const model = env.OPENAI_MODEL || 'gpt-4o-mini';
      try {
        const { data } = await this.http.post<{
          choices: { message: { content: string } }[];
          usage: { prompt_tokens: number; completion_tokens: number };
        }>('/chat/completions', {
          model,
          max_tokens: args.maxTokens ?? 1024,
          messages,
        });
        const text = data.choices[0]?.message.content ?? '';
        return {
          text,
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        };
      } catch (e: any) {
        this.logger.error(
          `OpenAI completion failed: ${e?.response?.status ?? ''} ${JSON.stringify(e?.response?.data ?? e?.message ?? e)}`,
        );
        throw e;
      }
    }

    // Anthropic
    try {
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
    } catch (e: any) {
      this.logger.error(
        `Anthropic completion failed: ${e?.response?.status ?? ''} ${JSON.stringify(e?.response?.data ?? e?.message ?? e)}`,
      );
      throw e;
    }
  }
}
