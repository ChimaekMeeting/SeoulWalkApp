import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { MaterialIcons } from '@expo/vector-icons';
import { TurnKind, TurnStep, formatTurnInstruction } from '../utils/turnByTurn';
import { colors, radii, spacing } from '../theme/tokens';

interface Props {
  step: TurnStep | null;
  distanceToKm: number;
}

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Material Icons에 이미 있는 "직진하다 곡선으로 휘는" 턴 아이콘을 그대로 쓴다 — kind(턴 종류)당
// 하나의 고정된 모양이라 실제 각도가 얼마든 항상 같은 모습으로 보인다. uturn만 좌/우 아이콘이
// 따로 있어서(u-turn-left/right) angleDeg 부호로 고른다(아래 iconNameFor). sharp_left/sharp_right는
// Material 프리셋(turn-sharp-*)이 둥글게 이어져 있어서 아래 SharpTurnArrow(직선으로 각지게 꺾이는
// 모양, 손으로 그린 참고 스케치 기준)로 직접 그린다.
const TURN_KIND_ICON: Record<Exclude<TurnKind, 'arrive' | 'uturn'>, MaterialIconName> = {
  slight_left: 'turn-slight-left',
  left: 'turn-left',
  sharp_left: 'turn-sharp-left', // renderIcon이 sharp_*를 먼저 가로채므로 실사용 안 함(타입 완전성용)
  slight_right: 'turn-slight-right',
  right: 'turn-right',
  sharp_right: 'turn-sharp-right', // 위와 동일
};

function iconNameFor(step: TurnStep): MaterialIconName {
  if (step.kind === 'arrive') return 'flag';
  if (step.kind === 'uturn') return step.angleDeg >= 0 ? 'u-turn-right' : 'u-turn-left';
  return TURN_KIND_ICON[step.kind];
}

/**
 * 산책 중 화면 상단에 다음 턴 안내를 보여주는 배너(WalkInProgressScreen 전용). step이 없으면
 * (턴이 없는 완전 직선 코스거나 이미 다 지나온 경우) 아무것도 렌더하지 않는다.
 * utils/turnByTurn.ts가 route 좌표만으로 계산한 턴을 kind별 고정 화살표 모양 + 문구로 표시한다 —
 * 백엔드 maneuver 데이터 없이 프론트 기하 계산만으로 동작.
 */
export function TurnByTurnBanner({ step, distanceToKm }: Props) {
  if (!step) return null;
  const isSharp = step.kind === 'sharp_left' || step.kind === 'sharp_right';

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {isSharp ? (
          <SharpTurnArrow direction={step.kind === 'sharp_left' ? 'left' : 'right'} />
        ) : (
          <MaterialIcons name={iconNameFor(step)} size={22} color={colors.card} />
        )}
      </View>
      <Text style={styles.text} numberOfLines={1}>
        {formatTurnInstruction(step.kind, distanceToKm)}
      </Text>
    </View>
  );
}

// ── 급좌/급우회전 전용 아이콘 ────────────────────────────────────────────────
// 손으로 그린 참고 스케치대로: 세로 막대가 곧게 올라가다 위쪽에서 한 번 각지게 꺾여(곡선 아님)
// 대각선으로 내려가 화살촉으로 끝난다. 세로 막대 밑변(피벗)을 축으로 꺾이는 막대를 135° 돌리면
// 끝점이 그 자리로 간다(삼각비: 대각선 성분 = 막대 길이 × sin45°). 순수 도형이라 SVG 라이브러리
// 없이 View 회전(transformOrigin)만으로 그렸다 — 새 네이티브 의존성 없음.
const GLYPH = 22; // 아이콘 캔버스 한 변(px) — MaterialIcons size={22}와 시각 크기를 맞춤
const BAR_W = 2; // Material Icons 다른 아이콘들의 획 굵기와 맞춤(너무 두꺼워 보인다는 피드백)
const START_Y = 20; // 세로 막대가 시작하는 바닥 지점
const PIVOT_Y = 7; // 꺾이는 지점 — 캔버스 중간이 아니라 위쪽(스케치처럼)
const TAIL_LEN = START_Y - PIVOT_Y;
const HEAD_LEN = 14; // 꺾인 뒤 뻗는 길이 — 스케치처럼 화살표 끝이 아래쪽까지 닿도록 길게
const BEND_DEG = 135;
// 화살촉도 얇아진 막대 굵기에 맞춰 함께 축소(BAR_W 3 시절 크기의 비율 유지).
const ARROW_HALF_W = 3;
const ARROW_H = 5;
// 세로 막대를 캔버스 정중앙(GLYPH/2)에 고정하면, 거기서 옆으로 뻗어나가는 꺾이는 구간 때문에
// 그림 전체(먹선이 실제로 차지하는 영역)의 무게중심이 한쪽으로 쏠려 보인다는 피드백 — 꺾이는
// 구간이 뻗는 가로 폭의 절반만큼 세로 막대를 반대쪽으로 밀어서, "세로 막대~꺾인 끝점" 전체 가로
// 범위의 중심이 캔버스 중앙에 오도록 맞춘다.
const HORIZONTAL_REACH = (HEAD_LEN * Math.sin((BEND_DEG * Math.PI) / 180)) / 2;

function SharpTurnArrow({ direction }: { direction: 'left' | 'right' }) {
  const sign = direction === 'left' ? -1 : 1;
  const centerX = GLYPH / 2 - sign * HORIZONTAL_REACH;
  const angleDeg = sign * BEND_DEG;
  const rad = (angleDeg * Math.PI) / 180;
  const tipX = centerX + HEAD_LEN * Math.sin(rad);
  const tipY = PIVOT_Y - HEAD_LEN * Math.cos(rad);
  const rotateDeg = `${angleDeg}deg`;

  return (
    <View style={{ width: GLYPH, height: GLYPH }}>
      {/* 곧게 올라가는 구간 — 피벗(centerX, PIVOT_Y)까지. */}
      <View style={[styles.bar, { left: centerX - BAR_W / 2, top: PIVOT_Y, height: TAIL_LEN }]} />
      {/* 꺾이는 구간 — 피벗을 축으로 135° 회전, 끝은 tipX/tipY로. */}
      <View
        style={[
          styles.bar,
          {
            left: centerX - BAR_W / 2,
            top: PIVOT_Y - HEAD_LEN,
            height: HEAD_LEN,
            transform: [{ rotate: rotateDeg }],
            transformOrigin: 'center bottom',
          },
        ]}
      />
      <View
        style={[
          styles.arrowHead,
          {
            left: tipX - ARROW_HALF_W,
            top: tipY - ARROW_H / 2,
            transform: [{ rotate: rotateDeg }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    color: colors.card,
    fontSize: 15,
    fontWeight: '800',
  },
  bar: {
    position: 'absolute',
    width: BAR_W,
    borderRadius: BAR_W / 2,
    backgroundColor: colors.card,
  },
  arrowHead: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_HALF_W,
    borderRightWidth: ARROW_HALF_W,
    borderBottomWidth: ARROW_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.card,
  },
});
