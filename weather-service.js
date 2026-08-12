// 날씨와 대기환경 UI만 담당합니다. API 호출·데이터 판정은 environment-data.js에 분리되어 있습니다.
const environmentData = window.greenOnEnvironmentData;

const weatherCard = document.querySelector("[data-weather-card]");
const weatherIcon = document.querySelector("[data-weather-icon]");
const weatherTemperature = document.querySelector("[data-weather-temperature]");
const weatherHumidity = document.querySelector("[data-weather-humidity]");
const weatherCondition = document.querySelector("[data-weather-condition]");
const weatherUpdated = document.querySelector("[data-weather-updated]");
const weatherMission = document.querySelector("[data-weather-mission]");
const weatherGuide = document.querySelector("[data-weather-guide]");
const weatherMissionCopy = document.querySelector("[data-weather-mission-copy]");
const weatherDataBadge = document.querySelector("[data-weather-data-badge]");
const hourlyWeatherList = document.querySelector("[data-hourly-weather]");
const airQualityCard = document.querySelector("[data-air-quality-card]");
const airQualityPm10 = document.querySelector("[data-air-quality-pm10]");
const airQualityPm25 = document.querySelector("[data-air-quality-pm25]");
const airQualityPm10Status = document.querySelector("[data-air-quality-pm10-status]");
const airQualityPm25Status = document.querySelector("[data-air-quality-pm25-status]");
const airQualityOverall = document.querySelector("[data-air-quality-overall]");
const greenAirGuideCard = document.querySelector("[data-green-air-guide]");
const greenAirGuideTitle = document.querySelector("[data-green-air-guide-title]");
const greenAirGuideMessage = document.querySelector("[data-green-air-guide-message]");

/** WMO 날씨 코드를 사용자가 이해하기 쉬운 한국어 상태와 아이콘으로 바꿉니다. */
function describeWeather(code, { isNight = false } = {}) {
  if (code === 0) return { label: "맑음", icon: isNight ? "🌙" : "☀️" };
  if ([1, 2, 3].includes(code)) return { label: "구름 조금", icon: isNight ? "🌙" : "⛅" };
  if ([45, 48].includes(code)) return { label: "안개", icon: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "이슬비", icon: "🌦️" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "비", icon: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "눈", icon: "🌨️" };
  if ([95, 96, 99].includes(code)) return { label: "뇌우", icon: "⛈️" };
  return { label: "날씨 정보", icon: "🌤️" };
}

/** 온도·습도·강수 상태에 따라 기존 날씨 맞춤 미션 안내를 고릅니다. */
function getWeatherMission({ temperature, humidity, code }) {
  const rainyCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
  const isRainy = rainyCodes.includes(code);

  if (temperature >= 30 || humidity >= 75) {
    return {
      title: "고온·다습 26°C 미션",
      guide: "덥고 습한 날이에요. COOL 26°C와 AUTO 바람으로 과도한 냉방을 줄여 보세요.",
    };
  }

  if (isRainy) {
    return {
      title: "비 오는 날 절전 미션",
      guide: "습도가 높은 비 오는 날이에요. 문을 닫고 COOL 26°C를 유지해 냉방 손실을 줄여요.",
    };
  }

  if (temperature <= 24) {
    return {
      title: "선선한 날 최소 냉방",
      guide: "실외가 선선해요. 꼭 필요할 때만 에어컨을 켜고 26°C 이상을 유지해요.",
    };
  }

  return {
    title: "26°C 건강 냉방",
    guide: "오늘은 적정 온도 26°C와 AUTO 바람을 유지하며 에너지를 아껴 보세요.",
  };
}

/** 예보 시각을 지금·오늘·내일처럼 짧고 읽기 쉽게 표시합니다. */
function formatForecastTime(forecast, firstForecastDate) {
  if (forecast.isCurrent) return "지금";
  const date = forecast.time.slice(0, 10);
  const hour = Number(forecast.time.slice(11, 13));
  return date === firstForecastDate ? `${hour}시` : `내일 ${hour}시`;
}

