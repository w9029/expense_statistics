import {PropsWithChildren} from 'react';
import {StyleSheet, Text, TextInput, TextInputProps, View} from 'react-native';

type FormFieldProps = PropsWithChildren<{
  label: string;
  error?: string | null;
}>;

export function FormField({children, error, label}: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

type AppTextInputProps = TextInputProps;

export function AppTextInput(props: AppTextInputProps) {
  return (
    <TextInput
      autoCapitalize="none"
      placeholderTextColor="#7a8794"
      style={styles.input}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: '#30465d',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f7f3ec',
    borderColor: '#ded4c7',
    borderRadius: 16,
    borderWidth: 1,
    color: '#1d2733',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: {
    color: '#8a2e24',
    fontSize: 13,
    lineHeight: 18,
  },
});
