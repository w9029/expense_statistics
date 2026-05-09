import {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

type HealthPayload = {
  app: string;
  env: string;
  now: string;
};

type HealthState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'success'; data: HealthPayload}
  | {status: 'error'; message: string};

const healthEndpoint = 'http://wlzy.online:8090/healthz';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [healthState, setHealthState] = useState<HealthState>({status: 'idle'});

  async function loadHealth() {
    setHealthState({status: 'loading'});

    try {
      const response = await fetch(healthEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        data?: HealthPayload;
      };

      if (!payload.data) {
        throw new Error('Missing data payload');
      }

      console.log('healthz success', payload.data);
      setHealthState({
        status: 'success',
        data: payload.data,
      });
    } catch (error) {
      console.log('healthz failed', error);
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Expense Statistics iOS</Text>
          <Text style={styles.title}>React Native minimum app</Text>
          <Text style={styles.description}>
            This build verifies the new mobile architecture and the public
            backend health endpoint.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Check</Text>
          <Text style={styles.endpoint}>{healthEndpoint}</Text>

          {healthState.status === 'loading' ? (
            <View style={styles.stateRow}>
              <ActivityIndicator />
              <Text style={styles.stateText}>Loading server status...</Text>
            </View>
          ) : null}

          {healthState.status === 'error' ? (
            <View style={styles.resultBox}>
              <Text style={styles.errorTitle}>Request failed</Text>
              <Text style={styles.errorText}>{healthState.message}</Text>
            </View>
          ) : null}

          {healthState.status === 'success' ? (
            <View style={styles.resultBox}>
              <Text style={styles.successTitle}>Request succeeded</Text>
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
            <Text style={styles.buttonText}>
              {healthState.status === 'loading' ? 'Refreshing...' : 'Retry'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4efe7',
  },
  screen: {
    padding: 20,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#17324d',
    borderRadius: 24,
    padding: 24,
    gap: 10,
  },
  eyebrow: {
    color: '#f3c98b',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
  },
  description: {
    color: '#d4dfeb',
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  cardTitle: {
    color: '#1d2733',
    fontSize: 22,
    fontWeight: '700',
  },
  endpoint: {
    color: '#5d6b79',
    fontSize: 14,
  },
  stateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  stateText: {
    color: '#44515e',
    fontSize: 15,
  },
  resultBox: {
    backgroundColor: '#f7f3ec',
    borderRadius: 18,
    gap: 10,
    padding: 16,
  },
  successTitle: {
    color: '#155b39',
    fontSize: 16,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#8e2b21',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#61261f',
    fontSize: 15,
    lineHeight: 21,
  },
  kvRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kvKey: {
    color: '#66727d',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    width: 48,
  },
  kvValue: {
    color: '#1d2733',
    flex: 1,
    fontSize: 15,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#ca5d2b',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default App;
