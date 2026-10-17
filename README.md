# Share App

커플의 일상을 함께 기록하고 공유하는 앱. 인스타그램처럼 사진과 일정, 위시리스트를
웹과 안드로이드(추후 iOS)에서 사용할 수 있는 하이브리드 앱입니다.

**기술 스택**: Expo SDK 54 · React Native · expo-router · Supabase (Storage + DB)

## 기능

| 탭 | 내용 |
|---|---|
| 홈 | 시작일을 입력하면 매일 만난 날 수(+D-day)를 표시 |
| 사진 | 사진 업로드 · 3열 그리드 · 상세(확대/핀치줌, 위치정보) · 다중 선택 삭제 |
| 캘린더 | 스케줄·기념일 등록/수정/삭제 · 지난 날짜는 취소선으로 완료 표시 |
| 위시 | 가고 싶은 곳/하고 싶은 일 메모 · 수정/삭제 · 완료 시 취소선 표시 |

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env` 파일을 만들고 Supabase 프로젝트 정보를 입력하세요.

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### 3. Supabase DB 준비 (1회)

Supabase 대시보드 → **SQL Editor** 에서
[`supabase/migrations/0001_calendar_and_wish.sql`](supabase/migrations/0001_calendar_and_wish.sql)
파일 내용을 통째로 실행하세요. `events`(캘린더)와 `wishes`(위시) 테이블이 생성됩니다.

> 사진 기능은 이미 생성된 `photos` 테이블과 `photos` 스토리지 버킷을 사용합니다.

### 4. 실행

```bash
npx expo start          # 개발 서버 (웹/안드로이드/iOS 시뮬레이터)
npx expo start --web    # 웹에서 실행
npx expo start --android # 안드로이드에서 실행
```

## 빌드

```bash
npx expo export --platform web   # 웹 정적 빌드 (dist/)
eas build --platform android     # 안드로이드 빌드 (EAS)
```

## 프로젝트 구조

```
app/
  _layout.tsx           # 루트 스택 + GestureHandlerRootView
  (tabs)/               # 하단 탭: 홈 · 사진 · 캘린더 · 위시
    index.tsx           # 홈 (D-day)
    photos.tsx          # 사진 그리드
    calendar.tsx        # 캘린더
    wish.tsx            # 위시
  photo/[id].tsx        # 사진 상세 (핀치줌·위치·다중선택 삭제)
lib/
  supabase.ts           # Supabase 클라이언트
  photos.ts             # 사진 업로드/조회/삭제 (EXIF·GPS 처리)
  calendar.ts           # 캘린더 CRUD
  wishes.ts             # 위시 CRUD
  dates.ts              # 날짜 유틸
  storage.ts            # AsyncStorage (시작일)
  types.ts              # 공용 타입
supabase/migrations/    # DB 마이그레이션 SQL
```
