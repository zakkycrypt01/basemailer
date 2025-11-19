export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  level: LogLevel;
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export class ConsoleLogger implements Logger {
  level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(target: LogLevel): boolean {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
    return order.indexOf(target) >= order.indexOf(this.level) && this.level !== 'silent';
  }

  debug(message: string, meta?: unknown): void {
    if (this.shouldLog('debug')) console.debug(`[BaseMailer][debug] ${message}`, meta ?? '');
  }

  info(message: string, meta?: unknown): void {
    if (this.shouldLog('info')) console.info(`[BaseMailer][info] ${message}`, meta ?? '');
  }

  warn(message: string, meta?: unknown): void {
    if (this.shouldLog('warn')) console.warn(`[BaseMailer][warn] ${message}`, meta ?? '');
  }

  error(message: string, meta?: unknown): void {
    if (this.shouldLog('error')) console.error(`[BaseMailer][error] ${message}`, meta ?? '');
  }
}
