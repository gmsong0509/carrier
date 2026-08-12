// Supabase JS 버전을 고정해 예기치 않은 라이브러리 변경을 방지합니다.
const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8/+esm";

const authGate = document.querySelector("[data-auth-gate]");
const authForm = document.querySelector("[data-auth-form]");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const signupNameField = document.querySelector("[data-signup-name-field]");
const authMessage = document.querySelector("[data-auth-message]");
const authSubmitButton = document.querySelector("[data-auth-submit]");
const signoutButton = document.querySelector("[data-auth-signout]");

let authMode = "login";
let supabaseClient = null;
let currentSession = null;
let activeMissionId = null;
let currentUserMissionId = null;
let sessionRefreshId = 0;

/** 로그인 화면의 안내 또는 오류 메시지를 표시합니다. */
function setAuthMessage(message, type = "info") {
  authMessage.textContent = message;
  authMessage.hidden = !message;
  authMessage.classList.toggle("is-danger", type === "danger");
  authMessage.classList.toggle("is-success", type === "success");
}

function showAuthGate(message = "", type = "info") {
  document.body.classList.remove("auth-pending");
  document.body.classList.add("is-auth-locked");
  authGate.hidden = false;
  setAuthMessage(message, type);
}

function showAuthenticatedApp() {
  authGate.hidden = true;
  document.body.classList.remove("auth-pending", "is-auth-locked");
}

/** Supabase 오류를 사용자에게 보여 줄 수 있는 짧은 오류로 변환합니다. */
function createUserError(error, fallbackMessage) {
  const normalizedError = new Error(error?.message || fallbackMessage);
  normalizedError.code = error?.message?.includes("INSUFFICIENT_POINTS")
    ? "INSUFFICIENT_POINTS"
    : error?.code;

  if (error?.code === "23505") {
    normalizedError.userMessage = "오늘 이미 같은 미션에 참여했어요.";
  } else if (error?.message?.includes("INSUFFICIENT_POINTS")) {
    normalizedError.userMessage = "GREEN POINT가 부족해요.";
  } else if (error?.message?.includes("MISSION_NOT_ACTIVE")) {
    normalizedError.userMessage = "현재 진행 중인 미션이 아니에요.";
  } else if (error?.message?.includes("Invalid login credentials")) {
    normalizedError.userMessage = "이메일 또는 비밀번호를 확인해 주세요.";
  } else if (error?.message?.includes("Email not confirmed")) {
    normalizedError.userMessage = "이메일 인증을 완료한 뒤 로그인해 주세요.";
  } else {
    normalizedError.userMessage = fallbackMessage;
  }

  return normalizedError;
}

