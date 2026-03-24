import type {
  AccountBookMember,
  AccountBookDetail,
  AccountBookSummary,
  AuthSession,
  ExpenseCategory,
  ExpenseDetail,
  ExpenseList,
  Expense,
  DeleteExpenseResult,
  MergedExpenseCreateResult,
  User,
  VerificationResult,
} from "@expense-statistics/domain";

export type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  request_id: string;
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  accessToken?: string | null;
  retryOnUnauthorized?: boolean;
};

type ApiClientOptions = {
  apiBaseUrl: string;
  onAccessTokenExpired?: (failedAccessToken: string) => Promise<string | null>;
};

export type HealthPayload = {
  app: string;
  env: string;
  now: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type SendVerificationCodeInput = {
  email: string;
  purpose: string;
};

export type VerifyCodeInput = {
  email: string;
  purpose: string;
  code: string;
};

export type RegisterInput = {
  email: string;
  name: string;
  password: string;
  preferred_currency: string;
  verification_token: string;
};

export type UpdateProfileInput = {
  name: string;
  preferred_currency: string;
  avatar_path: string | null;
};

export type UpdateDefaultAccountBookInput = {
  default_account_book_id: string | null;
};

export type UpdateAccountBookInput = {
  name: string;
  description: string | null;
};

export type ListExpensesInput = {
  page?: number;
  page_size?: number;
  include_children?: boolean;
  keyword?: string;
  category_ids?: string[];
  user_id?: string;
  min_amount?: string;
  max_amount?: string;
  original_currency?: string;
  date_from?: string;
  date_to?: string;
  spent_at_order?: "asc" | "desc";
};

export type CreateExpenseCategoryInput = {
  name: string;
  description: string | null;
  is_merge_category: boolean;
  color: string;
};

export type UpdateExpenseCategoryInput = CreateExpenseCategoryInput;

export type CreateNormalExpenseInput = {
  category_id: string;
  name: string;
  description: string | null;
  original_amount: string;
  original_currency: string;
  spent_at: string;
};

export type CreateMergedExpenseInput = {
  parent: {
    category_id: string;
    name: string;
    description: string | null;
    total_original_amount: string;
    original_currency: string;
    spent_at: string;
  };
  children_amount_input_mode: "pretax" | "posttax";
  children: Array<{
    category_id: string;
    name: string;
    description: string | null;
    amount_input: string;
  }>;
};

export type UpdateNormalExpenseInput = CreateNormalExpenseInput;

export type UpdateMergedExpenseInput = CreateMergedExpenseInput;

export function createApiClient(options: ApiClientOptions) {
  const apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
  const systemBaseUrl = apiBaseUrl.replace(/\/api\/v1$/, "");
  const requestWithAuthHandling = <T>(url: string, requestOptions: RequestOptions = {}) =>
    request<T>(url, requestOptions, options.onAccessTokenExpired);

  return {
    health: () => requestWithAuthHandling<HealthPayload>(`${systemBaseUrl}/healthz`),
    login: (input: LoginInput) =>
      requestWithAuthHandling<AuthSession>(`${apiBaseUrl}/identity/login`, {
        method: "POST",
        body: input,
      }),
    sendVerificationCode: (input: SendVerificationCodeInput) =>
      requestWithAuthHandling<{ message: string }>(`${apiBaseUrl}/identity/email-verifications/send`, {
        method: "POST",
        body: input,
      }),
    verifyCode: (input: VerifyCodeInput) =>
      requestWithAuthHandling<VerificationResult>(`${apiBaseUrl}/identity/email-verifications/verify`, {
        method: "POST",
        body: input,
      }),
    register: (input: RegisterInput) =>
      requestWithAuthHandling<AuthSession>(`${apiBaseUrl}/identity/register`, {
        method: "POST",
        body: input,
      }),
    refresh: (refreshToken: string) =>
      requestWithAuthHandling<AuthSession>(`${apiBaseUrl}/identity/refresh`, {
        method: "POST",
        body: { refresh_token: refreshToken },
      }),
    listAccountBooks: (accessToken: string) =>
      requestWithAuthHandling<AccountBookSummary[]>(`${apiBaseUrl}/account-books`, {
        accessToken,
      }),
    getAccountBook: (accessToken: string, accountBookId: string) =>
      requestWithAuthHandling<AccountBookDetail>(`${apiBaseUrl}/account-books/${accountBookId}`, {
        accessToken,
      }),
    listAccountBookMembers: (accessToken: string, accountBookId: string) =>
      requestWithAuthHandling<AccountBookMember[]>(`${apiBaseUrl}/account-books/${accountBookId}/members`, {
        accessToken,
      }),
    listExpenseCategories: (accessToken: string, accountBookId: string) =>
      requestWithAuthHandling<ExpenseCategory[]>(
        `${apiBaseUrl}/account-books/${accountBookId}/expense-categories`,
        {
          accessToken,
        },
      ),
    createExpenseCategory: (
      accessToken: string,
      accountBookId: string,
      input: CreateExpenseCategoryInput,
    ) =>
      requestWithAuthHandling<ExpenseCategory>(`${apiBaseUrl}/account-books/${accountBookId}/expense-categories`, {
        method: "POST",
        body: input,
        accessToken,
      }),
    updateExpenseCategory: (
      accessToken: string,
      accountBookId: string,
      categoryId: string,
      input: UpdateExpenseCategoryInput,
    ) =>
      requestWithAuthHandling<ExpenseCategory>(
        `${apiBaseUrl}/account-books/${accountBookId}/expense-categories/${categoryId}`,
        {
          method: "PUT",
          body: input,
          accessToken,
        },
      ),
    deleteExpenseCategory: (
      accessToken: string,
      accountBookId: string,
      categoryId: string,
    ) =>
      requestWithAuthHandling<{ deleted: boolean; category_id: string }>(
        `${apiBaseUrl}/account-books/${accountBookId}/expense-categories/${categoryId}`,
        {
          method: "DELETE",
          accessToken,
        },
      ),
    listExpenses: (
      accessToken: string,
      accountBookId: string,
      input: ListExpensesInput = {},
    ) =>
      requestWithAuthHandling<ExpenseList>(
        `${apiBaseUrl}/account-books/${accountBookId}/expenses${toQueryString(input)}`,
        {
          accessToken,
        },
      ),
    getExpenseDetail: (
      accessToken: string,
      accountBookId: string,
      expenseId: string,
    ) =>
      requestWithAuthHandling<ExpenseDetail>(
        `${apiBaseUrl}/account-books/${accountBookId}/expenses/${expenseId}`,
        {
          accessToken,
        },
      ),
    createNormalExpense: (
      accessToken: string,
      accountBookId: string,
      input: CreateNormalExpenseInput,
    ) =>
      requestWithAuthHandling<Expense>(`${apiBaseUrl}/account-books/${accountBookId}/expenses/normal`, {
        method: "POST",
        body: input,
        accessToken,
      }),
    updateNormalExpense: (
      accessToken: string,
      accountBookId: string,
      expenseId: string,
      input: UpdateNormalExpenseInput,
    ) =>
      requestWithAuthHandling<Expense>(
        `${apiBaseUrl}/account-books/${accountBookId}/expenses/${expenseId}/normal`,
        {
          method: "PUT",
          body: input,
          accessToken,
        },
      ),
    createMergedExpense: (
      accessToken: string,
      accountBookId: string,
      input: CreateMergedExpenseInput,
    ) =>
      requestWithAuthHandling<MergedExpenseCreateResult>(
        `${apiBaseUrl}/account-books/${accountBookId}/expenses/merged`,
        {
          method: "POST",
          body: input,
          accessToken,
        },
      ),
    updateMergedExpense: (
      accessToken: string,
      accountBookId: string,
      expenseId: string,
      input: UpdateMergedExpenseInput,
    ) =>
      requestWithAuthHandling<MergedExpenseCreateResult>(
        `${apiBaseUrl}/account-books/${accountBookId}/expenses/${expenseId}/merged`,
        {
          method: "PUT",
          body: input,
          accessToken,
        },
      ),
    deleteExpense: (
      accessToken: string,
      accountBookId: string,
      expenseId: string,
    ) =>
      requestWithAuthHandling<DeleteExpenseResult>(
        `${apiBaseUrl}/account-books/${accountBookId}/expenses/${expenseId}`,
        {
          method: "DELETE",
          accessToken,
        },
      ),
    updateAccountBook: (
      accessToken: string,
      accountBookId: string,
      input: UpdateAccountBookInput,
    ) =>
      requestWithAuthHandling<AccountBookDetail>(`${apiBaseUrl}/account-books/${accountBookId}`, {
        method: "PUT",
        body: input,
        accessToken,
      }),
    updateProfile: (accessToken: string, input: UpdateProfileInput) =>
      requestWithAuthHandling<User>(`${apiBaseUrl}/identity/me/profile`, {
        method: "PUT",
        body: input,
        accessToken,
      }),
    updateDefaultAccountBook: (
      accessToken: string,
      input: UpdateDefaultAccountBookInput,
    ) =>
      requestWithAuthHandling<User>(`${apiBaseUrl}/identity/me/default-account-book`, {
        method: "PUT",
        body: input,
        accessToken,
      }),
  };
}

async function request<T>(
  url: string,
  options: RequestOptions = {},
  onAccessTokenExpired?: (failedAccessToken: string) => Promise<string | null>,
) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (
    response.status === 401 &&
    options.accessToken &&
    options.retryOnUnauthorized !== false &&
    onAccessTokenExpired &&
    !url.endsWith("/identity/refresh")
  ) {
    const nextAccessToken = await onAccessTokenExpired(options.accessToken);
    if (nextAccessToken) {
      return request<T>(
        url,
        {
          ...options,
          accessToken: nextAccessToken,
          retryOnUnauthorized: false,
        },
        onAccessTokenExpired,
      );
    }
  }

  const json = (await response.json()) as
    | ApiEnvelope<T>
    | { ok: false; error: string; message: string; request_id: string };

  if (!response.ok || json.ok === false) {
    const error = json as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      error.error ?? "request_failed",
      error.message ?? `request failed: ${response.status}`,
    );
  }

  return (json as ApiEnvelope<T>).data;
}

function toQueryString(
  input: Record<string, string | number | boolean | string[] | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return;
      }
      params.set(key, value.join(","));
      return;
    }
    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}
