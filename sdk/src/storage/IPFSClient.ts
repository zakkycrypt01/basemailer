import { create, IPFSHTTPClient } from 'ipfs-http-client';
import pako from 'pako';
import type { EncryptedMailPackage } from '../types/index.js';

export interface IPFSClientOptions {
  endpoint?: string;
  projectId?: string;
  projectSecret?: string;
  pin?: boolean;
  compress?: boolean;
  client?: IPFSHTTPClient;
}

export class IPFSClient {
  private readonly ipfs: IPFSHTTPClient;
  private readonly shouldPin: boolean;
  private readonly shouldCompress: boolean;

  constructor(private readonly options: IPFSClientOptions = {}) {
    this.ipfs = options.client ?? this.createClient(options);
    this.shouldPin = options.pin ?? true;
    this.shouldCompress = options.compress ?? true;
  }

  async upload(pkg: EncryptedMailPackage): Promise<string> {
    const payload = Buffer.from(JSON.stringify(pkg), 'utf-8');
    const data = this.shouldCompress ? Buffer.from(pako.gzip(payload)) : payload;
    const result = await this.ipfs.add(data, { pin: this.shouldPin });
    return result.cid.toString();
  }

  async retrieve(cid: string): Promise<EncryptedMailPackage> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of this.ipfs.cat(cid)) {
      chunks.push(chunk as Uint8Array);
    }
    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const decoded = this.shouldCompress ? Buffer.from(pako.ungzip(buffer)) : buffer;
    return JSON.parse(decoded.toString('utf-8')) as EncryptedMailPackage;
  }

  async pin(cid: string): Promise<void> {
    if (!this.shouldPin) return;
    await this.ipfs.pin.add(cid);
  }

  private createClient(options: IPFSClientOptions): IPFSHTTPClient {
    if (!options.endpoint) {
      throw new Error('IPFS endpoint is required when client is not provided');
    }

    const headers: Record<string, string> = {};
    if (options.projectId && options.projectSecret) {
      const auth = Buffer.from(`${options.projectId}:${options.projectSecret}`).toString('base64');
      headers.authorization = `Basic ${auth}`;
    }

    return create({ url: options.endpoint, headers });
  }
}
