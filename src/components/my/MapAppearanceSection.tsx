import React from 'react';
import { MyPageSection, MyPageSubHeading } from './MyPageSection';
import { LightDarkSelector } from '../LightDarkSelector';
import { useMapAppearance } from '../../hooks/useMapAppearance';

/**
 * 마이페이지 '지도 화면' 섹션 — 홈 지도와 산책 중 지도의 라이트/다크를 각각 따로 고른다.
 * 기본값은 기존 고정 동작과 같은 홈=라이트/산책 중=다크(mapConfig.defaultMapModes)이고, 값은
 * 기기에 저장되어 다음 실행에도 유지된다(useMapAppearance → mapAppearance.ts).
 */
export function MapAppearanceSection() {
  const { modes, setMode } = useMapAppearance();

  return (
    <MyPageSection title="지도 화면">
      <MyPageSubHeading>홈 지도</MyPageSubHeading>
      <LightDarkSelector value={modes.overview} onChange={mode => setMode('overview', mode)} />

      <MyPageSubHeading>산책 중 지도</MyPageSubHeading>
      <LightDarkSelector value={modes.walk} onChange={mode => setMode('walk', mode)} />
    </MyPageSection>
  );
}
