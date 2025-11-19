import type { EncryptedMailPackage, MailRecord } from '../types/index.js';

export interface BackendAPIOptions {
  baseUrl: string;
  apiKey?: string;
}

export interface BackendSendMailRequest {
  proof: string;
  contentCID: string;
  senderEmail: string;
  recipientEmail: string;
}

export interface BackendSendMailResponse {
  success: boolean;
  mailId: string;
  txHash: string;
  timestamp: number;
}

export class BackendAPI {
  constructor(private readonly options: BackendAPIOptions) {}

  async sendMail(payload: BackendSendMailRequest): Promise<BackendSendMailResponse> {
    return this.post('/api/send-mail', payload);
  }

  async getInbox(email: string): Promise<MailRecord[]> {
    const response = await this.get(`/api/inbox/${encodeURIComponent(email)}`);
    return response.inbox as MailRecord[];
  }

  async getSentbox(email: string): Promise<MailRecord[]> {
    const response = await this.get(`/api/sentbox/${encodeURIComponent(email)}`);
    return response.sentbox as MailRecord[];
  }

  async getMail(mailId: string): Promise<{ mail: MailRecord; package?: EncryptedMailPackage }> {
    return this.get(`/api/mail/${mailId}`);
  }

  private async get(path: string): Promise<any> {
    return this.request(path, { method: 'GET' });
  }

  private async post(path: string, body: unknown): Promise<any> {
    return this.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  private async request(path: string, init: RequestInit): Promise<any> {
    const headers = new Headers(init.headers ?? {});
    if (this.options.apiKey) {
      headers.set('x-api-key', this.options.apiKey);
    }

    const response = await fetch(`${this.options.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Backend request failed (${response.status}): ${text}`);
    }
    return response.json();
  }
}
