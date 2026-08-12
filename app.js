// Carrier GreenON의 화면 이름을 한곳에서 관리합니다.
// 이후 기능이 늘어나도 이 목록을 기준으로 안전하게 화면을 전환할 수 있습니다.
const VIEW_NAMES = ["home", "mission", "reward", "my"];

const viewPanels = document.querySelectorAll("[data-view-panel]");
const navigationButtons = document.querySelectorAll("[data-nav-view]");
const directViewButtons = document.querySelectorAll("[data-go-view]");
const toastButtons = document.querySelectorAll("[data-toast]");
const toast = document.querySelector(".toast");
const missionStartButton = document.querySelector("[data-mission-start]");
const missionProgressValue = document.querySelector("[data-mission-progress-value]");
const missionProgressLabel = document.querySelector("[data-mission-progress-label]");
const missionProgressBar = document.querySelector("[data-mission-progressbar]");
const missionProgressFill = document.querySelector("[data-mission-progress-fill]");
const missionNotice = document.querySelector("[data-mission-notice] p");
const homeMissionStatus = document.querySelector("[data-home-mission-status]");
const todayLabel = document.querySelector("[data-today-label]");
const missionDetailCard = document.querySelector(".mission-detail-card");
const missionConditionTemperature = document.querySelector("[data-condition-temperature]");
const missionConditionDuration = document.querySelector("[data-condition-duration]");
const missionConditionMode = document.querySelector("[data-condition-mode]");
const missionConditionRows = document.querySelectorAll("[data-mission-condition]");

const airconCard = document.querySelector("[data-aircon-card]");
const airconHealth = document.querySelector("[data-aircon-health]");
const airconPower = document.querySelector("[data-aircon-power]");
const airconMode = document.querySelector("[data-aircon-mode]");
const airconTemperature = document.querySelector("[data-aircon-temperature]");
const airconFan = document.querySelector("[data-aircon-fan]");
const airconUsage = document.querySelector("[data-aircon-usage]");
const airconFilter = document.querySelector("[data-aircon-filter]");
const airconDeviceTemp = document.querySelector("[data-aircon-device-temp]");
const airconMessage = document.querySelector("[data-aircon-message]");
const airconMessageText = document.querySelector("[data-aircon-message] p");
const airconTempStat = document.querySelector("[data-aircon-temp-stat]");
const airconFilterStat = document.querySelector("[data-aircon-filter-stat]");
const controlTemperature = document.querySelector("[data-control-temperature]");
const controlPower = document.querySelector("[data-control-power]");
const controlMode = document.querySelector("[data-control-mode]");
const controlFan = document.querySelector("[data-control-fan]");
const tempDownButton = document.querySelector("[data-aircon-temp-down]");
const tempUpButton = document.querySelector("[data-aircon-temp-up]");
const powerToggleButton = document.querySelector("[data-aircon-power-toggle]");
const modeToggleButton = document.querySelector("[data-aircon-mode-toggle]");
const fanToggleButton = document.querySelector("[data-aircon-fan-toggle]");
const simulateTimeButton = document.querySelector("[data-simulate-time]");
const simulationPresetButtons = document.querySelectorAll("[data-sim-preset]");
const walletBalance = document.querySelector("[data-wallet-balance]");
const walletEarned = document.querySelector("[data-wallet-earned]");
const walletSpent = document.querySelector("[data-wallet-spent]");
const walletTransactions = document.querySelector("[data-wallet-transactions]");
const transactionCount = document.querySelector("[data-transaction-count]");
const shopBalance = document.querySelector("[data-shop-balance]");
const rewardCategoryButtons = document.querySelectorAll("[data-reward-category]");
const rewardList = document.querySelector("[data-reward-list]");
const rewardCount = document.querySelector("[data-reward-count]");
const orderList = document.querySelector("[data-order-list]");
const orderCount = document.querySelector("[data-order-count]");
const rewardModal = document.querySelector("[data-reward-modal]");
const rewardModalSheet = document.querySelector("[data-reward-modal-sheet]");
const rewardModalCloseButtons = document.querySelectorAll("[data-reward-modal-close]");
const rewardModalIcon = document.querySelector("[data-reward-modal-icon]");
const rewardModalCategory = document.querySelector("[data-reward-modal-category]");
const rewardModalName = document.querySelector("[data-reward-modal-name]");
const rewardModalDescription = document.querySelector("[data-reward-modal-description]");
const rewardModalPrice = document.querySelector("[data-reward-modal-price]");
const purchaseWarning = document.querySelector("[data-purchase-warning]");
const purchaseRewardButton = document.querySelector("[data-purchase-reward]");
const levelIcon = document.querySelector("[data-level-icon]");
const levelName = document.querySelector("[data-level-name]");
const levelMessage = document.querySelector("[data-level-message]");
const levelPoints = document.querySelector("[data-level-points]");
const levelProgressBar = document.querySelector("[data-level-progressbar]");
const levelProgressFill = document.querySelector("[data-level-progress-fill]");
const reportMissions = document.querySelector("[data-report-missions]");
const reportEnergy = document.querySelector("[data-report-energy]");
const reportCarbon = document.querySelector("[data-report-carbon]");
const reportOrders = document.querySelector("[data-report-orders]");
const headerUserName = document.querySelector("[data-header-user-name]");
const profileUserName = document.querySelector("[data-profile-user-name]");
const profileUserEmail = document.querySelector("[data-profile-user-email]");

