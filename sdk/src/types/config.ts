import type { JsonRpcProvider, Signer } from 'ethers';
import type { IPFSHTTPClient } from 'ipfs-http-client';
import type { EncryptionManager } from '../encryption/EncryptionManager.js';
import type { ProofGenerator } from '../zkproof/ProofGenerator.js';
import type { IPFSClient } from '../storage/IPFSClient.js';
import type { BackendAPI } from '../backend/BackendAPI.js';
import type { CidStore } from '../utils/cid-store.js';

export interface BaseMailerClientConfig {
  registryAddress: string;
  mailerAddress: string;
  rpcUrl?: string;
  provider?: JsonRpcProvider;
  signer?: Signer;
  encryption?: EncryptionManager;
  storage?: IPFSClient;
  proofGenerator?: ProofGenerator;
  backend?: BackendAPI;
  cidStore?: CidStore;
  ipfs?: IPFSConfig;
  proof?: ProofConfig;
  recipientResolver?: RecipientResolver;
}

export interface IPFSConfig {
  endpoint: string;
  projectId?: string;
  projectSecret?: string;
  pin?: boolean;
  compress?: boolean;
  client?: IPFSHTTPClient;
}

export interface ProofConfig {
  circuitPath: string;
  provingKeyPath: string;
  verificationKeyPath?: string;
}

export interface RecipientResolutionResult {
  email: string;
  owner: string;
  publicKey: string;
}

export type RecipientResolver = (email: string, ownerAddress: string) => Promise<RecipientResolutionResult>;
