import {PropsWithChildren} from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors} from '@/theme/colors';

type ScreenShellProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description?: string;
  hideHero?: boolean;
}>;

export function ScreenShell({
  children,
  description,
  eyebrow,
  hideHero = false,
  title,
}: ScreenShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {!hideHero ? (
          <View style={styles.hero}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
  },
  hero: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 24,
    gap: 10,
    padding: 24,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(202, 93, 43, 0.12)',
    borderRadius: 999,
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '700',
  },
  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
});
