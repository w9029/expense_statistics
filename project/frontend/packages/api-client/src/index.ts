import type {
  AccountBookMember,
  AccountBookDetail,
  AccountBookLeaveResult,
  AccountBookMemberRemovalResult,
  AccountBookOwnerTransferResult,
  AccountBookSummary,
  AcceptInvitationResult,
  CategoryShare,
  DeleteAccountBookResult,
  DeleteInvitationResult,
  AuthSession,
  ExpenseCategory,
  ExpenseDetail,
  ExpenseList,
  Expense,
  DeleteExpenseResult,
  Invitation,
  InvitationDetail,
  MergedExpenseCreateResult,
  SpendingTrend,
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
  language: "zh-CN" | "en" | "ja";
  verification_token: string;
};

export type UpdateProfileInput = {
  name: string;
  preferred_currency: string;
  language: "zh-CN" | "en" | "ja";
  avatar_path: string | null;
};

export type UpdateDefaultAccountBookInput = {
  default_account_book_id: string | null;
};

export type UpdateAccountBookInput = {
  name: string;
  description: string | null;
};

export type CreateAccountBookInput = {
  name: string;
  base_currency: string;
  description: string | null;
};

export type CreateInvitationInput = {
  account_book_id: string;
  account_role: "viewer" | "editor" | "admin";
  max_usage?: number;
  expires_in_hours?: number;
};

export type TransferAccountBookOwnerInput = {
  target_user_id: string;
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

export type GetCategoryShareInput = {
  date_from?: string;
  date_to?: string;
};

export type GetSpendingTrendInput = {
  bucket: "day" | "month";
  date_from?: string;
  date_to?: string;
  category_ids?: string[];
};

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
    getInvitationByToken: (token: string) =>
      requestWithAuthHandling<InvitationDetail>(`${apiBaseUrl}/invitations/${token}`),
    createInvitation: (accessToken: string, input: CreateInvitationInput) =>
      requestWithAuthHandling<Invitation>(`${apiBaseUrl}/invitations`, {
        method: "POST",
        body: input,
        accessToken,
      }),
    acceptInvitation: (accessToken: string, token: string) =>
      requestWithAuthHandling<AcceptInvitationResult>(
        `${apiBaseUrl}/invitations/${token}/accept`,
        {
          method: "POST",
          accessToken,
        },
      ),
    listAccountBooks: (accessToken: string) =>
      requestWithAuthHandling<AccountBookSummary[]>(`${apiBaseUrl}/account-books`, {
        accessToken,
      }),
    createAccountBook: (
      accessToken: string,
      input: CreateAccountBookInput,
    ) =>
      requestWithAuthHandling<AccountBookDetail>(`${apiBaseUrl}/account-books`, {
        method: "POST",
        body: input,
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
    listAccountBookInvitations: (accessToken: string, accountBookId: string) =>
      requestWithAuthHandling<Invitation[]>(
        `${apiBaseUrl}/account-books/${accountBookId}/invitations`,
        {
          accessToken,
        },
      ),
    deleteAccountBookInvitation: (
      accessToken: string,
      accountBookId: string,
      invitationId: string,
    ) =>
      requestWithAuthHandling<DeleteInvitationResult>(
        `${apiBaseUrl}/account-books/${accountBookId}/invitations/${invitationId}`,
        {
          method: "DELETE",
          accessToken,
        },
      ),
    transferAccountBookOwner: (
      accessToken: string,
      accountBookId: string,
      input: TransferAccountBookOwnerInput,
    ) =>
      requestWithAuthHandling<AccountBookOwnerTransferResult>(
        `${apiBaseUrl}/account-books/${accountBookId}/owner-transfer`,
        {
          method: "POST",
          body: input,
          accessToken,
        },
      ),
    removeAccountBookMember: (
      accessToken: string,
      accountBookId: string,
      userId: string,
    ) =>
      requestWithAuthHandling<AccountBookMemberRemovalResult>(
        `${apiBaseUrl}/account-books/${accountBookId}/members/${userId}`,
        {
          method: "DELETE",
          accessToken,
        },
      ),
    leaveAccountBook: (accessToken: string, accountBookId: string) =>
      requestWithAuthHandling<AccountBookLeaveResult>(
        `${apiBaseUrl}/account-books/${accountBookId}/leave`,
        {
          method: "POST",
          accessToken,
        },
      ),
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
    getCategoryShare: (
      accessToken: string,
      accountBookId: string,
      input: GetCategoryShareInput = {},
    ) =>
      requestWithAuthHandling<CategoryShare>(
        `${apiBaseUrl}/account-books/${accountBookId}/analytics/category-share${toQueryString(input)}`,
        {
          accessToken,
        },
      ),
    getSpendingTrend: (
      accessToken: string,
      accountBookId: string,
      input: GetSpendingTrendInput,
    ) =>
      requestWithAuthHandling<SpendingTrend>(
        `${apiBaseUrl}/account-books/${accountBookId}/analytics/spending-trend${toQueryString(input)}`,
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
    deleteAccountBook: (accessToken: string, accountBookId: string) =>
      requestWithAuthHandling<DeleteAccountBookResult>(
        `${apiBaseUrl}/account-books/${accountBookId}`,
        {
          method: "DELETE",
          accessToken,
        },
      ),
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
