import {Text} from 'react-native';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';

export function ProfilePlaceholderScreen() {
  const {t} = useI18n();

  return (
    <ScreenShell title={t('profile.title')} description={t('profile.description')}>
      <PlaceholderCard title={t('profile.title')}>
        <Text>{t('app.comingSoon')}</Text>
      </PlaceholderCard>
    </ScreenShell>
  );
}
