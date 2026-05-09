import {PropsWithChildren} from 'react';
import {StyleSheet, Text, TextInput, TextInputProps, TextStyle, View} from 'react-native';
import {colors} from '@/theme/colors';

type FormFieldProps = PropsWithChildren<{
  label: string;
  error?: string | null;
  errorTextStyle?: TextStyle;
}>;

export function FormField({children, error, errorTextStyle, label}: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={[styles.error, errorTextStyle]}>{error}</Text> : null}
    </View>
  );
}

type AppTextInputProps = TextInputProps;

export function AppTextInput(props: AppTextInputProps) {
  return (
    <TextInput
      autoCapitalize="none"
      placeholderTextColor="#938171"
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
});
