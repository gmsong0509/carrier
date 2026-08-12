import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");

async function readProjectFile(fileName) {
  return readFile(path.join(projectRoot, fileName), "utf8");
}

const [html, css, app, supabase, weather, schema, renderBlueprint, buildScript] = await Promise.all([
  readProjectFile("index.html"),
  readProjectFile("styles.css"),
  readProjectFile("app.js"),
  readProjectFile("supabase-client.js"),
  readProjectFile("weather-service.js"),
  readProjectFile("supabase/schema.sql"),
  readProjectFile("render.yaml"),
  readProjectFile("scripts/build.mjs"),
]);

// 세 파일을 실행하지 않고 파싱해 배포 전에 문법 오류를 잡습니다.
new vm.Script(app, { filename: "app.js" });
new vm.Script(weather, { filename: "weather-service.js" });
new vm.Script(`(async () => {${supabase}})`, { filename: "supabase-client.js" });

// JavaScript가 찾는 모든 data-* 요소가 실제 HTML에 존재하는지 확인합니다.
const selectorSources = [app, supabase, weather].join("\n");
const dataHooks = new Set(
  [...selectorSources.matchAll(/querySelector(?:All)?\(["']([^"']+)["']\)/g)]
    .flatMap((match) => match[1].match(/\[data-[a-z0-9-]+/gi) || [])
    .map((hook) => hook.slice(1)),
);

for (const hook of dataHooks) {
  assert.ok(html.includes(hook), `HTML에서 ${hook} 요소를 찾을 수 없습니다.`);
}

// Green 중심 ESG 디자인과 모바일 우선 반응형 규칙을 정적으로 확인합니다.
assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, "CSS 괄호가 맞지 않습니다.");
for (const [token, value] of Object.entries({
  "--green-600": "#1f9d68",
  "--green-800": "#157a55",
  "--green-500": "#22a06b",
  "--green-100": "#eaf8f1",
  "--green-50": "#f3fbf7",
  "--blue-600": "#2f80ed",
  "--blue-50": "#eaf4ff",
  "--red-600": "#e5484d",
  "--red-100": "#fff1f1",
  "--ink": "#1f2937",
  "--muted": "#6b7280",
  "--line": "#dcebe4",
  "--page": "#f6fbf8",
})) {
  assert.ok(css.includes(`${token}: ${value}`), `${token} 컬러 토큰이 ${value}가 아닙니다.`);
}

assert.match(css, /\.hero-card\s*{[^}]*var\(--green-600\)[^}]*var\(--green-800\)/s, "홈 대표 배너가 Green 중심이 아닙니다.");
assert.match(css, /\.home-mission\s*{[^}]*border-color:\s*var\(--green-200\)[^}]*var\(--green-50\)/s, "홈 미션 카드가 Green 중심이 아닙니다.");
assert.match(css, /\.progress-track__fill\s*{[^}]*var\(--green-500\)[^}]*var\(--green-800\)/s, "미션 진행률이 Green 중심이 아닙니다.");
assert.match(css, /\.wallet-card\s*{[^}]*var\(--green-600\)[^}]*var\(--green-800\)/s, "GREEN WALLET이 Green 중심이 아닙니다.");
assert.match(css, /\.nav-item\.is-active\s*{[^}]*var\(--green-800\)[^}]*var\(--green-50\)/s, "선택 내비게이션이 Green이 아닙니다.");
assert.match(css, /\.time-simulation-button\s*{[^}]*var\(--blue-600\)[^}]*var\(--blue-800\)/s, "에어컨 시간 제어가 Blue 중심이 아닙니다.");
assert.match(css, /\.aircon-card\.is-danger/, "에어컨 비정상 Red 상태가 없습니다.");
assert.match(css, /\.weather-card\.is-danger/, "날씨 오류 Red 상태가 없습니다.");
assert.match(css, /@media\s*\(min-width:\s*\d+px\)/, "모바일 우선 반응형 구간이 없습니다.");

// 실제 모바일 기기와 같은 좁은 화면에서도 레이아웃의 필수 조건이 유지되는지 확인합니다.
assert.match(
  html,
  /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1(?:\.0)?"\s*\/?>/i,
  "모바일 viewport 설정이 없습니다.",
);
assert.match(css, /html\s*{[^}]*min-width:\s*320px/s, "지원하는 최소 모바일 폭이 정의되지 않았습니다.");
assert.match(css, /\.app-shell\s*{[^}]*width:\s*100%[^}]*max-width:\s*720px/s, "앱 셸이 모바일 폭을 채우지 않습니다.");
assert.match(css, /\.bottom-nav\s*{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\)[^}]*width:\s*100%/s, "모바일 하단 메뉴가 4등분되지 않았습니다.");
assert.match(css, /env\(safe-area-inset-bottom\)/, "모바일 안전 영역 처리가 없습니다.");
assert.match(css, /@media\s*\(min-width:\s*600px\)/, "600px 이상 확장 레이아웃이 없습니다.");
assert.equal((html.match(/data-nav-view=/g) || []).length, 4, "모바일 하단 메뉴 항목 수가 4개가 아닙니다.");

