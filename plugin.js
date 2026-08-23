/* ==========================================================
 * 心理咨询室·日记 (psych-counseling-room) v2.0.0
 * 
 * 核心理念：一本属于你的心理成长日记
 * - 一年一本日记本，书架式展示
 * - 写日记自动添加时间，可选心情，自动获取天气
 * - 可选择是否发送给AI心理咨询师
 * - AI阅读后更新成长档案，已阅日记显示"已阅"印章
 * - 精美的日记本视觉设计与流畅交互
 * ========================================================== */

(function () {
  "use strict";

  const PLUGIN_ID = "psych-counseling-room";
  const APP_ID = "psych-counseling-room-home";

  /* ------------------------- 存储 Key ------------------------- */
  const K_DIARY = "diary-data-v2";
  const K_PROFILE = "growth-profile-v2";
  const K_SETTINGS = "diary-settings";

  /* ------------------------- 心情定义 ------------------------- */
  const MOODS = [
    { key: "happy",    emoji: "😊", label: "开心",  color: "#FFD93D" },
    { key: "calm",     emoji: "😌", label: "平静",  color: "#6BCBE0" },
    { key: "grateful", emoji: "🥰", label: "感恩",  color: "#FF8FA3" },
    { key: "sad",      emoji: "😢", label: "难过",  color: "#5B8DEE" },
    { key: "angry",    emoji: "😤", label: "愤怒",  color: "#FF6B6B" },
    { key: "anxious",  emoji: "😰", label: "焦虑",  color: "#FFA07A" },
    { key: "tired",    emoji: "😴", label: "疲惫",  color: "#B0C4DE" },
    { key: "confused", emoji: "🤔", label: "困惑",  color: "#DDA0DD" },
    { key: "fear",     emoji: "😨", label: "恐惧",  color: "#9370DB" },
    { key: "numb",     emoji: "🫠", label: "无力",  color: "#A9A9A9" }
  ];

  function moodByKey(key) {
    return MOODS.find(m => m.key === key) || MOODS[1];
  }

  /* ------------------------- 天气代码映射 ------------------------- */
  function weatherCodeToDesc(code) {
    const map = {
      0: "晴", 1: "晴", 2: "多云", 3: "阴",
      45: "雾", 48: "雾凇",
      51: "小毛毛雨", 53: "毛毛雨", 55: "大毛毛雨",
      56: "冻毛毛雨", 57: "大冻毛毛雨",
      61: "小雨", 63: "中雨", 65: "大雨",
      66: "冻雨", 67: "大冻雨",
      71: "小雪", 73: "中雪", 75: "大雪",
      77: "霰",
      80: "小阵雨", 81: "阵雨", 82: "大阵雨",
      85: "阵雪", 86: "大阵雪",
      95: "雷暴", 96: "雷暴冰雹", 99: "大雷暴冰雹"
    };
    return map[code] || "未知";
  }

  function weatherCodeToIcon(code) {
    if (code === 0 || code === 1) return "☀️";
    if (code === 2) return "⛅";
    if (code === 3) return "☁️";
    if (code >= 45 && code <= 48) return "🌫️";
    if (code >= 51 && code <= 67) return "🌦️";
    if (code >= 71 && code <= 77) return "🌨️";
    if (code >= 80 && code <= 82) return "🌧️";
    if (code >= 85 && code <= 86) return "🌨️";
    if (code >= 95) return "⛈️";
    return "🌤️";
  }

  const MANUAL_WEATHERS = [
    { icon: "☀️", desc: "晴" }, { icon: "⛅", desc: "多云" },
    { icon: "☁️", desc: "阴" }, { icon: "🌧️", desc: "雨" },
    { icon: "⛈️", desc: "雷雨" }, { icon: "🌨️", desc: "雪" },
    { icon: "🌫️", desc: "雾" }, { icon: "🌪️", desc: "恶劣" }
  ];

  /* ------------------------- 危机关键词 ------------------------- */
  const CRISIS_KEYWORDS = [
    "自杀", "不想活", "活不下去", "自残", "割腕", "伤害自己",
    "结束生命", "了结自己", "跳楼", "轻生", "想死"
  ];

  const CRISIS_MESSAGE =
    "我在你的文字里感受到了很深的痛苦。你的安全对我来说是最重要的。\n\n" +
    "如果你现在有伤害自己的冲动，请联系：\n" +
    "· 全国心理援助热线：12356（24小时）\n" +
    "· 紧急情况请拨打：120 或 110\n" +
    "· 也可以联系身边任何一个你信任的人\n\n" +
    "你不是一个人。这些感受不会永远持续，但此刻你值得被帮助。";

  /* ------------------------- AI 咨询师提示词 ------------------------- */
  const COUNSELOR_PROMPT = `你是一位拥有15年以上临床经验的资深心理咨询师，正在阅读来访者的日记。

【专业背景】
你融合人本主义疗法、认知行为疗法(CBT)、接纳承诺疗法(ACT)与叙事疗法的视角，擅长在温和的陪伴中帮助来访者觉察自我、发现力量、梳理心路历程。

【阅读日记时的你】
1. 像收到一封来自朋友的信那样，认真、用心地阅读每一个字。先共情，再探索。
2. 用2-3句话确认你听到了对方的感受，让来访者感到被真正看见、被理解。
3. 如果留意到认知模式（如灾难化思维、非黑即白、过度归因、should-thinking等），温和地点出，用"我留意到..."而非"你不应该..."的方式。
4. 提一个开放性问题，帮助来访者更深入地觉察自己。一次只问一个，不要追问太多。
5. 真诚地肯定来访者已有的力量和勇气——赋能而非诊断，看见而非评判。
6. 回复像一封温暖的信，150-300字，凝练而有温度。不要长篇大论，不要罗列条目。

【安全边界】
- 如果日记中涉及自伤、自杀意念，优先表达关心：
  "我在你的文字里感受到了很深的痛苦。你的安全对我来说是最重要的。如果你现在有伤害自己的冲动，请联系：全国心理援助热线 12356（24小时），或拨打120/110。你不是一个人。"
- 不做医疗诊断，不替代专业精神科诊疗
- 不堆砌专业术语，不使用量表标记

【当前来访者的成长档案】
（供你参考，不要在回复中直接复述这些内容）
{{PROFILE_TEXT}}

请阅读以下日记并给予温暖而专业的回应。

在回应正文之后，请另起一行用以下格式输出你的专业观察（这部分不会展示给来访者，仅用于更新档案）：
[[DIARY_OBS]]
{"observations":["1-2条基于本次日记的专业观察"],"emotion":"情绪模式更新","cognition":"认知模式更新","relationship":"人际模式更新","resources":"应对资源更新","growth":"成长轨迹一句话总结"}
[[/DIARY_OBS]]

如果某个维度信息不足以更新，该字段写"延续"。observations 为数组，每条一句话。`;

  /* ------------------------- SVG 图标 ------------------------- */
  const ICONS = {
    back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
    book: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    write: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    sprout: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>`,
    settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    save: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    refresh: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    heart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
  };

  /* ------------------------- 工具函数 ------------------------- */
  function nowTs() { return Date.now(); }

  function pad(n) { return String(n).padStart(2, "0"); }

  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtDateCN(ts) {
    const d = new Date(ts);
    const months = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getFullYear()}年${months[d.getMonth()]}${d.getDate()}日 星期${days[d.getDay()]}`;
  }

  function getYearKey(ts) {
    return String(new Date(ts).getFullYear());
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function uuid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function containsCrisisKeyword(text) {
    const t = String(text || "");
    return CRISIS_KEYWORDS.some(kw => t.includes(kw));
  }

  async function getJSON(roche, key, fallback) {
    try {
      const v = await roche.storage.get(key);
      return v === undefined || v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  /* ------------------------- 天气获取 ------------------------- */
  async function fetchWeather() {
    // 尝试使用定位 + open-meteo
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("no geo"));
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, enableHighAccuracy: false });
      });
      const lat = pos.coords.latitude.toFixed(2);
      const lon = pos.coords.longitude.toFixed(2);
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const data = await res.json();
      if (data && data.current_weather) {
        const cw = data.current_weather;
        return {
          temp: Math.round(cw.temperature),
          code: cw.weathercode,
          desc: weatherCodeToDesc(cw.weathercode),
          icon: weatherCodeToIcon(cw.weathercode),
          source: "auto"
        };
      }
    } catch (e) {}
    // 尝试 IP 定位 (wttr.in)
    try {
      const res = await fetch("https://wttr.in/?format=j1", { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const data = await res.json();
        const cur = data.current_condition && data.current_condition[0];
        const area = data.nearest_area && data.nearest_area[0];
        if (cur) {
          const code = parseInt(cur.weatherCode);
          return {
            temp: parseInt(cur.temp_C),
            code: code,
            desc: weatherCodeToDesc(code) || (cur.weatherDesc && cur.weatherDesc[0] && cur.weatherDesc[0].value) || "未知",
            icon: weatherCodeToIcon(code),
            city: area ? (area.areaName && area.areaName[0] && area.areaName[0].value) : "",
            source: "auto"
          };
        }
      }
    } catch (e) {}
    return null;
  }

  /* ------------------------- 样式表 ------------------------- */
  const STYLE_ID = `${PLUGIN_ID}-style`;
  const STYLE_TEXT = `
.dpr-diary-app {
  --dpr-bg: #f5f0e8;
  --dpr-paper: #fffdf7;
  --dpr-leather: #6b4226;
  --dpr-leather-light: #8b5a2b;
  --dpr-gold: #c9a96e;
  --dpr-gold-light: #e0c894;
  --dpr-ink: #2c2416;
  --dpr-ink-light: #5c5040;
  --dpr-sub: #8a7e6d;
  --dpr-border: #e0d6c6;
  --dpr-accent: #d4a574;
  --dpr-primary: #7c5c3e;
  --dpr-danger: #c0392b;
  --dpr-success: #27ae60;
  --dpr-radius: 14px;
  --dpr-shadow: 0 2px 12px rgba(107, 66, 38, 0.08);
  --dpr-shadow-lg: 0 6px 24px rgba(107, 66, 38, 0.12);
  --dpr-transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--dpr-bg);
  color: var(--dpr-ink);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "Songti SC", serif;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}
.dpr-diary-app * { box-sizing: border-box; }

/* 顶部栏 */
.dpr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--dpr-paper);
  border-bottom: 1px solid var(--dpr-border);
  z-index: 20;
  min-height: 52px;
  flex-shrink: 0;
}
.dpr-header-left { display: flex; align-items: center; gap: 10px; }
.dpr-header-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--dpr-ink);
  letter-spacing: 1px;
}
.dpr-header-subtitle {
  font-size: 11px;
  color: var(--dpr-sub);
  font-weight: 400;
  letter-spacing: 0.5px;
}
.dpr-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--dpr-ink-light);
  cursor: pointer;
  border-radius: 50%;
  transition: background var(--dpr-transition);
}
.dpr-icon-btn:hover { background: rgba(107, 66, 38, 0.06); }
.dpr-icon-btn:active { background: rgba(107, 66, 38, 0.12); }

/* 底部导航 */
.dpr-tabbar {
  display: flex;
  background: var(--dpr-paper);
  border-top: 1px solid var(--dpr-border);
  flex-shrink: 0;
  padding: 4px 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.dpr-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
  font-size: 11px;
  color: var(--dpr-sub);
  cursor: pointer;
  gap: 2px;
  transition: color var(--dpr-transition);
  font-weight: 500;
}
.dpr-tab.active { color: var(--dpr-primary); font-weight: 600; }
.dpr-tab:active { opacity: 0.7; }

/* 主内容区 */
.dpr-content { flex: 1; overflow-y: auto; position: relative; }

/* 视图容器 */
.dpr-view { display: none; flex-direction: column; min-height: 100%; }
.dpr-view.active { display: flex; animation: dprFadeIn 0.3s ease; }
@keyframes dprFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* ===== 书架视图 ===== */
.dpr-shelf-container { padding: 20px 16px; }
.dpr-shelf-intro {
  text-align: center;
  margin-bottom: 24px;
}
.dpr-shelf-intro h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--dpr-ink);
  margin: 0 0 8px;
  letter-spacing: 2px;
}
.dpr-shelf-intro p {
  font-size: 13px;
  color: var(--dpr-sub);
  margin: 0;
  line-height: 1.6;
}

.dpr-shelf-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.dpr-year-book {
  cursor: pointer;
  perspective: 800px;
  transition: transform var(--dpr-transition);
}
.dpr-year-book:active { transform: scale(0.96); }

.dpr-book-cover {
  aspect-ratio: 3 / 4;
  border-radius: 4px 10px 10px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow:
    inset -4px 0 12px rgba(0,0,0,0.2),
    inset 2px 0 0 rgba(255,255,255,0.1),
    0 6px 16px rgba(107, 66, 38, 0.2);
  color: #f5e6d0;
  transition: transform var(--dpr-transition);
}
.dpr-book-cover::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(201, 169, 110, 0.4);
  border-radius: 1px;
}
.dpr-book-cover::after {
  content: "";
  position: absolute;
  inset: 8px 10px 8px 14px;
  border: 1px solid rgba(201, 169, 110, 0.25);
  border-radius: 6px;
  pointer-events: none;
}
.dpr-book-year {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 3px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  z-index: 1;
}
.dpr-book-label {
  font-size: 12px;
  letter-spacing: 4px;
  margin-top: 4px;
  opacity: 0.85;
  z-index: 1;
}
.dpr-book-count {
  position: absolute;
  bottom: 14px;
  font-size: 11px;
  opacity: 0.7;
  z-index: 1;
}
.dpr-book-current {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--dpr-gold);
  color: var(--dpr-leather);
  font-size: 9px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
  z-index: 2;
}

/* 不同年份的皮面颜色 */
.dpr-book-leather-0 { background: linear-gradient(135deg, #6b4226, #8b5a2b); }
.dpr-book-leather-1 { background: linear-gradient(135deg, #4a3520, #6b4226); }
.dpr-book-leather-2 { background: linear-gradient(135deg, #5c3a1e, #7c5c3e); }
.dpr-book-leather-3 { background: linear-gradient(135deg, #3d4a2a, #5c6b3e); }
.dpr-book-leather-4 { background: linear-gradient(135deg, #4a2a3a, #6b3a5c); }

/* 空书架 */
.dpr-empty-shelf {
  text-align: center;
  padding: 40px 20px;
  color: var(--dpr-sub);
}
.dpr-empty-shelf-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }
.dpr-empty-shelf p { font-size: 14px; margin: 4px 0; }

/* 浮动写日记按钮 */
.dpr-fab {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--dpr-leather-light), var(--dpr-leather));
  color: #f5e6d0;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(107, 66, 38, 0.3);
  z-index: 15;
  transition: transform var(--dpr-transition);
}
.dpr-fab:active { transform: scale(0.9); }

/* ===== 日记本（年）视图 ===== */
.dpr-book-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--dpr-paper);
  border-bottom: 1px solid var(--dpr-border);
}
.dpr-book-header-info { flex: 1; }
.dpr-book-header-year { font-size: 24px; font-weight: 800; color: var(--dpr-ink); }
.dpr-book-header-sub { font-size: 12px; color: var(--dpr-sub); }

.dpr-entries-list { padding: 12px; }
.dpr-entry-card {
  background: var(--dpr-paper);
  border-radius: var(--dpr-radius);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--dpr-shadow);
  cursor: pointer;
  position: relative;
  transition: transform var(--dpr-transition), box-shadow var(--dpr-transition);
  border: 1px solid var(--dpr-border);
}
.dpr-entry-card:active { transform: scale(0.98); }
.dpr-entry-card:hover { box-shadow: var(--dpr-shadow-lg); }

.dpr-entry-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.dpr-entry-mood {
  font-size: 24px;
  line-height: 1;
}
.dpr-entry-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--dpr-ink);
}
.dpr-entry-time {
  font-size: 11px;
  color: var(--dpr-sub);
}
.dpr-entry-weather {
  margin-left: auto;
  font-size: 12px;
  color: var(--dpr-sub);
  display: flex;
  align-items: center;
  gap: 3px;
}
.dpr-entry-preview {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--dpr-ink-light);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.dpr-entry-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.dpr-entry-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.dpr-entry-badge.read { background: #f0e6d0; color: #8b6914; }
.dpr-entry-badge.unread { background: #f5f0e8; color: var(--dpr-sub); }
.dpr-entry-badge.response { background: #e8f5e9; color: var(--dpr-success); }

/* 已阅印章 */
.dpr-read-stamp {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 44px;
  height: 44px;
  border: 2.5px solid var(--dpr-danger);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dpr-danger);
  font-size: 13px;
  font-weight: 700;
  transform: rotate(-15deg);
  opacity: 0.45;
  letter-spacing: 1px;
  pointer-events: none;
}

/* ===== 写日记视图 ===== */
.dpr-write-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dpr-write-meta {
  padding: 16px 20px 8px;
  background: var(--dpr-paper);
  border-bottom: 1px solid var(--dpr-border);
}
.dpr-write-date {
  font-size: 16px;
  font-weight: 700;
  color: var(--dpr-ink);
  display: flex;
  align-items: center;
  gap: 8px;
}
.dpr-write-time {
  font-size: 13px;
  color: var(--dpr-sub);
  margin-top: 2px;
}

/* 心情选择 */
.dpr-mood-section { padding: 12px 20px; background: var(--dpr-paper); }
.dpr-section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--dpr-ink-light);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.dpr-mood-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 4px;
}
.dpr-mood-row::-webkit-scrollbar { display: none; }
.dpr-mood-chip {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 2px solid var(--dpr-border);
  background: var(--dpr-bg);
  cursor: pointer;
  transition: all var(--dpr-transition);
  min-width: 56px;
}
.dpr-mood-chip.selected {
  border-color: var(--mood-color);
  background: color-mix(in srgb, var(--mood-color) 12%, var(--dpr-paper));
  transform: translateY(-2px);
}
.dpr-mood-chip-emoji { font-size: 26px; line-height: 1; }
.dpr-mood-chip-label { font-size: 11px; color: var(--dpr-sub); }
.dpr-mood-chip.selected .dpr-mood-chip-label { color: var(--dpr-ink); font-weight: 600; }

/* 天气 */
.dpr-weather-section {
  padding: 8px 20px 12px;
  background: var(--dpr-paper);
  border-bottom: 1px solid var(--dpr-border);
}
.dpr-weather-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--dpr-bg);
  border: 1px solid var(--dpr-border);
}
.dpr-weather-icon { font-size: 28px; }
.dpr-weather-info { flex: 1; }
.dpr-weather-desc { font-size: 14px; font-weight: 600; color: var(--dpr-ink); }
.dpr-weather-temp { font-size: 12px; color: var(--dpr-sub); }
.dpr-weather-refresh {
  border: 1px solid var(--dpr-border);
  background: var(--dpr-paper);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--dpr-sub);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all var(--dpr-transition);
}
.dpr-weather-refresh:hover { color: var(--dpr-primary); border-color: var(--dpr-primary); }
.dpr-weather-manual {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.dpr-weather-manual-btn {
  border: 1px solid var(--dpr-border);
  background: var(--dpr-paper);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--dpr-sub);
  transition: all var(--dpr-transition);
}
.dpr-weather-manual-btn.selected { background: var(--dpr-gold-light); color: var(--dpr-ink); border-color: var(--dpr-gold); }

/* 日记编辑区 */
.dpr-write-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dpr-paper);
  background-image:
    linear-gradient(to bottom, transparent 0, transparent 30px, var(--dpr-border) 30px, var(--dpr-border) 31px, transparent 31px);
  background-size: 100% 32px;
}
.dpr-write-textarea {
  flex: 1;
  width: 100%;
  border: none;
  background: transparent;
  padding: 12px 20px;
  font-size: 15px;
  line-height: 32px;
  font-family: inherit;
  color: var(--dpr-ink);
  outline: none;
  resize: none;
  min-height: 200px;
}
.dpr-write-textarea::placeholder { color: var(--dpr-border); }

/* 底部操作 */
.dpr-write-actions {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: var(--dpr-paper);
  border-top: 1px solid var(--dpr-border);
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
.dpr-btn {
  border: none;
  border-radius: 10px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--dpr-transition);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: inherit;
}
.dpr-btn-primary {
  flex: 1;
  background: linear-gradient(135deg, var(--dpr-leather-light), var(--dpr-leather));
  color: #f5e6d0;
}
.dpr-btn-primary:active { transform: scale(0.97); }
.dpr-btn-primary:disabled { opacity: 0.5; }
.dpr-btn-secondary {
  background: var(--dpr-bg);
  color: var(--dpr-ink);
  border: 1px solid var(--dpr-border);
}
.dpr-btn-secondary:active { transform: scale(0.97); }
.dpr-btn-ai {
  flex: 1.5;
  background: linear-gradient(135deg, #d4a574, #c9a96e);
  color: #fff;
}
.dpr-btn-ai:active { transform: scale(0.97); }
.dpr-btn-ai:disabled { opacity: 0.5; }

/* 加载提示 */
.dpr-loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(245, 240, 232, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  gap: 12px;
}
.dpr-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--dpr-border);
  border-top-color: var(--dpr-leather);
  border-radius: 50%;
  animation: dprSpin 0.8s linear infinite;
}
@keyframes dprSpin { to { transform: rotate(360deg); } }
.dpr-loading-text { font-size: 14px; color: var(--dpr-sub); }

/* ===== 日记详情视图 ===== */
.dpr-detail-container { padding: 16px; padding-bottom: 40px; }
.dpr-detail-card {
  background: var(--dpr-paper);
  border-radius: var(--dpr-radius);
  padding: 24px 20px;
  box-shadow: var(--dpr-shadow);
  margin-bottom: 16px;
  position: relative;
  border: 1px solid var(--dpr-border);
}
.dpr-detail-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--dpr-border);
}
.dpr-detail-mood { font-size: 36px; line-height: 1; }
.dpr-detail-date-block { flex: 1; }
.dpr-detail-date { font-size: 17px; font-weight: 700; color: var(--dpr-ink); }
.dpr-detail-time { font-size: 13px; color: var(--dpr-sub); margin-top: 2px; }
.dpr-detail-weather-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--dpr-sub);
  background: var(--dpr-bg);
  padding: 4px 10px;
  border-radius: 8px;
}
.dpr-detail-content {
  font-size: 15px;
  line-height: 2;
  color: var(--dpr-ink);
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: 0.5px;
}
.dpr-detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--dpr-border);
}

/* AI 回复卡片 */
.dpr-ai-response-card {
  background: linear-gradient(135deg, #fdf8f0, #fff5e8);
  border: 1px solid var(--dpr-gold-light);
  border-left: 4px solid var(--dpr-gold);
  border-radius: var(--dpr-radius);
  padding: 20px;
  box-shadow: var(--dpr-shadow);
  margin-bottom: 16px;
  position: relative;
}
.dpr-ai-response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.dpr-ai-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--dpr-gold), var(--dpr-leather-light));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  flex-shrink: 0;
}
.dpr-ai-name { font-size: 14px; font-weight: 700; color: var(--dpr-ink); }
.dpr-ai-time { font-size: 11px; color: var(--dpr-sub); }
.dpr-ai-content {
  font-size: 14.5px;
  line-height: 1.9;
  color: var(--dpr-ink-light);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 危机提示 */
.dpr-crisis-alert {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-left: 4px solid var(--dpr-danger);
  border-radius: var(--dpr-radius);
  padding: 16px;
  margin-bottom: 16px;
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--dpr-danger);
  white-space: pre-wrap;
}

/* ===== 成长档案视图 ===== */
.dpr-profile-container { padding: 16px; }
.dpr-profile-hero {
  background: linear-gradient(135deg, var(--dpr-leather), var(--dpr-leather-light));
  border-radius: var(--dpr-radius);
  padding: 20px;
  color: #f5e6d0;
  margin-bottom: 16px;
  text-align: center;
  box-shadow: var(--dpr-shadow);
}
.dpr-profile-hero-icon { font-size: 40px; margin-bottom: 8px; }
.dpr-profile-hero-title { font-size: 18px; font-weight: 700; letter-spacing: 2px; }
.dpr-profile-hero-sub { font-size: 12px; opacity: 0.8; margin-top: 4px; }

.dpr-profile-card {
  background: var(--dpr-paper);
  border: 1px solid var(--dpr-border);
  border-radius: var(--dpr-radius);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--dpr-shadow);
}
.dpr-profile-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--dpr-ink);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dpr-profile-card-body {
  font-size: 13px;
  line-height: 1.8;
  color: var(--dpr-ink-light);
  white-space: pre-wrap;
}

.dpr-profile-observations {
  background: var(--dpr-paper);
  border: 1px solid var(--dpr-border);
  border-radius: var(--dpr-radius);
  padding: 16px;
  box-shadow: var(--dpr-shadow);
}
.dpr-obs-item {
  padding: 10px 0;
  border-bottom: 1px dashed var(--dpr-border);
  font-size: 13px;
  line-height: 1.6;
  color: var(--dpr-ink-light);
}
.dpr-obs-item:last-child { border-bottom: none; }
.dpr-obs-time { font-size: 11px; color: var(--dpr-sub); margin-bottom: 4px; }

/* 心情轨迹 */
.dpr-mood-track {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 80px;
  padding: 8px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.dpr-mood-track::-webkit-scrollbar { display: none; }
.dpr-mood-dot {
  flex-shrink: 0;
  width: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.dpr-mood-dot-emoji { font-size: 18px; }
.dpr-mood-dot-bar {
  width: 20px;
  border-radius: 4px;
  min-height: 4px;
}

/* ===== 设置视图 ===== */
.dpr-settings-container { padding: 16px; }
.dpr-settings-card {
  background: var(--dpr-paper);
  border: 1px solid var(--dpr-border);
  border-radius: var(--dpr-radius);
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: var(--dpr-shadow);
}
.dpr-settings-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--dpr-ink);
  margin-bottom: 12px;
}
.dpr-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--dpr-border);
}
.dpr-settings-row:last-child { border-bottom: none; }
.dpr-settings-label { font-size: 14px; color: var(--dpr-ink); }
.dpr-settings-desc { font-size: 12px; color: var(--dpr-sub); margin-top: 2px; }

/* 开关 */
.dpr-switch {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--dpr-border);
  position: relative;
  cursor: pointer;
  transition: background var(--dpr-transition);
  flex-shrink: 0;
}
.dpr-switch.on { background: var(--dpr-success); }
.dpr-switch::after {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  top: 2px;
  left: 2px;
  transition: transform var(--dpr-transition);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.dpr-switch.on::after { transform: translateX(20px); }

.dpr-about-text {
  font-size: 13px;
  line-height: 1.8;
  color: var(--dpr-sub);
}
.dpr-about-text b { color: var(--dpr-ink); }
.dpr-danger-btn {
  border: 1px solid var(--dpr-danger);
  background: transparent;
  color: var(--dpr-danger);
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  margin-top: 12px;
  width: 100%;
}
.dpr-danger-btn:active { background: #fef2f2; }

/* 通用 */
.dpr-empty { color: var(--dpr-sub); font-size: 14px; text-align: center; padding: 30px 16px; line-height: 1.8; }
.dpr-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--dpr-ink);
  color: #fff;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  z-index: 200;
  animation: dprToastIn 0.3s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
@keyframes dprToastIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;

  /* ------------------------- 主渲染 ------------------------- */
  async function mount(container, roche) {
    if (!document.getElementById(STYLE_ID)) {
      const styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.textContent = STYLE_TEXT;
      document.head.appendChild(styleEl);
    }

    const root = document.createElement("div");
    root.className = "dpr-diary-app";
    root.innerHTML = `
      <div class="dpr-header">
        <div class="dpr-header-left">
          <button class="dpr-icon-btn" id="dpr-back-btn" style="display:none;">${ICONS.back}</button>
          <div>
            <div class="dpr-header-title" id="dpr-header-title">我的日记</div>
            <div class="dpr-header-subtitle" id="dpr-header-sub">记录每一个值得被看见的瞬间</div>
          </div>
        </div>
      </div>

      <div class="dpr-content" id="dpr-content">
        <!-- 书架视图 -->
        <div class="dpr-view active" data-view="shelf">
          <div class="dpr-shelf-container" id="dpr-shelf-container"></div>
          <button class="dpr-fab" id="dpr-fab-write" title="写日记">${ICONS.write}</button>
        </div>

        <!-- 日记本视图 -->
        <div class="dpr-view" data-view="book">
          <div class="dpr-book-header" id="dpr-book-header"></div>
          <div class="dpr-entries-list" id="dpr-entries-list"></div>
        </div>

        <!-- 写日记视图 -->
        <div class="dpr-view" data-view="write">
          <div class="dpr-write-container">
            <div class="dpr-write-meta" id="dpr-write-meta"></div>
            <div class="dpr-mood-section">
              <div class="dpr-section-label">今天的心情</div>
              <div class="dpr-mood-row" id="dpr-mood-row"></div>
            </div>
            <div class="dpr-weather-section">
              <div class="dpr-section-label">今日天气</div>
              <div class="dpr-weather-display" id="dpr-weather-display"></div>
              <div class="dpr-weather-manual" id="dpr-weather-manual"></div>
            </div>
            <div class="dpr-write-editor">
              <textarea class="dpr-write-textarea" id="dpr-diary-textarea" placeholder="今天发生了什么？你有什么感受？&#10;&#10;写下你的心事，这里是属于你的安全空间…"></textarea>
            </div>
            <div class="dpr-write-actions">
              <button class="dpr-btn dpr-btn-secondary" id="dpr-save-only">${ICONS.save} 保存</button>
              <button class="dpr-btn dpr-btn-ai" id="dpr-save-send">${ICONS.send} 保存并发送给咨询师</button>
            </div>
          </div>
        </div>

        <!-- 日记详情视图 -->
        <div class="dpr-view" data-view="detail">
          <div class="dpr-detail-container" id="dpr-detail-container"></div>
        </div>

        <!-- 成长档案视图 -->
        <div class="dpr-view" data-view="profile">
          <div class="dpr-profile-container" id="dpr-profile-container"></div>
        </div>

        <!-- 设置视图 -->
        <div class="dpr-view" data-view="settings">
          <div class="dpr-settings-container" id="dpr-settings-container"></div>
        </div>
      </div>

      <!-- 底部导航 -->
      <div class="dpr-tabbar" id="dpr-tabbar">
        <div class="dpr-tab active" data-tab="shelf">${ICONS.book}<span>书架</span></div>
        <div class="dpr-tab" data-tab="profile">${ICONS.sprout}<span>成长档案</span></div>
        <div class="dpr-tab" data-tab="settings">${ICONS.settings}<span>设置</span></div>
      </div>
    `;
    container.appendChild(root);

    /* ==================== 状态管理 ==================== */
    let currentView = "shelf";
    let currentYear = null;
    let currentEntryId = null;
    let writeMood = null;
    let writeWeather = null;
    let isEditing = false;

    const contentEl = root.querySelector("#dpr-content");
    const tabbarEl = root.querySelector("#dpr-tabbar");
    const backBtn = root.querySelector("#dpr-back-btn");

    /* ==================== 视图切换 ==================== */
    function showView(viewName, options = {}) {
      currentView = viewName;
      root.querySelectorAll(".dpr-view").forEach(v => v.classList.remove("active"));
      const view = root.querySelector(`.dpr-view[data-view="${viewName}"]`);
      if (view) view.classList.add("active");

      // 顶部导航控制
      const mainViews = ["shelf", "profile", "settings"];
      const isMain = mainViews.includes(viewName);
      backBtn.style.display = isMain ? "none" : "flex";
      tabbarEl.style.display = isMain ? "flex" : "none";

      // 标题更新
      const titleEl = root.querySelector("#dpr-header-title");
      const subEl = root.querySelector("#dpr-header-sub");
      const titleMap = {
        shelf: ["我的日记", "记录每一个值得被看见的瞬间"],
        book: [`${currentYear} 年日记`, ""],
        write: ["写日记", ""],
        detail: ["日记详情", ""],
        profile: ["成长档案", "AI 咨询师的专业观察与陪伴"],
        settings: ["设置", ""]
      };
      if (titleMap[viewName]) {
        titleEl.textContent = titleMap[viewName][0];
        subEl.textContent = titleMap[viewName][1];
      }

      // 渲染对应视图
      if (viewName === "shelf") renderShelf();
      if (viewName === "book") renderBook();
      if (viewName === "write") renderWrite();
      if (viewName === "detail") renderDetail();
      if (viewName === "profile") renderProfile();
      if (viewName === "settings") renderSettings();

      contentEl.scrollTop = 0;
    }

    backBtn.onclick = () => {
      if (currentView === "book") showView("shelf");
      else if (currentView === "write") {
        if (isEditing) showView("detail");
        else showView("shelf");
      }
      else if (currentView === "detail") showView("book");
    };

    // 底部导航
    tabbarEl.querySelectorAll(".dpr-tab").forEach(tab => {
      tab.onclick = () => {
        tabbarEl.querySelectorAll(".dpr-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        showView(tab.dataset.tab);
      };
    });

    // 更新底部导航高亮
    function updateTab() {
      tabbarEl.querySelectorAll(".dpr-tab").forEach(t => {
        t.classList.toggle("active", t.dataset.tab === currentView ||
          (currentView === "book" && t.dataset.tab === "shelf") ||
          (currentView === "write" && t.dataset.tab === "shelf") ||
          (currentView === "detail" && t.dataset.tab === "shelf"));
      });
    }

    /* ==================== Toast ==================== */
    function toast(msg) {
      const t = document.createElement("div");
      t.className = "dpr-toast";
      t.textContent = msg;
      root.appendChild(t);
      setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.3s"; }, 2000);
      setTimeout(() => t.remove(), 2400);
    }

    /* ==================== 加载遮罩 ==================== */
    function showLoading(text) {
      const overlay = document.createElement("div");
      overlay.className = "dpr-loading-overlay";
      overlay.id = "dpr-loading";
      overlay.innerHTML = `
        <div class="dpr-loading-spinner"></div>
        <div class="dpr-loading-text">${escapeHtml(text || "处理中…")}</div>
      `;
      root.appendChild(overlay);
    }
    function hideLoading() {
      const el = root.querySelector("#dpr-loading");
      if (el) el.remove();
    }

    /* ==================== 书架渲染 ==================== */
    async function renderShelf() {
      updateTab();
      const data = await getJSON(roche, K_DIARY, {});
      const years = Object.keys(data).sort((a, b) => b - a);
      const container = root.querySelector("#dpr-shelf-container");
      const currentY = String(new Date().getFullYear());

      if (years.length === 0) {
        container.innerHTML = `
          <div class="dpr-shelf-intro">
            <h2>我的心理日记</h2>
            <p>这里是一个属于你的安全空间。<br>写下心事，选择是否分享给AI咨询师，<br>让每一个感受都被温柔地看见。</p>
          </div>
          <div class="dpr-empty-shelf">
            <div class="dpr-empty-shelf-icon">📔</div>
            <p>你的日记书架空空如也</p>
            <p style="font-size:12px;">点击右下角的笔，开始写第一篇日记吧</p>
          </div>
        `;
        return;
      }

      let html = `<div class="dpr-shelf-intro">
        <h2>我的心理日记</h2>
        <p>一年一本，记录你的心路历程</p>
      </div><div class="dpr-shelf-grid">`;

      years.forEach((y, idx) => {
        const entries = data[y] || [];
        const isCurrent = y === currentY;
        const leatherClass = `dpr-book-leather-${idx % 5}`;
        html += `
          <div class="dpr-year-book" data-year="${y}">
            <div class="dpr-book-cover ${leatherClass}">
              ${isCurrent ? '<div class="dpr-book-current">在用</div>' : ''}
              <div class="dpr-book-year">${y}</div>
              <div class="dpr-book-label">日记</div>
              <div class="dpr-book-count">${entries.length} 篇</div>
            </div>
          </div>
        `;
      });
      html += "</div>";
      container.innerHTML = html;

      container.querySelectorAll(".dpr-year-book").forEach(el => {
        el.onclick = () => {
          currentYear = el.dataset.year;
          showView("book");
        };
      });
    }

    /* ==================== 日记本（年）渲染 ==================== */
    async function renderBook() {
      const data = await getJSON(roche, K_DIARY, {});
      const entries = (data[currentYear] || []).sort((a, b) => b.timestamp - a.timestamp);
      const headerEl = root.querySelector("#dpr-book-header");
      const listEl = root.querySelector("#dpr-entries-list");

      headerEl.innerHTML = `
        <div class="dpr-book-header-info">
          <div class="dpr-book-header-year">${currentYear} 年</div>
          <div class="dpr-book-header-sub">共 ${entries.length} 篇日记</div>
        </div>
        <button class="dpr-btn dpr-btn-secondary" style="padding:8px 14px;font-size:13px;" id="dpr-book-write">${ICONS.write} 写日记</button>
      `;

      headerEl.querySelector("#dpr-book-write").onclick = () => {
        isEditing = false;
        currentEntryId = null;
        showView("write");
      };

      if (entries.length === 0) {
        listEl.innerHTML = `<div class="dpr-empty">这一年还没有日记<br>点击上方"写日记"开始记录</div>`;
        return;
      }

      let html = "";
      entries.forEach(e => {
        const mood = moodByKey(e.mood);
        const weatherStr = e.weather ? `${e.weather.icon || ""} ${e.weather.desc || ""}${e.weather.temp !== undefined ? " " + e.weather.temp + "°" : ""}` : "";
        const hasAI = !!e.aiResponse;
        html += `
          <div class="dpr-entry-card" data-id="${e.id}">
            ${e.aiRead ? '<div class="dpr-read-stamp">已阅</div>' : ''}
            <div class="dpr-entry-top">
              <span class="dpr-entry-mood">${mood.emoji}</span>
              <div>
                <div class="dpr-entry-date">${fmtDate(e.timestamp).slice(5)}</div>
                <div class="dpr-entry-time">${fmtTime(e.timestamp)}</div>
              </div>
              ${weatherStr ? `<span class="dpr-entry-weather">${weatherStr}</span>` : ""}
            </div>
            <div class="dpr-entry-preview">${escapeHtml(e.content.slice(0, 150))}</div>
            <div class="dpr-entry-footer">
              <span class="dpr-entry-badge ${e.aiRead ? 'read' : 'unread'}">${e.aiRead ? '✓ 已阅' : '未发送'}</span>
              ${hasAI ? '<span class="dpr-entry-badge response">💬 有回复</span>' : ''}
            </div>
          </div>
        `;
      });
      listEl.innerHTML = html;

      listEl.querySelectorAll(".dpr-entry-card").forEach(el => {
        el.onclick = () => {
          currentEntryId = el.dataset.id;
          showView("detail");
        };
      });
    }

    /* ==================== 写日记渲染 ==================== */
    async function renderWrite() {
      const now = nowTs();
      const metaEl = root.querySelector("#dpr-write-meta");
      const moodRow = root.querySelector("#dpr-mood-row");
      const weatherDisplay = root.querySelector("#dpr-weather-display");
      const weatherManual = root.querySelector("#dpr-weather-manual");
      const textarea = root.querySelector("#dpr-diary-textarea");

      // 日期时间
      metaEl.innerHTML = `
        <div class="dpr-write-date">📅 ${fmtDateCN(now)}</div>
        <div class="dpr-write-time">⏰ ${fmtTime(now)}</div>
      `;

      // 心情选择
      writeMood = null;
      moodRow.innerHTML = MOODS.map(m => `
        <div class="dpr-mood-chip" data-mood="${m.key}" style="--mood-color:${m.color};">
          <span class="dpr-mood-chip-emoji">${m.emoji}</span>
          <span class="dpr-mood-chip-label">${m.label}</span>
        </div>
      `).join("");
      moodRow.querySelectorAll(".dpr-mood-chip").forEach(chip => {
        chip.onclick = () => {
          moodRow.querySelectorAll(".dpr-mood-chip").forEach(c => c.classList.remove("selected"));
          chip.classList.add("selected");
          writeMood = chip.dataset.mood;
        };
      });

      // 天气 - 自动获取
      writeWeather = null;
      weatherDisplay.innerHTML = `<div class="dpr-weather-icon">⏳</div><div class="dpr-weather-info"><div class="dpr-weather-desc">正在获取天气…</div></div>`;
      weatherManual.innerHTML = "";

      // 手动天气选项
      MANUAL_WEATHERS.forEach(w => {
        const btn = document.createElement("div");
        btn.className = "dpr-weather-manual-btn";
        btn.innerHTML = `${w.icon} ${w.desc}`;
        btn.onclick = () => {
          weatherManual.querySelectorAll(".dpr-weather-manual-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
          writeWeather = { icon: w.icon, desc: w.desc, temp: null, source: "manual" };
          weatherDisplay.innerHTML = `
            <div class="dpr-weather-icon">${w.icon}</div>
            <div class="dpr-weather-info">
              <div class="dpr-weather-desc">${w.desc}</div>
              <div class="dpr-weather-temp">手动选择</div>
            </div>
          `;
        };
        weatherManual.appendChild(btn);
      });

      // 尝试自动获取天气
      const autoWeather = await fetchWeather();
      if (autoWeather) {
        writeWeather = autoWeather;
        weatherDisplay.innerHTML = `
          <div class="dpr-weather-icon">${autoWeather.icon}</div>
          <div class="dpr-weather-info">
            <div class="dpr-weather-desc">${autoWeather.desc} ${autoWeather.temp !== null && autoWeather.temp !== undefined ? autoWeather.temp + "°C" : ""}</div>
            <div class="dpr-weather-temp">${autoWeather.city ? autoWeather.city + " · " : ""}自动定位</div>
          </div>
          <button class="dpr-weather-refresh" id="dpr-weather-refresh">${ICONS.refresh}刷新</button>
        `;
        const refreshBtn = root.querySelector("#dpr-weather-refresh");
        if (refreshBtn) refreshBtn.onclick = async () => {
          refreshBtn.textContent = "获取中…";
          const w = await fetchWeather();
          if (w) {
            writeWeather = w;
            weatherDisplay.innerHTML = `
              <div class="dpr-weather-icon">${w.icon}</div>
              <div class="dpr-weather-info">
                <div class="dpr-weather-desc">${w.desc} ${w.temp !== null && w.temp !== undefined ? w.temp + "°C" : ""}</div>
                <div class="dpr-weather-temp">${w.city ? w.city + " · " : ""}已刷新</div>
              </div>
              <button class="dpr-weather-refresh" id="dpr-weather-refresh">${ICONS.refresh}刷新</button>
            `;
            root.querySelector("#dpr-weather-refresh").onclick = arguments.callee.caller;
          } else {
            toast("天气获取失败，请手动选择");
            refreshBtn.innerHTML = `${ICONS.refresh}刷新`;
          }
        };
      } else {
        weatherDisplay.innerHTML = `
          <div class="dpr-weather-icon">🌤️</div>
          <div class="dpr-weather-info">
            <div class="dpr-weather-desc">无法自动获取</div>
            <div class="dpr-weather-temp">请从下方手动选择天气</div>
          </div>
        `;
      }

      textarea.value = "";
      textarea.focus();
    }

    /* ==================== 保存日记 ==================== */
    async function saveEntry(sendToAI) {
      const textarea = root.querySelector("#dpr-diary-textarea");
      const content = textarea.value.trim();
      if (!content) {
        toast("日记内容不能为空");
        return;
      }

      const now = nowTs();
      const yearKey = getYearKey(now);
      const entry = {
        id: uuid(),
        timestamp: now,
        content: content,
        mood: writeMood,
        weather: writeWeather,
        aiRead: false,
        aiResponse: null,
        aiResponseAt: null,
        createdAt: now
      };

      // 保存到存储
      const data = await getJSON(roche, K_DIARY, {});
      if (!data[yearKey]) data[yearKey] = [];
      data[yearKey].push(entry);
      await roche.storage.set(K_DIARY, data);

      if (sendToAI) {
        await sendToCounselor(entry, data, yearKey);
      } else {
        toast("日记已保存 ✓");
        currentYear = yearKey;
        currentEntryId = entry.id;
        showView("detail");
      }
    }

    root.querySelector("#dpr-save-only").onclick = () => saveEntry(false);
    root.querySelector("#dpr-save-send").onclick = () => saveEntry(true);

    // 浮动写日记按钮
    root.querySelector("#dpr-fab-write").onclick = () => {
      isEditing = false;
      currentEntryId = null;
      showView("write");
    };

    /* ==================== 发送给AI咨询师 ==================== */
    async function sendToCounselor(entry, data, yearKey) {
      showLoading("咨询师正在阅读你的日记…");

      try {
        const mood = moodByKey(entry.mood);
        const profile = await getJSON(roche, K_PROFILE, defaultProfile());
        const settings = await getJSON(roche, K_SETTINGS, { syncMemory: true });

        // 拼接成长档案上下文
        const profileText = [
          `【情绪模式】: ${profile.emotion || "暂在梳理中"}`,
          `【认知信念】: ${profile.cognition || "暂在观察中"}`,
          `【人际模式】: ${profile.relationship || "暂在观察中"}`,
          `【应对资源】: ${profile.resources || "暂在挖掘中"}`,
          `【成长轨迹】: ${profile.growth || "刚刚开始"}`,
          `【近期观察】: ${(profile.observations || []).slice(-5).map(o => o.text).join("；") || "暂无"}`
        ].join("\n");

        const weatherStr = entry.weather ? `${entry.weather.desc || ""} ${entry.weather.temp !== null && entry.weather.temp !== undefined ? entry.weather.temp + "°C" : ""}` : "未知";

        let systemPrompt = COUNSELOR_PROMPT
          .replace("{{PROFILE_TEXT}}", profileText);

        const userMsg = `日期：${fmtDateCN(entry.timestamp)}\n时间：${fmtTime(entry.timestamp)}\n心情：${mood.emoji} ${mood.label}\n天气：${weatherStr}\n\n${entry.content}`;

        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg }
        ];

        const result = await roche.ai.chat({ messages, temperature: 0.75 });
        let replyText = (result && result.text ? result.text : "").trim();

        // 解析专业观察 JSON
        let obsData = null;
        const obsMatch = replyText.match(/\[\[DIARY_OBS\]\]([\s\S]*?)\[\[\/DIARY_OBS\]\]/);
        if (obsMatch) {
          replyText = replyText.replace(/\[\[DIARY_OBS\]\][\s\S]*?\[\[\/DIARY_OBS\]\]/, "").trim();
          try {
            obsData = JSON.parse(obsMatch[1].trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim());
          } catch (e) {}
        }

        // 更新日记条目
        entry.aiRead = true;
        entry.aiResponse = replyText;
        entry.aiResponseAt = nowTs();

        // 更新存储中的条目
        const idx = data[yearKey].findIndex(e => e.id === entry.id);
        if (idx >= 0) data[yearKey][idx] = entry;
        await roche.storage.set(K_DIARY, data);

        // 更新成长档案
        if (obsData) {
          await updateProfile(obsData, profile, entry, settings);
        }

        hideLoading();

        // 如果有危机关键词，显示危机提示
        if (containsCrisisKeyword(entry.content)) {
          // 危机提示已由AI处理，这里不再额外显示
        }

        toast("咨询师已阅读并回复 ✓");
        currentYear = yearKey;
        currentEntryId = entry.id;
        showView("detail");
      } catch (err) {
        hideLoading();
        toast("AI 服务暂时不可用，日记已保存");
        currentYear = yearKey;
        currentEntryId = entry.id;
        showView("detail");
      }
    }

    /* ==================== 更新成长档案 ==================== */
    async function updateProfile(obsData, oldProfile, entry, settings) {
      const newProfile = { ...oldProfile };

      if (obsData.emotion && obsData.emotion !== "延续") newProfile.emotion = obsData.emotion;
      if (obsData.cognition && obsData.cognition !== "延续") newProfile.cognition = obsData.cognition;
      if (obsData.relationship && obsData.relationship !== "延续") newProfile.relationship = obsData.relationship;
      if (obsData.resources && obsData.resources !== "延续") newProfile.resources = obsData.resources;
      if (obsData.growth && obsData.growth !== "延续") newProfile.growth = obsData.growth;

      // 添加观察记录
      if (!newProfile.observations) newProfile.observations = [];
      if (Array.isArray(obsData.observations)) {
        obsData.observations.forEach(text => {
          if (text && text.trim()) {
            newProfile.observations.push({ ts: entry.timestamp, text: text.trim() });
          }
        });
      }

      newProfile.lastUpdated = nowTs();
      await roche.storage.set(K_PROFILE, newProfile);

      // 可选：同步写入宿主记忆
      if (settings.syncMemory && roche.memory && roche.memory.write && Array.isArray(obsData.observations)) {
        for (const text of obsData.observations) {
          if (text && text.trim()) {
            try {
              await roche.memory.write({
                summaryText: `[心理日记观察] ${text.trim()}`,
                who: ["用户"],
                action: text.trim(),
                when: fmtDate(entry.timestamp),
                where: "心理咨询室·日记",
                source: PLUGIN_ID
              });
            } catch (e) {}
          }
        }
      }
    }

    function defaultProfile() {
      return {
        emotion: "正在通过日记持续建立中…",
        cognition: "正在通过日记持续建立中…",
        relationship: "正在通过日记持续建立中…",
        resources: "正在通过日记持续建立中…",
        growth: "刚刚开启日记之旅",
        observations: [],
        lastUpdated: null
      };
    }

    /* ==================== 日记详情渲染 ==================== */
    async function renderDetail() {
      const data = await getJSON(roche, K_DIARY, {});
      let entry = null;
      let yearKey = null;
      for (const y of Object.keys(data)) {
        const found = (data[y] || []).find(e => e.id === currentEntryId);
        if (found) { entry = found; yearKey = y; break; }
      }
      if (!entry) { showView("shelf"); return; }

      const container = root.querySelector("#dpr-detail-container");
      const mood = moodByKey(entry.mood);
      const weatherStr = entry.weather ? `${entry.weather.icon || ""} ${entry.weather.desc || ""}${entry.weather.temp !== null && entry.weather.temp !== undefined ? " " + entry.weather.temp + "°C" : ""}` : "";

      let html = "";

      // 危机提示
      if (containsCrisisKeyword(entry.content)) {
        html += `<div class="dpr-crisis-alert">${escapeHtml(CRISIS_MESSAGE)}</div>`;
      }

      // 日记正文卡片
      html += `
        <div class="dpr-detail-card">
          ${entry.aiRead ? '<div class="dpr-read-stamp">已阅</div>' : ''}
          <div class="dpr-detail-header">
            <span class="dpr-detail-mood">${mood.emoji}</span>
            <div class="dpr-detail-date-block">
              <div class="dpr-detail-date">${fmtDateCN(entry.timestamp)}</div>
              <div class="dpr-detail-time">${fmtTime(entry.timestamp)} · ${mood.label}</div>
            </div>
            ${weatherStr ? `<div class="dpr-detail-weather-tag">${weatherStr}</div>` : ""}
          </div>
          <div class="dpr-detail-content">${escapeHtml(entry.content)}</div>
      `;

      // 操作按钮
      if (!entry.aiRead) {
        html += `
          <div class="dpr-detail-actions">
            <button class="dpr-btn dpr-btn-ai" id="dpr-detail-send">${ICONS.send} 发送给咨询师</button>
          </div>
        `;
      } else {
        html += `
          <div class="dpr-detail-actions">
            <button class="dpr-btn dpr-btn-secondary" id="dpr-detail-edit" style="flex:1;">编辑</button>
            <button class="dpr-btn dpr-btn-secondary" id="dpr-detail-delete" style="color:var(--dpr-danger);flex:1;">${ICONS.trash} 删除</button>
          </div>
        `;
      }
      html += "</div>";

      // AI 回复卡片
      if (entry.aiResponse) {
        html += `
          <div class="dpr-ai-response-card">
            <div class="dpr-ai-response-header">
              <div class="dpr-ai-avatar">${ICONS.heart}</div>
              <div>
                <div class="dpr-ai-name">AI 咨询师</div>
                <div class="dpr-ai-time">${entry.aiResponseAt ? fmtDate(entry.aiResponseAt) + " " + fmtTime(entry.aiResponseAt) : ""}</div>
              </div>
            </div>
            <div class="dpr-ai-content">${escapeHtml(entry.aiResponse)}</div>
          </div>
        `;
      }

      container.innerHTML = html;

      // 绑定事件
      const sendBtn = root.querySelector("#dpr-detail-send");
      if (sendBtn) {
        sendBtn.onclick = async () => {
          await sendToCounselor(entry, data, yearKey);
        };
      }

      const editBtn = root.querySelector("#dpr-detail-edit");
      if (editBtn) {
        editBtn.onclick = () => {
          // 编辑模式：跳转到写日记视图，预填充内容
          isEditing = true;
          // 预填充
          const textarea = root.querySelector("#dpr-diary-textarea");
          showView("write");
          setTimeout(() => {
            const ta = root.querySelector("#dpr-diary-textarea");
            if (ta) ta.value = entry.content;
            // 预设心情
            if (entry.mood) {
              writeMood = entry.mood;
              const chip = root.querySelector(`.dpr-mood-chip[data-mood="${entry.mood}"]`);
              if (chip) chip.classList.add("selected");
            }
          }, 100);
        };
      }

      const deleteBtn = root.querySelector("#dpr-detail-delete");
      if (deleteBtn) {
        deleteBtn.onclick = async () => {
          const ok = await roche.ui.confirm({
            title: "删除日记",
            message: "确定要删除这篇日记吗？此操作不可撤销。"
          }).catch(() => window.confirm("确定要删除这篇日记吗？"));
          if (!ok) return;

          const idx = data[yearKey].findIndex(e => e.id === entry.id);
          if (idx >= 0) data[yearKey].splice(idx, 1);
          if (data[yearKey].length === 0) delete data[yearKey];
          await roche.storage.set(K_DIARY, data);
          toast("日记已删除");
          showView("book");
        };
      }
    }

    /* ==================== 成长档案渲染 ==================== */
    async function renderProfile() {
      updateTab();
      const profile = await getJSON(roche, K_PROFILE, defaultProfile());
      const data = await getJSON(roche, K_DIARY, {});
      const container = root.querySelector("#dpr-profile-container");

      // 收集所有日记的心情轨迹
      const allEntries = [];
      Object.values(data).forEach(yearEntries => {
        yearEntries.forEach(e => allEntries.push(e));
      });
      allEntries.sort((a, b) => a.timestamp - b.timestamp);
      const recentEntries = allEntries.slice(-20);

      let moodTrackHtml = "";
      if (recentEntries.length > 0) {
        moodTrackHtml = '<div class="dpr-mood-track">';
        recentEntries.forEach(e => {
          const m = moodByKey(e.mood);
          const barHeight = 20 + Math.random() * 40; // 视觉变化
          moodTrackHtml += `
            <div class="dpr-mood-dot">
              <span class="dpr-mood-dot-emoji">${m.emoji}</span>
              <div class="dpr-mood-dot-bar" style="height:${barHeight}px;background:${m.color};opacity:0.6;"></div>
            </div>
          `;
        });
        moodTrackHtml += "</div>";
      } else {
        moodTrackHtml = '<div class="dpr-empty" style="padding:16px;">还没有日记记录</div>';
      }

      const observations = (profile.observations || []).slice(-15).reverse();

      container.innerHTML = `
        <div class="dpr-profile-hero">
          <div class="dpr-profile-hero-icon">🌱</div>
          <div class="dpr-profile-hero-title">成长档案</div>
          <div class="dpr-profile-hero-sub">${profile.lastUpdated ? "最后更新：" + fmtDate(profile.lastUpdated) : "等待你的第一篇日记"}</div>
        </div>

        <div class="dpr-profile-card">
          <div class="dpr-profile-card-title">📈 心情轨迹</div>
          ${moodTrackHtml}
        </div>

        <div class="dpr-profile-card">
          <div class="dpr-profile-card-title">🌊 情绪模式</div>
          <div class="dpr-profile-card-body">${escapeHtml(profile.emotion || "暂在梳理中…")}</div>
        </div>

        <div class="dpr-profile-card">
          <div class="dpr-profile-card-title">🧠 认知信念</div>
          <div class="dpr-profile-card-body">${escapeHtml(profile.cognition || "暂在观察中…")}</div>
        </div>

        <div class="dpr-profile-card">
          <div class="dpr-profile-card-title">🤝 人际模式</div>
          <div class="dpr-profile-card-body">${escapeHtml(profile.relationship || "暂在观察中…")}</div>
        </div>

        <div class="dpr-profile-card">
          <div class="dpr-profile-card-title">💪 应对资源</div>
          <div class="dpr-profile-card-body">${escapeHtml(profile.resources || "暂在挖掘中…")}</div>
        </div>

        <div class="dpr-profile-card">
          <div class="dpr-profile-card-title">🌿 成长轨迹</div>
          <div class="dpr-profile-card-body">${escapeHtml(profile.growth || "刚刚开始…")}</div>
        </div>

        <div class="dpr-profile-card" style="margin-top:4px;">
          <div class="dpr-profile-card-title">📝 咨询师观察记录</div>
        </div>
        <div class="dpr-profile-observations">
          ${observations.length > 0
            ? observations.map(o => `
              <div class="dpr-obs-item">
                <div class="dpr-obs-time">${fmtDate(o.ts)} ${fmtTime(o.ts)}</div>
                <div>${escapeHtml(o.text)}</div>
              </div>
            `).join("")
            : '<div class="dpr-empty">暂无观察记录</div>'}
        </div>
      `;
    }

    /* ==================== 设置渲染 ==================== */
    async function renderSettings() {
      updateTab();
      const settings = await getJSON(roche, K_SETTINGS, { syncMemory: true });
      const container = root.querySelector("#dpr-settings-container");

      container.innerHTML = `
        <div class="dpr-settings-card">
          <div class="dpr-settings-title">记忆同步</div>
          <div class="dpr-settings-row">
            <div>
              <div class="dpr-settings-label">同步至宿主记忆</div>
              <div class="dpr-settings-desc">AI观察记录写入Roche主记忆库</div>
            </div>
            <div class="dpr-switch ${settings.syncMemory ? 'on' : ''}" id="dpr-toggle-memory"></div>
          </div>
        </div>

        <div class="dpr-settings-card">
          <div class="dpr-settings-title">关于</div>
          <div class="dpr-about-text">
            <p><b>心理咨询室·日记 v2.0.0</b></p>
            <p>一本属于你的心理成长日记。</p>
            <p>· 📔 一年一本日记本，书架式管理<br>
               · ✍️ 写日记自动添加日期时间<br>
               · 😊 可选心情，自动获取天气<br>
               · 💌 可选择发送给AI咨询师<br>
               · 📋 已阅日记显示"已阅"印章<br>
               · 🌱 AI维护专业成长档案</p>
            <p style="margin-top:10px;font-size:11px;opacity:0.7;">本应用非医疗诊断工具，不能替代专业心理咨询/精神科诊疗。如遇紧急情况，请拨打全国心理援助热线 12356。</p>
          </div>
        </div>

        <div class="dpr-settings-card">
          <div class="dpr-settings-title">数据管理</div>
          <button class="dpr-danger-btn" id="dpr-clear-all">清空全部日记与档案数据</button>
        </div>
      `;

      // 记忆同步开关
      const memSwitch = root.querySelector("#dpr-toggle-memory");
      memSwitch.onclick = async () => {
        settings.syncMemory = !settings.syncMemory;
        memSwitch.classList.toggle("on", settings.syncMemory);
        await roche.storage.set(K_SETTINGS, settings);
        toast(settings.syncMemory ? "已开启记忆同步" : "已关闭记忆同步");
      };

      // 清空数据
      root.querySelector("#dpr-clear-all").onclick = async () => {
        const ok = await roche.ui.confirm({
          title: "清空全部数据",
          message: "将删除所有日记、成长档案和设置，是否继续？"
        }).catch(() => window.confirm("将删除所有日记、成长档案和设置，是否继续？"));
        if (!ok) return;

        await Promise.all([
          roche.storage.delete(K_DIARY),
          roche.storage.delete(K_PROFILE),
          roche.storage.delete(K_SETTINGS)
        ]);
        toast("已清空全部数据");
        showView("shelf");
      };
    }

    /* ==================== 初始化 ==================== */
    await renderShelf();
    return { root };
  }

  async function unmount(container) {
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    container.replaceChildren();
  }

  window.RochePlugin.register({
    id: PLUGIN_ID,
    name: "心理咨询室·日记",
    version: "2.0.0",
    apps: [
      {
        id: APP_ID,
        name: "心理日记",
        icon: "book",
        iconImage: "",
        mount,
        unmount
      }
    ]
  });
})();