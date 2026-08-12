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

// 디자인 시스템과 모바일 우선 반응형 규칙을 정적으로 확인합니다.
assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, "CSS 괄호가 맞지 않습니다.");
assert.match(css, /--blue-600:/, "Blue 상태 색상이 없습니다.");
assert.match(css, /--red-600:/, "Red 경고 색상이 없습니다.");
assert.match(css, /\.aircon-card\.is-danger/, "에어컨 비정상 Red 상태가 없습니다.");
assert.match(css, /\.weather-card\.is-danger/, "날씨 오류 Red 상태가 없습니다.");
assert.match(css, /@media\s*\(min-width:\s*\d+px\)/, "모바일 우선 반응형 구간이 없습니다.");

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

console.log(`Carrier GreenON static checks passed: ${dataHooks.size} UI hooks, ${rlsStatements.length} RLS tables`);
