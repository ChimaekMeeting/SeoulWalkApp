import React from 'react';
import { Linking } from 'react-native';
import { TabScreen } from '../components/TabScreen';
import { ProfileCard } from '../components/my/ProfileCard';
import { DevMenu } from '../components/my/DevMenu';
import { MyPreferenceSection } from '../components/my/MyPreferenceSection';
import { SettingRow } from '../components/my/SettingRow';

interface MyPageScreenProps {
  onLogout?: () => void;
  nickname: string | null;
  email: string | null;
  onResetSurvey?: () => void;
}

export function MyPageScreen({
  onLogout,
  nickname,
  email,
  onResetSurvey,
}: MyPageScreenProps) {
  return (
    <TabScreen title="마이페이지">
      <ProfileCard nickname={nickname} email={email} />

      <MyPreferenceSection />

      <SettingRow
        label="신체 활동 및 위치 권한 수정"
        onPress={() => Linking.openSettings()}
      />
      <SettingRow label="로그아웃" onPress={onLogout} danger showChevron={false} />

      <DevMenu onResetSurvey={onResetSurvey} />
    </TabScreen>
  );
}
