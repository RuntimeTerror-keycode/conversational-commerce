import { ErrorCode } from '../types';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  public static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(400, 'bad_request', message, details);
  }

  public static unauthorized(message: string): AppError {
    return new AppError(401, 'unauthorized', message);
  }

  public static forbidden(message: string): AppError {
    return new AppError(403, 'forbidden', message);
  }

  public static notFound(message: string): AppError {
    return new AppError(404, 'not_found', message);
  }

  public static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(409, 'conflict', message, details);
  }

  public static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(422, 'validation_failed', message, details);
  }
}
