import {createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({children}: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextID = useRef(1);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextID.current++;
    setToasts(current => [...current, {id, tone, message}]);

    setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
    }, 2600);
  }, []);

  const value = useMemo(() => ({showToast}), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.container}>
        {toasts.map(toast => (
          <View
            key={toast.id}
            style={[
              styles.toast,
              toast.tone === 'success'
                ? styles.success
                : toast.tone === 'error'
                  ? styles.error
                  : styles.info,
            ]}>
            <Text style={styles.message}>{toast.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  container: {
    bottom: 24,
    left: 16,
    position: 'absolute',
    right: 16,
  },
  toast: {
    borderRadius: 16,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  success: {
    backgroundColor: '#1f6f43',
  },
  error: {
    backgroundColor: '#8a2e24',
  },
  info: {
    backgroundColor: '#1f4f7b',
  },
  message: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
