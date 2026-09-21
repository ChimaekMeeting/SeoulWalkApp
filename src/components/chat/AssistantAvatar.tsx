import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors } from '../../theme/tokens';

/** 앱 시작 화면과 같은 두 발자국을 사용하는 ROUDI 챗봇 아바타. */
export function AssistantAvatar() {
  return (
    <View style={styles.avatar} accessibilityLabel="ROUDI AI">
      <Text style={styles.footprints}>👣</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footprints: {
    fontSize: 15,
    lineHeight: 18,
  },
});
