import type { IPFSConfig } from '../types/config.js';

export interface EmailServiceConfig {
  rpcUrl: string;
  registryAddress: string;
  mailerAddress: string;
  signerPrivateKey: string;
  ipfs: IPFSConfig;
  port?: number;
  verificationKeyPath?: string;
  eventStartBlock?: number;
}

export interface StoredMail {
  mailId: string;
  cid: string;
  contentHash: string;
  senderEmail: string;
  recipientEmail: string;
  timestamp: number;
  blockNumber?: number;
  txHash?: string;
}
