#!/usr/bin/env node
import { readFile, writeFile, access } from 'fs/promises';
import path from 'path';
import process from 'process';
import readline from 'readline';
import { EmailService } from './service/EmailService.js';
import type { EmailServiceConfig } from './service/types.js';

const DEFAULT_CONFIG = 'basemailer.service.config.json';

// ANSI color codes for better CLI output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

interface CliInterface {
  question(query: string): Promise<string>;
  close(): void;
}

function createInterface(): CliInterface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    question: (query: string) => new Promise((resolve) => rl.question(query, resolve)),
    close: () => rl.close(),
  };
}

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function printBanner(): void {
  console.log(colorize('\n╭─────────────────────────────────────╮', 'cyan'));
  console.log(colorize('│       🚀 BaseMailer SDK CLI       │', 'cyan'));
  console.log(colorize('│   Decentralized Email on Base      │', 'cyan'));
  console.log(colorize('╰─────────────────────────────────────╯\n', 'cyan'));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // If no arguments provided, start interactive mode
  if (args.length === 0) {
    await interactiveMode();
    return;
  }

  // Handle direct command arguments
  const [command = 'help', subcommand, ...rest] = args;

  switch (command) {
    case 'init':
      await handleInit();
      break;
    case 'service':
      if (subcommand === 'start') {
        await handleServiceStart(rest);
      } else if (subcommand === 'status') {
        await handleServiceStatus();
      } else {
        printHelp();
      }
      break;
    case 'interactive':
    case '-i':
    case '--interactive':
      await interactiveMode();
      break;
    default:
      printHelp();
  }
}

async function interactiveMode(): Promise<void> {
  const cli = createInterface();
  
  try {
    printBanner();
    
    while (true) {
      console.log(colorize('\nAvailable commands:', 'bright'));
      console.log('1. 📝 Initialize service configuration');
      console.log('2. 🚀 Start email service');
      console.log('3. 📊 Check service status');
      console.log('4. ⚙️  Advanced configuration');
      console.log('5. ❓ Help');
      console.log('6. 🚪 Exit\n');

      const choice = await cli.question(colorize('Select an option (1-6): ', 'yellow'));

      switch (choice.trim()) {
        case '1':
          await interactiveInit(cli);
          break;
        case '2':
          await interactiveServiceStart(cli);
          break;
        case '3':
          await handleServiceStatus();
          break;
        case '4':
          await interactiveAdvancedConfig(cli);
          break;
        case '5':
          printDetailedHelp();
          break;
        case '6':
          console.log(colorize('\n👋 Goodbye! Thanks for using BaseMailer SDK\n', 'green'));
          return;
        default:
          console.log(colorize('\n❌ Invalid option. Please choose 1-6.', 'red'));
      }
    }
  } finally {
    cli.close();
  }
}

async function interactiveInit(cli: CliInterface): Promise<void> {
  console.log(colorize('\n📝 Initialize BaseMailer Service Configuration', 'bright'));
  console.log('─'.repeat(50));

  const configPath = await cli.question(
    `Config file path (${colorize(DEFAULT_CONFIG, 'cyan')}): `
  );
  const target = path.resolve(process.cwd(), configPath || DEFAULT_CONFIG);

  try {
    await access(target);
    const overwrite = await cli.question(
      colorize('⚠️  Config file already exists. Overwrite? (y/N): ', 'yellow')
    );
    if (overwrite.toLowerCase() !== 'y') {
      console.log(colorize('✅ Keeping existing configuration.', 'green'));
      return;
    }
  } catch {}

  console.log(colorize('\n🔧 Let\'s configure your BaseMailer service...', 'blue'));

  const rpcUrl = await cli.question(
    `RPC URL (${colorize('https://mainnet.base.org', 'cyan')}): `
  );
  
  const registryAddress = await cli.question('Registry contract address: ');
  const mailerAddress = await cli.question('Mailer contract address: ');
  
  const port = await cli.question(
    `Service port (${colorize('3000', 'cyan')}): `
  );

  const useIPFS = await cli.question(
    colorize('Enable IPFS storage? (Y/n): ', 'yellow')
  );

  let ipfsConfig = undefined;
  if (useIPFS.toLowerCase() !== 'n') {
    console.log(colorize('\n🌐 IPFS Configuration:', 'blue'));
    const endpoint = await cli.question(
      `IPFS endpoint (${colorize('https://ipfs.infura.io:5001', 'cyan')}): `
    );
    const projectId = await cli.question('IPFS Project ID (optional): ');
    const projectSecret = await cli.question('IPFS Project Secret (optional): ');
    
    ipfsConfig = {
      endpoint: endpoint || 'https://ipfs.infura.io:5001',
      ...(projectId && { projectId }),
      ...(projectSecret && { projectSecret }),
      pin: true,
      compress: true
    };
  }

  const template: EmailServiceConfig = {
    rpcUrl: rpcUrl || 'https://mainnet.base.org',
    registryAddress: registryAddress || '0xRegistryAddress',
    mailerAddress: mailerAddress || '0xMailerAddress',
    signerPrivateKey: '0xYOUR_PRIVATE_KEY',
    port: parseInt(port) || 3000,
    verificationKeyPath: './circuits/email_ownership_verification_key.json',
    ipfs: ipfsConfig || {
      endpoint: 'https://ipfs.infura.io:5001',
      pin: true,
      compress: true
    }
  };

  await writeFile(target, JSON.stringify(template, null, 2));
  console.log(colorize(`\n✅ Configuration created at ${target}`, 'green'));
  console.log(colorize('⚠️  Remember to update your private key and circuit paths!', 'yellow'));
}

