import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

export interface CreateInstanceResponse {
  instance: { instanceName: string; status: string };
  hash?: { apikey?: string };
  qrcode?: { code?: string; base64?: string };
}

export interface InstanceStatusResponse {
  instance: { instanceName: string; status: string };
}

@Injectable()
export class EvolutionClient {
  private readonly logger = new Logger('Evolution');
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.EVOLUTION_API_URL,
      headers: { apikey: env.EVOLUTION_API_KEY },
      timeout: 15_000,
    });
  }

  async createInstance(name: string, webhookUrl: string): Promise<CreateInstanceResponse> {
    const { data } = await this.http.post<CreateInstanceResponse>('/instance/create', {
      instanceName: name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        url: webhookUrl,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      },
    });
    return data;
  }

  async getInstanceQR(name: string): Promise<{ base64?: string; code?: string }> {
    const { data } = await this.http.get<{ base64?: string; code?: string }>(
      `/instance/connect/${encodeURIComponent(name)}`,
    );
    return data;
  }

  async getInstanceStatus(name: string): Promise<InstanceStatusResponse> {
    const { data } = await this.http.get<InstanceStatusResponse>(
      `/instance/connectionState/${encodeURIComponent(name)}`,
    );
    return data;
  }

  async sendText(name: string, to: string, text: string): Promise<{ key?: { id?: string } }> {
    const { data } = await this.http.post<{ key?: { id?: string } }>(
      `/message/sendText/${encodeURIComponent(name)}`,
      { number: to, text },
    );
    return data;
  }

  async deleteInstance(name: string): Promise<void> {
    try {
      await this.http.delete(`/instance/delete/${encodeURIComponent(name)}`);
    } catch (e) {
      this.logger.warn(`deleteInstance ${name} failed: ${(e as Error).message}`);
    }
  }
}
