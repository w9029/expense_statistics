import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useI18n} from '@/features/i18n/i18n-context';
import type {AppLanguage} from '@/features/i18n/messages';

export function LanguageSwitcher() {
  const {language, setLanguage, t, supportedLanguages} = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('root.language')}</Text>
      <View style={styles.row}>
        {supportedLanguages.map(item => (
          <Pressable
            key={item}
            onPress={() => {
              void setLanguage(item as AppLanguage);
            }}
            style={[
              styles.chip,
              item === language ? styles.activeChip : undefined,
            ]}>
            <Text
              style={[
                styles.chipText,
                item === language ? styles.activeChipText : undefined,
              ]}>
              {t(`lang.${item}` as const)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    color: '#4d5d6c',
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f0e8dc',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  activeChip: {
    backgroundColor: '#17324d',
  },
  chipText: {
    color: '#30465d',
    fontSize: 13,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#ffffff',
  },
});
