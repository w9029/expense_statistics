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
  AccountBooksTab: undefined;
  ExpensesTab: {accountBookId?: string} | undefined;
  CategoriesTab: {accountBookId?: string} | undefined;
  AnalyticsTab: {accountBookId?: string} | undefined;
  Profile: undefined;
};

export type CategoriesStackParamList = {
  CategoriesHome: {accountBookId: string};
  CategoryCreate: {accountBookId: string; categoryId?: string};
};

export type RootStackParamList = {
  Public: NavigatorScreenParams<PublicStackParamList> | undefined;
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  Invitation: {token?: string} | undefined;
  ExpenseTypePicker: {accountBookId: string};
  NormalExpenseEditor: {accountBookId: string; expenseId?: string};
  MergedExpenseEditor: {accountBookId: string; expenseId?: string};
};
