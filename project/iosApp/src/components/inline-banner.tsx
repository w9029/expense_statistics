import {StyleSheet, Text, View} from 'react-native';
import {colors} from '@/theme/colors';

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
    backgroundColor: colors.dangerSoft,
  },
  success: {
    backgroundColor: colors.successSoft,
  },
  info: {
    backgroundColor: colors.accentSoftMuted,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
  },
  successText: {
    color: colors.success,
  },
  infoText: {
    color: colors.accentDeep,
  },
});
