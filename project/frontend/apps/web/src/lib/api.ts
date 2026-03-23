import { createApiClient } from "@expense-statistics/api-client";
import { apiBaseUrl } from "@/lib/config";

export const apiClient = createApiClient({ apiBaseUrl });
