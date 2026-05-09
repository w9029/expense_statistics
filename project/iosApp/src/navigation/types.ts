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
  AccountBooksTab: NavigatorScreenParams<AccountBooksStackParamList> | undefined;
  Profile: undefined;
};

export type AccountBooksStackParamList = {
  AccountBooksHome: undefined;
  AccountBookDetail: {accountBookId: string};
  ExpenseCategories: {accountBookId: string};
  Analytics: {accountBookId: string};
};

export type RootStackParamList = {
  Public: NavigatorScreenParams<PublicStackParamList> | undefined;
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  Invitation: {token?: string} | undefined;
  ExpenseTypePicker: {accountBookId: string};
  NormalExpenseEditor: {accountBookId: string; expenseId?: string};
  MergedExpenseEditor: {accountBookId: string; expenseId?: string};
};
