// 실제 에어컨 API와는 무관한 공개 날씨 API 연결입니다.
// 네트워크 오류가 나더라도 화면 구조를 확인할 수 있도록 서울의 여름 샘플값을 준비합니다.
const WEATHER_API_URL = new URL("https://api.open-meteo.com/v1/forecast");
WEATHER_API_URL.search = new URLSearchParams({
  latitude: "37.5665",
  longitude: "126.9780",
  current: "temperature_2m,relative_humidity_2m,weather_code",
  timezone: "Asia/Seoul",
}).toString();

const SAMPLE_WEATHER = Object.freeze({
  temperature: 29,
  humidity: 68,
  code: 2,
  observedAt: null,
});

const weatherCard = document.querySelector("[data-weather-card]");
const weatherIcon = document.querySelector("[data-weather-icon]");
const weatherTemperature = document.querySelector("[data-weather-temperature]");
const weatherHumidity = document.querySelector("[data-weather-humidity]");
const weatherCondition = document.querySelector("[data-weather-condition]");
const weatherUpdated = document.querySelector("[data-weather-updated]");
const weatherMission = document.querySelector("[data-weather-mission]");
const weatherGuide = document.querySelector("[data-weather-guide]");
const weatherMissionCopy = document.querySelector("[data-weather-mission-copy]");

/** WMO 날씨 코드를 사용자가 이해하기 쉬운 한국어 상태와 아이콘으로 바꿉니다. */
function describeWeather(code) {
  if (code === 0) return { label: "맑음", icon: "☀️" };
  if ([1, 2, 3].includes(code)) return { label: "구름 조금", icon: "⛅" };
  if ([45, 48].includes(code)) return { label: "안개", icon: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "이슬비", icon: "🌦️" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "비", icon: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "눈", icon: "🌨️" };
  if ([95, 96, 99].includes(code)) return { label: "뇌우", icon: "⛈️" };
  return { label: "날씨 정보", icon: "🌤️" };
}

/** 온도·습도·강수 상태에 따라 오늘 실천할 냉방 안내를 고릅니다. */
function getWeatherMission({ temperature, humidity, code }) {
  const isRainy = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);

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

/** 날씨 데이터와 데이터 출처 상태를 카드에 함께 반영합니다. */
function renderWeather(weather, { isFallback = false } = {}) {
  const description = describeWeather(weather.code);
  const mission = getWeatherMission(weather);
  const roundedTemperature = Math.round(weather.temperature);
  const roundedHumidity = Math.round(weather.humidity);

  weatherCard.classList.toggle("is-danger", isFallback);
  weatherIcon.textContent = description.icon;
  weatherTemperature.textContent = String(roundedTemperature);
  weatherHumidity.textContent = String(roundedHumidity);
  weatherCondition.textContent = description.label;
  weatherMission.textContent = mission.title;
  weatherGuide.textContent = mission.guide;
  weatherMissionCopy.textContent = mission.guide;

  if (isFallback) {
    weatherUpdated.textContent = "연결 오류 · 서울 샘플 날씨 표시 중";
    return;
  }

  const observedTime = weather.observedAt
    ? new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(weather.observedAt))
    : "방금";
  weatherUpdated.textContent = `${observedTime} 기준 · Open-Meteo`;
}

/** 공개 API에서 서울의 현재 온도·습도·날씨 코드를 읽습니다. */
async function loadCurrentWeather() {
  try {
    const response = await fetch(WEATHER_API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`WEATHER_HTTP_${response.status}`);

    const payload = await response.json();
    const current = payload.current;
    const weather = {
      temperature: Number(current?.temperature_2m),
      humidity: Number(current?.relative_humidity_2m),
      code: Number(current?.weather_code),
      observedAt: current?.time || null,
    };

    if (![weather.temperature, weather.humidity, weather.code].every(Number.isFinite)) {
      throw new Error("WEATHER_INVALID_RESPONSE");
    }

    renderWeather(weather);
  } catch (error) {
    console.warn("현재 날씨를 불러오지 못해 샘플 날씨를 표시합니다.", error);
    renderWeather(SAMPLE_WEATHER, { isFallback: true });
  }
}

// 다른 기능을 기다리게 하지 않고 날씨만 독립적으로 갱신합니다.
loadCurrentWeather();

// 테스트에서 조건별 안내를 직접 검증할 수 있도록 순수 함수만 읽기 전용으로 공개합니다.
window.greenOnWeather = Object.freeze({ describeWeather, getWeatherMission });
