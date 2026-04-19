# 직관노트

KBO 직관 기록 앱. 내가 직접 관람한 야구 경기를 기록하고, 구단 일정을 조회하며, 직관 히스토리를 관리할 수 있습니다.

---

## 프로젝트 개요

**직관노트**는 KBO(한국야구위원회) 팬을 위한 모바일 앱입니다. 응원하는 구단을 선택하고, 직접 관람한 경기를 기록하고, 승·패·무 결과와 좌석 정보를 저장할 수 있습니다. Firebase 기반의 실시간 백엔드로 일정 데이터를 제공하며, 관리자 페이지를 통해 경기 일정을 관리합니다.

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | [Expo](https://expo.dev) ~54 / React Native 0.81 / React 19 |
| 언어 | TypeScript 5.9 |
| 라우팅 | Expo Router 6 (파일 기반 라우팅) |
| 백엔드 | Firebase Firestore, Firebase Authentication, Firebase Storage |
| 소셜 로그인 | Google (`expo-auth-session`), Apple (`expo-apple-authentication`), Kakao (OAuth + Cloud Function) |
| 상태 관리 | React Context API |
| 로컬 저장소 | AsyncStorage |
| 내비게이션 | React Navigation (Bottom Tabs) |
| 날짜 처리 | date-fns (한국어 로케일) |
| 아이콘 | @expo/vector-icons, lucide-react-native |
| 배포 | Vercel (Web), Expo (iOS/Android) |

---

## 프로젝트 구조

```
kbo-ticket-book/
├── app/                        # Expo Router 라우트
│   ├── _layout.tsx             # 루트 레이아웃
│   ├── (app)/                  # 사용자 앱 영역
│   │   ├── _layout.tsx         # 인증 가드 및 온보딩 분기
│   │   ├── login.tsx           # 소셜 로그인 화면
│   │   ├── onboarding.tsx      # 구단 선택 (첫 실행)
│   │   ├── settings.tsx        # 응원 구단 변경
│   │   ├── modal.tsx
│   │   ├── record/[id].tsx     # 기록 상세 / 수정
│   │   └── (tabs)/             # 탭 내비게이션
│   │       ├── _layout.tsx
│   │       ├── index.tsx       # 홈 (내 직관 기록 목록)
│   │       ├── new.tsx         # 기록 추가
│   │       └── schedule.tsx    # KBO 경기 일정
│   └── admin/                  # 관리자 영역
│       ├── _layout.tsx         # 관리자 인증 가드
│       ├── login.tsx           # 관리자 로그인
│       ├── index.tsx           # 대시보드
│       ├── users.tsx           # 유저 관리
│       └── games/              # 경기 일정 CRUD
│           ├── index.tsx
│           └── [id].tsx
├── src/
│   ├── config/
│   │   └── firebase.ts         # Firebase 초기화
│   └── hooks/
│       └── useSocialAuth.ts    # Google / Apple / Kakao 인증 로직
├── context/
│   ├── ThemeContext.tsx         # 응원 구단 전역 상태
│   └── FilterContext.tsx        # 연도 필터 전역 상태
├── constants/
│   ├── teams.ts                # 10개 구단 데이터 (색상, 로고)
│   └── theme.ts
├── hooks/                      # 공통 커스텀 훅
├── components/                 # 공통 UI 컴포넌트
│   └── ui/
├── assets/images/              # 앱 아이콘, 스플래시, 구단 로고
├── .env.example                # 환경 변수 템플릿
├── app.json                    # Expo 앱 설정
└── vercel.json                 # Vercel 배포 설정
```

---

## 핵심 기능

### 1. 소셜 로그인
앱 최초 실행 시 로그인 화면이 표시됩니다.

| 제공자 | 지원 플랫폼 |
|--------|------------|
| Google | iOS / Android / Web |
| Apple | iOS |
| Kakao | iOS / Android / Web |
| 게스트 (익명) | 전 플랫폼 |

> Kakao 로그인은 Firebase Custom Token 발급을 위한 별도 백엔드 엔드포인트가 필요합니다.

---

### 2. 온보딩 — 응원 구단 선택
최초 로그인 후 응원하는 KBO 구단을 선택합니다. 선택한 구단의 색상이 앱 전체 테마에 적용됩니다.

지원 구단: KIA 타이거즈, 삼성 라이온즈, LG 트윈스, 두산 베어스, KT 위즈, SSG 랜더스, NC 다이노스, 롯데 자이언츠, 한화 이글스, 키움 히어로즈

---

### 3. 직관 기록 목록 (홈)
- 연도별로 필터링하여 내 직관 기록 카드를 확인
- 해당 연도 총 직관 횟수 표시
- 기록 삭제 (확인 다이얼로그)
- 카드 탭 시 상세 화면으로 이동

---

### 4. 기록 추가
- 경기 일정에서 게임을 선택하면 날짜·팀·경기장이 자동 입력
- 홈/어웨이 응원 팀 선택
- 스코어 기반 자동 승·패·무 계산
- 좌석 정보 직접 입력
- 같은 날짜 기록 중복 방지

---

### 5. KBO 경기 일정
- 월별 경기 일정 조회 (3월~10월 시즌)
- TODAY 뱃지, 경기 결과(스코어), 예정·취소 상태 표시
- 경기 카드에서 바로 기록 추가 버튼 제공
- 이미 기록된 경기는 "기록됨" 뱃지 표시

---

### 6. 기록 상세 / 수정
- 스코어보드 형태의 결과 표시
- 좌석 정보 및 응원 팀 수정 가능
- 수정 시 승·패·무 자동 재계산
- 기록 삭제

---

### 7. 설정 — 응원 구단 변경
- 2열 그리드로 10개 구단 선택
- 선택 즉시 앱 테마 색상 변경
- AsyncStorage에 영속 저장

---

### 8. 관리자 페이지 (`/admin`)
별도 이메일/비밀번호 로그인으로 접근합니다.

- **경기 일정 관리**: 연도·월 필터, 경기 추가·수정·삭제 (CRUD)
- **유저 관리**: 준비 중
- **대시보드**: 요약 지표 (준비 중)

---

## Firebase 데이터 구조

### `records` 컬렉션
사용자의 직관 기록을 저장합니다.

```typescript
{
  id: string;
  userId: string;
  date: string;          // "YYYY-MM-DD"
  day: string;
  matchup: string;       // "원정팀 vs 홈팀"
  result: 'WIN' | 'LOSE' | 'DRAW' | 'SCHEDULED';
  score: string;         // "3:2"
  stadium: string;
  seat: string;
  myTeamSide: 'HOME' | 'AWAY';
  createdAt: Timestamp;
}
```

### `games` 컬렉션
관리자가 등록한 KBO 공식 경기 일정입니다.

```typescript
{
  id: string;
  date: string;          // "YYYY-MM-DD"
  time: string;          // "HH:mm"
  homeTeamId: string;
  awayTeamId: string;
  stadium: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'playing' | 'finished' | 'canceled';
}
```

---

## 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고 각 항목을 채웁니다.

```bash
cp .env.example .env
```

### 발급 위치 안내

| 변수 | 발급처 |
|------|--------|
| `EXPO_PUBLIC_FIREBASE_*` | [Firebase Console](https://console.firebase.google.com) → 프로젝트 설정 → 앱 |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Firebase Console → Authentication → Google 활성화 후 확인, 또는 Google Cloud Console → 사용자 인증 정보 |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Cloud Console → 사용자 인증 정보 → iOS 앱용 OAuth 클라이언트 ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google Cloud Console → 사용자 인증 정보 → Android 앱용 OAuth 클라이언트 ID |
| `EXPO_PUBLIC_KAKAO_REST_API_KEY` | [Kakao Developers](https://developers.kakao.com) → 애플리케이션 → 앱 키 → REST API 키 |
| `EXPO_PUBLIC_KAKAO_CUSTOM_TOKEN_ENDPOINT` | Kakao 액세스 토큰 → Firebase 커스텀 토큰 변환용 Cloud Function URL |

> **Apple 로그인**: 별도 환경 변수 없음. [Apple Developer Console](https://developer.apple.com) → Identifiers → 앱 Bundle ID → Sign In with Apple 활성화 필요.

---

## 시작하기

### 의존성 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm start          # Expo 개발 서버
npm run ios        # iOS 시뮬레이터
npm run android    # Android 에뮬레이터
npm run web        # 웹 브라우저
```

### 웹 빌드
```bash
npm run build      # dist/ 폴더로 정적 빌드
```

---

## Firebase 설정

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Authentication → Sign-in method에서 다음 활성화:
   - 이메일/비밀번호 (관리자용)
   - Google
   - Apple
   - 익명
3. Firestore Database 생성 (프로덕션 모드 권장)
4. 발급받은 설정값을 `.env` 파일에 입력
