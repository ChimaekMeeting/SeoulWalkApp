/**
 * useAndroidBackHandler: hardwareBackPress 구독/해제, enabled 토글, handler 반환값 전달 검증.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BackHandler } from 'react-native';

type BackListener = () => boolean;

let listeners: BackListener[] = [];
const removeSpy = jest.fn();

jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
  _event: string,
  cb: BackListener,
) => {
  listeners.push(cb);
  return {
    remove: () => {
      listeners = listeners.filter(l => l !== cb);
      removeSpy();
    },
  };
}) as typeof BackHandler.addEventListener);

import { useAndroidBackHandler } from '../useAndroidBackHandler';

function Probe({ handler, enabled }: { handler: () => boolean; enabled: boolean }) {
  useAndroidBackHandler(handler, enabled);
  return null;
}

function render(handler: () => boolean, enabled = true) {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Probe handler={handler} enabled={enabled} />);
  });
  return {
    rerender: (h: () => boolean, e = true) =>
      ReactTestRenderer.act(() => {
        renderer.update(<Probe handler={h} enabled={e} />);
      }),
    unmount: () => ReactTestRenderer.act(() => renderer.unmount()),
  };
}

beforeEach(() => {
  listeners = [];
  removeSpy.mockClear();
});

const press = () => listeners.map(l => l());

it('마운트 시 hardwareBackPress를 구독하고 언마운트 시 해제한다', () => {
  const { unmount } = render(() => true);
  expect(listeners).toHaveLength(1);
  unmount();
  expect(removeSpy).toHaveBeenCalled();
  expect(listeners).toHaveLength(0);
});

it('enabled=false면 구독하지 않는다', () => {
  render(() => true, false);
  expect(listeners).toHaveLength(0);
});

it('handler의 반환값이 그대로 back 이벤트 결과가 된다', () => {
  render(() => false);
  expect(press()).toEqual([false]);
});

it('handler가 매 렌더 새로 만들어져도 리스너를 재등록하지 않고 최신 handler를 호출한다', () => {
  const first = jest.fn(() => true);
  const view = render(first);
  const second = jest.fn(() => false);
  view.rerender(second);
  expect(listeners).toHaveLength(1);
  press();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalled();
});
