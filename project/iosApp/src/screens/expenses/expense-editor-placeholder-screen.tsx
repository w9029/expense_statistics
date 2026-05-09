import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';
import type {RootStackParamList} from '@/navigation/types';

type PickerProps = NativeStackScreenProps<RootStackParamList, 'ExpenseTypePicker'>;

export function ExpenseTypePickerScreen({navigation, route}: PickerProps) {
  const {t} = useI18n();
  const {accountBookId} = route.params;

  return (
    <ScreenShell title={t('book.chooseExpenseType')} description={t('book.chooseExpenseTypeDescription')}>
      <PlaceholderCard title={t('book.addExpense')}>
        <View style={styles.pickerActions}>
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

export {NormalExpenseEditorScreen as NormalExpenseEditorPlaceholderScreen} from '@/screens/expenses/normal-expense-editor-screen';
export {MergedExpenseEditorScreen as MergedExpenseEditorPlaceholderScreen} from '@/screens/expenses/merged-expense-editor-screen';

const styles = StyleSheet.create({
  pickerActions: {
    gap: 12,
  },
});
