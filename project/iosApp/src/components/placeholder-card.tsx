import {PropsWithChildren} from 'react';
import {StyleSheet, Text, View} from 'react-native';

type PlaceholderCardProps = PropsWithChildren<{
  title: string;
  description?: string;
}>;

export function PlaceholderCard({
  children,
  description,
  title,
}: PlaceholderCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    gap: 12,
    padding: 20,
  },
  title: {
    color: '#1d2733',
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    color: '#546575',
    fontSize: 15,
    lineHeight: 22,
  },
});