async function interactiveServiceStart(cli: CliInterface): Promise<void> {
  console.log(colorize('\n🚀 Start BaseMailer Service', 'bright'));
  console.log('─'.repeat(30));

  const configPath = await cli.question(
    `Config file path (${colorize(DEFAULT_CONFIG, 'cyan')}): `
  );
  
  const resolved = path.resolve(process.cwd(), configPath || DEFAULT_CONFIG);
  
  try {
    await access(resolved);
    console.log(colorize(`📂 Found config at ${resolved}`, 'green'));
  } catch {
    console.log(colorize(`❌ Config file not found at ${resolved}`, 'red'));
    console.log(colorize('💡 Run initialization first or check the path.', 'yellow'));
    return;
  }

  const confirm = await cli.question(
    colorize('Start the service? (Y/n): ', 'yellow')
  );
  
  if (confirm.toLowerCase() !== 'n') {
    console.log(colorize('\n🔄 Starting service...', 'blue'));
    await handleServiceStartWithPath(resolved);
  }
}

async function interactiveAdvancedConfig(cli: CliInterface): Promise<void> {
  console.log(colorize('\n⚙️  Advanced Configuration Options', 'bright'));
  console.log('─'.repeat(40));
  
  console.log('1. 🔐 Configure encryption settings');
  console.log('2. 📡 Configure IPFS pinning services');
  console.log('3. ⛓️  Configure blockchain settings');
  console.log('4. 🔙 Back to main menu');

  const choice = await cli.question(colorize('\nSelect option (1-4): ', 'yellow'));

  switch (choice.trim()) {
    case '1':
      console.log(colorize('\n🔐 Encryption Configuration:', 'blue'));
      console.log('- AES-256-GCM encryption is used by default');
      console.log('- ECIES for public key encryption');
      console.log('- No additional configuration needed');
      break;
    case '2':
      console.log(colorize('\n📡 IPFS Pinning Services:', 'blue'));
      console.log('- Pinata: Configure JWT token in config');
      console.log('- Infura IPFS: Set project credentials');
      console.log('- Custom pinning service: Configure endpoint');
      break;
    case '3':
      console.log(colorize('\n⛓️  Blockchain Settings:', 'blue'));
      console.log('- Base Mainnet: https://mainnet.base.org');
      console.log('- Base Sepolia: https://sepolia.base.org');
      console.log('- Custom RPC: Set your preferred endpoint');
      break;
    case '4':
      return;
    default:
      console.log(colorize('❌ Invalid option.', 'red'));
  }

  await cli.question(colorize('\nPress Enter to continue...', 'cyan'));
}

