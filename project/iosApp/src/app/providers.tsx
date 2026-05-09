import {PropsWithChildren} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {BookSessionProvider} from '@/features/account-books/book-session-context';
import {AuthProvider} from '@/features/auth/auth-context';
import {I18nProvider} from '@/features/i18n/i18n-context';
import {ToastProvider} from '@/features/feedback/toast-context';
import {navigationRef} from '@/lib/navigation';

export function AppProviders({children}: PropsWithChildren) {
  return (
    <AuthProvider>
      <BookSessionProvider>
        <I18nProvider>
          <ToastProvider>
            <NavigationContainer ref={navigationRef}>{children}</NavigationContainer>
          </ToastProvider>
        </I18nProvider>
      </BookSessionProvider>
    </AuthProvider>
  );
}
