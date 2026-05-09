import type {User} from '@expense-statistics/domain';

export function getPostAuthRoute(user: User) {
  if (user.default_account_book_id) {
    return {
      name: 'AppTabs' as const,
      params: {
        screen: 'ExpensesTab' as const,
        params: {accountBookId: user.default_account_book_id},
      },
    };
  }

  return {
    name: 'AppTabs' as const,
    params: {screen: 'AccountBooksTab' as const},
  };
}
