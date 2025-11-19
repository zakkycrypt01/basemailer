import { describe, expect, it } from 'vitest';
import { getPublicKey } from '@noble/secp256k1';
import { EncryptionManager } from '../src/encryption/EncryptionManager.js';

const recipientPrivateKeyBytes = Buffer.alloc(32, 1);
const recipientPrivateKey = `0x${recipientPrivateKeyBytes.toString('hex')}`;
const recipientPublicKey = `0x${Buffer.from(getPublicKey(recipientPrivateKeyBytes, true)).toString('hex')}`;

describe('EncryptionManager', () => {
  it('encrypts and decrypts payloads', async () => {
    const manager = new EncryptionManager();
    const mail = {
      from: 'alice.base.eth@basemailer.com',
      to: 'bob.base.eth@basemailer.com',
      subject: 'Hi Bob',
      body: 'Hello from Alice',
      timestamp: Date.now()
    };

    const encrypted = await manager.encrypt(mail, recipientPublicKey);
    const decrypted = await manager.decrypt(encrypted, recipientPrivateKey);

    expect(decrypted.subject).toEqual(mail.subject);
    expect(decrypted.body).toEqual(mail.body);
  });
});
