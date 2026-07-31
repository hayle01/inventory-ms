import { ApiError } from './apiClient';

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}
