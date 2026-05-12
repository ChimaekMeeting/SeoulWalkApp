# 👟 SeoulWalkApp
서울시 산책경로 추천 및 움직임 유도 플랫폼

> 사용자의 위치를 기반으로 최적의 산책 경로를 추천하고, 게이미피케이션 요소를 통해 지속적인 움직임을 유도하는 모바일 플랫폼입니다.

---

### 🛠 기술 스택 (Tech Stack)
#### Frontend
- **Framework**: React Native (CLI)
- **Map Engine**: Mapbox SDK for React Native
- **Animation**: React Native Reanimated, Lottie
- **State Management**: Zustand / React Query

---

### 📌 협업 규칙 (Git Convention)
본 프로젝트는 GitHub Issue 기반으로 작업을 진행합니다. 등록된 이슈 템플릿에 맞춰 이슈를 생성한 뒤, 해당 이슈 번호를 브랜치명에 포함하여 작업합니다.

#### 브랜치 명명 규칙 (Branch Naming)
**형식:** `태그/#이슈번호` (또는 `태그/이슈번호`)
*(예시: `feat/#1`, `bugfix/#12`, `setting/#3`)*

#### 이슈 태그 가이드 (Issue Templates)
| 태그 (Tag) | 설명 |
| :--- | :--- |
| `setting` | ⚙️ 개발 환경 세팅 및 패키지 설치 |
| `feat` | ✨ 새로운 기능 개발 |
| `bugfix` | 🐞 버그 및 에러 수정 |
| `refactor` | 🔨 코드 구조 개선 (기능 변화 없음) |
| `docs` | 📄 README 등 문서 작성 및 수정 |
| `test` | ✅ 테스트 코드 작성 |
| `deploy` | 🌍 배포 관련 작업 |

> **작업 플로우:** > Issue 생성 ➔ 브랜치 생성(`feat/#이슈번호`) ➔ 작업 및 Commit ➔ PR(Pull Request) ➔ Review 후 `dev` 브랜치에 Merge