// 이전 개발 단계에서 사용한 브라우저 임시 저장소의 이름입니다.
// 포인트와 구매 기록은 사용자가 조작할 수 있는 localStorage를 신뢰하지 않고,
// Supabase 데이터 로드가 성공한 뒤 이 키만 안전하게 제거합니다.
const LEGACY_STORAGE_KEY = "carrier-greenon-state-v1";
const MISSION_TARGET_MINUTES = 120;

// 상품은 인증 후 Supabase rewards 테이블에서만 받아옵니다.
let rewardProducts = [];

const defaultState = {
  mission: {
    status: "ready",
    progressMinutes: 0,
    joinedAt: null,
  },
  aircon: {
    power: true,
    mode: "COOL",
    temperature: 26,
    fan: "AUTO",
    usageMinutes: 0,
    filterPercent: 82,
    sensorStatus: "normal",
  },
  wallet: {
    balance: 0,
    transactions: [],
  },
  orders: [],
};

let toastTimer;

/**
 * Supabase에 저장된 사용자 데이터를 정상적으로 읽은 뒤에만 과거 임시 데이터를 지웁니다.
 * 클라이언트가 만든 포인트나 구매 기록을 서버로 복사하면 위조가 가능하므로 가져오지 않습니다.
 */
function discardLegacyState() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    // 저장소 사용이 차단된 브라우저에서도 앱 이용은 계속할 수 있습니다.
    console.warn("이전 GreenON 임시 데이터를 정리하지 못했습니다.", error);
  }
}

/** Supabase 로그인 후에는 서버 데이터 어댑터를 사용합니다. */
function usesRemoteData() {
  return Boolean(window.greenOnData?.isAuthenticated?.());
}

// 실제 사용자 데이터는 로그인 뒤 Supabase 응답으로 교체됩니다.
// 초기값은 인증 화면 뒤에 잠시 표시되는 화면 골격용이며 저장되지 않습니다.
let appState = structuredClone(defaultState);
let selectedRewardId = null;
let selectedRewardCategory = "ALL";

/**
 * 주소의 해시값에서 현재 화면 이름을 가져옵니다.
 * 잘못된 주소가 들어오면 기본 화면인 홈을 보여 줍니다.
 */
function getViewFromHash() {
  const hashView = window.location.hash.replace("#", "");
  return VIEW_NAMES.includes(hashView) ? hashView : "home";
}

/**
 * 선택한 화면만 표시하고 하단 메뉴의 활성 상태도 함께 변경합니다.
 * hidden 속성은 화면 읽기 도구가 숨겨진 화면을 읽지 않도록 도와줍니다.
 */
