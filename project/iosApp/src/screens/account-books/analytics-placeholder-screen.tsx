import {Text} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';
import type {AccountBooksStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<AccountBooksStackParamList, 'Analytics'>;

export function AnalyticsPlaceholderScreen({route}: Props) {
  const {t} = useI18n();

  return (
    <ScreenShell title={t('nav.analytics')} description={t('app.comingSoon')}>
      <PlaceholderCard title={t('nav.analytics')}>
        <Text>{route.params.accountBookId}</Text>
      </PlaceholderCard>
    </ScreenShell>
  );
}
