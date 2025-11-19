# @basemailer/sdk

TypeScript/JavaScript SDK that powers BaseMailer clients, handling:

- Email registration/helpers for `BaseMailerRegistry`
- ZK proof generation via Groth16 circuits
- Hybrid AES-256-GCM + ECIES encryption utilities
- IPFS storage (with optional compression & pinning)
- Backend REST helpers for self-hosted deployments

## Quick start

```bash
npm install @basemailer/sdk
```

```ts
import { BaseMailerClient } from '@basemailer/sdk';

const client = new BaseMailerClient({
  registryAddress: '0xRegistry',
  mailerAddress: '0xMailer',
  rpcUrl: 'https://mainnet.base.org',
  proof: {
    circuitPath: './circuits/email_ownership.wasm',
    provingKeyPath: './circuits/email_ownership_final.zkey'
  },
  recipientResolver: async (email, owner) => ({
    email,
    owner,
    publicKey: await fetchPublicKey(owner)
  })
});

await client.sendMail({
  from: 'alice.base.eth@basemailer.com',
  to: 'bob.base.eth@basemailer.com',
  subject: 'Hello',
  body: 'GM Bob!'
});
```

> **Note**
> Recipient resolution requires an external hook that can derive the secp256k1 public key for the owner’s address (e.g., via wallet signature or registry metadata).

## Built‑in Email Service

The SDK ships with a self-hosted service that can be initialized and run directly:

```bash
npx basemailer-sdk init
# edit basemailer.service.config.json
npx basemailer-sdk service start --config=basemailer.service.config.json
```

This spins up the Express backend defined in the SDK (`EmailService`), handling:

- `/api/send-mail` – verify proof, pin CID, submit on-chain
- `/api/inbox/:email` & `/api/sentbox/:email` – return indexed metadata
- `/health` – service heartbeat

You can also embed the service programmatically:

```ts
import { EmailService } from '@basemailer/sdk';
import config from './basemailer.service.config.json';

const service = new EmailService(config);
await service.start();
```

## Scripts

- `npm run build` – build ESM/CJS bundles via `tsup`
- `npm run dev` – watch mode for development
- `npm run test` – execute unit tests with `vitest`
- `npm run typecheck` – run `tsc --noEmit`

## Testing

```bash
npm run test
```

## License

MIT © BaseMailer Contributors
