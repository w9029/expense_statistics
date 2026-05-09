import type {User} from '@expense-statistics/domain';

export function getPostAuthRoute(user: User) {
  if (user.default_account_book_id) {
    return {
      name: 'AccountBookDetail' as const,
      params: {accountBookId: user.default_account_book_id},
    };
  }

  return {
    name: 'AccountBooks' as const,
    params: undefined,
  };
}