function renderView(viewName) {
  viewPanels.forEach((panel) => {
    const isCurrentView = panel.dataset.viewPanel === viewName;
    panel.hidden = !isCurrentView;
    panel.classList.toggle("is-active", isCurrentView);
  });

  navigationButtons.forEach((button) => {
    const isCurrentView = button.dataset.navView === viewName;
    button.classList.toggle("is-active", isCurrentView);

    if (isCurrentView) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  // 화면을 바꾸면 사용자가 새 화면의 처음부터 볼 수 있도록 위로 이동합니다.
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 선택한 화면 이름을 주소에 반영합니다.
 * 같은 화면을 다시 누른 경우에는 불필요한 방문 기록을 만들지 않습니다.
 */
function navigateTo(viewName) {
  if (!VIEW_NAMES.includes(viewName)) return;

  const nextHash = `#${viewName}`;

  if (window.location.hash === nextHash) {
    renderView(viewName);
    return;
  }

  window.location.hash = nextHash;
}

/**
 * 짧은 안내 문구를 토스트로 보여 줍니다.
 * 현재는 기본 UI 확인용이며, 이후 알림 기능과 연결할 수 있습니다.
 */
function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;

  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

/**
 * 미션 참여 상태와 진행률을 화면의 모든 관련 요소에 반영합니다.
 * 실제 에어컨 조건 판정은 다음 IoT 시뮬레이션 단계에서 연결합니다.
 */
function renderMission() {
  const { status, progressMinutes } = appState.mission;
  const safeMinutes = Math.min(Math.max(Number(progressMinutes) || 0, 0), MISSION_TARGET_MINUTES);
  const progressPercent = (safeMinutes / MISSION_TARGET_MINUTES) * 100;
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";

  missionProgressValue.textContent = String(safeMinutes);
  missionProgressLabel.textContent = isCompleted
    ? "미션 성공"
    : isFailed
      ? "미션 실패"
      : isActive
        ? "미션 진행 중"
        : "참여 전";
  missionProgressBar.setAttribute("aria-valuenow", String(safeMinutes));
  missionProgressFill.style.width = `${progressPercent}%`;

  missionStartButton.disabled = isActive || isCompleted;
  missionStartButton.textContent = isCompleted
    ? "오늘의 미션 완료"
    : isFailed
      ? "미션 다시 시작하기"
      : isActive
        ? "미션 진행 중"
        : "미션 시작하기";

  missionDetailCard.classList.toggle("is-danger", isFailed);
  missionDetailCard.classList.toggle("is-success", isCompleted);
  missionNotice.parentElement.classList.toggle("is-danger", isFailed);
  missionNotice.parentElement.classList.toggle("is-success", isCompleted);

  missionNotice.textContent = isCompleted
    ? "미션 성공! GREEN WALLET에 300P가 안전하게 지급됐어요."
    : isFailed
      ? "미션 조건을 지키지 못했어요. 에어컨을 정상 상태로 바꾼 뒤 다시 도전해 주세요."
      : isActive
        ? "미션 진행 중이에요. 홈에서 에어컨 상태를 확인하고 30분씩 진행해 보세요."
        : "참여를 시작하면 가상 에어컨 데이터로 진행 상황을 확인할 수 있어요.";

  homeMissionStatus.textContent = isCompleted
    ? "성공"
    : isFailed
      ? "조건 위반"
      : isActive
        ? "진행 중"
        : "참여 전";
  homeMissionStatus.classList.toggle("is-active", isActive);
  homeMissionStatus.classList.toggle("is-danger", isFailed);
  homeMissionStatus.classList.toggle("is-success", isCompleted);
}

/** 미션 참여 버튼을 누르면 시작 시각과 상태를 저장합니다. */
async function startMission() {
  if (["active", "completed"].includes(appState.mission.status)) return;

  if (usesRemoteData()) {
    missionStartButton.disabled = true;

    try {
      await window.greenOnData.startMission();
      showToast("GREEN MISSION 참여가 시작됐어요!");
    } catch (error) {
      showToast(error.userMessage || "미션 참여를 시작하지 못했어요.");
      renderMission();
    }
    return;
  }

  appState.mission = {
    status: "active",
    progressMinutes: 0,
    joinedAt: new Date().toISOString(),
  };

  commitSimulationState();
  showToast("GREEN MISSION 참여가 시작됐어요!");
}

/** 미션에 필요한 현재 에어컨 조건이 모두 맞는지 확인합니다. */
function getMissionConditionResult() {
  const { power, mode, temperature, sensorStatus } = appState.aircon;

  return {
    temperature: power && temperature >= 26,
    mode: power && mode === "COOL",
    sensor: sensorStatus === "normal",
  };
}

/**
 * 에어컨의 이상 상태나 진행 중인 미션 위반 상태를 찾아 안내 문구를 만듭니다.
 * 정상 상태는 Blue, 실제 경고가 있을 때만 Red UI를 사용합니다.
 */
function getAirconIssue() {
  const { power, mode, temperature, filterPercent, sensorStatus } = appState.aircon;
  const isMissionActive = appState.mission.status === "active";

  if (sensorStatus === "error") return "온도 센서 오류가 감지됐어요. 정상 상태로 복구해 주세요.";
  if (filterPercent <= 20) return "필터 수명이 얼마 남지 않았어요. 필터 점검이 필요해요.";
  if (isMissionActive && !power) return "미션 진행 중에는 에어컨 POWER를 켜 주세요.";
  if (isMissionActive && mode !== "COOL") return "미션 조건 위반: 냉방 모드를 COOL로 변경해 주세요.";
  if (isMissionActive && temperature < 26) return "미션 조건 위반: 설정 온도를 26°C 이상으로 높여 주세요.";

  return null;
}

/** 에어컨 데이터와 미션 조건 상태를 화면에 함께 표시합니다. */
function renderAircon() {
  const aircon = appState.aircon;
  const condition = getMissionConditionResult();
  const issueMessage = getAirconIssue();

  airconPower.textContent = aircon.power ? "ON" : "OFF";
  airconMode.textContent = aircon.mode;
  airconTemperature.textContent = String(aircon.temperature);
  airconFan.textContent = aircon.fan;
  airconUsage.textContent = String(aircon.usageMinutes);
  airconFilter.textContent = String(aircon.filterPercent);
  airconDeviceTemp.textContent = aircon.sensorStatus === "error" ? "--" : `${aircon.temperature}°`;

  controlPower.textContent = aircon.power ? "ON" : "OFF";
  controlMode.textContent = aircon.mode;
  controlTemperature.textContent = String(aircon.temperature);
  controlFan.textContent = aircon.fan;

  airconCard.classList.toggle("is-danger", Boolean(issueMessage));
  airconCard.classList.toggle("is-off", !aircon.power && !issueMessage);
  airconMessage.classList.toggle("is-danger", Boolean(issueMessage));
  airconTempStat.classList.toggle(
    "is-danger",
    appState.mission.status === "active" && (!aircon.power || aircon.temperature < 26),
  );
  airconFilterStat.classList.toggle("is-danger", aircon.filterPercent <= 20);

  airconHealth.innerHTML = issueMessage
    ? '<span aria-hidden="true"></span> 점검 필요'
    : aircon.power
      ? '<span aria-hidden="true"></span> 정상 운전'
      : '<span aria-hidden="true"></span> 전원 꺼짐';
  airconMessageText.textContent = issueMessage
    || (aircon.power
      ? "모든 상태가 정상이에요. 쾌적한 냉방을 유지하고 있어요."
      : "에어컨 전원이 꺼져 있어요. POWER 버튼으로 켤 수 있어요.");
  airconMessage.querySelector("span").textContent = issueMessage ? "!" : "✓";

  missionConditionTemperature.textContent = condition.temperature
    ? `${aircon.temperature}°C · 충족`
    : `${aircon.temperature}°C · 위반`;
  missionConditionMode.textContent = condition.mode ? `${aircon.mode} · 충족` : `${aircon.mode} · 위반`;
  missionConditionDuration.textContent = `${appState.mission.progressMinutes} / ${MISSION_TARGET_MINUTES}분`;

  missionConditionRows.forEach((row) => {
    const conditionName = row.dataset.missionCondition;
    const isDurationMet = appState.mission.progressMinutes >= MISSION_TARGET_MINUTES;
    const isMet = conditionName === "duration" ? isDurationMet : condition[conditionName];
    const shouldShowResult = appState.mission.status !== "ready";

    row.classList.toggle("is-met", shouldShowResult && isMet);
    row.classList.toggle("is-violated", shouldShowResult && !isMet && conditionName !== "duration");
  });
}

/** 앱 상태 변경 후 관련 화면을 한 번에 갱신합니다. */
function commitSimulationState() {
  renderMission();
  renderAircon();
  renderWallet();
}

/** 미션 보상 포인트를 거래 내역과 잔액에 정확히 한 번만 반영합니다. */
function awardMissionPoints() {
  if (appState.mission.rewardGranted) return;

  const rewardAmount = 300;
  const createdAt = new Date().toISOString();

  appState.wallet.balance += rewardAmount;
  appState.wallet.transactions.unshift({
    id: `mission-${createdAt}`,
    type: "earn",
    amount: rewardAmount,
    title: "26°C 건강 냉방 미션",
    createdAt,
  });
  appState.mission.rewardGranted = true;
}

/** 포인트 잔액, 누적 적립/사용 금액, 최신 거래 내역을 지갑에 표시합니다. */
function renderWallet() {
  const transactions = appState.wallet.transactions;
  const totalEarned = transactions
    .filter((transaction) => transaction.type === "earn")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalSpent = transactions
    .filter((transaction) => transaction.type === "spend")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  walletBalance.textContent = appState.wallet.balance.toLocaleString("ko-KR");
  shopBalance.textContent = appState.wallet.balance.toLocaleString("ko-KR");
  walletEarned.textContent = totalEarned.toLocaleString("ko-KR");
  walletSpent.textContent = totalSpent.toLocaleString("ko-KR");
  transactionCount.textContent = `${transactions.length}건`;
  renderGreenProfile(totalEarned);

  if (transactions.length === 0) {
    walletTransactions.innerHTML = `
      <div class="transaction-empty">
        <span aria-hidden="true">🪙</span>
        <strong>아직 포인트 내역이 없어요</strong>
        <p>GREEN MISSION을 완료하면 첫 포인트가 쌓여요.</p>
      </div>
    `;
    return;
  }

  walletTransactions.innerHTML = transactions
    .map((transaction) => {
      const isEarn = transaction.type === "earn";
      const formattedDate = new Intl.DateTimeFormat("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(transaction.createdAt));

      return `
        <article class="transaction-item ${isEarn ? "" : "is-spend"}">
          <span class="transaction-item__icon" aria-hidden="true">${isEarn ? "🌱" : "🎁"}</span>
          <div class="transaction-item__copy">
            <strong>${transaction.title}</strong>
            <span>${formattedDate}</span>
          </div>
          <span class="transaction-item__amount">${isEarn ? "+" : "−"}${transaction.amount.toLocaleString("ko-KR")} P</span>
        </article>
      `;
    })
    .join("");
}

/** 누적 적립 포인트를 기준으로 현재 GREEN LEVEL과 다음 목표를 계산합니다. */
function renderGreenProfile(totalEarned) {
  const levels = [
    { name: "GREEN SPROUT", icon: "🌱", minimum: 0, next: 500 },
    { name: "GREEN LEAF", icon: "🌿", minimum: 500, next: 1500 },
    { name: "GREEN TREE", icon: "🌳", minimum: 1500, next: 3000 },
    { name: "GREEN FOREST", icon: "🌲", minimum: 3000, next: null },
  ];
  const currentLevel = [...levels].reverse().find((level) => totalEarned >= level.minimum);
  const completedMissions = appState.wallet.transactions.filter(
    (transaction) => transaction.type === "earn" && transaction.id.startsWith("mission-"),
  ).length;

  let levelProgress = 100;
  if (currentLevel.next) {
    levelProgress = ((totalEarned - currentLevel.minimum) / (currentLevel.next - currentLevel.minimum)) * 100;
  }

  levelIcon.textContent = currentLevel.icon;
  levelName.textContent = currentLevel.name;
  levelPoints.textContent = `${totalEarned.toLocaleString("ko-KR")} P`;
  levelMessage.textContent = currentLevel.next
    ? `다음 레벨까지 ${(currentLevel.next - totalEarned).toLocaleString("ko-KR")}P 남았어요.`
    : "가장 높은 GREEN LEVEL을 달성했어요!";
  levelProgressBar.setAttribute("aria-valuemin", String(currentLevel.minimum));
  levelProgressBar.setAttribute("aria-valuemax", String(currentLevel.next || currentLevel.minimum));
  levelProgressBar.setAttribute("aria-valuenow", String(totalEarned));
  levelProgressFill.style.width = `${Math.min(Math.max(levelProgress, 0), 100)}%`;

  // 교육용 리포트이므로 미션 1회당 예상 절전량과 탄소 절감량을 단순 계산합니다.
  reportMissions.textContent = String(completedMissions);
  reportEnergy.textContent = (completedMissions * 0.35).toFixed(2);
  reportCarbon.textContent = (completedMissions * 0.16).toFixed(2);
  reportOrders.textContent = String(appState.orders.length);
}

/** HTML 문자열에 들어갈 텍스트를 안전하게 변환합니다. */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** 선택한 카테고리에 맞는 리워드 상품 카드를 표시합니다. */
function renderRewardShop() {
  const visibleProducts = selectedRewardCategory === "ALL"
    ? rewardProducts
    : rewardProducts.filter((product) => product.category === selectedRewardCategory);

  shopBalance.textContent = appState.wallet.balance.toLocaleString("ko-KR");
  rewardCount.textContent = `${visibleProducts.length}개`;
  rewardList.innerHTML = visibleProducts
    .map((product) => `
      <article class="reward-card" data-category="${product.category}">
        <div class="reward-card__visual" aria-hidden="true">${product.icon}</div>
        <div class="reward-card__body">
          <span class="reward-card__category">${product.category}</span>
          <h3>${escapeHtml(product.name)}</h3>
          <div class="reward-card__bottom">
            <strong>${product.price.toLocaleString("ko-KR")} P</strong>
            <button type="button" data-reward-detail="${product.id}" aria-label="${escapeHtml(product.name)} 상세 보기">+</button>
          </div>
        </div>
      </article>
    `)
    .join("");
}

/** 구매한 리워드를 최신 순서로 표시합니다. */
function renderOrders() {
  orderCount.textContent = `${appState.orders.length}건`;

  if (appState.orders.length === 0) {
    orderList.innerHTML = `
      <div class="order-empty">
        <span aria-hidden="true">🛍️</span>
        <strong>아직 구매한 리워드가 없어요</strong>
        <p>마음에 드는 상품을 GREEN POINT로 만나 보세요.</p>
      </div>
    `;
    return;
  }

  orderList.innerHTML = appState.orders
    .map((order) => {
      const formattedDate = new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(order.createdAt));

      return `
        <article class="order-item">
          <span class="order-item__icon" aria-hidden="true">${order.icon}</span>
          <div class="order-item__copy">
            <strong>${escapeHtml(order.productName)}</strong>
            <span>${formattedDate} · 구매 완료</span>
          </div>
          <span class="order-item__price">−${order.price.toLocaleString("ko-KR")} P</span>
        </article>
      `;
    })
    .join("");
}

function openRewardDetail(productId) {
  const product = rewardProducts.find((item) => item.id === productId);
  if (!product) return;

  selectedRewardId = product.id;
  rewardModalIcon.textContent = product.icon;
  rewardModalCategory.textContent = product.category;
  rewardModalName.textContent = product.name;
  rewardModalDescription.textContent = product.description;
  rewardModalPrice.textContent = product.price.toLocaleString("ko-KR");
  purchaseWarning.hidden = true;
  rewardModalSheet.classList.toggle("is-danger", false);
  rewardModal.hidden = false;
  document.body.classList.add("modal-open");
  purchaseRewardButton.focus();
}

function closeRewardDetail() {
  rewardModal.hidden = true;
  selectedRewardId = null;
  document.body.classList.remove("modal-open");
}

/** 잔액을 확인한 뒤 포인트 차감, 사용 기록, 구매내역을 한 번에 저장합니다. */
async function purchaseSelectedReward() {
  const product = rewardProducts.find((item) => item.id === selectedRewardId);
  if (!product) return;

  if (usesRemoteData()) {
    purchaseRewardButton.disabled = true;

    try {
      await window.greenOnData.purchaseReward(product.id);
      closeRewardDetail();
      showToast(`${product.name} 구매가 완료됐어요!`);
    } catch (error) {
      const isInsufficient = error.code === "INSUFFICIENT_POINTS"
        || error.message?.includes("INSUFFICIENT_POINTS");

      if (isInsufficient) {
        purchaseWarning.hidden = false;
        rewardModalSheet.classList.toggle("is-danger", true);
        showToast("GREEN POINT가 부족해 상품을 구매할 수 없어요.");
      } else {
        showToast(error.userMessage || "상품 구매 중 오류가 발생했어요.");
      }
    } finally {
      purchaseRewardButton.disabled = false;
    }
    return;
  }

  if (appState.wallet.balance < product.price) {
    purchaseWarning.hidden = false;
    rewardModalSheet.classList.toggle("is-danger", true);
    showToast("GREEN POINT가 부족해 상품을 구매할 수 없어요.");
    return;
  }

  const createdAt = new Date().toISOString();
  appState.wallet.balance -= product.price;
  appState.wallet.transactions.unshift({
    id: `reward-${product.id}-${createdAt}`,
    type: "spend",
    amount: product.price,
    title: product.name,
    createdAt,
  });
  appState.orders.unshift({
    id: `order-${product.id}-${createdAt}`,
    productId: product.id,
    productName: product.name,
    icon: product.icon,
    price: product.price,
    createdAt,
  });

  renderWallet();
  renderRewardShop();
  renderOrders();
  closeRewardDetail();
  showToast(`${product.name} 구매가 완료됐어요!`);
}

async function changeTemperature(amount) {
  const nextTemperature = Math.min(Math.max(appState.aircon.temperature + amount, 18), 30);

  if (usesRemoteData()) {
    try {
      await window.greenOnData.updateAircon({ temperature: nextTemperature });
    } catch (error) {
      showToast(error.userMessage || "설정 온도를 변경하지 못했어요.");
    }
    return;
  }

  appState.aircon.temperature = nextTemperature;
  commitSimulationState();
}

async function togglePower() {
  if (usesRemoteData()) {
    try {
      await window.greenOnData.updateAircon({ power: !appState.aircon.power });
    } catch (error) {
      showToast(error.userMessage || "POWER 상태를 변경하지 못했어요.");
    }
    return;
  }

  appState.aircon.power = !appState.aircon.power;
  commitSimulationState();
}

async function cycleMode() {
  const modes = ["COOL", "DRY", "FAN"];
  const currentIndex = modes.indexOf(appState.aircon.mode);
  const nextMode = modes[(currentIndex + 1) % modes.length];

  if (usesRemoteData()) {
    try {
      await window.greenOnData.updateAircon({ mode: nextMode });
    } catch (error) {
      showToast(error.userMessage || "냉방 모드를 변경하지 못했어요.");
    }
    return;
  }

  appState.aircon.mode = nextMode;
  commitSimulationState();
}

async function cycleFan() {
  const fanLevels = ["AUTO", "LOW", "MID", "HIGH"];
  const currentIndex = fanLevels.indexOf(appState.aircon.fan);
  const nextFan = fanLevels[(currentIndex + 1) % fanLevels.length];

  if (usesRemoteData()) {
    try {
      await window.greenOnData.updateAircon({ fan: nextFan });
    } catch (error) {
      showToast(error.userMessage || "FAN 상태를 변경하지 못했어요.");
    }
    return;
  }

  appState.aircon.fan = nextFan;
  commitSimulationState();
}

/**
 * 가상 시간을 30분 진행합니다.
 * 미션 중 조건이 맞으면 진행률을 올리고, 조건이 틀리면 실패로 판정합니다.
 */
async function simulateThirtyMinutes() {
  if (usesRemoteData()) {
    if (appState.mission.status === "ready") {
      showToast("먼저 오늘의 GREEN MISSION에 참여해 주세요.");
      return;
    }

    simulateTimeButton.disabled = true;

    try {
      const result = await window.greenOnData.advanceMission(appState.mission.progressMinutes);
      showToast(
        result.status === "completed"
          ? "GREEN MISSION 성공! 300P가 지급됐어요."
          : result.status === "failed"
            ? "미션 조건을 지키지 못해 미션이 종료됐어요."
            : `미션이 ${result.progressMinutes}분까지 진행됐어요.`,
      );
    } catch (error) {
      showToast(error.userMessage || "미션 시간을 진행하지 못했어요.");
    } finally {
      simulateTimeButton.disabled = false;
    }
    return;
  }

  if (appState.aircon.power) {
    appState.aircon.usageMinutes += 30;
  }

  if (appState.mission.status === "active") {
    const condition = getMissionConditionResult();

    if (!condition.temperature || !condition.mode || !condition.sensor) {
      appState.mission.status = "failed";
      showToast("미션 조건을 지키지 못해 미션이 종료됐어요.");
    } else {
      appState.mission.progressMinutes = Math.min(
        appState.mission.progressMinutes + 30,
        MISSION_TARGET_MINUTES,
      );

      if (appState.mission.progressMinutes >= MISSION_TARGET_MINUTES) {
        appState.mission.status = "completed";
        appState.mission.completedAt = new Date().toISOString();
        awardMissionPoints();
        showToast("GREEN MISSION 성공! 300P가 지급됐어요.");
      } else {
        showToast(`미션이 ${appState.mission.progressMinutes}분까지 진행됐어요.`);
      }
    }
  } else if (appState.mission.status === "ready") {
    showToast("먼저 오늘의 GREEN MISSION에 참여해 주세요.");
  }

  commitSimulationState();
}

/** 테스트하기 쉬운 정상/필터/센서 상태 프리셋을 적용합니다. */
async function applySimulationPreset(presetName) {
  if (usesRemoteData()) {
    const remotePresets = {
      normal: {
        power: true,
        mode: "COOL",
        temperature: 26,
        fan: "AUTO",
        filter_percent: 82,
        sensor_status: "normal",
      },
      filter: { filter_percent: 12 },
      sensor: { sensor_status: "error" },
    };

    try {
      await window.greenOnData.updateAircon(remotePresets[presetName]);
      showToast(
        presetName === "normal"
          ? "에어컨을 정상 상태로 복구했어요."
          : presetName === "filter"
            ? "필터 점검 필요 상태를 시뮬레이션했어요."
            : "센서 오류 상태를 시뮬레이션했어요.",
      );
    } catch (error) {
      showToast(error.userMessage || "에어컨 상태를 변경하지 못했어요.");
    }
    return;
  }

  if (presetName === "normal") {
    appState.aircon = {
      ...appState.aircon,
      power: true,
      mode: "COOL",
      temperature: 26,
      fan: "AUTO",
      filterPercent: 82,
      sensorStatus: "normal",
    };
    showToast("에어컨을 정상 상태로 복구했어요.");
  }

  if (presetName === "filter") {
    appState.aircon.filterPercent = 12;
    showToast("필터 점검 필요 상태를 시뮬레이션했어요.");
  }

  if (presetName === "sensor") {
    appState.aircon.sensorStatus = "error";
    showToast("센서 오류 상태를 시뮬레이션했어요.");
  }

  commitSimulationState();
}

/** 오늘 날짜를 한국어 형식으로 표시해 미션 화면의 맥락을 알려 줍니다. */
function renderTodayLabel() {
  const formattedDate = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  todayLabel.textContent = `${formattedDate}, 지구를 위한 시원한 습관을 시작해 보세요.`;
}

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => navigateTo(button.dataset.navView));
});

