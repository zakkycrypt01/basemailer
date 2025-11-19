export interface CidStore {
  set(key: string, cid: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
}

export class InMemoryCidStore implements CidStore {
  private readonly store = new Map<string, string>();

  async set(key: string, cid: string): Promise<void> {
    this.store.set(key, cid);
  }

  async get(key: string): Promise<string | undefined> {
    return this.store.get(key);
  }
}
