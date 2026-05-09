import {Text} from 'react-native';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';

export function AccountBooksPlaceholderScreen() {
  const {t} = useI18n();

  return (
    <ScreenShell title={t('books.title')} description={t('books.description')}>
      <PlaceholderCard title={t('books.title')}>
        <Text>{t('app.comingSoon')}</Text>
      </PlaceholderCard>
    </ScreenShell>
  );
}
