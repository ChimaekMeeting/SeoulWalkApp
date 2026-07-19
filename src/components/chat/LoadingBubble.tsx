import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export function LoadingBubble({ text }: { text: string }) {
  return (
    <View style={styles.chatLine}>
      <View style={styles.chatIcon}>
        <Text style={styles.chatIconText}>✳</Text>
      </View>
      <View style={styles.chatBubble}>
        <Text style={styles.chatText}>{text}</Text>
        <ActivityIndicator size="small" color={colors.mintDeep} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chatLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  chatIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  chatBubble: {
    flexShrink: 1,
    maxWidth: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  chatText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
