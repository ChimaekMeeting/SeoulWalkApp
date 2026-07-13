import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export function ChatBubble({ text }: { text: string }) {
  return (
    <View style={styles.chatLine}>
      <View style={styles.chatIcon}>
        <Text style={styles.chatIconText}>✳</Text>
      </View>
      <View style={styles.chatBubble}>
        <Text style={styles.chatText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chatLine: {
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
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chatText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
