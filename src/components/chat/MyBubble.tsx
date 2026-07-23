import { View, Text, StyleSheet } from 'react-native';
import { spacing, colors } from '../../theme/tokens';

export function MyBubble({ text }: { text: string }) {
  return (
    <View style={styles.myBubbleWrap}>
      <View style={styles.myBubble}>
        <Text style={styles.myBubbleText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  myBubbleWrap: {
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  myBubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.black,
  },
  myBubbleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
