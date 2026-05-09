import type {NavigatorScreenParams} from '@react-navigation/native';

export type AuthRedirectTarget =
  | {type: 'accountBooks'}
  | {type: 'accountBookDetail'; accountBookId: string}
  | {type: 'invitation'; token: string};

export type PublicStackParamList = {
  Welcome: undefined;
  Login: {redirect?: AuthRedirectTarget} | undefined;
  Register: {redirect?: AuthRedirectTarget} | undefined;
};

export type AppTabParamList = {
  AccountBooks: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Public: NavigatorScreenParams<PublicStackParamList> | undefined;
  AppTabs: undefined;
  Invitation: {token?: string} | undefined;
  AccountBookDetail: {accountBookId: string};
  ExpenseCategories: {accountBookId: string};
  NormalExpenseEditor: {accountBookId: string; expenseId?: string};
  MergedExpenseEditor: {accountBookId: string; expenseId?: string};
};
