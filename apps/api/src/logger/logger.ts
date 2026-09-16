import { Config } from '../config/config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private readonly context: string;
  private readonly config: Config;

  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: Config, context: string) {
    this.config = config;
    this.context = context;
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  public child(context: string): Logger {
    return new Logger(this.config, `${this.context}:${context}`);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const configuredLevel = this.config.values.logLevel as LogLevel;
    if (Logger.LEVEL_PRIORITY[level] < Logger.LEVEL_PRIORITY[configuredLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `${timestamp} [${level.toUpperCase()}] [${this.context}]`;
    const output = meta ? `${prefix} ${message} ${JSON.stringify(meta)}` : `${prefix} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }
}
