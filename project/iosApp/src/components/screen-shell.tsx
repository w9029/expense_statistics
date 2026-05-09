import {PropsWithChildren} from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

type ScreenShellProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description?: string;
}>;

export function ScreenShell({
  children,
  description,
  eyebrow,
  title,
}: ScreenShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f4efe7',
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
  },
  hero: {
    backgroundColor: '#17324d',
    borderRadius: 24,
    gap: 10,
    padding: 24,
  },
  eyebrow: {
    color: '#f3c98b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
});
