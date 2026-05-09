export type PublicStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Invitation: {token?: string} | undefined;
};

export type AppTabParamList = {
  AccountBooks: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Public: undefined;
  AppTabs: undefined;
  AccountBookDetail: {accountBookId: string};
};
