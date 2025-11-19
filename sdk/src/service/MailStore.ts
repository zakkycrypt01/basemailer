import type { StoredMail } from './types.js';

export interface MailStore {
  save(mail: StoredMail): Promise<void>;
  get(mailId: string): Promise<StoredMail | undefined>;
  getInbox(email: string): Promise<StoredMail[]>;
  getSentbox(email: string): Promise<StoredMail[]>;
}

export class InMemoryMailStore implements MailStore {
  private readonly mails = new Map<string, StoredMail>();

  async save(mail: StoredMail): Promise<void> {
    this.mails.set(mail.mailId, mail);
  }

  async get(mailId: string): Promise<StoredMail | undefined> {
    return this.mails.get(mailId);
  }

  async getInbox(email: string): Promise<StoredMail[]> {
    return Array.from(this.mails.values()).filter((mail) => mail.recipientEmail === email);
  }

  async getSentbox(email: string): Promise<StoredMail[]> {
    return Array.from(this.mails.values()).filter((mail) => mail.senderEmail === email);
  }
}
