import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Course} from '../data/chimeakData';
import {colors, radii, shadows, spacing} from '../theme/tokens';

type MockMapViewProps = {
  mode?: 'nearby' | 'overview' | 'detail' | 'dark';
  title?: string;
  course?: Course;
  progress?: number;
};

export function MockMapView({
  mode = 'nearby',
  title,
  course,
  progress = 1,
}: MockMapViewProps) {
  const isOverview = mode === 'overview';
  const isDark = mode === 'dark';
  const routeColor = course?.color ?? colors.warning;
  const routeStyle = getRouteStyle(course?.id, isOverview);

  return (
    <View
      style={[
        styles.map,
        isOverview && styles.overviewMap,
        mode === 'detail' && styles.detailMap,
        isDark && styles.darkMap,
      ]}>
      <View style={[styles.water, isDark && styles.darkWater]} />
      <View style={[styles.park, styles.parkLeft, isDark && styles.darkPark]} />
      <View style={[styles.park, styles.parkRight, isDark && styles.darkPark]} />
      <View style={[styles.park, styles.parkCenter, isDark && styles.darkPark]} />

      <Road variant="wide" dark={isDark} />
      <Road variant="curve" dark={isDark} />
      <Road variant="vertical" dark={isDark} />
      <Road variant="thinA" dark={isDark} />
      <Road variant="thinB" dark={isDark} />

      <View
        style={[
          styles.route,
          routeStyle.route,
          {borderColor: routeColor, opacity: Math.max(0.24, progress)},
        ]}>
        <View style={[styles.routeDotStart, {backgroundColor: routeColor}]} />
        <View style={[styles.routeDotMiddle, {borderColor: routeColor}]} />
        <View
          style={[
            styles.routeDotEnd,
            {backgroundColor: course?.type === 'oneway' ? routeColor : colors.card},
            course?.type === 'loop' && styles.loopEndDot,
            course?.type === 'loop' && {borderColor: routeColor},
          ]}
        />
      </View>

      {!isOverview ? (
        <View style={styles.locationPin}>
          <View style={styles.locationRing} />
          <View style={styles.locationCore} />
        </View>
      ) : null}

      <View style={styles.labels}>
        {['서촌', '서울숲', '성수'].map(label => (
          <Text key={label} style={[styles.mapText, isDark && styles.darkMapText]}>
            {label}
          </Text>
        ))}
      </View>

      {title ? (
        <View style={styles.mapLabel}>
          <Text style={styles.mapLabelText}>{title}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Road({variant, dark}: {variant: string; dark: boolean}) {
  return (
    <View
      style={[
        styles.road,
        getRoadStyle(variant),
        dark && styles.darkRoad,
      ]}
    />
  );
}

function getRoadStyle(variant: string) {
  switch (variant) {
    case 'wide':
      return styles.wideRoad;
    case 'curve':
      return styles.curveRoad;
    case 'vertical':
      return styles.verticalRoad;
    case 'thinA':
      return styles.thinARoad;
    case 'thinB':
      return styles.thinBRoad;
    default:
      return styles.wideRoad;
  }
}

function getRouteStyle(courseId?: string, overview?: boolean) {
  const base = overview ? styles.routeOverview : {};

  switch (courseId) {
    case 'c1':
      return {route: [base, styles.routeNorth]};
    case 'c3':
      return {route: [base, styles.routeRiver]};
    case 'c4':
      return {route: [base, styles.routeWest]};
    case 'c5':
      return {route: [base, styles.routeSouth]};
    case 'c6':
      return {route: [base, styles.routeStream]};
    case 'c2':
    default:
      return {route: [base, styles.routeEast]};
  }
}

const styles = StyleSheet.create({
  map: {
    overflow: 'hidden',
    minHeight: 330,
    backgroundColor: '#f2fbf7',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#d8eee6',
    ...shadows.map,
  },
  overviewMap: {
    width: 92,
    minHeight: 92,
    borderRadius: 10,
    shadowOpacity: 0,
    elevation: 0,
  },
  detailMap: {
    minHeight: 280,
    borderRadius: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  darkMap: {
    backgroundColor: '#142222',
    borderColor: '#223534',
  },
  water: {
    position: 'absolute',
    left: -40,
    right: -20,
    bottom: 22,
    height: 100,
    borderRadius: 48,
    backgroundColor: colors.mapWater,
    transform: [{rotate: '-4deg'}],
  },
  darkWater: {
    backgroundColor: '#264c59',
  },
  park: {
    position: 'absolute',
    backgroundColor: '#c9efd5',
  },
  darkPark: {
    backgroundColor: '#284c3f',
  },
  parkLeft: {
    top: 76,
    left: 36,
    width: 118,
    height: 126,
    borderRadius: 56,
    transform: [{rotate: '-20deg'}],
  },
  parkRight: {
    top: 46,
    right: 18,
    width: 104,
    height: 124,
    borderRadius: 44,
    transform: [{rotate: '12deg'}],
  },
  parkCenter: {
    top: 182,
    left: '47%',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  road: {
    position: 'absolute',
    backgroundColor: colors.road,
    borderColor: '#dbe9e2',
    borderWidth: 1,
  },
  darkRoad: {
    backgroundColor: '#283837',
    borderColor: '#334948',
  },
  wideRoad: {
    left: -30,
    right: -20,
    top: 182,
    height: 34,
    transform: [{rotate: '-2deg'}],
  },
  curveRoad: {
    left: -40,
    right: -40,
    top: 300,
    height: 28,
    transform: [{rotate: '-5deg'}],
  },
  verticalRoad: {
    top: -50,
    left: '51%',
    width: 30,
    height: 470,
    transform: [{rotate: '-6deg'}],
  },
  thinARoad: {
    top: 70,
    left: -24,
    width: 430,
    height: 8,
    transform: [{rotate: '22deg'}],
  },
  thinBRoad: {
    top: -40,
    right: 56,
    width: 9,
    height: 430,
    transform: [{rotate: '-10deg'}],
  },
  route: {
    position: 'absolute',
    borderWidth: 5,
    borderRadius: 999,
  },
  routeOverview: {
    transform: [{scale: 0.72}, {rotate: '12deg'}],
  },
  routeEast: {
    top: 96,
    right: 38,
    width: 86,
    height: 134,
    transform: [{rotate: '12deg'}],
  },
  routeNorth: {
    top: 36,
    left: 86,
    width: 110,
    height: 108,
    transform: [{rotate: '-16deg'}],
  },
  routeRiver: {
    bottom: 48,
    left: 48,
    width: 230,
    height: 38,
    borderRadius: 20,
    transform: [{rotate: '7deg'}],
  },
  routeWest: {
    top: 164,
    left: 46,
    width: 68,
    height: 70,
    transform: [{rotate: '-10deg'}],
  },
  routeSouth: {
    top: 70,
    right: 48,
    width: 88,
    height: 118,
    transform: [{rotate: '-20deg'}],
  },
  routeStream: {
    top: 186,
    left: 72,
    width: 220,
    height: 36,
    transform: [{rotate: '-2deg'}],
  },
  routeDotStart: {
    position: 'absolute',
    top: -8,
    left: 26,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  routeDotMiddle: {
    position: 'absolute',
    top: '50%',
    right: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.card,
    borderWidth: 3,
  },
  routeDotEnd: {
    position: 'absolute',
    bottom: -8,
    left: 22,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  loopEndDot: {
    borderWidth: 2,
  },
  locationPin: {
    position: 'absolute',
    top: 214,
    left: '46%',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 143, 116, 0.2)',
  },
  locationCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: colors.card,
  },
  labels: {
    position: 'absolute',
    left: 40,
    right: 30,
    top: 222,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapText: {
    color: '#7f908b',
    fontSize: 10,
    fontWeight: '700',
  },
  darkMapText: {
    color: '#6b8580',
  },
  mapLabel: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  mapLabelText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
});
