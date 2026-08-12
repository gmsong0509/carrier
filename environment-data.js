// 날씨·대기환경 데이터만 담당하는 모듈입니다.
// 화면을 그리는 코드는 weather-service.js에 두어 향후 API를 교체하기 쉽게 분리합니다.
(function initializeEnvironmentData() {
  const WEATHER_API_URL = new URL("https://api.open-meteo.com/v1/forecast");
  WEATHER_API_URL.search = new URLSearchParams({
    latitude: "37.5665",
    longitude: "126.9780",
    current: "temperature_2m,relative_humidity_2m,weather_code",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    forecast_days: "2",
    timezone: "Asia/Seoul",
  }).toString();

  // 대기질 API는 아직 연결하지 않았으므로 출처를 명확히 표시하는 데모값을 사용합니다.
  const SAMPLE_AIR_QUALITY = Object.freeze({
    pm10: 28,
    pm25: 14,
    isDemo: true,
  });

  /** Date를 API 응답과 같은 YYYY-MM-DDTHH:00 문자열로 바꿉니다. */
  function toLocalHourString(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
  }

  /** 네트워크가 끊겨도 시간대별 UI를 확인할 수 있는 서울 여름 샘플을 만듭니다. */
  function createSampleWeather() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const temperatures = [29, 31, 31, 28, 25, 24, 25];
    const weatherCodes = [2, 1, 2, 3, 0, 0, 1];
    const precipitation = [10, 10, 20, 30, 10, 10, 20];

    return {
      current: {
        temperature: 29,
        humidity: 68,
        code: 2,
        observedAt: null,
      },
      hourly: temperatures.map((temperature, index) => {
        const forecastTime = new Date(now.getTime() + index * 3 * 60 * 60 * 1000);
        return {
          time: toLocalHourString(forecastTime),
          temperature,
          code: weatherCodes[index],
          precipitationProbability: precipitation[index],
          isCurrent: index === 0,
        };
      }),
      isFallback: true,
      source: "시뮬레이션 데이터",
    };
  }

  /** 현재 시점 이후 예보를 3시간 간격으로 최대 7개 선택합니다. */
  function selectHourlyForecast(hourly, currentTime) {
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const temperatures = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : [];
    const codes = Array.isArray(hourly?.weather_code) ? hourly.weather_code : [];
    const precipitation = Array.isArray(hourly?.precipitation_probability)
      ? hourly.precipitation_probability
      : [];
    // 현재 값은 13:30처럼 분 단위일 수 있으므로 같은 시각의 13:00 예보부터 보여 줍니다.
    const currentHour = currentTime ? currentTime.slice(0, 13) : "";
    const matchingIndex = times.findIndex((time) => !currentHour || time.slice(0, 13) >= currentHour);
    const startIndex = matchingIndex >= 0 ? matchingIndex : 0;
    const forecast = [];

    for (let index = startIndex; index < times.length && forecast.length < 7; index += 3) {
      const temperature = Number(temperatures[index]);
      const code = Number(codes[index]);
      const precipitationProbability = Number(precipitation[index]);

      if (![temperature, code, precipitationProbability].every(Number.isFinite)) continue;

      forecast.push({
        time: times[index],
        temperature,
        code,
        precipitationProbability,
        isCurrent: forecast.length === 0,
      });
    }

    return forecast;
  }

  /** Open-Meteo 응답을 화면에서 사용하는 단순한 데이터 구조로 변환합니다. */
  function parseWeatherPayload(payload) {
    const current = payload?.current;
    const weather = {
      current: {
        temperature: Number(current?.temperature_2m),
        humidity: Number(current?.relative_humidity_2m),
        code: Number(current?.weather_code),
        observedAt: current?.time || null,
      },
      hourly: selectHourlyForecast(payload?.hourly, current?.time),
      isFallback: false,
      source: "Open-Meteo",
    };

    const currentValues = [weather.current.temperature, weather.current.humidity, weather.current.code];
    if (!currentValues.every(Number.isFinite) || weather.hourly.length === 0) {
      throw new Error("WEATHER_INVALID_RESPONSE");
    }

    return weather;
  }

  /** API 키가 필요 없는 기존 공개 날씨 API에서 현재·시간대별 예보를 함께 읽습니다. */
  async function loadWeatherData() {
    try {
      const response = await fetch(WEATHER_API_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`WEATHER_HTTP_${response.status}`);
      return parseWeatherPayload(await response.json());
    } catch (error) {
      console.warn("날씨를 불러오지 못해 시뮬레이션 데이터를 표시합니다.", error);
      return createSampleWeather();
    }
  }

  /** 국내 대기환경 안내 기준에 맞춰 농도를 네 단계로 분류합니다. */
  function classifyAirQuality(value, pollutant) {
    const thresholds = pollutant === "pm25" ? [15, 35, 75] : [30, 80, 150];

    if (value <= thresholds[0]) return { key: "good", label: "좋음", rank: 0 };
    if (value <= thresholds[1]) return { key: "normal", label: "보통", rank: 1 };
    if (value <= thresholds[2]) return { key: "bad", label: "나쁨", rank: 2 };
    return { key: "very-bad", label: "매우 나쁨", rank: 3 };
  }

  /** PM10과 PM2.5 중 더 좋지 않은 등급을 현재 대기질 상태로 사용합니다. */
  function getAirQualitySummary(airQuality) {
    const pm10Status = classifyAirQuality(airQuality.pm10, "pm10");
    const pm25Status = classifyAirQuality(airQuality.pm25, "pm25");
    const overallStatus = pm10Status.rank >= pm25Status.rank ? pm10Status : pm25Status;
    return { pm10Status, pm25Status, overallStatus };
  }

  /** 현재 기온과 대기질을 조합해 불안감을 주지 않는 짧은 행동 안내를 만듭니다. */
  function getGreenAirGuide(temperature, airQuality) {
    const { overallStatus } = getAirQualitySummary(airQuality);

    if (overallStatus.rank >= 2) {
      return {
        title: "실내 공기를 편안하게 관리해요",
        message: "현재 미세먼지 농도가 높아요. 장시간 창문을 열기보다 실내 공기 관리에 신경 써주세요.",
        tone: "caution",
      };
    }

    if (temperature >= 32) {
      return {
        title: "무리하지 않는 적정 냉방이 좋아요",
        message: "현재 외부 기온이 높아요. 무리하게 냉방을 줄이기보다 26℃ 안팎의 적정 실내온도를 유지해보세요.",
        tone: "warm",
      };
    }

    if (overallStatus.key === "good") {
      return {
        title: "환기 후 GREEN 냉방을 시작해요",
        message: "현재 대기질이 좋아요. 짧게 환기한 뒤 26℃ 적정 냉방을 실천해보세요.",
        tone: "good",
      };
    }

    return {
      title: "짧은 환기로 쾌적함을 더해요",
      message: "현재 대기질은 보통이에요. 짧게 환기한 뒤 26℃ 적정 냉방으로 쾌적함을 유지해보세요.",
      tone: "normal",
    };
  }

  window.greenOnEnvironmentData = Object.freeze({
    sampleAirQuality: SAMPLE_AIR_QUALITY,
    loadWeatherData,
    selectHourlyForecast,
    parseWeatherPayload,
    classifyAirQuality,
    getAirQualitySummary,
    getGreenAirGuide,
  });
})();
