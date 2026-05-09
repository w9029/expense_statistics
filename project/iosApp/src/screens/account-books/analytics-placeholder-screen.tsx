import {Text} from 'react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';
import type {AppTabParamList} from '@/navigation/types';

type Props = BottomTabScreenProps<AppTabParamList, 'AnalyticsTab'>;

export function AnalyticsPlaceholderScreen({route}: Props) {
  const {t} = useI18n();
  const accountBookId = route.params?.accountBookId ?? '';

  return (
    <ScreenShell title={t('nav.analytics')} description={t('app.comingSoon')}>
      <PlaceholderCard title={t('nav.analytics')}>
        <Text>{accountBookId}</Text>
      </PlaceholderCard>
    </ScreenShell>
  );
}