directViewButtons.forEach((button) => {
  button.addEventListener("click", () => navigateTo(button.dataset.goView));
});

toastButtons.forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.toast));
});

missionStartButton.addEventListener("click", startMission);
tempDownButton.addEventListener("click", () => changeTemperature(-1));
tempUpButton.addEventListener("click", () => changeTemperature(1));
powerToggleButton.addEventListener("click", togglePower);
modeToggleButton.addEventListener("click", cycleMode);
fanToggleButton.addEventListener("click", cycleFan);
simulateTimeButton.addEventListener("click", simulateThirtyMinutes);
simulationPresetButtons.forEach((button) => {
  button.addEventListener("click", () => applySimulationPreset(button.dataset.simPreset));
});

rewardCategoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedRewardCategory = button.dataset.rewardCategory;
    rewardCategoryButtons.forEach((categoryButton) => {
      categoryButton.classList.toggle("is-active", categoryButton === button);
    });
    renderRewardShop();
  });
});

rewardList.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-reward-detail]");
  if (detailButton) openRewardDetail(detailButton.dataset.rewardDetail);
});

rewardModalCloseButtons.forEach((button) => {
  button.addEventListener("click", closeRewardDetail);
});
purchaseRewardButton.addEventListener("click", purchaseSelectedReward);

