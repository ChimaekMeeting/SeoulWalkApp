import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import {useLocation} from '../hooks/useLocation';
import {MockMapView} from '../components/MockMapView';
import mockPois from '../data/mockPois.json';
import mockRoute from '../data/mockRoute.json';
import {StaticPOILayer} from '../components/map/StaticPOILayer';
import {DynamicPOILayer} from '../components/map/DynamicPOILayer';
import {RouteLayer} from '../components/map/RouteLayer';
import {WalkMapRenderer} from '../components/map/WalkMapRenderer';
import {
  chatbotFlow,
  Course,
  courses,
  CourseType,
  PersonaId,
  personas,
  recentWalks,
} from '../data/chimeakData';
import {colors, radii, shadows, spacing} from '../theme/tokens';

type Route =
  | {name: 'home'}
  | {name: 'chat'}
  | {name: 'courses'; filter?: CourseType | 'all'}
  | {name: 'course'; id: string}
  | {name: 'walk'; id: string}
  | {name: 'postwalk'; id: string}
  | {name: 'record'}
  | {name: 'me'};

type TabName = 'home' | 'chat' | 'courses' | 'record' | 'me';

const navItems: {name: TabName; label: string; icon: string}[] = [
  {name: 'home', label: '홈', icon: '⌂'},
  {name: 'chat', label: 'AI 산책', icon: '✳'},
  {name: 'courses', label: '추천 코스', icon: '♬'},
  {name: 'record', label: '기록', icon: '♧'},
  {name: 'me', label: '내 정보', icon: '♙'},
];

export function HomeScreen() {
  const [route, setRoute] = useState<Route>({name: 'home'});
  const [persona, setPersona] = useState<PersonaId>('killtime');
  const [recommendedFilter, setRecommendedFilter] = useState<CourseType | undefined>();
  const [walkResult, setWalkResult] = useState<{dist: string; time: string} | null>(null);
  const [activeMapCourse, setActiveMapCourse] = useState<string | null>(null);

  const go = (next: Route | TabName) => {
    if (typeof next === 'string') {
      if (next === 'courses') {
        setRoute({name: 'courses', filter: recommendedFilter ?? 'all'});
      } else if (next === 'home') {
        setRoute({name: 'home'});
      } else if (next === 'chat') {
        setRoute({name: 'chat'});
      } else if (next === 'record') {
        setRoute({name: 'record'});
      } else {
        setRoute({name: next});
      }
      return;
    }
    setRoute(next);
  };

  const activeTab = getTab(route);
  const showNav = ['home', 'chat', 'courses', 'record', 'me'].includes(route.name);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />
      <View style={styles.appShell}>
        {route.name === 'home' || route.name === 'chat' ? (
          <HomeTab 
             persona={persona} 
             activeMapCourse={activeMapCourse}
             go={go} 
             openCourse={id => go({name: 'course', id})} 
          />
        ) : null}
        {route.name === 'chat' ? (
          <ChatBottomSheet
            persona={persona}
            onSelectCourse={(id) => setActiveMapCourse(id)}
            go={go}
          />
        ) : null}
        {route.name === 'courses' ? (
          <CoursesTab
            filter={route.filter ?? recommendedFilter ?? 'all'}
            go={go}
          />
        ) : null}
        {route.name === 'course' ? <CourseDetail id={route.id} go={go} /> : null}
        {route.name === 'walk' ? (
          <WalkTab
            id={route.id}
            go={go}
            onDone={(dist, time) => {
              setWalkResult({dist, time});
              go({name: 'postwalk', id: route.id});
            }}
          />
        ) : null}
        {route.name === 'postwalk' ? (
          <PostWalkTab id={route.id} walkResult={walkResult} go={go} />
        ) : null}
        {route.name === 'record' ? <RecordTab /> : null}
        {route.name === 'me' ? (
          <MyPageTab persona={persona} setPersona={setPersona} go={go} />
        ) : null}
        {showNav ? <BottomNav active={activeTab} onChange={go} /> : null}
      </View>
    </SafeAreaView>
  );
}

function getTab(route: Route): TabName {
  if (route.name === 'course') {
    return 'courses';
  }
  if (route.name === 'postwalk') {
    return 'record';
  }
  return route.name as TabName;
}