// 조작 가능한 브라우저 저장소가 포인트나 구매 기록의 원본이 되지 않게 합니다.
assert.doesNotMatch(app, /localStorage\.setItem/, "localStorage 쓰기가 남아 있습니다.");
assert.match(app, /discardLegacyState/, "과거 임시 데이터 정리 함수가 없습니다.");
assert.match(supabase, /replaceState\(nextState, products\)[\s\S]*discardLegacyState\(\)/, "서버 데이터 로드 전 임시 상태를 삭제합니다.");

// 미션·포인트·상품·구매가 모두 Supabase 테이블을 기준으로 연결됐는지 확인합니다.
for (const tableName of ["profiles", "missions", "user_missions", "point_transactions", "rewards", "reward_orders", "aircon_status"]) {
  assert.ok(supabase.includes(`"${tableName}"`) || schema.includes(`public.${tableName}`), `${tableName} 연결이 없습니다.`);
}
assert.match(supabase, /@supabase\/supabase-js@\d+\.\d+\.\d+/, "Supabase JS 버전이 고정되지 않았습니다.");
assert.match(supabase, /sb_publishable_/, "브라우저용 publishable key 검사 규칙이 없습니다.");
assert.doesNotMatch(supabase, /sb_secret_[a-z0-9_-]{10,}/i, "브라우저 코드에 secret key가 있습니다.");

// 공개 스키마의 사용자 데이터 테이블에는 모두 RLS가 활성화되어야 합니다.
const rlsStatements = schema.match(/enable row level security/gi) || [];
assert.ok(rlsStatements.length >= 7, "RLS 활성화 구문이 7개보다 적습니다.");
assert.match(schema, /auth\.uid\(\)/, "사용자별 RLS 식별자가 없습니다.");
assert.doesNotMatch(schema, /create(?: or replace)? function public\.[\s\S]{0,300}security definer/i, "public 스키마에 SECURITY DEFINER 함수가 있습니다.");

// Render 빌드는 공개 환경변수만 받아 정적 dist 폴더를 배포해야 합니다.
assert.match(renderBlueprint, /runtime:\s*static/, "Render static runtime 설정이 없습니다.");
assert.match(renderBlueprint, /staticPublishPath:\s*\.\/dist/, "Render publish 경로가 dist가 아닙니다.");
assert.equal((renderBlueprint.match(/sync:\s*false/g) || []).length, 2, "Render 환경변수 placeholder 수가 다릅니다.");
assert.match(buildScript, /SUPABASE_URL/, "빌드에서 SUPABASE_URL을 읽지 않습니다.");
assert.match(buildScript, /SUPABASE_PUBLISHABLE_KEY/, "빌드에서 publishable key를 읽지 않습니다.");
assert.doesNotMatch(buildScript, /SUPABASE_SERVICE|SERVICE_ROLE|SECRET_KEY/i, "빌드가 비밀키를 요구합니다.");

// 로그인부터 리포트까지 전체 사용자 여정에 필요한 화면과 원격 저장 동작을 회귀 검사합니다.
for (const requiredHook of [
  "data-auth-form",
  "data-auth-signout",
  "data-mission-start",
  "data-simulate-time",
  "data-reward-list",
  "data-purchase-reward",
  "data-wallet-balance",
  "data-report-missions",
]) {
  assert.ok(html.includes(requiredHook), `전체 사용자 여정에 필요한 ${requiredHook} 요소가 없습니다.`);
}

for (const remoteAction of [
  "startRemoteMission",
  "advanceRemoteMission",
  "purchaseRemoteReward",
  "updateRemoteAircon",
  "refreshUserData",
]) {
  assert.ok(supabase.includes(`function ${remoteAction}`), `${remoteAction} 원격 동작이 없습니다.`);
}

for (const viewName of ["home", "mission", "reward", "my"]) {
  assert.ok(html.includes(`data-view-panel=\"${viewName}\"`), `${viewName} 화면이 없습니다.`);
}

console.log(`Carrier GreenON static checks passed: ${dataHooks.size} UI hooks, ${rlsStatements.length} RLS tables`);
