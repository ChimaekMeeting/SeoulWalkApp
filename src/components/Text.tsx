import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { keepWordsTogether } from '../utils/koreanText';

// react-native의 Text를 그대로 대체해 쓰는 컴포넌트 — 문자열 children에 keepWordsTogether를
// 적용해, 앱 전체 어디서든 한글 단어가 음절 사이에서 잘려 줄바꿈되는 일이 없게 한다. props는
// react-native Text와 동일해 import 경로만 바꾸면 그대로 쓸 수 있다.
function transformChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return keepWordsTogether(children);
  if (Array.isArray(children)) return children.map((child, i) => (
    <React.Fragment key={i}>{transformChildren(child)}</React.Fragment>
  ));
  return children;
}

export function Text({ children, ...rest }: TextProps) {
  return <RNText {...rest}>{transformChildren(children)}</RNText>;
}
