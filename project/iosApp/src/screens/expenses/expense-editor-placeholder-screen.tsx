import {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useI18n} from '@/features/i18n/i18n-context';
import type {RootStackParamList} from '@/navigation/types';
import {MergedExpenseEditorScreen} from '@/screens/expenses/merged-expense-editor-screen';
import {NormalExpenseEditorScreen} from '@/screens/expenses/normal-expense-editor-screen';
import {colors} from '@/theme/colors';

type PickerProps = NativeStackScreenProps<RootStackParamList, 'ExpenseTypePicker'>;
type EditorMode = 'normal' | 'merged';

export function ExpenseTypePickerScreen({navigation, route}: PickerProps) {
  const {t} = useI18n();
  const {accountBookId} = route.params;
  const [mode, setMode] = useState<EditorMode>('normal');

  return (
    <ScreenShell
      title={t('book.addExpense')}
      description={t('book.chooseExpenseTypeDescription')}>
      <PlaceholderCard
        title={t('book.chooseExpenseType')}
        description={t('book.chooseExpenseTypeDescription')}>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('normal')}
            style={[
              styles.modeOption,
              mode === 'normal' ? styles.modeOptionActive : undefined,
            ]}>
            <View style={styles.radioOuter}>
              {mode === 'normal' ? <View style={styles.radioInner} /> : null}
            </View>
            <Text
              style={[
                styles.modeLabel,
                mode === 'normal' ? styles.modeLabelActive : undefined,
              ]}>
              {t('book.addNormal')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('merged')}
            style={[
              styles.modeOption,
              mode === 'merged' ? styles.modeOptionActive : undefined,
            ]}>
            <View style={styles.radioOuter}>
              {mode === 'merged' ? <View style={styles.radioInner} /> : null}
            </View>
            <Text
              style={[
                styles.modeLabel,
                mode === 'merged' ? styles.modeLabelActive : undefined,
              ]}>
              {t('book.addMerged')}
            </Text>
          </Pressable>
        </View>
      </PlaceholderCard>

      {mode === 'normal' ? (
        <NormalExpenseEditorScreen
          embedded
          navigation={navigation}
          route={{
            key: `${route.key}-normal`,
            name: 'NormalExpenseEditor',
            params: {accountBookId},
          }}
        />
      ) : (
        <MergedExpenseEditorScreen
          embedded
          navigation={navigation}
          route={{
            key: `${route.key}-merged`,
            name: 'MergedExpenseEditor',
            params: {accountBookId},
          }}
        />
      )}
    </ScreenShell>
  );
}

export function NormalExpenseEditorPlaceholderScreen(
  props: NativeStackScreenProps<RootStackParamList, 'NormalExpenseEditor'>,
) {
  return <NormalExpenseEditorScreen {...props} />;
}

export function MergedExpenseEditorPlaceholderScreen(
  props: NativeStackScreenProps<RootStackParamList, 'MergedExpenseEditor'>,
) {
  return <MergedExpenseEditorScreen {...props} />;
}

const styles = StyleSheet.create({
  modeRow: {
    gap: 10,
  },
  modeOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modeOptionActive: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.accentSoft,
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  radioInner: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  modeLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  modeLabelActive: {
    color: colors.accentDeep,
  },
});
