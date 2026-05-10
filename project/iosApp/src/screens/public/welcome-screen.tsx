import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {LanguageSwitcher} from '@/components/language-switcher';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {HealthCard} from '@/features/health/health-card';
import {useI18n} from '@/features/i18n/i18n-context';
import type {PublicStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<PublicStackParamList, 'Welcome'>;

export function WelcomeScreen({navigation}: Props) {
  const {t} = useI18n();

  return (
    <ScreenShell
      title={t('root.welcome')}
      description={t('root.subtitle')}>
      <PlaceholderCard
        title={t('root.authTitle')}
        description={t('root.authDescription')}>
        <View style={styles.row}>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={[styles.button, styles.primaryButton]}>
            <Text style={styles.primaryButtonText}>{t('root.loginButton')}</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={styles.button}>
            <Text style={styles.buttonText}>{t('root.registerButton')}</Text>
          </Pressable>
        </View>
      </PlaceholderCard>

      <LanguageSwitcher />
      <HealthCard />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    backgroundColor: colors.accent,
  },
  buttonText: {
    color: colors.accentDeep,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: colors.backgroundSoft,
    fontSize: 15,
    fontWeight: '700',
  },
});
