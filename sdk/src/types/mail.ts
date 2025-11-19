export interface MailContent {
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp?: number;
  attachments?: AttachmentMeta[];
}

export interface AttachmentMeta {
  name: string;
  mimeType: string;
  size: number;
  cid?: string;
}

export interface MailMetadata {
  version: string;
  timestamp: number;
  size: number;
  contentType: 'mail';
}

export interface EncryptedContentPayload {
  algorithm: 'AES-256-GCM';
  ciphertext: string; // hex string
  iv: string; // hex string
  authTag: string; // hex string
}

export interface EncryptedKeyPayload {
  algorithm: 'ECIES-secp256k1';
  ephemeralPublicKey: string; // hex string
  ciphertext: string; // hex string
  mac: string; // hex string
}

export interface EncryptedMailPackage {
  version: string;
  encryptedContent: EncryptedContentPayload;
  encryptedKey: EncryptedKeyPayload;
  metadata: MailMetadata;
}

export interface MailRecord {
  mailId: bigint;
  contentCID: string; // bytes32 hex string
  senderEmail: string;
  recipientEmail: string;
  timestamp: bigint;
  verified: boolean;
}

export interface SendMailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: AttachmentMeta[];
}
