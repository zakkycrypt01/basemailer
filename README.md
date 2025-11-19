# @basemailer/sdk

[![Development Status](https://img.shields.io/badge/Status-Under%20Development-orange)](https://github.com/basemailer/sdk)
[![npm version](https://img.shields.io/npm/v/@basemailer/sdk)](https://www.npmjs.com/package/@basemailer/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

> ⚠️ **Development Notice**: This SDK is currently under active development. APIs and features may change before the stable release. Use with caution in production environments.

A comprehensive TypeScript/JavaScript SDK for building decentralized email applications on the Base network. BaseMailer combines zero-knowledge proofs, hybrid encryption, and distributed storage to enable private, verifiable email communication on-chain.

## Features

- **🔐 Zero-Knowledge Email Verification**: Groth16 circuits for proving email ownership without revealing credentials
- **🛡️ Hybrid Encryption**: AES-256-GCM + ECIES for secure message encryption
- **📡 Distributed Storage**: IPFS integration with optional compression and pinning
- **⛓️ On-Chain Registry**: Smart contract integration for email registration and verification
- **🚀 Self-Hosted Backend**: Built-in Express service for production deployments
- **📱 Cross-Platform**: Full TypeScript support with ESM/CJS compatibility

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Self-Hosted Service](#self-hosted-service)
- [Development](#development)
- [Examples](#examples)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install @basemailer/sdk
# or
yarn add @basemailer/sdk
# or
pnpm add @basemailer/sdk
```

### Prerequisites

- Node.js 18+ 
- TypeScript 5.0+ (for TypeScript projects)
- Access to Base network RPC endpoint
- ZK circuit files (`.wasm` and `.zkey`)

## Quick Start

```typescript
import { BaseMailerClient } from '@basemailer/sdk';

// Initialize the client
const client = new BaseMailerClient({
  registryAddress: '0x...', // BaseMailer registry contract address
  mailerAddress: '0x...', // BaseMailer contract address
  rpcUrl: 'https://mainnet.base.org',
  proof: {
    circuitPath: './circuits/email_ownership.wasm',
    provingKeyPath: './circuits/email_ownership_final.zkey'
  },
  recipientResolver: async (email, owner) => {
    // Custom logic to resolve recipient's public key
    return {
      email,
      owner,
      publicKey: await fetchPublicKey(owner)
    };
  }
});

// Send an encrypted email
await client.sendMail({
  from: 'alice.base.eth@basemailer.com',
  to: 'bob.base.eth@basemailer.com',
  subject: 'Hello from BaseMailer',
  body: 'This message is encrypted and stored on IPFS!'
});
```

## Configuration

### BaseMailerClient Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `registryAddress` | `string` | ✅ | Address of the BaseMailer registry contract |
| `mailerAddress` | `string` | ✅ | Address of the BaseMailer contract |
| `rpcUrl` | `string` | ✅ | Base network RPC endpoint |
| `proof.circuitPath` | `string` | ✅ | Path to the email ownership circuit (.wasm) |
| `proof.provingKeyPath` | `string` | ✅ | Path to the proving key (.zkey) |
| `recipientResolver` | `Function` | ✅ | Async function to resolve recipient public keys |
| `ipfs.gateway` | `string` | ❌ | Custom IPFS gateway URL |
| `ipfs.pinningService` | `object` | ❌ | Pinning service configuration |

> **Important**: The `recipientResolver` function must implement logic to derive secp256k1 public keys for recipient addresses. This typically involves wallet signatures or registry lookups.

### Environment Configuration

Create a `.env` file for sensitive configuration:

```env
# Base Network Configuration
BASE_RPC_URL=https://mainnet.base.org
BASEMAILER_REGISTRY_ADDRESS=0x...
BASEMAILER_CONTRACT_ADDRESS=0x...

# IPFS Configuration
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
IPFS_PINNING_JWT=your_pinning_service_jwt

# ZK Proof Circuits
CIRCUIT_WASM_PATH=./circuits/email_ownership.wasm
CIRCUIT_ZKEY_PATH=./circuits/email_ownership_final.zkey
```

## API Reference

### BaseMailerClient

The main client class for interacting with the BaseMailer protocol.

#### Constructor

```typescript
new BaseMailerClient(config: BaseMailerConfig)
```

#### Methods

##### `sendMail(options: SendMailOptions): Promise<string>`

Sends an encrypted email through the BaseMailer protocol.

**Parameters:**
- `from` (string): Sender's email address
- `to` (string): Recipient's email address  
- `subject` (string): Email subject line
- `body` (string): Email message body
- `attachments?` (Attachment[]): Optional file attachments

**Returns:** Promise resolving to the transaction hash

**Example:**
```typescript
const txHash = await client.sendMail({
  from: 'alice.base.eth@basemailer.com',
  to: 'bob.base.eth@basemailer.com',
  subject: 'Meeting Reminder',
  body: 'Don\'t forget about our meeting tomorrow at 2 PM.',
  attachments: [{
    filename: 'agenda.pdf',
    content: Buffer.from('...'),
    mimeType: 'application/pdf'
  }]
});
```

##### `getInbox(email: string): Promise<Mail[]>`

Retrieves inbox messages for a specified email address.

##### `getSentbox(email: string): Promise<Mail[]>`

Retrieves sent messages for a specified email address.

##### `registerEmail(email: string, proof: ZKProof): Promise<string>`

Registers an email address with zero-knowledge proof verification.

### Utility Classes

#### EncryptionManager

Handles hybrid encryption operations for email content.

#### ProofGenerator  

Generates zero-knowledge proofs for email ownership verification.

#### IPFSClient

Manages IPFS storage operations with optional pinning services.

## Self-Hosted Service

The SDK includes a production-ready backend service that can be deployed independently or embedded in your application.

### CLI Usage

```bash
# Initialize service configuration
npx @basemailer/sdk init

# Start the service
npx @basemailer/sdk service start --config=basemailer.service.config.json

# Check service status
npx @basemailer/sdk service status
```

### Programmatic Usage

```typescript
import { EmailService } from '@basemailer/sdk';

const service = new EmailService({
  port: 3000,
  cors: {
    origin: ['https://your-frontend.com'],
    credentials: true
  },
  database: {
    url: 'postgresql://user:pass@localhost:5432/basemailer'
  },
  blockchain: {
    rpcUrl: process.env.BASE_RPC_URL,
    contractAddresses: {
      registry: process.env.REGISTRY_ADDRESS,
      mailer: process.env.MAILER_ADDRESS
    }
  },
  ipfs: {
    gateway: 'https://ipfs.io/ipfs/',
    pinningService: {
      url: 'https://api.pinata.cloud',
      jwt: process.env.PINATA_JWT
    }
  }
});

// Start the service
await service.start();
console.log('BaseMailer service running on port 3000');
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/send-mail` | POST | Send encrypted email with proof verification |
| `/api/inbox/:email` | GET | Retrieve inbox for email address |
| `/api/sentbox/:email` | GET | Retrieve sent messages for email address |
| `/api/register` | POST | Register email with ZK proof |
| `/health` | GET | Service health check |

## Development

### Prerequisites

- Node.js 18+
- TypeScript 5.0+
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/basemailer/sdk.git
cd sdk

# Install dependencies
npm install

# Build the project
npm run build
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build ESM/CJS bundles via tsup |
| `npm run dev` | Watch mode for development |
| `npm run test` | Execute unit tests with Vitest |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Lint code with ESLint |
| `npm run format` | Format code with Prettier |

### Project Structure

```
src/
├── client/             # Main client implementation
├── backend/           # Backend API utilities
├── encryption/        # Encryption and decryption utilities
├── zkproof/          # Zero-knowledge proof generation
├── storage/          # IPFS storage integration
├── service/          # Self-hosted email service
├── contracts/        # Smart contract ABIs and utilities
├── utils/            # Shared utilities
└── types/            # TypeScript type definitions
```

## Examples

### Basic Email Registration

```typescript
import { BaseMailerClient, ProofGenerator } from '@basemailer/sdk';

const client = new BaseMailerClient(config);
const proofGen = new ProofGenerator(circuitConfig);

// Generate proof of email ownership
const proof = await proofGen.generateEmailProof({
  email: 'user@gmail.com',
  emailSignature: 'DKIM-Signature: ...',
  privateKey: userPrivateKey
});

// Register email on-chain
const txHash = await client.registerEmail(
  'user.base.eth@basemailer.com', 
  proof
);
```

### Advanced Configuration

```typescript
const client = new BaseMailerClient({
  registryAddress: '0x...',
  mailerAddress: '0x...',
  rpcUrl: 'https://mainnet.base.org',
  proof: {
    circuitPath: './circuits/email_ownership.wasm',
    provingKeyPath: './circuits/email_ownership_final.zkey'
  },
  ipfs: {
    gateway: 'https://your-ipfs-gateway.com/ipfs/',
    pinningService: {
      url: 'https://api.pinata.cloud',
      jwt: process.env.PINATA_JWT,
      timeout: 30000
    }
  },
  recipientResolver: async (email, owner) => {
    // Custom implementation for public key resolution
    const registry = new ethers.Contract(registryAddress, abi, provider);
    const publicKey = await registry.getPublicKey(owner);
    return { email, owner, publicKey };
  },
  logger: {
    level: 'debug',
    format: 'json'
  }
});
```

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test encryption.test.ts
```

### Test Configuration

The project uses Vitest for testing with configuration in `vitest.config.ts`. Tests are located in the `tests/` directory and follow the pattern `*.test.ts`.

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BaseMailerClient } from '../src/client/BaseMailerClient';

describe('BaseMailerClient', () => {
  let client: BaseMailerClient;

  beforeEach(() => {
    client = new BaseMailerClient(testConfig);
  });

  it('should send mail successfully', async () => {
    const result = await client.sendMail({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      body: 'Test message'
    });
    
    expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
});
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests: `npm run test`
5. Run type checking: `npm run typecheck`
6. Commit your changes: `git commit -m 'feat: add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Standards

- Follow TypeScript best practices
- Maintain 90%+ test coverage
- Use conventional commits
- Document all public APIs
- Run `npm run format` before committing

## Roadmap

- [ ] **v0.1.0**: Core SDK functionality
- [ ] **v0.2.0**: Enhanced encryption options
- [ ] **v0.3.0**: Multiple IPFS provider support
- [ ] **v0.4.0**: Mobile SDK wrappers
- [ ] **v1.0.0**: Production-ready stable release

## Support

- 📚 [Documentation](https://docs.basemailer.com)
- 💬 [Discord Community](https://discord.gg/basemailer)
- 🐛 [Issue Tracker](https://github.com/basemailer/sdk/issues)
- 📧 [Email Support](mailto:support@basemailer.com)

## Security

Security is our top priority. If you discover a security vulnerability, please send an email to [security@basemailer.com](mailto:security@basemailer.com). All security vulnerabilities will be promptly addressed.

## License

MIT © BaseMailer Contributors

---

**Disclaimer**: This software is in active development. Use at your own risk in production environments. The BaseMailer team makes no warranties about the software's reliability, security, or fitness for any particular purpose.