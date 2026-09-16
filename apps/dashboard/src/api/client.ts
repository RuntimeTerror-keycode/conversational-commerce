import type { ApiError } from './types';

/**
 * No fallback, on purpose. An unset base URL means the app is
 * misconfigured, not that it should quietly talk to localhost or
 * serve fake data — `isApiConfigured` gates the whole router on this.
 */
const baseUrl = import.meta.env.VITE_API_BASE_URL;

export const isApiConfigured = Boolean(baseUrl);

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiError['code'];
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: Partial<ApiError>) {
    super(body.message ?? 'Request failed');
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body.code ?? 'internal_error';
    this.details = body.details;
  }

  /** Session gone. The router guard redirects on this. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * Someone else already advanced this order, or two tabs raced.
   * Never a hard failure — refetch and reconcile.
   */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildPath(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * Every call goes through here.
 *
 * `credentials: 'include'` assumes an httpOnly session cookie (Q-A1). If the
 * backend lands on bearer tokens instead, this function is the only thing that
 * changes.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not set — see ConfigErrorScreen');
  }

  const { method = 'GET', body, query } = options;
  const fullPath = buildPath(path, query);

  const response = await fetch(`${baseUrl}${fullPath}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiRequestError(response.status, (payload ?? {}) as Partial<ApiError>);
  }

  return payload as T;
}