async function handleInit(): Promise<void> {
  const target = path.resolve(process.cwd(), DEFAULT_CONFIG);
  try {
    await access(target);
    console.log(colorize(`Config already exists at ${target}`, 'yellow'));
    return;
  } catch {}

  const template: EmailServiceConfig = {
    rpcUrl: 'https://mainnet.base.org',
    registryAddress: '0xRegistryAddress',
    mailerAddress: '0xMailerAddress',
    signerPrivateKey: '0xYOUR_PRIVATE_KEY',
    port: 3000,
    verificationKeyPath: './circuits/email_ownership_verification_key.json',
    ipfs: {
      endpoint: 'https://ipfs.infura.io:5001',
      projectId: 'your_project_id',
      projectSecret: 'your_project_secret',
      pin: true,
      compress: true
    }
  };

  await writeFile(target, JSON.stringify(template, null, 2));
  console.log(colorize(`✅ BaseMailer service config created at ${target}`, 'green'));
}

async function handleServiceStart(args: string[]): Promise<void> {
  const configPathArg = args.find((arg) => arg.startsWith('--config='));
  const configPath = configPathArg ? configPathArg.split('=')[1] : DEFAULT_CONFIG;
  const resolved = path.resolve(process.cwd(), configPath);
  await handleServiceStartWithPath(resolved);
}

async function handleServiceStartWithPath(configPath: string): Promise<void> {
  let config: EmailServiceConfig;
  try {
    config = JSON.parse(await readFile(configPath, 'utf-8')) as EmailServiceConfig;
  } catch (error) {
    console.error(colorize(`❌ Unable to read config at ${configPath}:`, 'red'), error);
    process.exit(1);
    return;
  }

  console.log(colorize('🔄 Starting BaseMailer service...', 'blue'));
  const service = new EmailService(config);
  await service.start();
  console.log(colorize(`🚀 BaseMailer service running on port ${config.port ?? 3000}`, 'green'));

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(colorize('\n🛑 Shutting down service...', 'yellow'));
      await service.stop();
      console.log(colorize('✅ Service stopped gracefully', 'green'));
      process.exit(0);
    });
  });
}

async function handleServiceStatus(): Promise<void> {
  console.log(colorize('\n📊 Service Status Check', 'bright'));
  console.log('─'.repeat(25));
  
  // Try to read config and check if service might be running
  const configPath = path.resolve(process.cwd(), DEFAULT_CONFIG);
  try {
    await access(configPath);
    const config = JSON.parse(await readFile(configPath, 'utf-8')) as EmailServiceConfig;
    const port = config.port ?? 3000;
    
    console.log(colorize(`📂 Config found: ${configPath}`, 'green'));
    console.log(colorize(`🔧 Configured port: ${port}`, 'blue'));
    console.log(colorize(`🌐 RPC URL: ${config.rpcUrl}`, 'blue'));
    console.log(colorize('\n💡 To check if service is running, try: curl http://localhost:' + port + '/health', 'cyan'));
  } catch {
    console.log(colorize(`❌ No config found at ${configPath}`, 'red'));
    console.log(colorize('💡 Run initialization first', 'yellow'));
  }
}

function printHelp(): void {
  console.log(colorize('\n🚀 BaseMailer SDK CLI', 'bright'));
  console.log('─'.repeat(25));
  console.log('\nUsage:');
  console.log('  basemailer-sdk [command] [options]');
  console.log('  basemailer-sdk (no args for interactive mode)');
  console.log('\nCommands:');
  console.log(colorize('  init', 'cyan') + '                    Create default service config');
  console.log(colorize('  service start', 'cyan') + '           Start the built-in email service');
  console.log(colorize('  service status', 'cyan') + '          Check service configuration');
  console.log(colorize('  interactive, -i', 'cyan') + '         Start interactive mode');
  console.log('\nOptions:');
  console.log('  --config=<path>           Specify config file path');
  console.log('\nExamples:');
  console.log('  basemailer-sdk init');
  console.log('  basemailer-sdk service start --config=my-config.json');
  console.log('  basemailer-sdk -i');
}

function printDetailedHelp(): void {
  printHelp();
  console.log(colorize('\n📚 Additional Information:', 'bright'));
  console.log('─'.repeat(30));
  console.log('• Configuration files are JSON format');
  console.log('• Requires ZK circuit files (.wasm, .zkey)');
  console.log('• Service provides REST API for email operations');
  console.log('• IPFS integration for distributed storage');
  console.log('• Built on Base blockchain network');
  console.log('\n🔗 For more help: https://docs.basemailer.com');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
