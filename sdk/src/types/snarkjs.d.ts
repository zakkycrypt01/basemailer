declare module 'snarkjs' {
  export const groth16: {
    fullProve(
      inputs: Record<string, unknown>,
      circuitPath: string,
      provingKeyPath: string
    ): Promise<{ proof: any; publicSignals: string[] }>;
    verify(verificationKey: any, publicSignals: string[], proof: any): Promise<boolean>;
  };
}