/** 한국 시간 기준 오늘 날짜를 YYYY-MM-DD 형식으로 반환합니다. */
function getKoreanDate() {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const partMap = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function requireUser() {
  const user = currentSession?.user;
  if (!user) throw createUserError(null, "로그인이 필요해요.");
  return user;
}

function throwIfError(error, fallbackMessage) {
  if (error) throw createUserError(error, fallbackMessage);
}

/**
 * RLS가 적용된 사용자별 데이터를 병렬로 읽어 앱 화면 상태로 변환합니다.
 * 인증 JWT는 Supabase 클라이언트가 모든 요청에 자동으로 첨부합니다.
 */
async function refreshUserData() {
  const user = requireUser();
  const today = getKoreanDate();

  const [
    profileResult,
    missionResult,
    userMissionResult,
    transactionResult,
    rewardResult,
    orderResult,
    airconResult,
  ] = await Promise.all([
    supabaseClient.from("profiles").select("display_name,green_points,lifetime_points,green_level").eq("id", user.id).maybeSingle(),
    supabaseClient.from("missions").select("id,code,title,description,reward_points,target_minutes,min_temperature,required_mode").eq("code", "healthy-cooling-26").single(),
    supabaseClient.from("user_missions").select("id,mission_id,status,progress_minutes,reward_granted,joined_at,completed_at").eq("user_id", user.id).eq("mission_date", today).maybeSingle(),
    supabaseClient.from("point_transactions").select("id,transaction_type,amount,description,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabaseClient.from("rewards").select("id,code,category,name,description,points_price,icon").eq("active", true).order("points_price", { ascending: true }),
    supabaseClient.from("reward_orders").select("id,reward_id,product_name,points_spent,status,created_at,rewards(icon)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabaseClient.from("aircon_status").select("power,mode,temperature,fan,usage_minutes,filter_percent,sensor_status").eq("user_id", user.id).maybeSingle(),
  ]);

  [
    [profileResult.error, "프로필을 불러오지 못했어요."],
    [missionResult.error, "오늘의 미션을 불러오지 못했어요."],
    [userMissionResult.error, "미션 참여 기록을 불러오지 못했어요."],
    [transactionResult.error, "포인트 내역을 불러오지 못했어요."],
    [rewardResult.error, "리워드 상품을 불러오지 못했어요."],
    [orderResult.error, "구매내역을 불러오지 못했어요."],
    [airconResult.error, "에어컨 상태를 불러오지 못했어요."],
  ].forEach(([error, message]) => throwIfError(error, message));

  const profile = profileResult.data;
  const userMission = userMissionResult.data;
  const aircon = airconResult.data;
  activeMissionId = missionResult.data.id;
  currentUserMissionId = userMission?.id || null;

  const nextState = {
    mission: {
      status: userMission?.status || "ready",
      progressMinutes: userMission?.progress_minutes || 0,
      joinedAt: userMission?.joined_at || null,
      completedAt: userMission?.completed_at || null,
      rewardGranted: userMission?.reward_granted || false,
    },
    aircon: {
      power: aircon?.power ?? true,
      mode: aircon?.mode || "COOL",
      temperature: aircon?.temperature ?? 26,
      fan: aircon?.fan || "AUTO",
      usageMinutes: aircon?.usage_minutes || 0,
      filterPercent: aircon?.filter_percent ?? 82,
      sensorStatus: aircon?.sensor_status || "normal",
    },
    wallet: {
      balance: profile?.green_points || 0,
      transactions: (transactionResult.data || []).map((transaction) => ({
        id: transaction.id,
        type: transaction.transaction_type,
        amount: transaction.amount,
        title: transaction.description,
        createdAt: transaction.created_at,
      })),
    },
    orders: (orderResult.data || []).map((order) => ({
      id: order.id,
      productId: order.reward_id,
      productName: order.product_name,
      icon: order.rewards?.icon || "🎁",
      price: order.points_spent,
      createdAt: order.created_at,
    })),
  };

  const products = (rewardResult.data || []).map((product) => ({
    id: product.id,
    code: product.code,
    category: product.category,
    name: product.name,
    description: product.description,
    price: product.points_price,
    icon: product.icon,
  }));

  window.greenOnApp.replaceState(nextState, products);
  // 서버 데이터가 모두 준비된 뒤에만 조작 가능한 과거 localStorage 값을 폐기합니다.
  // 이후 미션·포인트·구매·에어컨 상태의 단일 기준은 Supabase입니다.
  window.greenOnApp.discardLegacyState();
  window.greenOnApp.setUser({
    displayName: profile?.display_name || user.user_metadata?.display_name || "그리너",
    email: user.email,
  });

  return nextState;
}

async function startRemoteMission() {
  const user = requireUser();
  if (!activeMissionId) await refreshUserData();

  const { error } = await supabaseClient.from("user_missions").insert({
    user_id: user.id,
    mission_id: activeMissionId,
  });
  throwIfError(error, "미션 참여를 시작하지 못했어요.");
  await refreshUserData();
}

async function updateRemoteAircon(patch) {
  const user = requireUser();
  const columnMap = {
    filterPercent: "filter_percent",
    sensorStatus: "sensor_status",
    usageMinutes: "usage_minutes",
  };
  const databasePatch = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [columnMap[key] || key, value]),
  );

  const { error } = await supabaseClient
    .from("aircon_status")
    .update(databasePatch)
    .eq("user_id", user.id);
  throwIfError(error, "에어컨 상태를 저장하지 못했어요.");
  await refreshUserData();
}

async function advanceRemoteMission(currentProgress) {
  requireUser();
  if (!currentUserMissionId) throw createUserError(null, "진행 중인 미션이 없어요.");

  const { data, error } = await supabaseClient
    .from("user_missions")
    .update({ progress_minutes: currentProgress + 30 })
    .eq("id", currentUserMissionId)
    .select("status,progress_minutes")
    .single();
  throwIfError(error, "미션 시간을 진행하지 못했어요.");
  await refreshUserData();

  return {
    status: data.status,
    progressMinutes: data.progress_minutes,
  };
}

async function purchaseRemoteReward(rewardId) {
  const user = requireUser();
  const { error } = await supabaseClient.from("reward_orders").insert({
    user_id: user.id,
    reward_id: rewardId,
  });
  throwIfError(error, "상품을 구매하지 못했어요.");
  await refreshUserData();
}

function setAuthMode(nextMode) {
  authMode = nextMode;
  const isSignup = authMode === "signup";
  signupNameField.hidden = !isSignup;
  authSubmitButton.textContent = isSignup ? "회원가입" : "로그인";
  authForm.elements.password.autocomplete = isSignup ? "new-password" : "current-password";
  setAuthMessage("");

  authModeButtons.forEach((button) => {
    const isActive = button.dataset.authMode === authMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(authForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim() || "그리너";

  if (!email || !email.includes("@")) {
    setAuthMessage("올바른 이메일 주소를 입력해 주세요.", "danger");
    return;
  }

  if (password.length < 6) {
    setAuthMessage("비밀번호는 6자 이상 입력해 주세요.", "danger");
    return;
  }

  authSubmitButton.disabled = true;
  setAuthMessage(authMode === "signup" ? "회원가입을 진행하고 있어요." : "로그인하고 있어요.");

  try {
    if (authMode === "signup") {
      const redirectUrl = window.location.protocol === "file:"
        ? undefined
        : `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          ...(redirectUrl ? { emailRedirectTo: redirectUrl } : {}),
        },
      });
      throwIfError(error, "회원가입을 완료하지 못했어요.");

      if (!data.session) {
        setAuthMode("login");
        setAuthMessage("가입 확인 메일을 보냈어요. 이메일 인증 후 로그인해 주세요.", "success");
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      throwIfError(error, "로그인하지 못했어요.");
    }
  } catch (error) {
    setAuthMessage(error.userMessage || "인증 처리 중 오류가 발생했어요.", "danger");
  } finally {
    authSubmitButton.disabled = false;
  }
}

async function applySession(session) {
  const refreshId = ++sessionRefreshId;
  currentSession = session;

  if (!session) {
    activeMissionId = null;
    currentUserMissionId = null;
    showAuthGate();
    return;
  }

  try {
    await refreshUserData();
    if (refreshId === sessionRefreshId) showAuthenticatedApp();
  } catch (error) {
    showAuthenticatedApp();
    window.greenOnApp.showToast(error.userMessage || "사용자 데이터를 불러오지 못했어요.");
  }
}

async function initializeSupabase() {
  const config = window.GREENON_CONFIG || {};
  const isConfigured = config.supabaseUrl?.startsWith("https://")
    && config.supabasePublishableKey?.startsWith("sb_publishable_");

  if (!isConfigured) {
    showAuthGate("Supabase 공개 설정이 필요합니다. runtime-config.js를 확인해 주세요.", "danger");
    return;
  }

  try {
    const { createClient } = await import(SUPABASE_JS_URL);
    supabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    window.greenOnData = Object.freeze({
      isAuthenticated: () => Boolean(currentSession?.user),
      refresh: refreshUserData,
      startMission: startRemoteMission,
      updateAircon: updateRemoteAircon,
      advanceMission: advanceRemoteMission,
      purchaseReward: purchaseRemoteReward,
    });

    const { data, error } = await supabaseClient.auth.getSession();
    throwIfError(error, "로그인 상태를 확인하지 못했어요.");
    await applySession(data.session);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      // Auth 콜백 안에서 다른 Supabase 요청을 직접 기다리지 않도록 다음 작업 큐에서 처리합니다.
      window.setTimeout(() => applySession(session), 0);
    });
  } catch (error) {
    showAuthGate(error.userMessage || "Supabase 연결을 시작하지 못했어요.", "danger");
  }
}

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});
authForm.addEventListener("submit", handleAuthSubmit);
signoutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  signoutButton.disabled = true;

  const { error } = await supabaseClient.auth.signOut();
  signoutButton.disabled = false;

  if (error) {
    window.greenOnApp.showToast("로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
});

// classic defer 스크립트인 app.js가 먼저 초기화되지 않은 경우 DOM 준비까지 기다립니다.
if (!window.greenOnApp && document.readyState === "loading") {
  await new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
}

initializeSupabase();
