export type NaturalDateString = `${number}-${number}-${number}`;

export type AccountRole = "viewer" | "editor" | "admin" | "owner";

export type User = {
  id: string;
  email: string;
  name: string;
  preferred_currency: string;
  user_role: string;
  default_account_book_id: string | null;
  avatar_path: string | null;
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

export type AuthSession = AuthTokens & {
  user: User;
};

export type VerificationResult = {
  verification_token: string;
  expires_at: string;
};

export type AccountBookSummary = {
  id: string;
  name: string;
  base_currency: string;
  description: string | null;
  my_role: AccountRole;
  is_default: boolean;
  created_at: string;
};

export type AccountBookDetail = {
  id: string;
  name: string;
  owner_user_id: string;
  base_currency: string;
  description: string | null;
  is_active: boolean;
  my_role: AccountRole;
  created_at: string;
  updated_at: string;
};

export type DeleteAccountBookResult = {
  account_book_id: string;
  deleted: boolean;
};

export type AccountBookMember = {
  user_id: string;
  name: string;
  email: string;
  account_role: AccountRole;
  joined_at: string;
  is_me: boolean;
};

export type Invitation = {
  id: string;
  account_book_id: string;
  account_book_name: string;
  inviter_user_id: string;
  inviter_name: string;
  account_role: AccountRole;
  token: string;
  status: string;
  max_usage: number;
  used_count: number;
  expires_at: string;
  created_at: string;
  invite_url: string;
};

export type InvitationDetail = {
  account_book_id: string;
  account_book_name: string;
  inviter_name: string;
  account_role: AccountRole;
  status: string;
  max_usage: number;
  used_count: number;
  expires_at: string;
  acceptable: boolean;
};

export type AcceptInvitationResult = {
  account_book_id: string;
  account_role: AccountRole;
  joined: boolean;
};

export type DeleteInvitationResult = {
  invitation_id: string;
  deleted: boolean;
};

export type AccountBookOwnerTransferResult = {
  account_book_id: string;
  previous_owner_user_id: string;
  new_owner_user_id: string;
  transferred: boolean;
};

export type AccountBookMemberRemovalResult = {
  account_book_id: string;
  user_id: string;
  removed: boolean;
};

export type AccountBookLeaveResult = {
  account_book_id: string;
  left: boolean;
};

export type ExpenseCategory = {
  id: string;
  account_book_id: string;
  name: string;
  description: string | null;
  is_merge_category: boolean;
  color: string;
  is_system_seed: boolean;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  account_book_id: string;
  user_id: string | null;
  category_id: string;
  expense_type: "normal" | "merged_parent" | "merged_child";
  parent_id?: string | null;
  name: string;
  description: string | null;
  original_amount: string;
  original_currency: string;
  exchange_rate_used: string;
  converted_amount: string;
  spent_at: string;
  created_at: string;
  updated_at: string;
};

export type ExpenseSummary = Expense & {
  children_count: number;
  matched_children_count: number;
  expandable: boolean;
  children?: Expense[];
};

export type ExpenseList = {
  items: ExpenseSummary[];
  page: number;
  page_size: number;
  total: number;
  total_converted_amount: string;
};

export type ExpenseDetail = {
  expense: Expense;
  children?: Expense[];
  is_root: boolean;
  root_id: string;
};

export type MergedExpenseCreateResult = {
  parent: Expense;
  children: Expense[];
  children_amount_input_mode: "pretax" | "posttax";
};

export type DeleteExpenseResult = {
  expense_id: string;
  root_id: string;
  deleted: boolean;
};

export function formatNaturalDateLabel(value: NaturalDateString) {
  return value;
}
