import { Contract, JsonRpcProvider, Signer, keccak256, toUtf8Bytes } from 'ethers';
import type { BaseMailerClientConfig, RecipientResolutionResult } from '../types/config.js';
import type { MailContent, MailRecord, SendMailParams } from '../types/mail.js';
import { BaseMailerRegistryABI, NameBasedMailerABI } from '../contracts/abi.js';
import { EncryptionManager } from '../encryption/EncryptionManager.js';
import { IPFSClient } from '../storage/IPFSClient.js';
import { ProofGenerator } from '../zkproof/ProofGenerator.js';
import { BackendAPI } from '../backend/BackendAPI.js';
import { cidToBytes32 } from '../utils/bytes.js';
import { InMemoryCidStore, type CidStore } from '../utils/cid-store.js';
import { ConsoleLogger, type Logger } from '../utils/logger.js';

export interface SendMailResponse {
  mailId: string;
  cid: string;
  txHash: string;
}

export class BaseMailerClient {
  private readonly provider: JsonRpcProvider;
  private readonly signer: Signer;
  private readonly registry: Contract;
  private readonly mailer: Contract;
  private readonly encryption: EncryptionManager;
  private readonly storage: IPFSClient;
  private readonly proof: ProofGenerator;
  private readonly backend?: BackendAPI;
  private readonly cidStore: CidStore;
  private readonly recipientResolver?: BaseMailerClientConfig['recipientResolver'];
  private readonly logger: Logger;

  constructor(private readonly config: BaseMailerClientConfig) {
    if (!config.registryAddress || !config.mailerAddress) {
      throw new Error('registryAddress and mailerAddress are required');
    }

    if (!config.provider && !config.rpcUrl) {
      throw new Error('Either provider or rpcUrl must be supplied');
    }

    if (!config.signer) {
      throw new Error('Signer is required for BaseMailerClient');
    }

    this.provider = config.provider ?? new JsonRpcProvider(config.rpcUrl!);
    this.signer = config.signer;
    this.registry = new Contract(config.registryAddress, BaseMailerRegistryABI, this.signer);
    this.mailer = new Contract(config.mailerAddress, NameBasedMailerABI, this.signer);

    this.encryption = config.encryption ?? new EncryptionManager();
    this.storage = config.storage ?? new IPFSClient(config.ipfs);
    if (!config.proof && !config.proofGenerator) {
      throw new Error('Proof configuration or generator must be provided');
    }
    this.proof = config.proofGenerator ?? new ProofGenerator(config.proof!);
    this.backend = config.backend;
    this.cidStore = config.cidStore ?? new InMemoryCidStore();
    this.recipientResolver = config.recipientResolver;
    this.logger = new ConsoleLogger('info');
  }

  async registerEmail(basename: string): Promise<string> {
    const tx = await this.registry.registerEmail(basename);
    const receipt = await tx.wait();
    this.logger.info('Registered email', { basename, txHash: receipt?.hash ?? tx.hash });
    return `${basename}@basemailer.com`;
  }

  async isEmailRegistered(email: string): Promise<boolean> {
    return this.registry.isEmailRegistered(email);
  }

  async resolveOwner(email: string): Promise<string> {
    return this.registry.resolveEmail(email);
  }

  async sendMail(params: SendMailParams): Promise<SendMailResponse> {
    if (!params.from) throw new Error('from email is required');
    const recipient = await this.resolveRecipient(params.to);

    const content: MailContent = {
      from: params.from,
      to: params.to,
      subject: params.subject,
      body: params.body,
      attachments: params.attachments,
      timestamp: Date.now()
    };

    const encrypted = await this.encryption.encrypt(content, recipient.publicKey);
    const cid = await this.storage.upload(encrypted);
    const contentCID = cidToBytes32(cid);
    await this.cidStore.set(contentCID, cid);

    const proofInputs = {
      senderEmail: params.from,
      recipientEmail: params.to,
      contentHash: keccak256(toUtf8Bytes(JSON.stringify(encrypted)))
    };

    const proof = await this.proof.generateProof(proofInputs);

    const tx = await this.mailer.sendMail(proof.proof, contentCID, params.from, params.to);
    const receipt = await tx.wait();
    const mailId = this.extractMailIdFromReceipt(receipt?.logs); // fallback later

    return {
      mailId: mailId ?? '0',
      cid,
      txHash: tx.hash
    };
  }

  async getInbox(email: string): Promise<MailRecord[]> {
    const records = await this.mailer.getInbox(email);
    return this.normalizeMailRecords(records);
  }

  async getSentbox(email: string): Promise<MailRecord[]> {
    const records = await this.mailer.getSentbox(email);
    return this.normalizeMailRecords(records);
  }

  async retrieveMail(mailId: string, recipientPrivateKey: string): Promise<MailContent> {
    const mail = await this.mailer.getMail(mailId);
    const normalized = this.normalizeMailRecords([mail])[0];

    const cidKey = normalized.contentCID;
    let cid = await this.cidStore.get(cidKey);

    if (!cid && this.backend) {
      const backendMail = await this.backend.getMail(mailId);
      cid = backendMail.mail.contentCID;
      if (cid) {
        await this.cidStore.set(cidKey, cid);
      }
      if (backendMail.package) {
        return this.encryption.decrypt(backendMail.package, recipientPrivateKey);
      }
    }

    if (!cid) {
      throw new Error('CID not found locally. Provide cidStore or backend to resolve.');
    }

    const pkg = await this.storage.retrieve(cid);
    return this.encryption.decrypt(pkg, recipientPrivateKey);
  }

  private async resolveRecipient(email: string): Promise<RecipientResolutionResult> {
    const owner = await this.resolveOwner(email);
    if (!this.recipientResolver) {
      throw new Error('recipientResolver is not configured; cannot derive public key');
    }
    return this.recipientResolver(email, owner);
  }

  private normalizeMailRecords(records: any[]): MailRecord[] {
    return records.map((record, index) => ({
      mailId: BigInt(record.mailId ?? index),
      contentCID: record.contentCID,
      senderEmail: record.senderEmail,
      recipientEmail: record.recipientEmail,
      timestamp: BigInt(record.timestamp ?? 0),
      verified: Boolean(record.verified)
    }));
  }

  private extractMailIdFromReceipt(logs?: readonly any[]): string | undefined {
    if (!logs) return undefined;
    const event = this.mailer.interface.getEvent('MailSent');
    if (!event || !event.topicHash) return undefined;

    for (const log of logs) {
      const topics = log.topics ?? [];
      if (topics.length > 0 && topics[0] === event.topicHash) {
        const parsed = this.mailer.interface.parseLog({ data: log.data, topics: log.topics });
        return parsed?.args?.mailId?.toString();
      }
    }
    return undefined;
  }
}
