export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  databaseUrl: string;
  rabbitmqUrl: string;
}

export class Config {
  private static instance: Config;
  private readonly config: AppConfig;

  private constructor() {
    this.config = {
      nodeEnv: this.getEnv('NODE_ENV', 'development'),
      port: parseInt(this.getEnv('PORT', '4000'), 10),
      logLevel: this.getEnv('LOG_LEVEL', 'info'),
      databaseUrl: this.getEnv('DATABASE_URL', 'postgresql://kadakaran:kadakaran@localhost:5432/kadakaran'),
      rabbitmqUrl: this.getEnv('RABBITMQ_URL', 'amqp://kadakaran:kadakaran@localhost:5672'),
    };

    this.validate();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public get values(): Readonly<AppConfig> {
    return Object.freeze({ ...this.config });
  }

  public get isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  public get isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  private getEnv(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
  }

  private validate(): void {
    const { port } = this.config;

    if (isNaN(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid PORT value: ${port}. Must be between 0 and 65535.`);
    }
  }
}
