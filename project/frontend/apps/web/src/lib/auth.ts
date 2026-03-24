import type { User } from "@expense-statistics/domain";

export function getPostAuthPath(user: User | null | undefined) {
  if (user?.default_account_book_id) {
    return `/app/account-books/${user.default_account_book_id}`;
  }

  return "/app/account-books";
}
