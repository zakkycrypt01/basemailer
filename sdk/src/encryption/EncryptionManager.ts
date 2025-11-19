import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { getPublicKey, getSharedSecret } from '@noble/secp256k1';
import type { EncryptedMailPackage, MailContent } from '../types/index.js';
import { deriveKey } from '../utils/hkdf.js';
import { ConsoleLogger, type Logger } from '../utils/logger.js';
import { fromHex, toHex } from '../utils/bytes.js';

export interface EncryptionManagerOptions {
  version?: string;
  logger?: Logger;
}

export class EncryptionManager {
  private readonly version: string;
  private readonly logger: Logger;

  constructor(options: EncryptionManagerOptions = {}) {
    this.version = options.version ?? '1.0';
    this.logger = options.logger ?? new ConsoleLogger('warn');
  }

  async encrypt(content: MailContent, recipientPublicKeyHex: string): Promise<EncryptedMailPackage> {
    const timestamp = content.timestamp ?? Date.now();
    const canonical = { ...content, timestamp };
    const plaintext = Buffer.from(JSON.stringify(canonical), 'utf-8');

    const symmetricKey = randomBytes(32);
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', symmetricKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const recipientPublicKey = this.normalizePublicKey(recipientPublicKeyHex);
    const { encryptedKey, mac, ephemeralPublicKey } = this.wrapSymmetricKey(symmetricKey, recipientPublicKey);

    const metadataSize = ciphertext.length + encryptedKey.length;

    return {
      version: this.version,
      encryptedContent: {
        algorithm: 'AES-256-GCM',
        ciphertext: toHex(ciphertext),
        iv: toHex(iv),
        authTag: toHex(authTag)
      },
      encryptedKey: {
        algorithm: 'ECIES-secp256k1',
        ephemeralPublicKey: toHex(ephemeralPublicKey),
        ciphertext: toHex(encryptedKey),
        mac: toHex(mac)
      },
      metadata: {
        version: this.version,
        timestamp,
        size: metadataSize,
        contentType: 'mail'
      }
    };
  }

  async decrypt(pkg: EncryptedMailPackage, recipientPrivateKeyHex: string): Promise<MailContent> {
    const symmetricKey = this.unwrapSymmetricKey(pkg, recipientPrivateKeyHex);
    const iv = fromHex(pkg.encryptedContent.iv);
    const ciphertext = fromHex(pkg.encryptedContent.ciphertext);
    const authTag = fromHex(pkg.encryptedContent.authTag);

    const decipher = createDecipheriv('aes-256-gcm', symmetricKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return JSON.parse(decrypted.toString('utf-8')) as MailContent;
  }

  private wrapSymmetricKey(key: Buffer, recipientPublicKey: Uint8Array): { encryptedKey: Buffer; mac: Buffer; ephemeralPublicKey: Uint8Array } {
    const ephemeralPrivateKey = this.generatePrivateKey();
    const ephemeralPublicKey = getPublicKey(ephemeralPrivateKey, true);
    const sharedSecret = this.computeSharedSecret(ephemeralPrivateKey, recipientPublicKey);

    const maskKey = deriveKey(sharedSecret, 'basemailer-mask', 32);
    const macKey = deriveKey(sharedSecret, 'basemailer-mac', 32);

    const encryptedKey = Buffer.alloc(key.length);
    for (let i = 0; i < key.length; i += 1) {
      encryptedKey[i] = key[i] ^ maskKey[i % maskKey.length];
    }

    const mac = createHmac('sha256', macKey).update(encryptedKey).digest();
    return { encryptedKey, mac, ephemeralPublicKey };
  }

  private unwrapSymmetricKey(pkg: EncryptedMailPackage, recipientPrivateKeyHex: string): Buffer {
    const ephemeralPublicKey = this.normalizePublicKey(pkg.encryptedKey.ephemeralPublicKey);
    const recipientPrivateKey = this.normalizePrivateKey(recipientPrivateKeyHex);

    const sharedSecret = this.computeSharedSecret(recipientPrivateKey, ephemeralPublicKey);
    const maskKey = deriveKey(sharedSecret, 'basemailer-mask', 32);
    const macKey = deriveKey(sharedSecret, 'basemailer-mac', 32);

    const encryptedKey = fromHex(pkg.encryptedKey.ciphertext);
    const expectedMac = createHmac('sha256', macKey).update(encryptedKey).digest();
    const providedMac = fromHex(pkg.encryptedKey.mac);

    if (!expectedMac.equals(providedMac)) {
      this.logger.error('MAC verification failed while decrypting symmetric key');
      throw new Error('encrypted key MAC mismatch');
    }

    const symmetricKey = Buffer.alloc(encryptedKey.length);
    for (let i = 0; i < encryptedKey.length; i += 1) {
      symmetricKey[i] = encryptedKey[i] ^ maskKey[i % maskKey.length];
    }

    return symmetricKey;
  }

  private computeSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
    const secret = getSharedSecret(privateKey, publicKey, true);
    return secret.slice(1); // drop format byte
  }

  private generatePrivateKey(): Uint8Array {
    let key = randomBytes(32);
    while (key.length === 0 || key.every((b) => b === 0)) {
      key = randomBytes(32);
    }
    return key;
  }

  private normalizePublicKey(hex: string): Uint8Array {
    return new Uint8Array(fromHex(this.ensureHexPrefix(hex)));
  }

  private normalizePrivateKey(hex: string): Uint8Array {
    const buff = fromHex(this.ensureHexPrefix(hex));
    if (buff.length !== 32) {
      throw new Error('Private key must be 32 bytes');
    }
    return new Uint8Array(buff);
  }

  private ensureHexPrefix(value: string): string {
    return value.startsWith('0x') ? value : `0x${value}`;
  }
}
