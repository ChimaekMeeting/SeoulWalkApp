import React from 'react';
import { StyleSheet, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../BottomNav';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 16, left: 0 }),
}));

let renderer: ReactTestRenderer.ReactTestRenderer;

afterEach(() => {
  ReactTestRenderer.act(() => renderer?.unmount());
});

function renderNav(onChange = jest.fn()) {
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <BottomNav active="home" onChange={onChange} />,
    );
  });
  return renderer.root;
}

test('keeps the native gesture target from being flattened', () => {
  const rootView = renderNav().findAllByType(View)[0];
  expect(rootView.props.collapsable).toBe(false);
});

test('preserves bottom positioning and safe-area spacing', () => {
  const rootView = renderNav().findAllByType(View)[0];
  expect(StyleSheet.flatten(rootView.props.style)).toMatchObject({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_NAV_HEIGHT + 16,
    paddingBottom: 16,
  });
});

test('keeps all three tab buttons connected', () => {
  const onChange = jest.fn();
  const buttons = renderNav(onChange).findAll(
    node => typeof node.props.onPress === 'function',
  );
  expect(buttons).toHaveLength(3);
  ReactTestRenderer.act(() => {
    buttons.forEach(button => button.props.onPress());
  });
  expect(onChange.mock.calls).toEqual([['home'], ['record'], ['me']]);
});
