import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

@Injectable()
export class SarvamClient {
  private readonly logger = new Logger('Sarvam');
  private readonly http: AxiosInstance | null;

  constructor() {
    this.http = env.SARVAM_API_KEY
      ? axios.create({
          baseURL: 'https://api.sarvam.ai',
          headers: { 'api-subscription-key': env.SARVAM_API_KEY },
          timeout: 60_000,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.http !== null;
  }

  /**
   * Transcribe an audio buffer (typically downloaded from Evolution API media URL).
   * Sarvam's saaras model handles 11 Indian languages with auto-detection.
   */
  async transcribe(audio: Buffer, mimeType = 'audio/ogg'): Promise<{
    transcript: string;
    languageCode: string | null;
  }> {
    if (!this.http) throw new Error('SARVAM_API_KEY not configured');
    const form = new FormData();
    const blob = new Blob([new Uint8Array(audio)], { type: mimeType });
    form.append('file', blob, 'audio.ogg');
    form.append('model', 'saaras:v2');
    form.append('with_diarization', 'false');
    const { data } = await this.http.post<{
      transcript: string;
      language_code?: string;
    }>('/speech-to-text-translate', form);
    return {
      transcript: data.transcript ?? '',
      languageCode: data.language_code ?? null,
    };
  }
}
