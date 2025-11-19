import { readFile } from 'fs/promises';
import { AbiCoder } from 'ethers';
import type { ProofConfig } from '../types/config.js';

export interface ProofResult {
  proof: string;
  publicSignals: string[];
}

export class ProofGenerator {
  private snark: typeof import('snarkjs') | null = null;
  private verificationKey: any | null = null;
  private readonly abi = new AbiCoder();

  constructor(private readonly config: ProofConfig) {
    if (!config.circuitPath || !config.provingKeyPath) {
      throw new Error('ProofGenerator requires circuit and proving key paths');
    }
  }

  async generateProof(inputs: Record<string, unknown>): Promise<ProofResult> {
    const snarkjs = await this.loadSnark();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      this.config.circuitPath,
      this.config.provingKeyPath
    );

    return {
      proof: this.packProof(proof),
      publicSignals: publicSignals.map(String)
    };
  }

  async verifyProof(publicSignals: string[], proof: any): Promise<boolean> {
    if (!this.config.verificationKeyPath) {
      throw new Error('Verification key path not provided');
    }

    const snarkjs = await this.loadSnark();
    const key = await this.loadVerificationKey();
    return snarkjs.groth16.verify(key, publicSignals, proof);
  }

  private async loadSnark(): Promise<typeof import('snarkjs')> {
    if (!this.snark) {
      this.snark = await import('snarkjs');
    }
    return this.snark;
  }

  private async loadVerificationKey(): Promise<any> {
    if (this.verificationKey) return this.verificationKey;
    const file = await readFile(this.config.verificationKeyPath!, 'utf-8');
    this.verificationKey = JSON.parse(file);
    return this.verificationKey;
  }

  private packProof(proof: any): string {
    const piA = proof.pi_a.map((value: string) => BigInt(value));
    const piB = proof.pi_b.map((row: string[]) => row.map((value) => BigInt(value)));
    const piC = proof.pi_c.map((value: string) => BigInt(value));

    return this.abi.encode(['uint256[2]', 'uint256[2][2]', 'uint256[2]'], [piA, piB, piC]);
  }
}
