import type { ILogger } from "@cc/domain";

/**
 * Minimal ILogger over the same single-line JSON the rest of apps/agent emits,
 * so domain logs land in one stream alongside the per-turn traceId lines rather
 * than in a second format.
 */
class JsonLogger implements ILogger {
  constructor(private readonly context: string) {}

  private write(level: string, message: string, meta?: Record<string, unknown>): void {
    const line = JSON.stringify({ level, context: this.context, message, ...meta });
    if (level === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write("error", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === "debug") {
      this.write("debug", message, meta);
    }
  }

  child(context: string): ILogger {
    return new JsonLogger(`${this.context}.${context}`);
  }
}

export const logger: ILogger = new JsonLogger("agent");
