import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../Text';
import { colors, spacing } from '../../theme/tokens';

export type ChatInputChip = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onRemove: () => void;
};

export function ChatInput({
  onSend,
  placeholder = '답변을 입력해주세요',
  disabled,
  chip,
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  // 입력창 위에 붙는 모드 칩(예: 확인 질문에 "아니요" → "수정 요청"). × 로 모드를 해제한다.
  chip?: ChatInputChip | null;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // 칩이 새로 붙으면(모드 진입) 바로 입력할 수 있게 포커스한다.
  const chipLabel = chip?.label;
  useEffect(() => {
    if (chipLabel) inputRef.current?.focus();
  }, [chipLabel]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={styles.container}>
      {chip ? (
        <View style={styles.chip}>
          <Ionicons name={chip.icon} size={16} color={colors.ink} />
          <Text style={styles.chipLabel}>{chip.label}</Text>
          <Pressable
            onPress={chip.onRemove}
            hitSlop={8}
            style={({ pressed }) => [styles.chipRemove, pressed && styles.sendButtonPressed]}
          >
            <Ionicons name="close" size={14} color={colors.ink} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink3}
          editable={!disabled}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          onPress={handleSend}
          disabled={disabled || !text.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            (disabled || !text.trim()) && styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed,
          ]}
        >
          <Ionicons name="send" size={18} color={colors.card} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginLeft: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.bgSoft,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  chipRemove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: '#FFFFFF',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.containerBackground,
  },
  sendButtonPressed: {
    opacity: 0.75,
  },
});
