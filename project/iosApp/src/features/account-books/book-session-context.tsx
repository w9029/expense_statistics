import {createContext, PropsWithChildren, useContext, useMemo, useState} from 'react';

type BookSessionContextValue = {
  activeAccountBookId: string | null;
  setActiveAccountBookId: (
    accountBookId:
      | string
      | null
      | ((currentAccountBookId: string | null) => string | null),
  ) => void;
};

const BookSessionContext = createContext<BookSessionContextValue | null>(null);

export function BookSessionProvider({children}: PropsWithChildren) {
  const [activeAccountBookId, setActiveAccountBookId] = useState<string | null>(null);

  const value = useMemo<BookSessionContextValue>(
    () => ({
      activeAccountBookId,
      setActiveAccountBookId,
    }),
    [activeAccountBookId],
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
