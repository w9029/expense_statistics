import {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {apiClient} from '@/lib/api';
import {PlaceholderCard} from '@/components/placeholder-card';
import {useI18n} from '@/features/i18n/i18n-context';
import {colors} from '@/theme/colors';

type HealthState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'success'; data: {app: string; env: string; now: string}}
  | {status: 'error'; message: string};

export function HealthCard() {
  const {t} = useI18n();
  const [healthState, setHealthState] = useState<HealthState>({status: 'idle'});

  async function loadHealth() {
    setHealthState({status: 'loading'});

    try {
      const data = await apiClient.health();
      setHealthState({status: 'success', data});
    } catch (error) {
      setHealthState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <PlaceholderCard
      description={t('app.comingSoon')}
      title={t('root.healthTitle')}>
      {healthState.status === 'loading' ? (
        <View style={styles.stateRow}>
          <ActivityIndicator />
          <Text style={styles.stateText}>{t('root.healthLoading')}</Text>
        </View>
      ) : null}

      {healthState.status === 'error' ? (
        <View style={styles.resultBox}>
          <Text style={styles.errorTitle}>{t('root.healthFailed')}</Text>
          <Text style={styles.errorText}>{healthState.message}</Text>
        </View>
      ) : null}

      {healthState.status === 'success' ? (
        <View style={styles.resultBox}>
          <Text style={styles.successTitle}>{t('root.healthSuccess')}</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>app</Text>
            <Text style={styles.kvValue}>{healthState.data.app}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>env</Text>
            <Text style={styles.kvValue}>{healthState.data.env}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>now</Text>
            <Text style={styles.kvValue}>{healthState.data.now}</Text>
          </View>
        </View>
      ) : null}

      <Pressable onPress={() => void loadHealth()} style={styles.button}>
        <Text style={styles.buttonText}>{t('root.primaryAction')}</Text>
      </Pressable>
    </PlaceholderCard>
  );
}

const styles = StyleSheet.create({
  stateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  stateText: {
    color: colors.muted,
    fontSize: 15,
  },
  resultBox: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 18,
    gap: 10,
    padding: 16,
  },
  successTitle: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '700',
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    lineHeight: 21,
  },
  kvRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kvKey: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    width: 48,
  },
  kvValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonText: {
    color: colors.backgroundSoft,
    fontSize: 15,
    fontWeight: '700',
  },
});
