import {Text} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';
import type {RootStackParamList} from '@/navigation/types';

type NormalProps = NativeStackScreenProps<RootStackParamList, 'NormalExpenseEditor'>;
type MergedProps = NativeStackScreenProps<RootStackParamList, 'MergedExpenseEditor'>;

export function NormalExpenseEditorPlaceholderScreen({route}: NormalProps) {
  const {t} = useI18n();

  return (
    <ScreenShell title={t('book.addNormal')} description={t('app.comingSoon')}>
      <PlaceholderCard title={t('book.addNormal')}>
        <Text>{route.params.expenseId ?? route.params.accountBookId}</Text>
      </PlaceholderCard>
    </ScreenShell>
  );
}

export function MergedExpenseEditorPlaceholderScreen({route}: MergedProps) {
  const {t} = useI18n();

  return (
    <ScreenShell title={t('book.addMerged')} description={t('app.comingSoon')}>
      <PlaceholderCard title={t('book.addMerged')}>
        <Text>{route.params.expenseId ?? route.params.accountBookId}</Text>
      </PlaceholderCard>
    </ScreenShell>
  );
}
