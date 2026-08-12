# Carrier GreenON

Carrier GreenON은 가상의 캐리어 에어컨 상태를 이용해 친환경 냉방 미션을 수행하고, GREEN POINT를 모아 리워드를 구매하는 모바일 우선 웹앱입니다. 실제 에어컨 API에는 연결하지 않습니다.

## 주요 흐름

회원가입/로그인 → 서울 현재 날씨와 가상 에어컨 확인 → 오늘의 미션 참여 → 30분 단위 시뮬레이션 → 미션 성공 및 포인트 적립 → GREEN WALLET 확인 → REWARD SHOP 구매 → 구매내역과 GREEN REPORT 확인

## 기술 구성

- HTML, CSS, Vanilla JavaScript 정적 프런트엔드
- Supabase Auth, Postgres, RLS
- Open-Meteo 현재 날씨 API
- Render Static Site

White + Blue를 기본으로 사용하고, 필터 점검·센서 오류·미션 조건 위반·포인트 부족·외부 API 오류에만 Red 계열 상태를 표시합니다.

## 로컬 설정

1. `.env.example`을 `.env`로 복사합니다.
2. Supabase 프로젝트의 URL과 브라우저용 publishable key를 입력합니다.
3. `supabase/schema.sql`을 Supabase SQL Editor에서 실행합니다.
4. 개발용 정적 서버로 프로젝트 루트를 엽니다. `file://` 대신 HTTP 서버를 사용해야 인증 리디렉션을 정상적으로 확인할 수 있습니다.

브라우저 코드에는 `service_role`, secret key, 데이터베이스 비밀번호를 넣지 마세요. publishable key는 공개 식별자이며 실제 접근 통제는 Postgres 권한과 RLS가 담당합니다.

## Production build

Node.js 20 이상에서 실행합니다.

```bash
npm run build
```

빌드 스크립트는 필요한 정적 파일만 `dist`에 복사하고, 환경변수로부터 `dist/runtime-config.js`를 생성합니다. 실제 `.env`, 로컬 `runtime-config.js`, Supabase SQL 파일은 배포 결과물에 포함하지 않습니다.

## 자동 검사

```bash
npm test
```

자동 검사는 JavaScript 구문, HTML 데이터 훅, White + Blue/Red 상태 스타일, localStorage 쓰기 제거, Supabase 테이블·RLS 연결, Render 환경변수 구조를 확인합니다. 실제 계정과 배포 URL이 필요한 검사는 `QA.md` 순서대로 수행합니다.

## Render 배포

저장소 루트의 `render.yaml`을 Blueprint로 연결하거나 Static Site를 직접 생성합니다.

- Build Command: `npm run build`
- Publish Directory: `dist`
- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_PUBLISHABLE_KEY`: `sb_publishable_`로 시작하는 브라우저용 키
- `SKIP_INSTALL_DEPS`: `true`

배포 URL이 정해지면 Supabase Auth의 Site URL과 Redirect URLs에 해당 HTTPS 주소를 추가합니다. 이메일 확인 링크와 로그인 복귀 경로가 배포 사이트를 가리키는지 확인해야 합니다.

## 데이터와 보안

데이터베이스 정의는 `supabase/schema.sql`에 있습니다. 사용자별 프로필, 미션 참여, 포인트 거래, 구매내역, 가상 에어컨 상태는 `auth.uid()` 기반 RLS로 분리됩니다. 포인트 지급과 구매 차감은 클라이언트가 잔액을 직접 수정하지 않고 데이터베이스 트리거에서 검증합니다.

## 점검 기준

진행상황은 `CHECKLIST.md`에서 관리합니다. 각 단계는 구문/빌드 검사, 기존 흐름 회귀 검사, Supabase RLS 검사 후 완료 처리합니다. 실제 이메일 확인과 서로 다른 기기 세션이 필요한 항목은 배포 URL에서 별도로 검증합니다.
