import {Text} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';
import type {RootStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountBookDetail'>;

export function AccountBookDetailPlaceholderScreen({route}: Props) {
  const {t} = useI18n();

  return (
    <ScreenShell
      title={`Book ${route.params.accountBookId}`}
      description={t('app.comingSoon')}>
      <PlaceholderCard title={`Book ${route.params.accountBookId}`}>
        <Text>{t('app.comingSoon')}</Text>
      </PlaceholderCard>
    </ScreenShell>
  );
}
