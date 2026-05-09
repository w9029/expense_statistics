import {createContext, PropsWithChildren, useContext, useMemo, useState} from 'react';

type BookSessionContextValue = {
  activeAccountBookId: string | null;
  expenseRefreshSignal: number;
  setActiveAccountBookId: (
    accountBookId:
      | string
      | null
      | ((currentAccountBookId: string | null) => string | null),
  ) => void;
  requestExpenseRefresh: () => void;
};

const BookSessionContext = createContext<BookSessionContextValue | null>(null);

export function BookSessionProvider({children}: PropsWithChildren) {
  const [activeAccountBookId, setActiveAccountBookId] = useState<string | null>(null);
  const [expenseRefreshSignal, setExpenseRefreshSignal] = useState(0);

  const value = useMemo<BookSessionContextValue>(
    () => ({
      activeAccountBookId,
      expenseRefreshSignal,
      setActiveAccountBookId,
      requestExpenseRefresh() {
        setExpenseRefreshSignal(current => current + 1);
      },
    }),
    [activeAccountBookId, expenseRefreshSignal],
  );

  return (
    <BookSessionContext.Provider value={value}>
      {children}
    </BookSessionContext.Provider>
  );
}

export function useBookSession() {
  const context = useContext(BookSessionContext);
  if (!context) {
    throw new Error('useBookSession must be used inside BookSessionProvider');
  }
  return context;
}
