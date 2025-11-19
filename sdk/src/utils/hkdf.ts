import { hkdfSync } from 'crypto';

export function deriveKey(sharedSecret: Uint8Array, info: string, length = 32, salt?: Uint8Array): Uint8Array {
  const buffer = Buffer.isBuffer(sharedSecret) ? sharedSecret : Buffer.from(sharedSecret);
  const derived = hkdfSync('sha256', buffer, salt ?? Buffer.alloc(0), Buffer.from(info, 'utf-8'), length);
  return new Uint8Array(derived);
}