function HomeTab({
  persona,
  activeMapCourse,
  go,
  openCourse,
}: {
  persona: PersonaId;
  activeMapCourse: string | null;
  go: (route: Route | TabName) => void;
  openCourse: (id: string) => void;
}) {
  const {hasPermission} = useLocation();
  const [topTab, setTopTab] = useState<'nearby' | 'trending' | 'time'>('nearby');

  const staticData = {
    ...mockPois,
    features: mockPois.features.filter((f: any) => ['bench', 'toilet', 'cctv'].includes(f.properties.type))
  };

  const dynamicData = {
    ...mockPois,
    features: mockPois.features.filter((f: any) => ['cafe', 'spot'].includes(f.properties.type))
  };

  const routeData = activeMapCourse ? mockRoute : null;
  const personaInfo = personas[persona];
  const featured = courses.filter(course => course.persona.includes(persona)).slice(0, 5);
  const visibleCourses = topTab === 'trending' ? courses.slice(0, 4) : featured;

  return (
    <View style={styles.fill}>
      <View style={styles.homeMap}>
        <Mapbox.MapView style={{flex: 1}} styleURL={'mapbox://styles/mapbox/streets-v12'}>
          <Mapbox.Camera
            zoomLevel={15}
            centerCoordinate={[126.9780, 37.5665]}
            // followUserLocation={hasPermission} // 에뮬레이터 GPS(미국)를 따라가지 않도록 임시 비활성화
            // followUserMode="normal"
          />
          {routeData && <RouteLayer data={routeData} />}
          <StaticPOILayer data={staticData} />
          <DynamicPOILayer data={dynamicData} />
          {hasPermission && <Mapbox.UserLocation />}
        </Mapbox.MapView>
        <Pressable onPress={() => go('chat')} style={styles.aiSearch}>
          <View style={styles.searchSpark}>
            <Text style={styles.searchSparkText}>✳</Text>
          </View>
          <View style={styles.searchBody}>
            <Text style={styles.searchMeta}>AI · {personaInfo.label.toUpperCase()}</Text>
            <Text style={styles.searchQuestion}>오늘 기분 어때요?</Text>
          </View>
          <Text style={styles.searchMic}>마이크</Text>
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionScroller}
          contentContainerStyle={styles.suggestionContent}>
          {['30분만 가볍게 걷고 싶어요', '오늘 야경 보러 갈 곳', '한강 근처 편도 코스', '카페 들르면서 천천히'].map(
            suggestion => (
              <Pressable key={suggestion} onPress={() => go('chat')} style={styles.suggestionChip}>
                <Text style={styles.suggestionText}>✳ {suggestion}</Text>
              </Pressable>
            ),
          )}
        </ScrollView>
        <View style={styles.weatherPill}>
          <Text style={styles.weatherText}>☁ 17° · 미세 ●</Text>
        </View>
        <View style={styles.mapControls}>
          <RoundButton label="◎" />
          <RoundButton label="+" />
        </View>
      </View>

      <View style={styles.homeSheet}>
        <View style={styles.dragHandle} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentStrip}>
          {[
            {id: 'nearby', label: '내 주변', icon: '⌖'},
            {id: 'trending', label: '서울 트렌딩', icon: '↗'},
            {id: 'time', label: '지금 이 시간', icon: '◷'},
          ].map(tab => (
            <Pressable
              key={tab.id}
              onPress={() => setTopTab(tab.id as 'nearby' | 'trending' | 'time')}
              style={[styles.pill, topTab === tab.id && styles.pillActive]}>
              <Text style={[styles.pillText, topTab === tab.id && styles.pillTextActive]}>
                {tab.icon} {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View style={styles.inlineTitle}>
            <Text style={styles.sectionTitle}>
              {topTab === 'trending'
                ? '서울 산책 TOP 5'
                : topTab === 'time'
                  ? '오늘 저녁에 좋아요'
                  : '내 주변 AI 추천'}
            </Text>
            <Text style={styles.sectionSub}>· 4분 전 업데이트</Text>
          </View>
          <Pressable onPress={() => go('courses')}>
            <Text style={styles.sectionAction}>전체 보기 →</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseCarousel}>
          {visibleCourses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              rank={topTab === 'trending' ? index + 1 : undefined}
              onPress={() => openCourse(course.id)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function ChatBottomSheet({
  persona,
  onSelectCourse,
  go,
}: {
  persona: PersonaId;
  onSelectCourse: (id: string) => void;
  go: (route: Route | TabName) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const done = step >= chatbotFlow.length;
  const recommendType = answers[3]?.startsWith('편도') ? 'oneway' : 'loop';
  const recommended =
    courses.find(course => course.type === recommendType && course.persona.includes(persona)) ??
    courses[0];

  const choose = (answer: string) => {
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    // (Optional) Could set filters here if needed
    setStep(current => current + 1);
  };

  return (
    <View style={styles.chatOverlay}>
      <View style={styles.chatSheet}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatHeaderTitle}>AI 산책 도우미 ({personas[persona].label})</Text>
          <Pressable onPress={() => go('home')} style={styles.chatCloseBtn}>
            <Text style={styles.chatCloseBtnText}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}>
        <ChatBubble text="안녕하세요 채원님 👋" />
        <ChatBubble text="몇 가지만 물어볼게요. 오늘에 맞는 길을 찾아드릴게요." />
        {chatbotFlow.slice(0, Math.min(step + 1, chatbotFlow.length)).map((flow, index) => (
          <View key={flow.q}>
            <ChatBubble text={flow.q} />
            {answers[index] ? <MyBubble text={answers[index]} /> : null}
            {index === step && !done ? (
              <View style={styles.answerRow}>
                {flow.a.map(answer => (
                  <Pressable key={answer} onPress={() => choose(answer)} style={styles.answerChip}>
                    <Text style={styles.answerText}>{answer}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        {done ? (
          <View>
            <ChatBubble text="좋아요. 정리해보면 오늘은 이 길이 어울려요." />
            <Pressable onPress={() => {
              onSelectCourse(recommended.id);
              go('home');
            }} style={styles.recommendBubble}>
              <View style={[styles.recommendIcon, {backgroundColor: `${recommended.color}22`}]}>
                <Text style={styles.recommendMood}>{recommended.mood}</Text>
              </View>
              <View style={styles.recommendBody}>
                <Text style={[styles.recommendType, {color: recommended.color}]}>
                  {recommended.type === 'loop' ? '순환 · LOOP' : '편도 · ONE-WAY'}
                </Text>
                <Text style={styles.recommendTitle}>{recommended.title}</Text>
                <Text style={styles.recommendMeta}>
                  {recommended.distance}km · {recommended.duration}분 · {recommended.kcal}kcal
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <View style={styles.chatButtons}>
              <Pressable onPress={() => go('courses')} style={styles.primaryButtonSmall}>
                <Text style={styles.primaryButtonText}>다른 코스 더 보기</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAnswers([]);
                  setStep(0);
                }}
                style={styles.ghostButtonSmall}>
                <Text style={styles.ghostButtonText}>다시 묻기</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
      </View>
    </View>
  );
}

function CoursesTab({
  filter,
  go,
}: {
  filter: CourseType | 'all';
  go: (route: Route | TabName) => void;
}) {
  const [activeType, setActiveType] = useState<CourseType | 'all'>(filter);
  const filtered = courses.filter(course => activeType === 'all' || course.type === activeType);

  return (
    <View style={styles.pageSoft}>
      <ScreenHeader title="추천 코스" subtitle="힐링타임 · 6개의 길" onBack={() => go('home')} />
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>
          {[
            {id: 'all', label: `전체 ${courses.length}`},
            {id: 'loop', label: `순환 ${courses.filter(course => course.type === 'loop').length}`},
            {id: 'oneway', label: `편도 ${courses.filter(course => course.type === 'oneway').length}`},
          ].map(item => (
            <Pressable
              key={item.id}
              onPress={() => setActiveType(item.id as CourseType | 'all')}
              style={[styles.pill, activeType === item.id && styles.pillActive]}>
              <Text style={[styles.pillText, activeType === item.id && styles.pillTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          <View style={styles.pill}>
            <Text style={styles.pillText}>↑↓ 거리순</Text>
          </View>
        </ScrollView>

        <View style={styles.tagStrip}>
          {['#야경', '#한강', '#골목', '#카페', '#짧게', '#운동'].map(tag => (
            <Text key={tag} style={styles.tagFilter}>
              {tag}
            </Text>
          ))}
        </View>

        {filtered.map(course => (
          <Pressable
            key={course.id}
            onPress={() => go({name: 'course', id: course.id})}
            style={styles.courseRow}>
            <MockMapView mode="overview" course={course} />
            <View style={styles.courseRowBody}>
              <View style={styles.inlineRow}>
                <Text style={[styles.loopText, {color: course.color}]}>
                  {course.type === 'loop' ? '◯ LOOP' : '→ ONE-WAY'}
                </Text>
                <Badge label={course.badges[0]} color={course.color} />
              </View>
              <Text style={styles.courseTitle}>{course.title}</Text>
              <Text style={styles.courseSub}>{course.subtitle}</Text>
              <Text style={styles.courseMeta}>
                {course.distance}km · {course.duration}분 · {course.kcal}kcal
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function CourseDetail({id, go}: {id: string; go: (route: Route | TabName) => void}) {
  const course = getCourse(id);

  return (
    <View style={styles.detailPage}>
      <View style={styles.detailMapWrap}>
        <MockMapView mode="detail" course={course} />
        <Pressable onPress={() => go('courses')} style={styles.backCircle}>
          <Text style={styles.circleIcon}>‹</Text>
        </Pressable>
        <View style={styles.heartCircle}>
          <Text style={styles.circleIcon}>♡</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.detailSheet} showsVerticalScrollIndicator={false}>
        <View style={styles.tagStrip}>
          <Badge label={course.type === 'loop' ? '◯ 순환' : '→ 편도'} color={course.color} />
          {course.badges.map(badge => (
            <Badge key={badge} label={badge} color={colors.accent} />
          ))}
        </View>
        <Text style={styles.detailTitle}>{course.title}</Text>
        <Text style={styles.detailBlurb}>{course.blurb}</Text>
        <View style={styles.metricRow}>
          <StatTile label="거리" value={`${course.distance}`} unit="km" />
          <StatTile label="시간" value={`${course.duration}`} unit="분" />
          <StatTile label="칼로리" value={`${course.kcal}`} unit="kcal" />
        </View>
        <Text style={styles.blockTitle}>경유지 {course.waypoints.length}곳</Text>
        <View style={styles.waypointList}>
          {course.waypoints.map((waypoint, index) => (
            <View key={`${waypoint}-${index}`} style={styles.waypointRow}>
              <View
                style={[
                  styles.waypointDot,
                  {borderColor: course.color},
                  (index === 0 || index === course.waypoints.length - 1) && {
                    backgroundColor: course.color,
                  },
                ]}
              />
              <Text style={styles.waypointText}>{waypoint}</Text>
              {index === 0 ? <Text style={[styles.startText, {color: course.color}]}>START</Text> : null}
              {index === course.waypoints.length - 1 && course.type === 'oneway' ? (
                <Text style={[styles.startText, {color: course.color}]}>END</Text>
              ) : null}
            </View>
          ))}
        </View>
        <Text style={styles.blockTitle}>이 길의 분위기</Text>
        <View style={styles.tagStrip}>
          {course.tags.map(tag => (
            <Text key={tag} style={styles.moodTag}>
              {tag}
            </Text>
          ))}
        </View>
        <View style={styles.actionRow}>
          <Pressable onPress={() => go({name: 'walk', id: course.id})} style={styles.startButton}>
            <Text style={styles.startButtonText}>▶ 지금 산책 시작</Text>
          </Pressable>
          <Pressable style={styles.scheduleButton}>
            <Text style={styles.scheduleButtonText}>일정 추가</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function WalkTab({
  id,
  go,
  onDone,
}: {
  id: string;
  go: (route: Route | TabName) => void;
  onDone: (dist: string, time: string) => void;
}) {
  const course = getCourse(id);
  const [mode, setMode] = useState<'game' | 'map'>('game');
  const [paused, setPaused] = useState(false);
  const progress = paused ? 0.42 : 0.46;
  const distNow = (course.distance * progress).toFixed(2);
  const kcalNow = Math.round(course.kcal * progress);

  return (
    <View style={styles.walkPage}>
      <WalkMapRenderer course={course} progress={progress} isGameMode={mode === 'game'} />

      <View style={styles.walkTop}>
        <View style={styles.weatherDark}>
          <Text style={styles.weatherDarkText}>☾ 날씨: 흐림{'\n'}시간: 저녁</Text>
        </View>
        <Pressable
          onPress={() => setMode(mode === 'game' ? 'map' : 'game')}
          style={styles.modeButton}>
          <Text style={styles.modeButtonText}>{mode === 'game' ? '지도 모드' : '게임 모드'}</Text>
        </Pressable>
        <Pressable onPress={() => go('home')} style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.nextTip}>
        <Text style={styles.nextTipMeta}>📍 다음 경유지</Text>
        <Text style={styles.nextTipTitle}>{course.waypoints[2] ?? course.waypoints[1]}</Text>
      </View>

      <View style={styles.walkPanel}>
        <View style={styles.dragHandleDark} />
        <View style={styles.walkInfoRow}>
          <MockMapView mode="overview" course={course} progress={progress} />
          <View style={styles.walkInfoBody}>
            <Text style={styles.walkMeta}>NEXT WAYPOINT · 320m</Text>
            <Text style={styles.walkTitle}>{course.waypoints[2] ?? course.title}</Text>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsBadgeText}>⚡ +{Math.round(progress * 240)}P</Text>
            </View>
          </View>
        </View>
        <View style={styles.progressLine}>
          <View style={[styles.progressLineFill, {width: `${progress * 100}%`, backgroundColor: course.color}]} />
        </View>
        <View style={styles.walkStats}>
          <DarkMetric label="시간" value="10:27" />
          <DarkMetric label="페이스" value="6:09" color={colors.mint} />
          <DarkMetric label="칼로리" value={`${kcalNow}kcal`} color={colors.coral} />
        </View>
        <View style={styles.walkControls}>
          <RoundDark label="⌁" />
          <Pressable onPress={() => setPaused(value => !value)} style={styles.pauseButton}>
            <Text style={styles.pauseText}>{paused ? '▶' : 'Ⅱ'}</Text>
          </Pressable>
          <Pressable onPress={() => onDone(distNow, '10:27')} style={styles.doneButton}>
            <Text style={styles.doneText}>✓</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PostWalkTab({
  id,
  walkResult,
  go,
}: {
  id: string;
  walkResult: {dist: string; time: string} | null;
  go: (route: Route | TabName) => void;
}) {
  const course = getCourse(id);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const moodTags = ['야경 좋음', '한적함', '적당히 빡셈', '카페 들름', '사진 명소'];

  return (
    <View style={styles.pageSoft}>
      <ScreenHeader title="산책 기록" subtitle="오늘 다녀온 길을 기록해주세요" onBack={() => go('home')} />
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.completedCard, {backgroundColor: course.color}]}>
          <Text style={styles.completedMeta}>COMPLETED · 오늘</Text>
          <Text style={styles.completedTitle}>{course.title}</Text>
          <View style={styles.completedStats}>
            <LightMetric label="거리" value={`${walkResult?.dist ?? course.distance}km`} />
            <LightMetric label="시간" value={walkResult?.time ?? '00:00'} />
            <LightMetric label="걸음" value="5,842" />
          </View>
        </View>
        <View style={styles.previewMap}>
          <MockMapView mode="detail" course={course} />
        </View>
        <Text style={styles.blockTitle}>이 길은 어땠나요?</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map(item => (
            <Pressable key={item} onPress={() => setRating(item)}>
              <Text style={[styles.star, item <= rating && styles.starActive]}>★</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.blockTitle}>어떤 점이 좋았나요?</Text>
        <View style={styles.tagStrip}>
          {moodTags.map(tag => {
            const active = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() =>
                  setTags(active ? tags.filter(item => item !== tag) : [...tags, tag])
                }
                style={[styles.reviewTag, active && styles.reviewTagActive]}>
                <Text style={[styles.reviewTagText, active && styles.reviewTagTextActive]}>
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.aiLearnCard}>
          <Text style={styles.aiLearnTitle}>관심사가 업데이트됩니다</Text>
          <Text style={styles.aiLearnBody}>
            이번 산책 평가를 바탕으로 다음 추천이 자연스럽게 더 맞게 변해요.
          </Text>
        </View>
        <Pressable onPress={() => go('record')} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>기록 저장</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function RecordTab() {
  return (
    <View style={styles.pageSoft}>
      <ScreenHeader title="기록" subtitle="이번 달 산책 일지" />
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={styles.monthRow}>
          {['3월', '4월', '5월', '6월'].map((month, index) => (
            <View key={month} style={[styles.monthChip, index === 2 && styles.monthChipActive]}>
              <Text style={[styles.monthText, index === 2 && styles.monthTextActive]}>{month}</Text>
            </View>
          ))}
        </View>
        <View style={styles.pointsCard}>
          <Text style={styles.pointsKicker}>WALKING POINTS · 채원님</Text>
          <Text style={styles.pointsValue}>2,847P</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <View style={styles.pointsSubRow}>
            <Text style={styles.pointsSub}>LV.5까지 1,153P</Text>
            <Text style={styles.pointsSub}>오늘 +240P</Text>
          </View>
          <View style={styles.pointsMiniRow}>
            <LightMetric label="오늘 걸음" value="8,420" />
            <LightMetric label="연속" value="8일" />
            <LightMetric label="뱃지" value="12개" />
          </View>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryMeta}>2026 · MAY</Text>
          <View style={styles.metricRow}>
            <DarkOnMintMetric label="총 거리" value="9.1km" />
            <DarkOnMintMetric label="총 시간" value="02:19" />
            <DarkOnMintMetric label="산책일" value="8일" />
          </View>
        </View>
        <View style={styles.calendarCard}>
          <Text style={styles.cardTitle}>주간 활동</Text>
          <View style={styles.calendarGrid}>
            {Array.from({length: 28}).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.calendarCell,
                  index % 3 === 0 && styles.calendarCellMid,
                  index % 6 === 0 && styles.calendarCellStrong,
                ]}
              />
            ))}
          </View>
        </View>
        <Text style={styles.blockTitle}>최근 산책</Text>
        {recentWalks.map(walk => (
          <View key={walk.date} style={styles.historyRow}>
            <View style={styles.datePill}>
              <Text style={styles.dateText}>{walk.date}</Text>
            </View>
            <View style={styles.historyBody}>
              <Text style={styles.historyTitle}>{walk.course}</Text>
              <Text style={styles.historyMeta}>
                {walk.dist}km · {walk.time}
              </Text>
              <Text style={styles.historyNote}>"{walk.note}"</Text>
            </View>
            <Text style={styles.starText}>★ {walk.rating}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function MyPageTab({
  persona,
  setPersona,
  go,
}: {
  persona: PersonaId;
  setPersona: (persona: PersonaId) => void;
  go: (route: Route | TabName) => void;
}) {
  return (
    <View style={styles.pageSoft}>
      <ScreenHeader title="내 정보" right="설정" />
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>채</Text>
          </View>
          <View style={styles.profileBody}>
            <Text style={styles.profileName}>채원님</Text>
            <Text style={styles.profileEmail}>chaewon@gmail.com · 8일째 산책</Text>
          </View>
          <Text style={styles.editText}>편집</Text>
        </View>
        <Text style={styles.subhead}>AI 추천 페르소나</Text>
        <View style={styles.preferenceGrid}>
          {(Object.entries(personas) as [PersonaId, (typeof personas)[PersonaId]][]).map(
            ([id, item]) => {
              const active = id === persona;
              return (
                <Pressable
                  key={id}
                  onPress={() => setPersona(id)}
                  style={[
                    styles.preferenceCard,
                    active && {backgroundColor: item.color, borderColor: item.color},
                  ]}>
                  <Text style={styles.preferenceIcon}>{item.icon}</Text>
                  <Text style={[styles.preferenceTitle, active && styles.preferenceTitleActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.preferenceMeta, active && styles.preferenceMetaActive]}>
                    {id === 'killtime' ? '30분 내' : id === 'exercise' ? '심박↑' : '조용함'}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
        <View style={styles.metricRow}>
          <StatTile label="총 산책" value="23" unit="회" />
          <StatTile label="총 거리" value="84.2" unit="km" />
          <StatTile label="저장" value="6" unit="코스" />
        </View>
        {[
          ['저장한 코스', '6개'],
          ['산책 기록', '23회'],
          ['관심 태그', '#야경 #한강 +4'],
          ['AI 학습 데이터', '관리'],
        ].map(([label, meta]) => (
          <Pressable
            key={label}
            onPress={() => label === '산책 기록' && go('record')}
            style={styles.menuRow}>
            <Text style={styles.menuText}>{label}</Text>
            <Text style={styles.menuMeta}>{meta} ›</Text>
          </Pressable>
        ))}
        <View style={styles.menuRow}>
          <Text style={styles.menuText}>설정</Text>
          <Text style={styles.menuMeta}>›</Text>
        </View>
        <View style={styles.menuRow}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function CourseCard({
  course,
  rank,
  onPress,
}: {
  course: Course;
  rank?: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.courseCard}>
      <View style={styles.cardMap}>
        <MockMapView mode="overview" course={course} />
        {rank ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{rank}</Text>
          </View>
        ) : null}
        <View style={styles.typeBadge}>
          <Text style={[styles.typeBadgeText, {color: course.color}]}>
            {course.type === 'loop' ? '↻ 순환' : '→ 편도'}
          </Text>
        </View>
        <Text style={styles.moodText}>{course.mood}</Text>
      </View>
      <Text style={styles.cardTitle}>{course.title}</Text>
      <Text style={styles.cardSub}>{course.subtitle}</Text>
      <Text style={styles.cardMeta}>
        {course.distance}km · {course.duration}분 · {course.kcal}kcal
      </Text>
    </Pressable>
  );
}

function BottomNav({
  active,
  onChange,
}: {
  active: TabName;
  onChange: (tab: TabName) => void;
}) {
  return (
    <View style={styles.bottomNav}>
      {navItems.map(item => {
        const isActive = active === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => onChange(item.name)}
            style={styles.navItem}>
            <Text style={[styles.navIcon, isActive && styles.navActiveText]}>{item.icon}</Text>
            <Text style={[styles.navLabel, isActive && styles.navActiveText]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: string;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.headerBack}>
          <Text style={styles.headerBackText}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.headerBody}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={styles.headerRight}>{right}</Text> : null}
    </View>
  );
}

function ChatBubble({text}: {text: string}) {
  return (
    <View style={styles.chatLine}>
      <View style={styles.chatIcon}>
        <Text style={styles.chatIconText}>✳</Text>
      </View>
      <View style={styles.chatBubble}>
        <Text style={styles.chatText}>{text}</Text>
      </View>
    </View>
  );
}

function MyBubble({text}: {text: string}) {
  return (
    <View style={styles.myBubbleWrap}>
      <View style={styles.myBubble}>
        <Text style={styles.myBubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function Badge({label, color}: {label: string; color: string}) {
  return (
    <View style={[styles.badge, {backgroundColor: `${color}1f`}]}>
      <Text style={[styles.badgeText, {color}]}>{label}</Text>
    </View>
  );
}

function RoundButton({label}: {label: string}) {
  return (
    <View style={styles.roundButton}>
      <Text style={styles.roundButtonText}>{label}</Text>
    </View>
  );
}

function StatTile({label, value, unit}: {label: string; value: string; unit?: string}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </Text>
    </View>
  );
}

function DarkMetric({label, value, color = colors.card}: {label: string; value: string; color?: string}) {
  return (
    <View style={styles.darkMetric}>
      <Text style={styles.darkMetricLabel}>{label}</Text>
      <Text style={[styles.darkMetricValue, {color}]}>{value}</Text>
    </View>
  );
}

function LightMetric({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.lightMetric}>
      <Text style={styles.lightMetricLabel}>{label}</Text>
      <Text style={styles.lightMetricValue}>{value}</Text>
    </View>
  );
}

function DarkOnMintMetric({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.mintMetric}>
      <Text style={styles.mintMetricLabel}>{label}</Text>
      <Text style={styles.mintMetricValue}>{value}</Text>
    </View>
  );
}

function RoundDark({label}: {label: string}) {
  return (
    <View style={styles.roundDark}>
      <Text style={styles.roundDarkText}>{label}</Text>
    </View>
  );
}

function getCourse(id: string) {
  return courses.find(course => course.id === id) ?? courses[0];
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.card,
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.bgSoft,
  },
  fill: {
    flex: 1,
  },
  pageSoft: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    paddingBottom: 76,
  },
  homeMap: {
    height: 430,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
  },
  aiSearch: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    height: 58,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1.5,
    borderColor: '#aeead8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 4,
    ...shadows.soft,
  },
  searchSpark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSparkText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '900',
  },
  searchBody: {
    flex: 1,
  },
  searchMeta: {
    color: colors.mintDeep,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  searchQuestion: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  searchMic: {
    color: colors.mintDeep,
    fontSize: 11,
    fontWeight: '900',
    paddingRight: spacing.md,
  },
  suggestionScroller: {
    position: 'absolute',
    top: 80,
    left: 14,
    right: 0,
  },
  suggestionContent: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  suggestionChip: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    ...shadows.soft,
  },
  suggestionText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '700',
  },
  weatherPill: {
    position: 'absolute',
    top: 128,
    right: 14,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  weatherText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  mapControls: {
    position: 'absolute',
    top: 252,
    right: 14,
    gap: spacing.sm,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  roundButtonText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  homeSheet: {
    marginTop: -74,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    ...shadows.soft,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  segmentStrip: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillActive: {
    backgroundColor: colors.mintDeep,
    borderColor: colors.mintDeep,
  },
  pillText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: '800',
  },
  pillTextActive: {
    color: colors.card,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  inlineTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionSub: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionAction: {
    color: colors.mintDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  courseCarousel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  courseCard: {
    width: 230,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  cardMap: {
    height: 104,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
  },
  rankBadge: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: '900',
  },
  typeBadge: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  moodText: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.sm,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  cardSub: {
    color: colors.ink3,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  cardMeta: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  header: {
    minHeight: 60,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerBack: {
    marginLeft: -spacing.sm,
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '500',
  },
  headerBody: {
    flex: 1,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: colors.ink3,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  headerRight: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '800',
  },
  chatContent: {
    padding: spacing.lg,
    paddingBottom: 108,
    gap: spacing.md,
  },
  chatLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  chatIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  chatBubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chatText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  myBubbleWrap: {
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  myBubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.mintDeep,
  },
  myBubbleText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '700',
  },
  answerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: 38,
  },
  answerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.mint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  answerText: {
    color: colors.mintDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  recommendBubble: {
    marginLeft: 38,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.mint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recommendIcon: {
    width: 62,
    height: 62,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendMood: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 12,
  },
  recommendBody: {
    flex: 1,
  },
  recommendType: {
    fontSize: 11,
    fontWeight: '900',
  },
  recommendTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  recommendMeta: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  chevron: {
    color: colors.ink3,
    fontSize: 28,
  },
  chatButtons: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonSmall: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.mintDeep,
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  ghostButtonSmall: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  ghostButtonText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '900',
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },
  filterStrip: {
    gap: spacing.sm,
  },
  tagStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagFilter: {
    color: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  courseRow: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  courseRowBody: {
    flex: 1,
    justifyContent: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loopText: {
    fontSize: 10,
    fontWeight: '900',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  courseTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  courseSub: {
    color: colors.ink3,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  courseMeta: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  detailPage: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  detailMapWrap: {
    height: 280,
  },
  backCircle: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  heartCircle: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  circleIcon: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  detailSheet: {
    marginTop: -16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  detailBlurb: {
    color: colors.ink2,
    fontSize: 14,
    lineHeight: 21,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  statLabel: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: '800',
  },
  statValue: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  statUnit: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: '700',
  },
  blockTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  waypointList: {
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.line2,
    gap: spacing.sm,
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waypointDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: colors.card,
    marginLeft: -21,
  },
  waypointText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  startText: {
    fontSize: 10,
    fontWeight: '900',
  },
  moodTag: {
    color: colors.ink2,
    backgroundColor: colors.bgSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 12,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  startButton: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.mintDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '900',
  },
  scheduleButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButtonText: {
    color: colors.mintDeep,
    fontSize: 14,
    fontWeight: '900',
  },
  walkPage: {
    flex: 1,
    backgroundColor: '#0a0f12',
  },
  gameScene: {
    flex: 1,
    backgroundColor: '#10272d',
    overflow: 'hidden',
  },
  skyline: {
    position: 'absolute',
    left: -40,
    right: -20,
    top: 210,
    height: 120,
    backgroundColor: '#18383d',
    transform: [{rotate: '-8deg'}],
  },
  glowRoute: {
    position: 'absolute',
    top: 64,
    left: '53%',
    width: 18,
    height: 480,
    borderRadius: 12,
    opacity: 0.6,
    transform: [{rotate: '-14deg'}],
  },
  glowRouteDash: {
    position: 'absolute',
    top: 64,
    left: '55%',
    width: 5,
    height: 480,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.75)',
    transform: [{rotate: '-14deg'}],
  },
  buildingLeft: {
    position: 'absolute',
    left: 20,
    bottom: 210,
    width: 120,
    height: 120,
    backgroundColor: '#1b3338',
    transform: [{rotate: '-18deg'}],
  },
  buildingRight: {
    position: 'absolute',
    right: 26,
    bottom: 260,
    width: 150,
    height: 160,
    backgroundColor: '#172c32',
    transform: [{rotate: '16deg'}],
  },
  buildingBack: {
    position: 'absolute',
    left: 130,
    top: 180,
    width: 120,
    height: 110,
    backgroundColor: '#203c42',
    transform: [{rotate: '12deg'}],
  },
  avatarWalker: {
    position: 'absolute',
    left: '48%',
    top: '48%',
    width: 42,
    height: 60,
    alignItems: 'center',
  },
  avatarHead: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#d8b77a',
  },
  avatarBody: {
    width: 20,
    height: 30,
    borderRadius: 5,
    marginTop: -2,
  },
  walkTop: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  weatherDark: {
    borderRadius: 14,
    backgroundColor: 'rgba(20,28,28,0.75)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weatherDarkText: {
    color: colors.card,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  modeButton: {
    marginLeft: 'auto',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modeButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(20,28,28,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.card,
    fontSize: 24,
    fontWeight: '500',
  },
  nextTip: {
    position: 'absolute',
    top: 82,
    left: 52,
    right: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    padding: spacing.md,
    ...shadows.soft,
  },
  nextTipMeta: {
    color: colors.mintDeep,
    fontSize: 11,
    fontWeight: '900',
  },
  nextTipTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  walkPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: 'rgba(15,22,22,0.94)',
    padding: spacing.lg,
    paddingBottom: 28,
  },
  dragHandleDark: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  walkInfoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  walkInfoBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  walkMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
  },
  walkTitle: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  pointsBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  pointsBadgeText: {
    color: '#251706',
    fontSize: 11,
    fontWeight: '900',
  },
  progressLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  progressLineFill: {
    height: 6,
    borderRadius: 3,
  },
  walkStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  darkMetric: {
    flex: 1,
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  darkMetricLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
  },
  darkMetricValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  walkControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  roundDark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDarkText: {
    color: colors.card,
    fontSize: 20,
    fontWeight: '900',
  },
  pauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: {
    color: '#0a0f12',
    fontSize: 24,
    fontWeight: '900',
  },
  doneButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#b4463f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: colors.card,
    fontSize: 22,
    fontWeight: '900',
  },
  completedCard: {
    borderRadius: 18,
    padding: spacing.lg,
  },
  completedMeta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  completedTitle: {
    color: colors.card,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  completedStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  lightMetric: {
    flex: 1,
  },
  lightMetricLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
  },
  lightMetricValue: {
    color: colors.card,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  previewMap: {
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  starRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  star: {
    color: colors.line2,
    fontSize: 36,
  },
  starActive: {
    color: colors.gold,
  },
  reviewTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reviewTagActive: {
    borderColor: colors.mint,
    backgroundColor: colors.accentSoft,
  },
  reviewTagText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '800',
  },
  reviewTagTextActive: {
    color: colors.mintDeep,
  },
  aiLearnCard: {
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#b7eadc',
    padding: spacing.lg,
  },
  aiLearnTitle: {
    color: colors.mintDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  aiLearnBody: {
    color: colors.ink2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.mintDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '900',
  },
  monthRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  monthChip: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  monthChipActive: {
    backgroundColor: colors.mintDeep,
  },
  monthText: {
    color: colors.ink2,
    fontWeight: '900',
  },
  monthTextActive: {
    color: colors.card,
  },
  pointsCard: {
    borderRadius: radii.lg,
    backgroundColor: '#00563f',
    padding: spacing.lg,
  },
  pointsKicker: {
    color: '#b7eadc',
    fontSize: 11,
    fontWeight: '900',
  },
  pointsValue: {
    color: colors.card,
    fontSize: 34,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: spacing.md,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    width: '68%',
    backgroundColor: colors.gold,
  },
  pointsSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  pointsSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '800',
  },
  pointsMiniRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.mintDeep,
    padding: spacing.lg,
  },
  summaryMeta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  mintMetric: {
    flex: 1,
  },
  mintMetricLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
  },
  mintMetricValue: {
    color: colors.card,
    fontSize: 23,
    fontWeight: '900',
  },
  calendarCard: {
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  calendarCell: {
    width: '12.5%',
    aspectRatio: 1,
    borderRadius: 4,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  calendarCellMid: {
    backgroundColor: '#b9eadc',
  },
  calendarCellStrong: {
    backgroundColor: colors.mint,
  },
  historyRow: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    alignItems: 'center',
  },
  datePill: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    color: colors.mintDeep,
    fontSize: 10,
    fontWeight: '900',
  },
  historyBody: {
    flex: 1,
  },
  historyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  historyMeta: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: '800',
  },
  historyNote: {
    color: colors.ink2,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  starText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.mintDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.card,
    fontSize: 22,
    fontWeight: '900',
  },
  profileBody: {
    flex: 1,
  },
  profileName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  profileEmail: {
    color: colors.ink3,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  editText: {
    color: colors.mintDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  subhead: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: '900',
  },
  preferenceGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  preferenceCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    minHeight: 98,
    justifyContent: 'center',
  },
  preferenceIcon: {
    fontSize: 22,
  },
  preferenceTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  preferenceTitleActive: {
    color: colors.card,
  },
  preferenceMeta: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  preferenceMetaActive: {
    color: 'rgba(255,255,255,0.84)',
  },
  menuRow: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  menuMeta: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: '800',
  },
  logoutText: {
    color: '#d75b5b',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navIcon: {
    color: colors.ink3,
    fontSize: 22,
    fontWeight: '900',
  },
  navLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: '800',
  },
  navActiveText: {
    color: colors.mintDeep,
  },
  chatOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  chatSheet: {
    height: '80%',
    backgroundColor: colors.bgSoft,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...shadows.medium,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
  },
  chatCloseBtn: {
    padding: spacing.sm,
  },
  chatCloseBtnText: {
    fontSize: 20,
    color: colors.ink3,
    fontWeight: '700',
  },
});
