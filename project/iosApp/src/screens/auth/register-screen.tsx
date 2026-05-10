import {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ApiError} from '@expense-statistics/api-client';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {AppTextInput, FormField} from '@/components/form-field';
import {InlineBanner} from '@/components/inline-banner';
import {LanguageSwitcher} from '@/components/language-switcher';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useAuth} from '@/features/auth/auth-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import {getPostAuthRoute} from '@/lib/auth';
import {navigationRef} from '@/lib/navigation';
import type {PublicStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<PublicStackParamList, 'Register'>;

const purpose = 'register';

type EmailErrors = {email?: string};
type VerifyErrors = {code?: string};
type RegisterErrors = {
  name?: string;
  password?: string;
  preferred_currency?: string;
};

export function RegisterScreen({navigation, route}: Props) {
  const auth = useAuth();
  const {language, t} = useI18n();
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationExpiry, setVerificationExpiry] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState('JPY');
  const [emailErrors, setEmailErrors] = useState<EmailErrors>({});
  const [verifyErrors, setVerifyErrors] = useState<VerifyErrors>({});
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!verificationToken || !verificationExpiry) {
      return;
    }

    const intervalID = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(intervalID);
  }, [verificationExpiry, verificationToken]);

  const expiryTime = useMemo(
    () => (verificationExpiry ? new Date(verificationExpiry).getTime() : null),
    [verificationExpiry],
  );
  const isVerified = Boolean(
    verificationToken && expiryTime && Number.isFinite(expiryTime) && expiryTime > now,
  );
  const isExpired = Boolean(
    verificationToken && expiryTime && Number.isFinite(expiryTime) && expiryTime <= now,
  );

  function validateEmail() {
    const trimmedEmail = email.trim().toLowerCase();
    const nextErrors: EmailErrors = {};
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = t('register.error.email');
    }
    setEmailErrors(nextErrors);
    return {isValid: Object.keys(nextErrors).length === 0, trimmedEmail};
  }

  function validateCode() {
    const trimmedCode = code.trim();
    const nextErrors: VerifyErrors = {};
    if (!/^\d{6}$/.test(trimmedCode)) {
      nextErrors.code = t('register.error.code');
    }
    setVerifyErrors(nextErrors);
    return {isValid: Object.keys(nextErrors).length === 0, trimmedCode};
  }

  function validateRegister() {
    const nextErrors: RegisterErrors = {};
    const trimmedName = name.trim();
    const normalizedCurrency = preferredCurrency.trim().toUpperCase();

    if (!trimmedName) {
      nextErrors.name = t('register.error.name');
    } else if (trimmedName.length > 100) {
      nextErrors.name = t('register.error.nameLong');
    }

    if (password.length < 8) {
      nextErrors.password = t('register.error.password');
    }

    if (!/^[A-Za-z]{3}$/.test(normalizedCurrency)) {
      nextErrors.preferred_currency = t('register.error.currency');
    }

    setRegisterErrors(nextErrors);
    return {
      isValid: Object.keys(nextErrors).length === 0,
      trimmedName,
      normalizedCurrency,
    };
  }

  function resetVerificationState() {
    setVerifiedEmail(null);
    setCode('');
    setVerificationToken(null);
    setVerificationExpiry(null);
    setVerifyErrors({});
    setStepError(null);
  }

  async function handleSendCode(nextEmail?: string) {
    const validation = validateEmail();
    const targetEmail = nextEmail ?? validation.trimmedEmail;
    if ((!nextEmail && !validation.isValid) || !targetEmail || isSending) {
      return;
    }

    setIsSending(true);
    setStepError(null);

    try {
      await apiClient.sendVerificationCode({
        email: targetEmail,
        purpose,
      });
      setVerifiedEmail(targetEmail);
      setVerificationToken(null);
      setVerificationExpiry(null);
      setCode('');
    } catch (error) {
      setStepError(
        error instanceof ApiError ? error.message : t('register.error.sendCode'),
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleVerifyCode() {
    const {isValid, trimmedCode} = validateCode();
    const targetEmail = verifiedEmail ?? email.trim().toLowerCase();
    if (!isValid || !targetEmail || isVerifying) {
      return;
    }

    setIsVerifying(true);
    setStepError(null);

    try {
      const result = await apiClient.verifyCode({
        email: targetEmail,
        purpose,
        code: trimmedCode,
      });
      setVerificationToken(result.verification_token);
      setVerificationExpiry(result.expires_at);
    } catch (error) {
      setStepError(
        error instanceof ApiError ? error.message : t('register.error.verifyCode'),
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleRegister() {
    const {isValid, normalizedCurrency, trimmedName} = validateRegister();
    if (!isValid || isRegistering) {
      return;
    }

    if (!verifiedEmail || !verificationToken || isExpired) {
      setStepError(t('register.error.verificationMissing'));
      return;
    }

    setIsRegistering(true);
    setStepError(null);

    try {
      const session = await auth.register({
        email: verifiedEmail,
        name: trimmedName,
        password,
        preferred_currency: normalizedCurrency,
        language,
        verification_token: verificationToken,
      });

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
      setStepError(getApiErrorMessage(error, t('register.error.register')));
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <ScreenShell title={t('register.title')} description={t('register.description')}>
      <PlaceholderCard
        description={t('register.step1.description')}
        title={t('register.step1.title')}>
        <View style={styles.stack}>
          <FormField error={emailErrors.email} label={t('register.email')}>
            <AppTextInput
              autoComplete="email"
              editable={!verifiedEmail && !isSending}
              keyboardType="email-address"
              onChangeText={text => {
                setEmail(text);
                setEmailErrors({});
              }}
              placeholder={t('login.placeholder.email')}
              value={email}
            />
          </FormField>

          {verifiedEmail ? (
            <InlineBanner
              message={t('register.codeSent', {email: verifiedEmail})}
              tone="success"
            />
          ) : null}
          {stepError && !verifiedEmail ? (
            <InlineBanner message={stepError} tone="error" />
          ) : null}

          <ActionButton
            disabled={Boolean(verifiedEmail) || isSending}
            label={isSending ? t('register.sendingCode') : t('register.sendCode')}
            onPress={() => {
              void handleSendCode();
            }}
          />

          {verifiedEmail ? (
            <ActionButton
              label={t('register.changeEmail')}
              onPress={resetVerificationState}
              tone="secondary"
            />
          ) : null}
        </View>
      </PlaceholderCard>

      {verifiedEmail ? (
        <PlaceholderCard
          description={t('register.step2.description')}
          title={t('register.step2.title')}>
          <View style={styles.stack}>
            <Text style={styles.currentEmail}>
              {t('register.currentEmail', {email: verifiedEmail})}
            </Text>

            <FormField error={verifyErrors.code} label={t('register.code')}>
              <AppTextInput
                editable={!isVerified && !isVerifying}
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={text => {
                  setCode(text.replace(/\D/g, ''));
                  setVerifyErrors({});
                }}
                placeholder={t('register.placeholder.code')}
                value={code}
              />
            </FormField>

            {isVerified && verificationExpiry ? (
              <InlineBanner
                message={t('register.verified', {expiresAt: verificationExpiry})}
                tone="success"
              />
            ) : null}
            {isExpired ? (
              <InlineBanner message={t('register.verifiedExpired')} tone="info" />
            ) : null}
            {stepError && verifiedEmail && !isVerified ? (
              <InlineBanner message={stepError} tone="error" />
            ) : null}

            <View style={styles.actions}>
              <ActionButton
                disabled={isVerified || isVerifying}
                label={isVerifying ? t('register.verifyingCode') : t('register.verifyCode')}
                onPress={() => {
                  void handleVerifyCode();
                }}
                style={styles.flexButton}
              />
              <ActionButton
                disabled={isSending || isVerified}
                label={t('register.resendCode')}
                onPress={() => {
                  void handleSendCode(verifiedEmail);
                }}
                style={styles.flexButton}
                tone="secondary"
              />
            </View>
          </View>
        </PlaceholderCard>
      ) : null}

      {isVerified ? (
        <PlaceholderCard
          description={t('register.step3.description')}
          title={t('register.step3.title')}>
          <View style={styles.stack}>
            <FormField error={registerErrors.name} label={t('register.name')}>
              <AppTextInput
                onChangeText={text => {
                  setName(text);
                  setRegisterErrors(current => ({...current, name: undefined}));
                }}
                placeholder={t('register.placeholder.name')}
                value={name}
              />
            </FormField>

            <FormField
              error={registerErrors.preferred_currency}
              label={t('register.preferredCurrency')}>
              <AppTextInput
                autoCapitalize="characters"
                maxLength={3}
                onChangeText={text => {
                  setPreferredCurrency(text);
                  setRegisterErrors(current => ({
                    ...current,
                    preferred_currency: undefined,
                  }));
                }}
                placeholder={t('register.placeholder.currency')}
                value={preferredCurrency}
              />
            </FormField>

            <FormField error={registerErrors.password} label={t('register.password')}>
              <AppTextInput
                onChangeText={text => {
                  setPassword(text);
                  setRegisterErrors(current => ({...current, password: undefined}));
                }}
                placeholder={t('register.placeholder.password')}
                secureTextEntry
                value={password}
              />
            </FormField>

            <LanguageSwitcher />

            {stepError ? <InlineBanner message={stepError} tone="error" /> : null}

            <ActionButton
              disabled={isRegistering}
              label={isRegistering ? t('register.submitting') : t('register.submit')}
              onPress={() => {
                void handleRegister();
              }}
            />

            <Pressable onPress={() => navigation.navigate('Login', route.params)}>
              <Text style={styles.link}>
                {t('register.alreadyRegistered')} {t('register.signIn')}
              </Text>
            </Pressable>
          </View>
        </PlaceholderCard>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  currentEmail: {
    color: colors.muted,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
