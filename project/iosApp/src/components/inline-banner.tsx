import {StyleSheet, Text, View} from 'react-native';

type InlineBannerProps = {
  tone: 'error' | 'success' | 'info';
  message: string;
};

export function InlineBanner({message, tone}: InlineBannerProps) {
  return (
    <View
      style={[
        styles.banner,
        tone === 'error'
          ? styles.error
          : tone === 'success'
            ? styles.success
            : styles.info,
      ]}>
      <Text
        style={[
          styles.message,
          tone === 'error'
            ? styles.errorText
            : tone === 'success'
              ? styles.successText
              : styles.infoText,
        ]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    backgroundColor: '#f7e1dc',
  },
  success: {
    backgroundColor: '#e1f0e6',
  },
  info: {
    backgroundColor: '#e2edf7',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#73271f',
  },
  successText: {
    color: '#1f5b39',
  },
  infoText: {
    color: '#1f4f7b',
  },
});
