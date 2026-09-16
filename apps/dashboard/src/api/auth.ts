import { request } from './client';
import type { ChangePasswordRequest, LoginRequest, ProfilePatch, Session } from './types';

export function fetchSession(): Promise<Session> {
  return request<Session>('/auth/me');
}

export function login(credentials: LoginRequest): Promise<Session> {
  return request<Session>('/auth/login', { method: 'POST', body: credentials });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function updateProfile(patch: ProfilePatch): Promise<Session> {
  return request<Session>('/auth/me', { method: 'PATCH', body: patch });
}

export function changePassword(body: ChangePasswordRequest): Promise<void> {
  return request<void>('/auth/change-password', { method: 'POST', body });
}
