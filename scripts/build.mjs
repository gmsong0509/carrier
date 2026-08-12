import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputRoot = path.resolve(projectRoot, "dist");

// 삭제 대상이 프로젝트 내부의 dist 폴더인지 확인한 뒤 이전 빌드만 정리합니다.
if (path.dirname(outputRoot) !== projectRoot || path.basename(outputRoot) !== "dist") {
  throw new Error("안전하지 않은 빌드 출력 경로입니다.");
}

/** 로컬 검증용 .env를 단순 KEY=VALUE 형식으로 읽습니다. */
async function readLocalEnvironment() {
  const environmentPath = path.join(projectRoot, ".env");

  try {
    await access(environmentPath);
    const source = await readFile(environmentPath, "utf8");

    return Object.fromEntries(
      source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const separatorIndex = line.indexOf("=");
          const key = line.slice(0, separatorIndex).trim();
          const value = line.slice(separatorIndex + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
          return [key, value];
        }),
    );
  } catch {
    return {};
  }
}

const localEnvironment = await readLocalEnvironment();
const runtimeEnvironment = globalThis.process?.env || {};
const supabaseUrl = runtimeEnvironment.SUPABASE_URL || localEnvironment.SUPABASE_URL;
const supabasePublishableKey = runtimeEnvironment.SUPABASE_PUBLISHABLE_KEY || localEnvironment.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl?.startsWith("https://") || !supabasePublishableKey?.startsWith("sb_publishable_")) {
  throw new Error("SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY 환경변수를 확인해 주세요.");
}

const publicFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "supabase-client.js",
  "weather-service.js",
  "assets/eco-polar-bear-pruni-cutout.png",
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await mkdir(path.join(outputRoot, "assets"), { recursive: true });
await Promise.all(
  publicFiles.map((fileName) => copyFile(path.join(projectRoot, fileName), path.join(outputRoot, fileName))),
);

// JSON.stringify로 값을 직렬화해 따옴표나 특수문자가 스크립트 문맥을 깨지 않게 합니다.
const runtimeConfig = `// Render 빌드 시 공개 환경변수에서 자동 생성됩니다.\nwindow.GREENON_CONFIG = Object.freeze({\n  supabaseUrl: ${JSON.stringify(supabaseUrl)},\n  supabasePublishableKey: ${JSON.stringify(supabasePublishableKey)},\n});\n`;
await writeFile(path.join(outputRoot, "runtime-config.js"), runtimeConfig, "utf8");

console.log(`Carrier GreenON production build complete: ${publicFiles.length + 1} files`);
