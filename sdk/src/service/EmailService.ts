import express, { type Express, type Request, type Response } from 'express';
import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes, AbiCoder, type EventLog, type Log } from 'ethers';
import { groth16 } from 'snarkjs';
import { readFile } from 'fs/promises';
import type { Server } from 'http';
import { IPFSClient } from '../storage/IPFSClient.js';
import { BaseMailerRegistryABI, NameBasedMailerABI } from '../contracts/abi.js';
import { cidToBytes32 } from '../utils/bytes.js';
import { InMemoryCidStore, type CidStore } from '../utils/cid-store.js';
import type { EmailServiceConfig, StoredMail } from './types.js';
import { InMemoryMailStore, type MailStore } from './MailStore.js';

const abiCoder = new AbiCoder();

interface ServiceOptions {
  store?: MailStore;
  cidStore?: CidStore;
}

export class EmailService {
  private readonly provider: JsonRpcProvider;
  private readonly wallet: Wallet;
  private readonly registry: Contract;
  private readonly mailer: Contract;
  private readonly ipfs: IPFSClient;
  private readonly store: MailStore;
  private readonly cidStore: CidStore;
  private readonly port: number;
  private readonly app: Express;
  private server?: Server;
  private verificationKey?: any;

  constructor(private readonly config: EmailServiceConfig, options: ServiceOptions = {}) {
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.signerPrivateKey, this.provider);
    this.registry = new Contract(config.registryAddress, BaseMailerRegistryABI, this.wallet);
    this.mailer = new Contract(config.mailerAddress, NameBasedMailerABI, this.wallet);
    this.ipfs = new IPFSClient(config.ipfs);
    this.store = options.store ?? new InMemoryMailStore();
    this.cidStore = options.cidStore ?? new InMemoryCidStore();
    this.port = config.port ?? 3000;
    this.app = express();
    this.app.use(express.json({ limit: '6mb' }));
    this.registerRoutes();
  }

  async start(): Promise<void> {
    if (this.config.verificationKeyPath) {
      const raw = await readFile(this.config.verificationKeyPath, 'utf-8');
      this.verificationKey = JSON.parse(raw);
    }

    await this.bootstrapEvents();

    await new Promise<void>((resolve) => {
      this.server = this.app.listen(this.port, () => resolve());
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server?.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    this.mailer.removeAllListeners('MailSent');
  }

  get expressApp(): Express {
    return this.app;
  }

  private registerRoutes(): void {
    this.app.post('/api/send-mail', async (req: Request, res: Response) => {
      try {
        const { proof, cid, senderEmail, recipientEmail } = req.body ?? {};
        if (!proof || !cid || !senderEmail || !recipientEmail) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const owner = await this.registry.resolveEmail(senderEmail);
        if (owner === '0x0000000000000000000000000000000000000000') {
          return res.status(400).json({ error: 'Sender email not registered' });
        }

        const contentCID = cidToBytes32(cid);
        await this.cidStore.set(contentCID, cid);

        if (this.verificationKey) {
          const isValid = await this.verifyProof(proof, owner, senderEmail, contentCID);
          if (!isValid) {
            return res.status(400).json({ error: 'Invalid proof' });
          }
        }

        await this.ipfs.pin(cid);

        const tx = await this.mailer.sendMail(proof, contentCID, senderEmail, recipientEmail);
        const receipt = await tx.wait();
        const mailId = this.extractMailId(receipt?.logs) ?? '0';

        const record: StoredMail = {
          mailId,
          cid,
          contentHash: contentCID,
          senderEmail,
          recipientEmail,
          timestamp: Date.now(),
          blockNumber: receipt?.blockNumber,
          txHash: tx.hash
        };
        await this.store.save(record);

        return res.json({ success: true, mailId, txHash: tx.hash, timestamp: record.timestamp });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: message });
      }
    });

    this.app.get('/api/inbox/:email', async (req: Request, res: Response) => {
      const inbox = await this.store.getInbox(req.params.email);
      return res.json({ inbox });
    });

    this.app.get('/api/sentbox/:email', async (req: Request, res: Response) => {
      const sentbox = await this.store.getSentbox(req.params.email);
      return res.json({ sentbox });
    });

    this.app.get('/api/mail/:mailId', async (req: Request, res: Response) => {
      const mail = await this.store.get(req.params.mailId);
      if (!mail) {
        return res.status(404).json({ error: 'Mail not found' });
      }
      return res.json({ mail });
    });

    this.app.get('/health', async (_req: Request, res: Response) => {
      const network = await this.provider.getNetwork();
      return res.json({ status: 'ok', chainId: Number(network.chainId), port: this.port });
    });
  }

  private async bootstrapEvents(): Promise<void> {
    const startBlock = this.config.eventStartBlock ?? (await this.provider.getBlockNumber());
    const current = await this.provider.getBlockNumber();
    if (current >= startBlock) {
      const events = (await this.mailer.queryFilter(this.mailer.filters.MailSent(), startBlock, current)) as (EventLog | Log)[];
      for (const event of events) {
        if (!('args' in event) || !event.args) continue;
        const args = event.args as unknown as {
          mailId: bigint;
          contentCID: string;
          senderEmail: string;
          recipientEmail: string;
          timestamp: bigint;
        };
        await this.persistEvent(
          args.mailId.toString(),
          args.contentCID,
          args.senderEmail,
          args.recipientEmail,
          Number(args.timestamp),
          event.blockNumber,
          event.transactionHash
        );
      }
    }

    this.mailer.on('MailSent', async (mailId, recipientEmail, senderEmail, contentCID, timestamp, event) => {
      await this.persistEvent(mailId.toString(), contentCID, senderEmail, recipientEmail, Number(timestamp), event.blockNumber, event.transactionHash);
    });
  }

  private async persistEvent(
    mailId: string | undefined,
    contentCID: string | undefined,
    senderEmail: string,
    recipientEmail: string,
    timestamp: number,
    blockNumber?: number,
    txHash?: string
  ): Promise<void> {
    if (!mailId || !contentCID) return;
    const cid = (await this.cidStore.get(contentCID)) ?? contentCID;
    const record: StoredMail = {
      mailId,
      cid,
      contentHash: contentCID,
      senderEmail,
      recipientEmail,
      timestamp,
      blockNumber,
      txHash
    };
    await this.store.save(record);
  }

  private extractMailId(logs?: readonly any[]): string | undefined {
    if (!logs) return undefined;
    const event = this.mailer.interface.getEvent('MailSent');
    if (!event?.topicHash) return undefined;
    for (const log of logs) {
      if (log.topics?.[0] === event.topicHash) {
        const parsed = this.mailer.interface.parseLog({ data: log.data, topics: log.topics });
        return parsed?.args?.mailId?.toString();
      }
    }
    return undefined;
  }

  private async verifyProof(
    encodedProof: string,
    senderAddress: string,
    senderEmail: string,
    contentCID: string
  ): Promise<boolean> {
    if (!this.verificationKey) return true;
    const decoded = this.decodeProof(encodedProof);
    const publicSignals = [
      BigInt(senderAddress).toString(),
      BigInt(contentCID).toString(),
      BigInt(keccak256(toUtf8Bytes(senderEmail))).toString()
    ];
    return groth16.verify(this.verificationKey, publicSignals, decoded);
  }

  private decodeProof(encoded: string): { pi_a: string[]; pi_b: string[][]; pi_c: string[] } {
    const [piA, piB, piC] = abiCoder.decode(['uint256[2]', 'uint256[2][2]', 'uint256[2]'], encoded);
    const normalize = (value: any) => (typeof value === 'bigint' ? value.toString() : value);
    return {
      pi_a: piA.map(normalize),
      pi_b: piB.map((row: any[]) => row.map(normalize)),
      pi_c: piC.map(normalize)
    };
  }
}
