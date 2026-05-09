import {Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';
import type {RootStackParamList} from '@/navigation/types';

type PickerProps = NativeStackScreenProps<RootStackParamList, 'ExpenseTypePicker'>;
type NormalProps = NativeStackScreenProps<RootStackParamList, 'NormalExpenseEditor'>;
type MergedProps = NativeStackScreenProps<RootStackParamList, 'MergedExpenseEditor'>;

export function ExpenseTypePickerScreen({navigation, route}: PickerProps) {
  const {t} = useI18n();
  const {accountBookId} = route.params;

  return (
    <ScreenShell title={t('book.chooseExpenseType')} description={t('book.chooseExpenseTypeDescription')}>
      <PlaceholderCard title={t('book.addExpense')}>
        <View style={{gap: 12}}>
          <ActionButton
            label={t('book.addNormal')}
            onPress={() =>
              navigation.replace('NormalExpenseEditor', {accountBookId})
            }
          />
          <ActionButton
            label={t('book.addMerged')}
            onPress={() =>
              navigation.replace('MergedExpenseEditor', {accountBookId})
            }
            tone="secondary"
          />
        </View>
      </PlaceholderCard>
    </ScreenShell>
  );
}

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
