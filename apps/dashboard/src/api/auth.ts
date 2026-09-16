import { request } from './client';
import type { LoginRequest, Session } from './types';

export function fetchSession(): Promise<Session> {
  return request<Session>('/auth/me');
}

export function login(credentials: LoginRequest): Promise<Session> {
  return request<Session>('/auth/login', { method: 'POST', body: credentials });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}
