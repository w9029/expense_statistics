import {Text} from 'react-native';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';

export function LoginPlaceholderScreen() {
  const {t} = useI18n();

  return (
    <ScreenShell title="Login" description={t('root.authDescription')}>
      <PlaceholderCard title="Login">
        <Text>{t('app.comingSoon')}</Text>
      </PlaceholderCard>
    </ScreenShell>
  );
}
