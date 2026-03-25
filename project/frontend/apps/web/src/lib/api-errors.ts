import { ApiError } from "@expense-statistics/api-client";

export function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
