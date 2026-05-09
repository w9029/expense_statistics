import {Pressable, StyleSheet, Text, ViewStyle} from 'react-native';
import {colors} from '@/theme/colors';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'destructive';
  style?: ViewStyle;
};

export function ActionButton({
  disabled,
  label,
  onPress,
  style,
  tone = 'primary',
}: ActionButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        tone === 'primary'
          ? styles.primary
          : tone === 'secondary'
            ? styles.secondary
            : styles.destructive,
        disabled ? styles.disabled : undefined,
        pressed && !disabled ? styles.pressed : undefined,
        style,
      ]}>
      <Text
        style={[
          styles.label,
          tone === 'primary'
            ? styles.primaryLabel
            : tone === 'secondary'
              ? styles.secondaryLabel
              : styles.destructiveLabel,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderWidth: 1,
  },
  destructive: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{scale: 0.99}],
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryLabel: {
    color: colors.backgroundSoft,
  },
  secondaryLabel: {
    color: colors.accentDeep,
  },
  destructiveLabel: {
    color: colors.backgroundSoft,
  },
});