/** 시간대별 예보 카드를 안전한 DOM 요소로 만들어 가로 스크롤 목록에 넣습니다. */
function renderHourlyForecast(hourly) {
  const fragment = document.createDocumentFragment();
  const firstForecastDate = hourly[0]?.time.slice(0, 10) || "";

  hourly.forEach((forecast) => {
    const hour = Number(forecast.time.slice(11, 13));
    const description = describeWeather(forecast.code, { isNight: hour < 6 || hour >= 20 });
    const card = document.createElement("article");
    const time = document.createElement("strong");
    const icon = document.createElement("span");
    const temperature = document.createElement("b");
    const precipitation = document.createElement("small");

    card.className = `hourly-weather-card${forecast.isCurrent ? " is-current" : ""}`;
    card.setAttribute("role", "listitem");
    card.setAttribute(
      "aria-label",
      `${formatForecastTime(forecast, firstForecastDate)}, ${description.label}, ${Math.round(forecast.temperature)}도, 강수확률 ${Math.round(forecast.precipitationProbability)}퍼센트`,
    );
    time.textContent = formatForecastTime(forecast, firstForecastDate);
    icon.className = "hourly-weather-card__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = description.icon;
    temperature.textContent = `${Math.round(forecast.temperature)}℃`;
    precipitation.textContent = `강수 ${Math.round(forecast.precipitationProbability)}%`;
    card.append(time, icon, temperature, precipitation);
    fragment.append(card);
  });

  hourlyWeatherList.replaceChildren(fragment);
  hourlyWeatherList.scrollLeft = 0;
}

/** 상태 배지의 네 단계 색상 클래스를 한 곳에서 일관되게 바꿉니다. */
function updateQualityBadge(element, status) {
  element.className = `quality-badge is-${status.key}`;
  element.textContent = status.label;
}

/** PM10·PM2.5 수치와 더 나쁜 쪽을 기준으로 한 종합 상태를 그립니다. */
function renderAirQuality(airQuality) {
  const summary = environmentData.getAirQualitySummary(airQuality);
  airQualityPm10.textContent = String(Math.round(airQuality.pm10));
  airQualityPm25.textContent = String(Math.round(airQuality.pm25));
  updateQualityBadge(airQualityPm10Status, summary.pm10Status);
  updateQualityBadge(airQualityPm25Status, summary.pm25Status);
  updateQualityBadge(airQualityOverall, summary.overallStatus);
  airQualityCard.dataset.quality = summary.overallStatus.key;
}

/** 기온·대기질 조건에 따라 오늘의 냉방·환기 가이드 문구를 갱신합니다. */
function renderGreenAirGuide(temperature, airQuality) {
  const guide = environmentData.getGreenAirGuide(temperature, airQuality);
  greenAirGuideTitle.textContent = guide.title;
  greenAirGuideMessage.textContent = guide.message;
  greenAirGuideCard.dataset.tone = guide.tone;
}

/** 현재 날씨와 시간대별 예보를 기존 홈 날씨 카드에 함께 반영합니다. */
function renderWeather(weatherData) {
  const weather = weatherData.current;
  const description = describeWeather(weather.code);
  const mission = getWeatherMission(weather);
  const roundedTemperature = Math.round(weather.temperature);
  const roundedHumidity = Math.round(weather.humidity);

  weatherCard.classList.toggle("is-danger", weatherData.isFallback);
  weatherIcon.textContent = description.icon;
  weatherTemperature.textContent = String(roundedTemperature);
  weatherHumidity.textContent = String(roundedHumidity);
  weatherCondition.textContent = description.label;
  weatherMission.textContent = mission.title;
  weatherGuide.textContent = mission.guide;
  weatherMissionCopy.textContent = mission.guide;
  weatherDataBadge.textContent = weatherData.isFallback ? "시뮬레이션 데이터" : "실시간 예보";
  weatherDataBadge.classList.toggle("is-demo", weatherData.isFallback);
  renderHourlyForecast(weatherData.hourly);

  if (weatherData.isFallback) {
    weatherUpdated.textContent = "연결 오류 · 서울 시뮬레이션 데이터 표시 중";
    return;
  }

  const observedTime = weather.observedAt
    ? new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(weather.observedAt))
    : "방금";
  weatherUpdated.textContent = `${observedTime} 기준 · ${weatherData.source}`;
}

/** 날씨 API와 독립적인 대기질 데모값을 결합해 홈 환경 정보를 초기화합니다. */
async function loadEnvironmentInformation() {
  const weatherData = await environmentData.loadWeatherData();
  const airQuality = environmentData.sampleAirQuality;
  renderWeather(weatherData);
  renderAirQuality(airQuality);
  renderGreenAirGuide(weatherData.current.temperature, airQuality);
}

// 다른 앱 기능을 기다리게 하지 않고 날씨·대기환경만 독립적으로 갱신합니다.
loadEnvironmentInformation();

// 테스트에서 기존 날씨 미션 규칙을 직접 확인할 수 있도록 순수 함수만 읽기 전용으로 공개합니다.
window.greenOnWeather = Object.freeze({ describeWeather, getWeatherMission, formatForecastTime });
