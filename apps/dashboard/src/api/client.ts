import type { ApiError } from './types';
import { currentShopId } from './shop-context';

const baseUrl = import.meta.env.VITE_API_BASE_URL;

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

  /**
   * The username was not recognised at identify time.
   *
   * There is no session to expire — auth is a stateless header — so a 401 only
   * ever comes from `/api/identify`.
   */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * The stored shop id is no longer usable: unknown shop (400) or deactivated
   * (403). Both mean the same thing to the UI — sign out and identify again.
   */
  get isShopRejected(): boolean {
    return (
      (this.status === 400 && /shop/i.test(this.message)) || this.status === 403
    );
  }

  /** Someone else already advanced this fulfillment, or two tabs raced. */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

export class MissingApiUrlError extends Error {
  constructor() {
    super('VITE_API_BASE_URL is not set');
    this.name = 'MissingApiUrlError';
  }
}

export const isApiConfigured = Boolean(baseUrl);

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Identify is the one route that must not send X-Shop-Id. */
  skipShopHeader?: boolean;
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

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!baseUrl) throw new MissingApiUrlError();

  const { method = 'GET', body, query, skipShopHeader } = options;

  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';

  if (!skipShopHeader) {
    const shopId = currentShopId();
    // Every scoped route 400s without this. Failing here with a clear code
    // beats letting the server reject it and reading like a server fault.
    if (shopId === null) {
      throw new ApiRequestError(401, {
        code: 'unauthorized',
        message: 'Not signed in to a shop',
      });
    }
    headers['X-Shop-Id'] = String(shopId);
  }

  const response = await fetch(`${baseUrl}${buildPath(path, query)}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiRequestError(response.status, (payload ?? {}) as Partial<ApiError>);
  }

  return payload as T;
}
