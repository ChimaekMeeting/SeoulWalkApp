# src/api

서버와 통신하는 API 함수들을 모아두는 폴더입니다.
공용 axios 인스턴스(`client.ts`)를 도메인별 파일(`prewalk.ts` 등)에서 import해 사용합니다.

```
src/api/
├─ client.ts     # 공용 axios 인스턴스 (baseURL, header, 토큰/에러 처리)
├─ prewalk.ts    # 프리워크 챗봇 관련 fetch 함수
└─ README.md
```

> 요청/응답 타입은 이 폴더가 아니라 `src/types/`에 정의합니다. (예: `src/types/prewalk.ts`)

---

### 1. fetch 함수를 작성 시 주의사항

- `client.ts`의 **client**를 사용해야 합니다. (`axios`를 직접 import해서 쓰지 않습니다.)
- 요청/응답 타입은 `src/types/`에서 import해 제네릭(`client.post<ChatResponse>`)으로 명시합니다.
- 응답에서 필요한 값(`data`)만 꺼내 반환합니다.

```ts
import { client } from './client';
import { ChatResponse, InitRequest } from '../types/prewalk';

/* 챗봇의 첫 번째 메시지를 제공합니다. */
export const getInitMessage = async (
  body: InitRequest,
): Promise<ChatResponse> => {
  const { data } = await client.post<ChatResponse>('/api/prewalk/init', body);
  return data;
};
```

### 2. 코드 스타일

- 프로젝트 Prettier 규칙을 따릅니다. (`.prettierrc.js`)
- **세미콜론 O**, **홑따옴표(single quote)**, **후행 쉼표(trailing comma)**
- 커밋 전 `npx prettier --write src/`로 포맷을 맞춰주세요.

---

### 그렇다면, client는 무슨 역할을 하는가?

- axios 기반 client로 baseURL, 토큰 처리 방법, header 등을 1개만 만들어, 전역적으로 공유할 수 있습니다.
- 설정을 한 곳(`client.ts`)에서 관리하므로, 서버 주소나 헤더가 바뀌어도 이 파일만 수정하면 됩니다.
- 인터셉터(interceptor)를 붙이면 **모든 요청에 토큰을 자동으로 주입**하거나, **모든 응답의 에러(401 등)를 한 곳에서 처리**할 수 있습니다.

```ts
// src/api/client.ts
import axios from 'axios';
import { env } from '../config/env';

/* 공용 axios 인스턴스 */
export const client = axios.create({
  baseURL: env.API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});
```
