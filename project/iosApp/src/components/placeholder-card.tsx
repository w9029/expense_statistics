import {PropsWithChildren, ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '@/theme/colors';

type PlaceholderCardProps = PropsWithChildren<{
  title: string;
  description?: string;
  headerAccessory?: ReactNode;
}>;

export function PlaceholderCard({
  children,
  description,
  headerAccessory,
  title,
}: PlaceholderCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {headerAccessory ? <View style={styles.headerAccessory}>{headerAccessory}</View> : null}
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 24,
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerAccessory: {
    marginLeft: 12,
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
