import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { colors, spacing } from '../../theme/tokens';
import { AssistantAvatar } from './AssistantAvatar';

export function ChatBubble({ text }: { text: string }) {
  return (
    <View style={styles.chatLine}>
      <AssistantAvatar />
      <View style={styles.chatBubble}>
        <Text style={styles.chatText}>{text}</Text>
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
  chatBubble: {
    flexShrink: 1,
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.containerBackground,
  },
  chatText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
