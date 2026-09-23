import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../Text';
import { LocationInfo } from '../../types/prewalk';
import { estimateDistanceKm } from '../../utils/walkEstimate';
import { colors, radii, spacing } from '../../theme/tokens';

type FieldKey = 'origin' | 'destination' | 'distance';
type DistanceUnit = 'km' | 'min';

const locationLabel = (info: LocationInfo | null, fallback: string) =>
  info?.place_name ?? info?.address ?? fallback;

/**
 * 사용자가 방금 입력한 값 — onEdit과 함께 넘겨서 백엔드 응답이 오기 전에 카드가 그 값을
 * 바로 반영(낙관적 업데이트)할 수 있게 한다. 나중에 실제 응답이 오면 그 값으로 덮어써진다.
 */
export type WalkConditionOptimisticEdit =
  | { field: 'origin' | 'destination'; value: string }
  | { field: 'distance'; value: number };

/**
 * 챗봇이 이해한 산책 조건(출발/도착/목표 거리)을 요약해 보여주는 카드. 필드마다 연필 아이콘으로
 * 수정할 수 있는데, 값을 직접 상태에 반영하는 게 아니라 "출발지를 OO로 바꿔줘" 같은 자연어
 * 발화를 만들어 onEdit으로 흘려보낸다 — 실제 반영은 항상 백엔드 챗봇 응답을 거친다(다만 화면에는
 * optimistic으로 방금 입력한 값을 바로 보여준다).
 */
export function WalkConditionCard({
  origin,
  destination,
  showDestination,
  targetKm,
  distanceEditable,
  disabled,
  onEdit,
}: {
  origin: LocationInfo | null;
  destination: LocationInfo | null;
  showDestination: boolean;
  targetKm: number | null;
  distanceEditable: boolean;
  disabled?: boolean;
  onEdit: (promptText: string, optimistic: WalkConditionOptimisticEdit) => void;
}) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  const startEdit = (field: FieldKey, current: string) => {
    if (disabled) return;
    setEditing(field);
    setDraft(current);
    setDistanceUnit('km');
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
  };

  const submitLocationEdit = (field: 'origin' | 'destination') => {
    const value = draft.trim();
    if (!value) {
      cancelEdit();
      return;
    }
    const label = field === 'origin' ? '출발지' : '목적지';
    onEdit(`${label}를 ${value}로 바꿔줘`, { field, value });
    cancelEdit();
  };

  const submitDistanceEdit = () => {
    const value = draft.trim();
    const numeric = Number(value);
    if (!value || !Number.isFinite(numeric) || numeric <= 0) {
      cancelEdit();
      return;
    }
    // "분" 입력도 체크 버튼을 누르는 즉시 km로 환산해서 보낸다 — 백엔드 응답을 기다려야만
    // km로 바뀌는 게 아니라, 여기서 바로 확정된 값으로 발화를 만든다.
    const km = distanceUnit === 'km' ? numeric : estimateDistanceKm(numeric);
    onEdit(`목표 거리를 ${km}km로 바꿔줘`, { field: 'distance', value: km });
    cancelEdit();
  };

  const submitEdit = (field: FieldKey) =>
    field === 'distance' ? submitDistanceEdit() : submitLocationEdit(field);

  const renderRow = (
    field: FieldKey,
    icon: React.ComponentProps<typeof Ionicons>['name'],
    label: string,
    value: string,
    editable: boolean,
  ) => {
    const isEditing = editing === field;
    return (
      <View style={styles.row} key={field}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={16} color={colors.ink} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
        {isEditing ? (
          <View style={styles.editArea}>
            {field === 'distance' ? (
              <View style={styles.unitToggle}>
                {(['km', 'min'] as DistanceUnit[]).map(unit => (
                  <Pressable
                    key={unit}
                    onPress={() => setDistanceUnit(unit)}
                    style={[
                      styles.unitChip,
                      distanceUnit === unit && styles.unitChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        distanceUnit === unit && styles.unitChipTextActive,
                      ]}
                    >
                      {unit === 'km' ? 'km' : '분'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput
              style={styles.editInput}
              value={draft}
              onChangeText={setDraft}
              autoFocus
              keyboardType={field === 'distance' ? 'numeric' : 'default'}
              onSubmitEditing={() => submitEdit(field)}
              returnKeyType="done"
            />
            <Pressable onPress={() => submitEdit(field)} style={styles.editConfirm}>
              <Ionicons name="checkmark" size={16} color={colors.card} />
            </Pressable>
            <Pressable onPress={cancelEdit} style={styles.editCancel} hitSlop={6}>
              <Ionicons name="close" size={16} color={colors.ink3} />
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.rowValue} numberOfLines={1}>
              {value}
            </Text>
            {editable ? (
              <Pressable
                onPress={() =>
                  startEdit(field, field === 'distance' ? String(targetKm ?? '') : value)
                }
                disabled={disabled}
                hitSlop={8}
              >
                <Ionicons name="pencil-outline" size={14} color={colors.ink3} />
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="clipboard-outline" size={18} color={colors.ink} />
        <Text style={styles.headerText}>산책 조건</Text>
      </View>
      {renderRow('origin', 'navigate-outline', '출발', locationLabel(origin, '현재 위치'), true)}
      {showDestination
        ? renderRow(
            'destination',
            'flag-outline',
            '도착',
            locationLabel(destination, '설정 안 됨'),
            true,
          )
        : null}
      {targetKm != null
        ? renderRow('distance', 'resize-outline', '목표 거리', `${targetKm}km`, distanceEditable)
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 34,
  },
  rowIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.containerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    color: colors.ink3,
    fontSize: 13,
    fontWeight: '700',
    width: 52,
  },
  rowValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    marginRight: spacing.xs,
  },
  editArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 13,
    color: colors.ink,
  },
  editConfirm: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancel: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  unitChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  unitChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink3,
  },
  unitChipTextActive: {
    color: colors.card,
  },
});
