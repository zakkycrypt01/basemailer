import { keccak256, toUtf8Bytes } from 'ethers';

export function toHex(buffer: Uint8Array | Buffer): string {
  return `0x${Buffer.from(buffer).toString('hex')}`;
}

export function fromHex(hex: string): Buffer {
  if (!hex.startsWith('0x')) {
    throw new Error('Hex string must start with 0x');
  }
  return Buffer.from(hex.slice(2), 'hex');
}

export function cidToBytes32(cid: string): string {
  const hash = keccak256(toUtf8Bytes(cid));
  return hash;
}

export function assertHex(input: string, label: string): void {
  if (!/^0x[0-9a-fA-F]+$/.test(input)) {
    throw new Error(`${label} must be a hex string`);
  }
}