// 브라우저의 뒤로/앞으로 가기와 주소 직접 입력에도 같은 화면 전환 규칙을 적용합니다.
window.addEventListener("hashchange", () => renderView(getViewFromHash()));

// 앱을 처음 열었을 때 주소에 맞는 화면을 표시합니다.
renderView(getViewFromHash());
renderTodayLabel();
renderMission();
renderAircon();
renderWallet();
renderRewardShop();
renderOrders();

/**
 * Supabase 어댑터가 사용자별 데이터를 전달할 수 있도록 공개하는 최소 인터페이스입니다.
 * 앱 내부 상태 자체는 계속 이 파일에서만 관리합니다.
 */
window.greenOnApp = Object.freeze({
  getLocalState() {
    return structuredClone(appState);
  },
  replaceState(nextState, nextProducts = null) {
    appState = {
      ...structuredClone(defaultState),
      ...nextState,
      mission: { ...defaultState.mission, ...nextState.mission },
      aircon: { ...defaultState.aircon, ...nextState.aircon },
      wallet: {
        ...defaultState.wallet,
        ...nextState.wallet,
        transactions: nextState.wallet?.transactions || [],
      },
      orders: nextState.orders || [],
    };

    if (Array.isArray(nextProducts)) {
      rewardProducts = nextProducts;
    }

    renderMission();
    renderAircon();
    renderWallet();
    renderRewardShop();
    renderOrders();
  },
  setUser({ displayName, email }) {
    const safeName = displayName || "그리너";
    headerUserName.textContent = safeName;
    profileUserName.textContent = safeName;
    profileUserEmail.textContent = email || "";
  },
  discardLegacyState,
  showToast,
});
