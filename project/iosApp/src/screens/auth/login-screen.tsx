import {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {AppTextInput, FormField} from '@/components/form-field';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useAuth} from '@/features/auth/auth-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {getApiErrorMessage} from '@/lib/api-errors';
import {getPostAuthRoute} from '@/lib/auth';
import {navigationRef} from '@/lib/navigation';
import type {PublicStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<PublicStackParamList, 'Login'>;

type LoginErrors = {
  email?: string;
  password?: string;
};

export function LoginScreen({navigation, route}: Props) {
  const auth = useAuth();
  const {t} = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const nextErrors: LoginErrors = {};
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = t('login.error.email');
    }

    if (!password) {
      nextErrors.password = t('login.error.password');
    }

    setErrors(nextErrors);
    return {isValid: Object.keys(nextErrors).length === 0, trimmedEmail};
  }

  async function handleSubmit() {
    const {isValid, trimmedEmail} = validate();
    if (!isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const session = await auth.login(trimmedEmail, password);
      const redirect = route.params?.redirect;
      requestAnimationFrame(() => {
        if (!navigationRef.isReady()) {
          return;
        }

        if (redirect?.type === 'invitation') {
          navigationRef.navigate('Invitation', {token: redirect.token});
          return;
        }

        if (redirect?.type === 'accountBookDetail') {
          navigationRef.navigate('AppTabs', {
            screen: 'ExpensesTab',
            params: {accountBookId: redirect.accountBookId},
          });
          return;
        }

        if (redirect?.type === 'accountBooks') {
          navigationRef.navigate('AppTabs', {screen: 'AccountBooksTab'});
          return;
        }

        const destination = getPostAuthRoute(session.user);
        navigationRef.navigate(destination.name, destination.params);
      });
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, t('login.failed')));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenShell title={t('login.title')} description={t('login.description')}>
      <PlaceholderCard title={t('login.title')}>
        <View style={styles.form}>
          <FormField error={errors.email} label={t('login.email')}>
            <AppTextInput
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={text => {
                setEmail(text);
                setErrors(current => ({...current, email: undefined}));
              }}
              placeholder={t('login.placeholder.email')}
              value={email}
            />
          </FormField>

          <FormField error={errors.password} label={t('login.password')}>
            <AppTextInput
              autoComplete="password"
              onChangeText={text => {
                setPassword(text);
                setErrors(current => ({...current, password: undefined}));
              }}
              placeholder={t('login.placeholder.password')}
              secureTextEntry
              value={password}
            />
          </FormField>

          {submitError ? <InlineBanner message={submitError} tone="error" /> : null}

          <ActionButton
            disabled={isSubmitting}
            label={isSubmitting ? t('login.submitting') : t('login.submit')}
            onPress={() => {
              void handleSubmit();
            }}
          />

          <Pressable
            onPress={() =>
              navigation.navigate('Register', {redirect: route.params?.redirect})
            }>
            <Text style={styles.link}>
              {t('login.needAccount')} {t('login.createOne')}
            </Text>
          </Pressable>
        </View>
      </PlaceholderCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
