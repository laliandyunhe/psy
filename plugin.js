/* ==========================================================
 * 心理咨询室·日记 (psych-counseling-room) v3.0.0
 * 
 * v3.0 变更：
 * - 日记支持上传图片（base64存储，随日记发送给AI）
 * - Token估算显示（中文≈1.5字/token，英文≈4字符/token）
 * - 全面扁平化重设计：无阴影、治愈系色彩
 * - 保留：分类提示词编辑、独立API配置、模型拉取、成长档案
 * ========================================================== */

(function () {
  "use strict";

  const PLUGIN_ID = "psych-counseling-room";
  const APP_ID = "psych-counseling-room-home";

  const K_DIARY = "diary-data-v3";
  const K_PROFILE = "growth-profile-v3";
  const K_PROMPTS = "diary-prompts-v2";
  const K_API_CONFIG = "diary-api-config";

  /* ---- 心情 ---- */
  const MOODS = [
    { key: "happy",    emoji: "😊", label: "开心",  color: "#7EC8A0" },
    { key: "calm",     emoji: "😌", label: "平静",  color: "#8ECDE0" },
    { key: "grateful", emoji: "🥰", label: "感恩",  color: "#F0A8B8" },
    { key: "sad",      emoji: "😢", label: "难过",  color: "#8BAEE0" },
    { key: "angry",    emoji: "😤", label: "愤怒",  color: "#E0A0A0" },
    { key: "anxious",  emoji: "😰", label: "焦虑",  color: "#E0B896" },
    { key: "tired",    emoji: "😴", label: "疲惫",  color: "#B0C4DE" },
    { key: "confused", emoji: "🤔", label: "困惑",  color: "#C8B0D8" },
    { key: "fear",     emoji: "😨", label: "恐惧",  color: "#A0A8D8" },
    { key: "numb",     emoji: "🫠", label: "无力",  color: "#B8B8C0" }
  ];
  function moodByKey(key) { return MOODS.find(m => m.key === key) || MOODS[1]; }

  /* ---- 天气 ---- */
  function weatherCodeToDesc(code) {
    const m = {0:"晴",1:"晴",2:"多云",3:"阴",45:"雾",48:"雾凇",51:"小毛毛雨",53:"毛毛雨",55:"大毛毛雨",56:"冻毛毛雨",57:"大冻毛毛雨",61:"小雨",63:"中雨",65:"大雨",66:"冻雨",67:"大冻雨",71:"小雪",73:"中雪",75:"大雪",77:"霰",80:"小阵雨",81:"阵雨",82:"大阵雨",85:"阵雪",86:"大阵雪",95:"雷暴",96:"雷暴冰雹",99:"大雷暴冰雹"};
    return m[code] || "未知";
  }
  function weatherCodeToIcon(code) {
    if (code===0||code===1) return "☀️"; if (code===2) return "⛅"; if (code===3) return "☁️";
    if (code>=45&&code<=48) return "🌫️"; if (code>=51&&code<=67) return "🌦️"; if (code>=71&&code<=77) return "🌨️";
    if (code>=80&&code<=82) return "🌧️"; if (code>=85&&code<=86) return "🌨️"; if (code>=95) return "⛈️"; return "🌤️";
  }
  const MANUAL_WEATHERS = [
    { icon:"☀️",desc:"晴" },{ icon:"⛅",desc:"多云" },{ icon:"☁️",desc:"阴" },{ icon:"🌧️",desc:"雨" },
    { icon:"⛈️",desc:"雷雨" },{ icon:"🌨️",desc:"雪" },{ icon:"🌫️",desc:"雾" },{ icon:"🌪️",desc:"恶劣" }
  ];

  /* ---- 危机 ---- */
  const CRISIS_KEYWORDS = ["自杀","不想活","活不下去","自残","割腕","伤害自己","结束生命","了结自己","跳楼","轻生","想死"];
  const CRISIS_MESSAGE = "我在你的文字里感受到了很深的痛苦。你的安全对我来说是最重要的。\n\n如果你现在有伤害自己的冲动，请联系：\n· 全国心理援助热线：12356（24小时）\n· 紧急情况请拨打：120 或 110\n· 也可以联系身边任何一个你信任的人\n\n你不是一个人。这些感受不会永远持续，但此刻你值得被帮助。";

  /* =========================================================
   *  分类提示词系统
   * ========================================================= */
  const PROMPT_CATEGORIES = [
    {
      id:"counselor", title:"将日记发给 AI", icon:"💌",
      desc:"选择「保存并发送给咨询师」时，以下提示词组合为完整 System Prompt 发送给 AI。",
      items:[
        { key:"counselor_role", label:"咨询师角色设定",
          note:"定义 AI 作为心理咨询师的身份背景与专业流派。这是 AI「人设」的核心。",
          default:`你是一位拥有15年以上临床经验的资深心理咨询师，正在阅读来访者的日记。\n你融合人本主义疗法、认知行为疗法(CBT)、接纳承诺疗法(ACT)与叙事疗法的视角，擅长在温和的陪伴中帮助来访者觉察自我、发现力量、梳理心路历程。`
        },
        { key:"counselor_style", label:"回复风格与字数",
          note:"控制 AI 回复的语气、长度和格式。影响来访者阅读体验的关键参数。",
          default:`【阅读日记时的你】\n1. 像收到一封来自朋友的信那样，认真、用心地阅读每一个字。先共情，再探索。\n2. 用2-3句话确认你听到了对方的感受，让来访者感到被真正看见、被理解。\n3. 如果留意到认知模式（如灾难化思维、非黑即白、过度归因、should-thinking等），温和地点出，用"我留意到..."而非"你不应该..."的方式。\n4. 提一个开放性问题，帮助来访者更深入地觉察自己。一次只问一个，不要追问太多。\n5. 真诚地肯定来访者已有的力量和勇气——赋能而非诊断，看见而非评判。\n6. 回复像一封温暖的信，150-300字，凝练而有温度。不要长篇大论，不要罗列条目。`
        },
        { key:"counselor_safety", label:"安全边界与危机处理",
          note:"当日记内容涉及自伤、自杀等危机信号时，AI 的应对规则。请谨慎修改。",
          default:`【安全边界】\n- 如果日记中涉及自伤、自杀意念，优先表达关心：\n  "我在你的文字里感受到了很深的痛苦。你的安全对我来说是最重要的。如果你现在有伤害自己的冲动，请联系：全国心理援助热线 12356（24小时），或拨打120/110。你不是一个人。"\n- 不做医疗诊断，不替代专业精神科诊疗\n- 不堆砌专业术语，不使用量表标记`
        },
        { key:"counselor_context", label:"成长档案注入模板",
          note:"{{PROFILE_TEXT}} 会被自动替换为档案内容。请勿删除该占位符。",
          default:`【当前来访者的成长档案】\n（供你参考，不要在回复中直接复述这些内容）\n{{PROFILE_TEXT}}`
        },
        { key:"counselor_instruction", label:"回应指令与观察输出格式",
          note:"告诉 AI 在回复正文后用特定格式输出专业观察（用户不可见，仅用于更新档案）。修改格式可能导致档案更新失败。",
          default:`请阅读以下日记并给予温暖而专业的回应。\n\n在回应正文之后，请另起一行用以下格式输出你的专业观察（这部分不会展示给来访者，仅用于更新档案）：\n[[DIARY_OBS]]\n{"observations":["1-2条基于本次日记的专业观察"],"emotion":"情绪模式更新","cognition":"认知模式更新","relationship":"人际模式更新","resources":"应对资源更新","growth":"成长轨迹一句话总结"}\n[[/DIARY_OBS]]\n\n如果某个维度信息不足以更新，该字段写"延续"。observations 为数组，每条一句话。\n\n如果日记附带图片，请结合图片内容理解来访者的情绪与处境，给予更有针对性的回应。`
        }
      ]
    },
    {
      id:"profile", title:"成长档案", icon:"🌱",
      desc:"成长档案由 AI 在阅读日记后自动维护。以下提示词定义档案的维度结构和更新规则。",
      items:[
        { key:"profile_dimensions", label:"档案维度定义",
          note:"定义成长档案包含哪些维度。增减维度需同时修改 AI 输出格式和档案渲染代码。",
          default:`成长档案包含以下五个维度：\n- emotion（情绪模式）：主要情绪体验、情绪触发模式、情绪调节方式\n- cognition（认知信念）：核心信念、自动化思维模式、对自我和世界的看法\n- relationship（人际模式）：人际互动风格、依恋特征、安全感来源\n- resources（应对资源）：拥有的积极资源、支持系统、有效应对策略\n- growth（成长轨迹）：一句话总结来访者的成长方向与变化`
        },
        { key:"profile_update_rule", label:"档案更新规则",
          note:"告诉 AI 如何更新档案：什么时候覆盖、什么时候延续、如何写观察记录。",
          default:`档案更新规则：\n1. 仅在本次日记提供了新的、有意义的信息时更新对应维度。\n2. 如果某个维度在本次日记中没有新信息，输出"延续"以保持原有内容不变。\n3. observations 数组每条为一句话的专业观察，应客观、简练，避免主观评判。\n4. 观察 内容应是对来访者心理模式的事实性描述，而非建议或诊断。`
        },
        { key:"profile_obs_format", label:"观察输出格式",
          note:"定义 AI 输出专业观察的 JSON 格式。该格式与代码中的解析逻辑严格对应。",
          default:`专业观察 JSON 格式：\n{\n  "observations": ["观察1", "观察2"],\n  "emotion": "情绪模式更新内容或'延续'",\n  "cognition": "认知模式更新内容或'延续'",\n  "relationship": "人际模式更新内容或'延续'",\n  "resources": "应对资源更新内容或'延续'",\n  "growth": "成长轨迹一句话总结或'延续'"\n}`
        }
      ]
    }
  ];

  function getDefaultPrompts() {
    const r = {}; PROMPT_CATEGORIES.forEach(c => c.items.forEach(i => r[i.key] = i.default)); return r;
  }
  async function getPrompts(roche) {
    const s = await getJSON(roche, K_PROMPTS, null);
    const d = getDefaultPrompts();
    return s ? { ...d, ...s } : d;
  }
  function buildCounselorPrompt(prompts, profileText) {
    return [prompts["counselor_role"], prompts["counselor_style"], prompts["counselor_safety"],
      prompts["counselor_context"].replace("{{PROFILE_TEXT}}", profileText), prompts["counselor_instruction"]
    ].join("\n\n");
  }

  /* ---- 图标 ---- */
  const I = {
    back:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
    book:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    write:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    sprout:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>`,
    settings:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    send:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    save:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    refresh:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    trash:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    heart:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    reset:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    chevron:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    cloud:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
    image:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    close:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  /* ---- 工具 ---- */
  function nowTs(){return Date.now();}
  function pad(n){return String(n).padStart(2,"0");}
  function fmtDate(ts){const d=new Date(ts);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
  function fmtTime(ts){const d=new Date(ts);return `${pad(d.getHours())}:${pad(d.getMinutes())}`;}
  function fmtDateCN(ts){const d=new Date(ts);const ms=["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];const ds=["日","一","二","三","四","五","六"];return `${d.getFullYear()}年${ms[d.getMonth()]}${d.getDate()}日 星期${ds[d.getDay()]}`;}
  function getYearKey(ts){return String(new Date(ts).getFullYear());}
  function escapeHtml(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function uuid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
  function containsCrisisKeyword(text){const t=String(text||"");return CRISIS_KEYWORDS.some(kw=>t.includes(kw));}
  async function getJSON(roche,key,fb){try{const v=await roche.storage.get(key);return v===undefined||v===null?fb:v;}catch(e){return fb;}}

  /* ---- Token 估算 ---- */
  function estimateTokens(text) {
    if (!text) return 0;
    let cn = 0, en = 0, other = 0;
    for (const ch of String(text)) {
      if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(ch)) cn++;
      else if (/[a-zA-Z0-9]/.test(ch)) en++;
      else other++;
    }
    return Math.ceil(cn / 1.5 + en / 4 + other / 2);
  }
  function fmtTokens(n) {
    if (n < 1000) return n + " tokens";
    return (n / 1000).toFixed(1) + "k tokens";
  }

  /* ---- 图片转 base64 (压缩) ---- */
  function fileToCompressedBase64(file, maxW, quality) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) return reject(new Error("not image"));
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const mw = maxW || 1024;
          let w = img.width, h = img.height;
          if (w > mw) { h = Math.round(h * mw / w); w = mw; }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL("image/jpeg", quality || 0.7);
          resolve(base64);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---- 天气 ---- */
  async function fetchWeather() {
    try {
      const pos = await new Promise((res, rej) => {
        if (!navigator.geolocation) return rej(new Error("no geo"));
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000, enableHighAccuracy: false });
      });
      const lat = pos.coords.latitude.toFixed(2), lon = pos.coords.longitude.toFixed(2);
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const data = await res.json();
      if (data && data.current_weather) {
        const cw = data.current_weather;
        return { temp: Math.round(cw.temperature), code: cw.weathercode, desc: weatherCodeToDesc(cw.weathercode), icon: weatherCodeToIcon(cw.weathercode), source: "auto" };
      }
    } catch (e) {}
    try {
      const res = await fetch("https://wttr.in/?format=j1", { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const data = await res.json();
        const cur = data.current_condition && data.current_condition[0];
        const area = data.nearest_area && data.nearest_area[0];
        if (cur) {
          const code = parseInt(cur.weatherCode);
          return { temp: parseInt(cur.temp_C), code, desc: weatherCodeToDesc(code) || (cur.weatherDesc&&cur.weatherDesc[0]&&cur.weatherDesc[0].value) || "未知", icon: weatherCodeToIcon(code), city: area ? (area.areaName&&area.areaName[0]&&area.areaName[0].value) : "", source: "auto" };
        }
      }
    } catch (e) {}
    return null;
  }

  /* ---- API 配置 ---- */
  async function getApiConfig(roche) { return await getJSON(roche, K_API_CONFIG, {}); }
  function applyApiConfig(opts, cfg) {
    if (!cfg) return opts;
    if (cfg.provider) opts.provider = cfg.provider;
    if (cfg.model) opts.model = cfg.model;
    if (cfg.endpoint) opts.endpoint = cfg.endpoint;
    if (cfg.apiKey) opts.apiKey = cfg.apiKey;
    return opts;
  }
  async function fetchModels(endpoint, apiKey) {
    if (!endpoint) return [];
    try {
      const url = endpoint.replace(/\/+$/, "") + "/models";
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      if (data && Array.isArray(data.data)) return data.data.map(m => m.id).filter(Boolean).sort();
      if (data && Array.isArray(data.models)) return data.models.map(m => (typeof m === "string" ? m : m.id || m.name)).filter(Boolean).sort();
      return [];
    } catch (e) { return []; }
  }

  /* =========================================================
   *  样式 — 扁平化治愈系，无阴影
   * ========================================================= */
  const STYLE_ID = `${PLUGIN_ID}-style`;
  const STYLE_TEXT = `
.dpr-app {
  --bg: #F2F6F4;
  --card: #FFFFFF;
  --card-alt: #F7FAF8;
  --primary: #5B9B8A;
  --primary-light: #E8F4F0;
  --primary-dark: #3D7A6A;
  --accent: #7EC8B8;
  --ink: #3A4A42;
  --ink-light: #6B7B73;
  --sub: #9CA8A2;
  --border: #E2E8E5;
  --danger: #D4756B;
  --danger-light: #FDF0EE;
  --success: #6BAA8F;
  --warn: #E0B870;
  --r: 12px;
  --r-sm: 8px;
  --t: 0.25s ease;

  height:100%; width:100%; display:flex; flex-direction:column;
  background:var(--bg); color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC",sans-serif;
  box-sizing:border-box; overflow:hidden; position:relative;
}
.dpr-app * { box-sizing:border-box; }

.dpr-header {
  display:flex; align-items:center; gap:10px; padding:12px 16px;
  background:var(--card); border-bottom:1px solid var(--border);
  min-height:52px; flex-shrink:0;
}
.dpr-header-title { font-size:17px; font-weight:700; color:var(--ink); }
.dpr-header-sub { font-size:11px; color:var(--sub); }
.dpr-icon-btn {
  display:inline-flex; align-items:center; justify-content:center;
  width:36px; height:36px; border:none; background:transparent;
  color:var(--ink-light); cursor:pointer; border-radius:50%; transition:background var(--t);
}
.dpr-icon-btn:active { background:var(--primary-light); }

.dpr-tabbar {
  display:flex; background:var(--card); border-top:1px solid var(--border);
  flex-shrink:0; padding-bottom:env(safe-area-inset-bottom,0px);
}
.dpr-tab {
  flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:6px 4px; font-size:11px; color:var(--sub); cursor:pointer; gap:2px;
  transition:color var(--t); font-weight:500;
}
.dpr-tab.active { color:var(--primary); font-weight:600; }
.dpr-tab:active { opacity:0.7; }

.dpr-content { flex:1; overflow-y:auto; position:relative; }
.dpr-view { display:none; flex-direction:column; min-height:100%; }
.dpr-view.active { display:flex; animation:dprFade 0.25s ease; }
@keyframes dprFade { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }

/* 书架 */
.dpr-shelf-c { padding:20px 16px; }
.dpr-shelf-intro { text-align:center; margin-bottom:24px; }
.dpr-shelf-intro h2 { font-size:22px; font-weight:700; color:var(--ink); margin:0 0 8px; }
.dpr-shelf-intro p { font-size:13px; color:var(--sub); margin:0; line-height:1.6; }
.dpr-shelf-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:24px; }
.dpr-year-book { cursor:pointer; transition:transform var(--t); }
.dpr-year-book:active { transform:scale(0.96); }
.dpr-book-cover {
  aspect-ratio:3/4; border-radius:4px 10px 10px 4px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; position:relative; overflow:hidden;
  color:#f5f5f5; transition:transform var(--t);
}
.dpr-book-cover::before { content:""; position:absolute; left:6px; top:0; bottom:0; width:2px; background:rgba(255,255,255,0.2); }
.dpr-book-cover::after { content:""; position:absolute; inset:8px 10px 8px 14px; border:1px solid rgba(255,255,255,0.15); border-radius:6px; }
.dpr-book-year { font-size:32px; font-weight:800; z-index:1; }
.dpr-book-label { font-size:12px; letter-spacing:4px; margin-top:4px; opacity:0.8; z-index:1; }
.dpr-book-count { position:absolute; bottom:14px; font-size:11px; opacity:0.7; z-index:1; }
.dpr-book-current { position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.9); color:var(--primary); font-size:9px; padding:2px 8px; border-radius:8px; font-weight:600; z-index:2; }
.dpr-bk-0 { background:#5B9B8A; } .dpr-bk-1 { background:#6B8AAE; } .dpr-bk-2 { background:#8B7AAE; } .dpr-bk-3 { background:#AE7A8B; } .dpr-bk-4 { background:#7AAE9B; }
.dpr-empty-shelf { text-align:center; padding:40px 20px; color:var(--sub); }
.dpr-empty-shelf-icon { font-size:48px; margin-bottom:12px; opacity:0.4; }

.dpr-fab {
  position:absolute; bottom:20px; right:20px; width:56px; height:56px; border-radius:50%;
  background:var(--primary); color:#fff; border:none; display:flex; align-items:center; justify-content:center;
  cursor:pointer; z-index:15; transition:transform var(--t);
}
.dpr-fab:active { transform:scale(0.9); }

/* 日记本 */
.dpr-book-hdr { display:flex; align-items:center; gap:12px; padding:16px; background:var(--card); border-bottom:1px solid var(--border); }
.dpr-book-hdr-info { flex:1; }
.dpr-book-hdr-y { font-size:24px; font-weight:800; color:var(--ink); }
.dpr-book-hdr-s { font-size:12px; color:var(--sub); }
.dpr-entries { padding:12px; }
.dpr-entry-card {
  background:var(--card); border-radius:var(--r); padding:16px; margin-bottom:12px;
  cursor:pointer; position:relative; transition:transform var(--t); border:1px solid var(--border);
}
.dpr-entry-card:active { transform:scale(0.98); }
.dpr-entry-top { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.dpr-entry-mood { font-size:24px; line-height:1; }
.dpr-entry-date { font-size:13px; font-weight:600; color:var(--ink); }
.dpr-entry-time { font-size:11px; color:var(--sub); }
.dpr-entry-weather { margin-left:auto; font-size:12px; color:var(--sub); display:flex; align-items:center; gap:3px; }
.dpr-entry-preview { font-size:13.5px; line-height:1.7; color:var(--ink-light); overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
.dpr-entry-img-count { font-size:11px; color:var(--sub); margin-top:4px; display:flex; align-items:center; gap:3px; }
.dpr-entry-footer { display:flex; align-items:center; gap:8px; margin-top:10px; }
.dpr-badge { font-size:10px; padding:2px 8px; border-radius:10px; font-weight:500; }
.dpr-badge.read { background:var(--primary-light); color:var(--primary-dark); }
.dpr-badge.unread { background:var(--card-alt); color:var(--sub); }
.dpr-badge.response { background:#E8F5EC; color:var(--success); }
.dpr-read-stamp {
  position:absolute; top:14px; right:14px; width:44px; height:44px;
  border:2.5px solid var(--danger); border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:var(--danger); font-size:13px; font-weight:700; transform:rotate(-15deg); opacity:0.4; pointer-events:none;
}

/* 写日记 */
.dpr-write-c { flex:1; display:flex; flex-direction:column; overflow:hidden; }
.dpr-write-meta { padding:16px 20px 8px; background:var(--card); border-bottom:1px solid var(--border); }
.dpr-write-date { font-size:16px; font-weight:700; color:var(--ink); display:flex; align-items:center; gap:8px; }
.dpr-write-time { font-size:13px; color:var(--sub); margin-top:2px; }
.dpr-mood-section { padding:12px 20px; background:var(--card); }
.dpr-sect-label { font-size:13px; font-weight:600; color:var(--ink-light); margin-bottom:10px; display:flex; align-items:center; gap:4px; }
.dpr-mood-row { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:4px; }
.dpr-mood-row::-webkit-scrollbar { display:none; }
.dpr-mood-chip {
  flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:2px; padding:8px 10px;
  border-radius:12px; border:2px solid var(--border); background:var(--card-alt); cursor:pointer;
  transition:all var(--t); min-width:56px;
}
.dpr-mood-chip.selected { border-color:var(--mood-c); background:color-mix(in srgb, var(--mood-c) 15%, var(--card)); transform:translateY(-2px); }
.dpr-mood-chip-emoji { font-size:26px; line-height:1; }
.dpr-mood-chip-label { font-size:11px; color:var(--sub); }
.dpr-mood-chip.selected .dpr-mood-chip-label { color:var(--ink); font-weight:600; }
.dpr-weather-section { padding:8px 20px 12px; background:var(--card); border-bottom:1px solid var(--border); }
.dpr-weather-display { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:12px; background:var(--card-alt); border:1px solid var(--border); }
.dpr-weather-icon { font-size:28px; }
.dpr-weather-info { flex:1; }
.dpr-weather-desc { font-size:14px; font-weight:600; color:var(--ink); }
.dpr-weather-temp { font-size:12px; color:var(--sub); }
.dpr-weather-refresh { border:1px solid var(--border); background:var(--card); border-radius:8px; padding:6px 10px; font-size:12px; color:var(--sub); cursor:pointer; display:flex; align-items:center; gap:4px; transition:all var(--t); }
.dpr-weather-refresh:active { background:var(--primary-light); }
.dpr-weather-manual { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
.dpr-weather-manual-btn { border:1px solid var(--border); background:var(--card); border-radius:8px; padding:5px 10px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:3px; color:var(--sub); transition:all var(--t); }
.dpr-weather-manual-btn.selected { background:var(--primary-light); color:var(--primary-dark); border-color:var(--primary); }

.dpr-editor-c { flex:1; display:flex; flex-direction:column; overflow:hidden; background:var(--card); }
.dpr-textarea { flex:1; width:100%; border:none; background:transparent; padding:12px 20px; font-size:15px; line-height:1.8; font-family:inherit; color:var(--ink); outline:none; resize:none; min-height:120px; }
.dpr-textarea::placeholder { color:var(--border); }

/* 图片预览 */
.dpr-img-bar { display:flex; gap:8px; padding:8px 16px; overflow-x:auto; scrollbar-width:none; background:var(--card); border-top:1px solid var(--border); }
.dpr-img-bar::-webkit-scrollbar { display:none; }
.dpr-img-thumb { position:relative; flex-shrink:0; width:64px; height:64px; border-radius:8px; overflow:hidden; border:1px solid var(--border); }
.dpr-img-thumb img { width:100%; height:100%; object-fit:cover; }
.dpr-img-thumb-del { position:absolute; top:2px; right:2px; width:20px; height:20px; border-radius:50%; background:rgba(0,0,0,0.5); color:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.dpr-img-add { flex-shrink:0; width:64px; height:64px; border-radius:8px; border:2px dashed var(--border); background:var(--card-alt); color:var(--sub); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; gap:2px; font-size:10px; transition:all var(--t); }
.dpr-img-add:active { border-color:var(--primary); color:var(--primary); }

/* Token 估算 */
.dpr-token-bar { display:flex; align-items:center; gap:8px; padding:6px 16px; background:var(--card-alt); border-top:1px solid var(--border); font-size:11px; color:var(--sub); }
.dpr-token-num { font-weight:600; color:var(--primary); }
.dpr-token-warn { color:var(--warn); }

.dpr-write-actions { display:flex; gap:10px; padding:12px 16px; background:var(--card); border-top:1px solid var(--border); padding-bottom:calc(12px + env(safe-area-inset-bottom,0px)); }
.dpr-btn { border:none; border-radius:10px; padding:12px 20px; font-size:14px; font-weight:600; cursor:pointer; transition:all var(--t); display:flex; align-items:center; justify-content:center; gap:6px; font-family:inherit; }
.dpr-btn:active { transform:scale(0.97); }
.dpr-btn:disabled { opacity:0.5; }
.dpr-btn-sec { background:var(--card-alt); color:var(--ink); border:1px solid var(--border); }
.dpr-btn-pri { flex:1; background:var(--primary); color:#fff; }
.dpr-btn-ai { flex:1.5; background:var(--primary); color:#fff; }

.dpr-loading { position:fixed; inset:0; background:rgba(242,246,244,0.92); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:100; gap:12px; }
.dpr-spinner { width:36px; height:36px; border:3px solid var(--border); border-top-color:var(--primary); border-radius:50%; animation:dprSpin 0.7s linear infinite; }
@keyframes dprSpin { to{transform:rotate(360deg);} }
.dpr-loading-text { font-size:14px; color:var(--sub); }

/* 详情 */
.dpr-detail-c { padding:16px; padding-bottom:40px; }
.dpr-detail-card { background:var(--card); border-radius:var(--r); padding:24px 20px; margin-bottom:16px; position:relative; border:1px solid var(--border); }
.dpr-detail-hdr { display:flex; align-items:flex-start; gap:12px; margin-bottom:16px; padding-bottom:14px; border-bottom:1px dashed var(--border); }
.dpr-detail-mood { font-size:36px; line-height:1; }
.dpr-detail-date { font-size:17px; font-weight:700; color:var(--ink); }
.dpr-detail-time { font-size:13px; color:var(--sub); margin-top:2px; }
.dpr-detail-wtag { display:flex; align-items:center; gap:4px; font-size:12px; color:var(--sub); background:var(--card-alt); padding:4px 10px; border-radius:8px; }
.dpr-detail-content { font-size:15px; line-height:2; color:var(--ink); white-space:pre-wrap; word-break:break-word; }
.dpr-detail-imgs { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
.dpr-detail-img { width:100%; border-radius:8px; border:1px solid var(--border); cursor:pointer; }
.dpr-detail-actions { display:flex; gap:10px; margin-top:20px; padding-top:16px; border-top:1px dashed var(--border); }
.dpr-ai-card { background:var(--primary-light); border:1px solid var(--border); border-left:3px solid var(--primary); border-radius:var(--r); padding:20px; margin-bottom:16px; }
.dpr-ai-hdr { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.dpr-ai-avatar { width:32px; height:32px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; font-size:16px; color:#fff; flex-shrink:0; }
.dpr-ai-name { font-size:14px; font-weight:700; color:var(--ink); }
.dpr-ai-time { font-size:11px; color:var(--sub); }
.dpr-ai-content { font-size:14.5px; line-height:1.9; color:var(--ink-light); white-space:pre-wrap; word-break:break-word; }
.dpr-crisis { background:var(--danger-light); border:1px solid var(--border); border-left:3px solid var(--danger); border-radius:var(--r); padding:16px; margin-bottom:16px; font-size:13.5px; line-height:1.8; color:var(--danger); white-space:pre-wrap; }

/* 图片大图查看 */
.dpr-img-viewer { position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:300; display:flex; align-items:center; justify-content:center; padding:20px; }
.dpr-img-viewer img { max-width:100%; max-height:100%; border-radius:8px; }
.dpr-img-viewer-close { position:absolute; top:16px; right:16px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.2); color:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; }

/* 成长档案 */
.dpr-profile-c { padding:16px; }
.dpr-profile-hero { background:var(--primary); border-radius:var(--r); padding:20px; color:#fff; margin-bottom:16px; text-align:center; }
.dpr-profile-hero-icon { font-size:40px; margin-bottom:8px; }
.dpr-profile-hero-title { font-size:18px; font-weight:700; }
.dpr-profile-hero-sub { font-size:12px; opacity:0.8; margin-top:4px; }
.dpr-pcard { background:var(--card); border:1px solid var(--border); border-radius:var(--r); padding:16px; margin-bottom:12px; }
.dpr-pcard-title { font-size:14px; font-weight:700; color:var(--ink); margin-bottom:8px; display:flex; align-items:center; gap:6px; }
.dpr-pcard-body { font-size:13px; line-height:1.8; color:var(--ink-light); white-space:pre-wrap; }
.dpr-pobs { background:var(--card); border:1px solid var(--border); border-radius:var(--r); padding:16px; }
.dpr-obs-item { padding:10px 0; border-bottom:1px dashed var(--border); font-size:13px; line-height:1.6; color:var(--ink-light); }
.dpr-obs-item:last-child { border-bottom:none; }
.dpr-obs-time { font-size:11px; color:var(--sub); margin-bottom:4px; }
.dpr-mood-track { display:flex; align-items:flex-end; gap:4px; height:80px; padding:8px 0; overflow-x:auto; scrollbar-width:none; }
.dpr-mood-track::-webkit-scrollbar { display:none; }
.dpr-mood-dot { flex-shrink:0; width:28px; display:flex; flex-direction:column; align-items:center; gap:4px; }
.dpr-mood-dot-emoji { font-size:18px; }
.dpr-mood-dot-bar { width:20px; border-radius:4px; min-height:4px; }

/* 设置 */
.dpr-set-c { padding:16px; padding-bottom:40px; }
.dpr-set-card { background:var(--card); border:1px solid var(--border); border-radius:var(--r); padding:16px; margin-bottom:14px; }
.dpr-set-title { font-size:15px; font-weight:700; color:var(--ink); margin-bottom:12px; }
.dpr-set-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); }
.dpr-set-row:last-child { border-bottom:none; }
.dpr-set-label { font-size:14px; color:var(--ink); }
.dpr-set-desc { font-size:12px; color:var(--sub); margin-top:2px; }
.dpr-switch { width:44px; height:24px; border-radius:12px; background:var(--border); position:relative; cursor:pointer; transition:background var(--t); flex-shrink:0; }
.dpr-switch.on { background:var(--success); }
.dpr-switch::after { content:""; position:absolute; width:20px; height:20px; border-radius:50%; background:#fff; top:2px; left:2px; transition:transform var(--t); }
.dpr-switch.on::after { transform:translateX(20px); }
.dpr-about { font-size:13px; line-height:1.8; color:var(--sub); }
.dpr-about b { color:var(--ink); }
.dpr-danger-btn { border:1px solid var(--danger); background:transparent; color:var(--danger); border-radius:8px; padding:10px 16px; font-size:13px; cursor:pointer; font-family:inherit; margin-top:12px; width:100%; }
.dpr-danger-btn:active { background:var(--danger-light); }
.dpr-empty { color:var(--sub); font-size:14px; text-align:center; padding:30px 16px; line-height:1.8; }
.dpr-toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; padding:10px 20px; border-radius:10px; font-size:13px; z-index:200; animation:dprToastIn 0.3s ease; }
@keyframes dprToastIn { from{opacity:0;transform:translate(-50%,10px);} to{opacity:1;transform:translate(-50%,0);} }

/* 提示词 */
.dpr-prompt-cat { margin-bottom:20px; }
.dpr-prompt-cat-hdr { display:flex; align-items:center; gap:8px; padding:12px 14px; background:var(--primary); color:#fff; border-radius:12px; cursor:pointer; transition:opacity var(--t); }
.dpr-prompt-cat-hdr:active { opacity:0.85; }
.dpr-prompt-cat-icon { font-size:20px; }
.dpr-prompt-cat-title { flex:1; font-size:15px; font-weight:700; }
.dpr-prompt-cat-chev { transition:transform var(--t); }
.dpr-prompt-cat-chev.open { transform:rotate(180deg); }
.dpr-prompt-cat-desc { font-size:12px; color:var(--sub); line-height:1.6; padding:8px 14px 4px; }
.dpr-prompt-cat-body { display:none; padding:0 4px; }
.dpr-prompt-cat-body.open { display:block; animation:dprFade 0.2s ease; }
.dpr-prompt-item { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:10px; }
.dpr-prompt-item-label { font-size:14px; font-weight:700; color:var(--ink); margin-bottom:4px; }
.dpr-prompt-item-note { font-size:12px; color:var(--sub); line-height:1.5; margin-bottom:8px; padding:6px 10px; background:var(--card-alt); border-radius:8px; border-left:3px solid var(--accent); }
.dpr-prompt-ta { width:100%; border:1px solid var(--border); border-radius:8px; padding:10px 12px; font-size:13px; font-family:"SF Mono","Menlo","Consolas",monospace; line-height:1.6; outline:none; min-height:80px; resize:vertical; transition:border var(--t); color:var(--ink); background:var(--card-alt); }
.dpr-prompt-ta:focus { border-color:var(--primary); background:var(--card); }
.dpr-prompt-item-act { display:flex; gap:8px; margin-top:8px; }
.dpr-prompt-reset { border:1px solid var(--border); background:var(--card); color:var(--sub); border-radius:6px; padding:4px 10px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:3px; transition:all var(--t); font-family:inherit; }
.dpr-prompt-reset:active { color:var(--primary); border-color:var(--primary); }

/* API */
.dpr-api-fg { margin-bottom:12px; }
.dpr-api-lbl { display:block; font-size:12px; color:var(--sub); margin-bottom:4px; font-weight:500; }
.dpr-api-input { width:100%; border:1px solid var(--border); border-radius:8px; padding:9px 12px; font-size:13px; outline:none; transition:border var(--t); font-family:inherit; background:var(--card-alt); color:var(--ink); }
.dpr-api-input:focus { border-color:var(--primary); background:var(--card); }
.dpr-api-select { width:100%; border:1px solid var(--border); border-radius:8px; padding:9px 12px; font-size:13px; outline:none; background:var(--card-alt); color:var(--ink); cursor:pointer; font-family:inherit; }
.dpr-api-fetch { border:1px solid var(--primary); background:var(--card); color:var(--primary); border-radius:8px; padding:8px 14px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all var(--t); font-family:inherit; margin-top:4px; }
.dpr-api-fetch:active { transform:scale(0.97); }
.dpr-api-fetch:disabled { opacity:0.5; }
.dpr-api-status { font-size:11px; color:var(--sub); margin-top:6px; }
.dpr-api-status.ok { color:var(--success); }
.dpr-api-status.err { color:var(--danger); }
.dpr-api-hint { font-size:12px; color:var(--sub); line-height:1.6; padding:8px 10px; background:var(--card-alt); border-radius:8px; margin-bottom:10px; }
`;

  /* =========================================================
   *  主渲染
   * ========================================================= */
  async function mount(container, roche) {
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement("style");
      s.id = STYLE_ID; s.textContent = STYLE_TEXT; document.head.appendChild(s);
    }
    const root = document.createElement("div");
    root.className = "dpr-app";
    root.innerHTML = `
      <div class="dpr-header">
        <button class="dpr-icon-btn" id="dpr-back" style="display:none;">${I.back}</button>
        <div><div class="dpr-header-title" id="dpr-htitle">我的日记</div><div class="dpr-header-sub" id="dpr-hsub">记录每一个值得被看见的瞬间</div></div>
      </div>
      <div class="dpr-content" id="dpr-content">
        <div class="dpr-view active" data-view="shelf">
          <div class="dpr-shelf-c" id="dpr-shelf"></div>
          <button class="dpr-fab" id="dpr-fab">${I.write}</button>
        </div>
        <div class="dpr-view" data-view="book">
          <div class="dpr-book-hdr" id="dpr-book-hdr"></div>
          <div class="dpr-entries" id="dpr-entries"></div>
        </div>
        <div class="dpr-view" data-view="write">
          <div class="dpr-write-c">
            <div class="dpr-write-meta" id="dpr-wmeta"></div>
            <div class="dpr-mood-section"><div class="dpr-sect-label">今天的心情</div><div class="dpr-mood-row" id="dpr-mood-row"></div></div>
            <div class="dpr-weather-section"><div class="dpr-sect-label">今日天气</div><div class="dpr-weather-display" id="dpr-wdisplay"></div><div class="dpr-weather-manual" id="dpr-wmanual"></div></div>
            <div class="dpr-editor-c"><textarea class="dpr-textarea" id="dpr-ta" placeholder="今天发生了什么？你有什么感受？&#10;&#10;写下你的心事，这里是属于你的安全空间…"></textarea></div>
            <div class="dpr-img-bar" id="dpr-img-bar"></div>
            <div class="dpr-token-bar" id="dpr-token-bar"></div>
            <div class="dpr-write-actions">
              <button class="dpr-btn dpr-btn-sec" id="dpr-save">${I.save} 保存</button>
              <button class="dpr-btn dpr-btn-ai" id="dpr-saveai">${I.send} 保存并发送给咨询师</button>
            </div>
          </div>
        </div>
        <div class="dpr-view" data-view="detail"><div class="dpr-detail-c" id="dpr-detail"></div></div>
        <div class="dpr-view" data-view="profile"><div class="dpr-profile-c" id="dpr-profile"></div></div>
        <div class="dpr-view" data-view="settings"><div class="dpr-set-c" id="dpr-set"></div></div>
      </div>
      <div class="dpr-tabbar" id="dpr-tabbar">
        <div class="dpr-tab active" data-tab="shelf">${I.book}<span>书架</span></div>
        <div class="dpr-tab" data-tab="profile">${I.sprout}<span>成长档案</span></div>
        <div class="dpr-tab" data-tab="settings">${I.settings}<span>设置</span></div>
      </div>`;
    container.appendChild(root);

    /* 状态 */
    let curView="shelf", curYear=null, curEntryId=null;
    let writeMood=null, writeWeather=null, writeImages=[];
    let isEditing=false, editingEntry=null;

    const contentEl=root.querySelector("#dpr-content");
    const tabbarEl=root.querySelector("#dpr-tabbar");
    const backBtn=root.querySelector("#dpr-back");

    function showView(v) {
      curView=v;
      root.querySelectorAll(".dpr-view").forEach(x=>x.classList.remove("active"));
      const el=root.querySelector(`.dpr-view[data-view="${v}"]`);
      if(el) el.classList.add("active");
      const main=["shelf","profile","settings"];
      backBtn.style.display=main.includes(v)?"none":"flex";
      tabbarEl.style.display=main.includes(v)?"flex":"none";
      const tm={shelf:["我的日记","记录每一个值得被看见的瞬间"],book:[`${curYear} 年日记`,""],write:["写日记",""],detail:["日记详情",""],profile:["成长档案","AI 咨询师的专业观察与陪伴"],settings:["设置",""]};
      if(tm[v]){root.querySelector("#dpr-htitle").textContent=tm[v][0];root.querySelector("#dpr-hsub").textContent=tm[v][1];}
      if(v==="shelf")renderShelf(); if(v==="book")renderBook(); if(v==="write")renderWrite();
      if(v==="detail")renderDetail(); if(v==="profile")renderProfile(); if(v==="settings")renderSettings();
      contentEl.scrollTop=0;
    }
    backBtn.onclick=()=>{if(curView==="book")showView("shelf");else if(curView==="write"){if(isEditing)showView("detail");else showView("shelf");}else if(curView==="detail")showView("book");};
    tabbarEl.querySelectorAll(".dpr-tab").forEach(t=>{t.onclick=()=>{tabbarEl.querySelectorAll(".dpr-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");showView(t.dataset.tab);};});
    function updateTab(){tabbarEl.querySelectorAll(".dpr-tab").forEach(t=>{t.classList.toggle("active",t.dataset.tab===curView||(["book","write","detail"].includes(curView)&&t.dataset.tab==="shelf"));});}

    function toast(m){const t=document.createElement("div");t.className="dpr-toast";t.textContent=m;root.appendChild(t);setTimeout(()=>{t.style.opacity="0";t.style.transition="opacity 0.3s";},2000);setTimeout(()=>t.remove(),2400);}
    function showLoading(text){const o=document.createElement("div");o.className="dpr-loading";o.id="dpr-loading";o.innerHTML=`<div class="dpr-spinner"></div><div class="dpr-loading-text">${escapeHtml(text||"处理中…")}</div>`;root.appendChild(o);}
    function hideLoading(){const e=root.querySelector("#dpr-loading");if(e)e.remove();}

    /* 图片查看器 */
    function openImageViewer(src) {
      const v=document.createElement("div");
      v.className="dpr-img-viewer";
      v.innerHTML=`<button class="dpr-img-viewer-close">${I.close}</button><img src="${src}" alt="">`;
      v.onclick=(e)=>{if(e.target===v||e.target.closest(".dpr-img-viewer-close"))v.remove();};
      root.appendChild(v);
    }

    /* ===== 书架 ===== */
    async function renderShelf() {
      updateTab();
      const data=await getJSON(roche,K_DIARY,{});
      const years=Object.keys(data).filter(y=>(data[y]||[]).length>0).sort((a,b)=>b-a);
      const c=root.querySelector("#dpr-shelf");
      const cy=String(new Date().getFullYear());
      if(years.length===0){
        c.innerHTML=`<div class="dpr-shelf-intro"><h2>我的心理日记</h2><p>这里是一个属于你的安全空间。<br>写下心事，选择是否分享给AI咨询师，<br>让每一个感受都被温柔地看见。</p></div><div class="dpr-empty-shelf"><div class="dpr-empty-shelf-icon">📔</div><p>你的日记书架空空如也</p><p style="font-size:12px;">点击右下角的笔，开始写第一篇日记吧</p></div>`;
        return;
      }
      let h=`<div class="dpr-shelf-intro"><h2>我的心理日记</h2><p>一年一本，记录你的心路历程</p></div><div class="dpr-shelf-grid">`;
      years.forEach((y,i)=>{const es=data[y]||[];h+=`<div class="dpr-year-book" data-year="${y}"><div class="dpr-book-cover dpr-bk-${i%5}">${y===cy?'<div class="dpr-book-current">在用</div>':''}<div class="dpr-book-year">${y}</div><div class="dpr-book-label">日记</div><div class="dpr-book-count">${es.length} 篇</div></div></div>`;});
      h+="</div>"; c.innerHTML=h;
      c.querySelectorAll(".dpr-year-book").forEach(e=>{e.onclick=()=>{curYear=e.dataset.year;showView("book");};});
    }

    /* ===== 日记本 ===== */
    async function renderBook() {
      const data=await getJSON(roche,K_DIARY,{});
      const es=(data[curYear]||[]).sort((a,b)=>b.timestamp-a.timestamp);
      const hdr=root.querySelector("#dpr-book-hdr"), list=root.querySelector("#dpr-entries");
      hdr.innerHTML=`<div class="dpr-book-hdr-info"><div class="dpr-book-hdr-y">${curYear} 年</div><div class="dpr-book-hdr-s">共 ${es.length} 篇日记</div></div><button class="dpr-btn dpr-btn-sec" style="padding:8px 14px;font-size:13px;" id="dpr-bw">${I.write} 写日记</button>`;
      hdr.querySelector("#dpr-bw").onclick=()=>{isEditing=false;curEntryId=null;showView("write");};
      if(!es.length){list.innerHTML=`<div class="dpr-empty">这一年还没有日记<br>点击上方"写日记"开始记录</div>`;return;}
      let h="";
      es.forEach(e=>{
        const m=moodByKey(e.mood);
        const ws=e.weather?`${e.weather.icon||""} ${e.weather.desc||""}${e.weather.temp!==undefined?" "+e.weather.temp+"°":""}`:"";
        const imgs=e.images||[];
        h+=`<div class="dpr-entry-card" data-id="${e.id}">${e.aiRead?'<div class="dpr-read-stamp">已阅</div>':''}<div class="dpr-entry-top"><span class="dpr-entry-mood">${m.emoji}</span><div><div class="dpr-entry-date">${fmtDate(e.timestamp).slice(5)}</div><div class="dpr-entry-time">${fmtTime(e.timestamp)}</div></div>${ws?`<span class="dpr-entry-weather">${ws}</span>`:""}</div><div class="dpr-entry-preview">${escapeHtml(e.content.slice(0,150))}</div>${imgs.length?`<div class="dpr-entry-img-count">${I.image} ${imgs.length} 张图片</div>`:""}<div class="dpr-entry-footer"><span class="dpr-badge ${e.aiRead?'read':'unread'}">${e.aiRead?'✓ 已阅':'未发送'}</span>${e.aiResponse?'<span class="dpr-badge response">💬 有回复</span>':''}</div></div>`;
      });
      list.innerHTML=h;
      list.querySelectorAll(".dpr-entry-card").forEach(e=>{e.onclick=()=>{curEntryId=e.dataset.id;showView("detail");};});
    }

    /* ===== 写日记 ===== */
    async function renderWrite() {
      const now=nowTs();
      root.querySelector("#dpr-wmeta").innerHTML=`<div class="dpr-write-date">📅 ${fmtDateCN(now)}</div><div class="dpr-write-time">⏰ ${fmtTime(now)}</div>`;
      writeMood=null;
      const mr=root.querySelector("#dpr-mood-row");
      mr.innerHTML=MOODS.map(m=>`<div class="dpr-mood-chip" data-mood="${m.key}" style="--mood-c:${m.color};"><span class="dpr-mood-chip-emoji">${m.emoji}</span><span class="dpr-mood-chip-label">${m.label}</span></div>`).join("");
      mr.querySelectorAll(".dpr-mood-chip").forEach(c=>{c.onclick=()=>{mr.querySelectorAll(".dpr-mood-chip").forEach(x=>x.classList.remove("selected"));c.classList.add("selected");writeMood=c.dataset.mood;};});

      writeWeather=null; writeImages=[];
      const wd=root.querySelector("#dpr-wdisplay"), wm=root.querySelector("#dpr-wmanual");
      wd.innerHTML=`<div class="dpr-weather-icon">⏳</div><div class="dpr-weather-info"><div class="dpr-weather-desc">正在获取天气…</div></div>`;
      wm.innerHTML="";
      MANUAL_WEATHERS.forEach(w=>{const b=document.createElement("div");b.className="dpr-weather-manual-btn";b.innerHTML=`${w.icon} ${w.desc}`;b.onclick=()=>{wm.querySelectorAll(".dpr-weather-manual-btn").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");writeWeather={icon:w.icon,desc:w.desc,temp:null,source:"manual"};wd.innerHTML=`<div class="dpr-weather-icon">${w.icon}</div><div class="dpr-weather-info"><div class="dpr-weather-desc">${w.desc}</div><div class="dpr-weather-temp">手动选择</div></div>`;};wm.appendChild(b);});

      const aw=await fetchWeather();
      if(aw){writeWeather=aw;renderWeatherDisplay(wd,aw);}
      else{wd.innerHTML=`<div class="dpr-weather-icon">🌤️</div><div class="dpr-weather-info"><div class="dpr-weather-desc">无法自动获取</div><div class="dpr-weather-temp">请从下方手动选择</div></div>`;}

      // 图片栏
      renderImgBar();
      // Token 栏
      const ta=root.querySelector("#dpr-ta");
      const updateToken=()=>updateTokenBar(ta.value);
      ta.addEventListener("input",updateToken);

      if(isEditing&&editingEntry){
        ta.value=editingEntry.content||"";
        if(editingEntry.mood){writeMood=editingEntry.mood;const c=mr.querySelector(`.dpr-mood-chip[data-mood="${editingEntry.mood}"]`);if(c)c.classList.add("selected");}
        if(editingEntry.images&&Array.isArray(editingEntry.images))writeImages=[...editingEntry.images];
        renderImgBar();
      } else { ta.value=""; }
      updateToken();
      ta.focus();
    }

    function renderWeatherDisplay(el,w){
      el.innerHTML=`<div class="dpr-weather-icon">${w.icon}</div><div class="dpr-weather-info"><div class="dpr-weather-desc">${w.desc} ${w.temp!==null&&w.temp!==undefined?w.temp+"°C":""}</div><div class="dpr-weather-temp">${w.city?w.city+" · ":""}自动定位</div></div><button class="dpr-weather-refresh" id="dpr-wrefresh">${I.refresh}刷新</button>`;
      const b=el.querySelector("#dpr-wrefresh");
      if(b)b.onclick=async()=>{b.textContent="获取中…";const nw=await fetchWeather();if(nw){writeWeather=nw;renderWeatherDisplay(el,nw);}else{toast("天气获取失败，请手动选择");b.innerHTML=`${I.refresh}刷新`;}};
    }

    function renderImgBar() {
      const bar=root.querySelector("#dpr-img-bar");
      let h="";
      writeImages.forEach((src,i)=>{
        h+=`<div class="dpr-img-thumb"><img src="${src}" alt=""><button class="dpr-img-thumb-del" data-idx="${i}">${I.close}</button></div>`;
      });
      h+=`<div class="dpr-img-add" id="dpr-img-add">${I.image}<span>添加</span></div>`;
      bar.innerHTML=h;
      bar.querySelectorAll(".dpr-img-thumb-del").forEach(b=>{b.onclick=()=>{writeImages.splice(parseInt(b.dataset.idx),1);renderImgBar();};});
      root.querySelector("#dpr-img-add").onclick=()=>{addImage();};
    }

    async function addImage() {
      const input=document.createElement("input");
      input.type="file"; input.accept="image/*";
      input.onchange=async(e)=>{
        const file=e.target.files[0];
        if(!file) return;
        try {
          toast("压缩图片中…");
          const b64=await fileToCompressedBase64(file,1024,0.7);
          writeImages.push(b64);
          renderImgBar();
          updateTokenBar(root.querySelector("#dpr-ta").value);
        } catch(err) { toast("图片加载失败"); }
      };
      input.click();
    }

    function updateTokenBar(text) {
      const bar=root.querySelector("#dpr-token-bar");
      if(!bar) return;
      const textTokens=estimateTokens(text||"");
      // 图片 token 估算: 每张约 85 tokens (低分辨率) + base64 摘要
      const imgTokens=writeImages.length*256;
      const total=textTokens+imgTokens;
      const sysTokens=1200; // 系统提示词估算
      const grand=total+sysTokens;
      const cls=grand>8000?"dpr-token-warn":"";
      bar.innerHTML=`<span class="${cls}">📊 估算 ${fmtTokens(grand)}</span><span style="color:var(--border);">|</span><span>正文 ${textTokens} · 图片 ${imgTokens} · 系统 ~${sysTokens}</span>${writeImages.length?`<span style="color:var(--border);">|</span><span>📷 ${writeImages.length} 张</span>`:""}`;
    }

    /* ===== 保存 ===== */
    async function saveEntry(sendAI) {
      const ta=root.querySelector("#dpr-ta");
      const content=ta.value.trim();
      if(!content&&!writeImages.length){toast("日记内容不能为空");return;}
      const now=nowTs(), yk=getYearKey(now);
      const data=await getJSON(roche,K_DIARY,{});

      if(isEditing&&editingEntry){
        editingEntry.content=content; editingEntry.mood=writeMood; editingEntry.weather=writeWeather;
        editingEntry.images=[...writeImages]; editingEntry.editedAt=now;
        for(const y of Object.keys(data)){const i=data[y].findIndex(e=>e.id===editingEntry.id);if(i>=0){data[y][i]=editingEntry;break;}}
        await roche.storage.set(K_DIARY,data);
        if(sendAI){editingEntry.aiRead=false;editingEntry.aiResponse=null;editingEntry.aiResponseAt=null;await sendToCounselor(editingEntry,data,yk);}
        else{toast("日记已更新 ✓");curEntryId=editingEntry.id;showView("detail");}
        isEditing=false; editingEntry=null; return;
      }

      const entry={id:uuid(),timestamp:now,content,mood:writeMood,weather:writeWeather,images:[...writeImages],aiRead:false,aiResponse:null,aiResponseAt:null,createdAt:now};
      if(!data[yk])data[yk]=[];
      data[yk].push(entry);
      await roche.storage.set(K_DIARY,data);
      if(sendAI){await sendToCounselor(entry,data,yk);}
      else{toast("日记已保存 ✓");curYear=yk;curEntryId=entry.id;showView("detail");}
    }
    root.querySelector("#dpr-save").onclick=()=>saveEntry(false);
    root.querySelector("#dpr-saveai").onclick=()=>saveEntry(true);
    root.querySelector("#dpr-fab").onclick=()=>{isEditing=false;curEntryId=null;showView("write");};

    /* ===== 发送给 AI ===== */
    async function sendToCounselor(entry,data,yk) {
      showLoading("咨询师正在阅读你的日记…");
      try {
        const mood=moodByKey(entry.mood);
        const profile=await getJSON(roche,K_PROFILE,defaultProfile());
        const prompts=await getPrompts(roche);
        const apiCfg=await getApiConfig(roche);
        const profileText=[
          `【情绪模式】: ${profile.emotion||"暂在梳理中"}`,
          `【认知信念】: ${profile.cognition||"暂在观察中"}`,
          `【人际模式】: ${profile.relationship||"暂在观察中"}`,
          `【应对资源】: ${profile.resources||"暂在挖掘中"}`,
          `【成长轨迹】: ${profile.growth||"刚刚开始"}`,
          `【近期观察】: ${(profile.observations||[]).slice(-5).map(o=>o.text).join("；")||"暂无"}`
        ].join("\n");
        const ws=entry.weather?`${entry.weather.desc||""} ${entry.weather.temp!==null&&entry.weather.temp!==undefined?entry.weather.temp+"°C":""}`:"未知";
        const sysPrompt=buildCounselorPrompt(prompts,profileText);
        const userMsg=`日期：${fmtDateCN(entry.timestamp)}\n时间：${fmtTime(entry.timestamp)}\n心情：${mood.emoji} ${mood.label}\n天气：${ws}\n\n${entry.content}`;

        // 构建 messages，支持图片
        const messages=[{role:"system",content:sysPrompt}];
        if(entry.images&&entry.images.length>0){
          // 多模态消息
          const contentParts=[{type:"text",text:userMsg}];
          entry.images.forEach(img=>{
            contentParts.push({type:"image_url",image_url:{url:img}});
          });
          messages.push({role:"user",content:contentParts});
        } else {
          messages.push({role:"user",content:userMsg});
        }

        const opts={messages,temperature:0.75};
        applyApiConfig(opts,apiCfg);
        const result=await roche.ai.chat(opts);
        let reply=(result&&result.text?result.text:"").trim();

        let obs=null;
        const m=reply.match(/\[\[DIARY_OBS\]\]([\s\S]*?)\[\[\/DIARY_OBS\]\]/);
        if(m){reply=reply.replace(/\[\[DIARY_OBS\]\][\s\S]*?\[\[\/DIARY_OBS\]\]/,"").trim();try{obs=JSON.parse(m[1].trim().replace(/^```json/i,"").replace(/^```/,"").replace(/```$/,"").trim());}catch(e){}}

        entry.aiRead=true; entry.aiResponse=reply; entry.aiResponseAt=nowTs();
        const idx=data[yk].findIndex(e=>e.id===entry.id);
        if(idx>=0)data[yk][idx]=entry;
        await roche.storage.set(K_DIARY,data);
        if(obs)await updateProfile(obs,profile,entry);
        hideLoading();
        toast("咨询师已阅读并回复 ✓");
        curYear=yk; curEntryId=entry.id; showView("detail");
      } catch(err){
        hideLoading();
        toast("AI 服务暂时不可用，日记已保存");
        curYear=yk; curEntryId=entry.id; showView("detail");
      }
    }

    async function updateProfile(obs,old,entry){
      const np={...old};
      if(obs.emotion&&obs.emotion!=="延续")np.emotion=obs.emotion;
      if(obs.cognition&&obs.cognition!=="延续")np.cognition=obs.cognition;
      if(obs.relationship&&obs.relationship!=="延续")np.relationship=obs.relationship;
      if(obs.resources&&obs.resources!=="延续")np.resources=obs.resources;
      if(obs.growth&&obs.growth!=="延续")np.growth=obs.growth;
      if(!np.observations)np.observations=[];
      if(Array.isArray(obs.observations))obs.observations.forEach(t=>{if(t&&t.trim())np.observations.push({ts:entry.timestamp,text:t.trim()});});
      np.lastUpdated=nowTs();
      await roche.storage.set(K_PROFILE,np);
    }
    function defaultProfile(){return{emotion:"正在通过日记持续建立中…",cognition:"正在通过日记持续建立中…",relationship:"正在通过日记持续建立中…",resources:"正在通过日记持续建立中…",growth:"刚刚开启日记之旅",observations:[],lastUpdated:null};}

    /* ===== 详情 ===== */
    async function renderDetail(){
      const data=await getJSON(roche,K_DIARY,{});
      let entry=null,yk=null;
      for(const y of Object.keys(data)){const f=(data[y]||[]).find(e=>e.id===curEntryId);if(f){entry=f;yk=y;break;}}
      if(!entry){showView("shelf");return;}
      const c=root.querySelector("#dpr-detail");
      const mood=moodByKey(entry.mood);
      const ws=entry.weather?`${entry.weather.icon||""} ${entry.weather.desc||""}${entry.weather.temp!==null&&entry.weather.temp!==undefined?" "+entry.weather.temp+"°C":""}`:"";
      const imgs=entry.images||[];
      let h="";
      if(containsCrisisKeyword(entry.content))h+=`<div class="dpr-crisis">${escapeHtml(CRISIS_MESSAGE)}</div>`;
      h+=`<div class="dpr-detail-card">${entry.aiRead?'<div class="dpr-read-stamp">已阅</div>':''}<div class="dpr-detail-hdr"><span class="dpr-detail-mood">${mood.emoji}</span><div><div class="dpr-detail-date">${fmtDateCN(entry.timestamp)}</div><div class="dpr-detail-time">${fmtTime(entry.timestamp)} · ${mood.label}</div></div>${ws?`<div class="dpr-detail-wtag">${ws}</div>`:""}</div><div class="dpr-detail-content">${escapeHtml(entry.content)}</div>`;
      if(imgs.length){h+=`<div class="dpr-detail-imgs">`;imgs.forEach(src=>{h+=`<img class="dpr-detail-img" src="${src}" alt="" data-src="${src}">`;});h+="</div>";}
      h+=`<div class="dpr-detail-actions">`;
      if(!entry.aiRead)h+=`<button class="dpr-btn dpr-btn-ai" id="dpr-dsend">${I.send} 发送给咨询师</button>`;
      h+=`<button class="dpr-btn dpr-btn-sec" id="dpr-dedit" style="flex:1;">编辑</button><button class="dpr-btn dpr-btn-sec" id="dpr-ddel" style="color:var(--danger);flex:1;">${I.trash} 删除</button></div></div>`;
      if(entry.aiResponse)h+=`<div class="dpr-ai-card"><div class="dpr-ai-hdr"><div class="dpr-ai-avatar">${I.heart}</div><div><div class="dpr-ai-name">AI 咨询师</div><div class="dpr-ai-time">${entry.aiResponseAt?fmtDate(entry.aiResponseAt)+" "+fmtTime(entry.aiResponseAt):""}</div></div></div><div class="dpr-ai-content">${escapeHtml(entry.aiResponse)}</div></div>`;
      c.innerHTML=h;

      // 图片点击大图
      c.querySelectorAll(".dpr-detail-img").forEach(img=>{img.onclick=()=>openImageViewer(img.dataset.src);});
      const sb=root.querySelector("#dpr-dsend");if(sb)sb.onclick=async()=>{await sendToCounselor(entry,data,yk);};
      root.querySelector("#dpr-dedit").onclick=()=>{isEditing=true;editingEntry=entry;showView("write");};
      root.querySelector("#dpr-ddel").onclick=async()=>{
        const ok=await roche.ui.confirm({title:"删除日记",message:"确定要删除这篇日记吗？此操作不可撤销。"}).catch(()=>window.confirm("确定要删除这篇日记吗？"));
        if(!ok)return;
        const i=data[yk].findIndex(e=>e.id===entry.id);if(i>=0)data[yk].splice(i,1);
        if(data[yk].length===0)delete data[yk];
        await roche.storage.set(K_DIARY,data);toast("日记已删除");showView("book");
      };
    }

    /* ===== 成长档案 ===== */
    async function renderProfile(){
      updateTab();
      const profile=await getJSON(roche,K_PROFILE,defaultProfile());
      const data=await getJSON(roche,K_DIARY,{});
      const c=root.querySelector("#dpr-profile");
      const all=[];Object.values(data).forEach(ye=>ye.forEach(e=>all.push(e)));all.sort((a,b)=>a.timestamp-b.timestamp);
      const recent=all.slice(-20);
      let mth="";
      if(recent.length){mth='<div class="dpr-mood-track">';recent.forEach((e,i)=>{const m=moodByKey(e.mood);const bh=20+((i*7+13)%35);mth+=`<div class="dpr-mood-dot"><span class="dpr-mood-dot-emoji">${m.emoji}</span><div class="dpr-mood-dot-bar" style="height:${bh}px;background:${m.color};opacity:0.6;"></div></div>`;});mth+="</div>";}
      else mth='<div class="dpr-empty" style="padding:16px;">还没有日记记录</div>';
      const obs=(profile.observations||[]).slice(-15).reverse();
      c.innerHTML=`<div class="dpr-profile-hero"><div class="dpr-profile-hero-icon">🌱</div><div class="dpr-profile-hero-title">成长档案</div><div class="dpr-profile-hero-sub">${profile.lastUpdated?"最后更新："+fmtDate(profile.lastUpdated):"等待你的第一篇日记"}</div></div>
      <div class="dpr-pcard"><div class="dpr-pcard-title">📈 心情轨迹</div>${mth}</div>
      <div class="dpr-pcard"><div class="dpr-pcard-title">🌊 情绪模式</div><div class="dpr-pcard-body">${escapeHtml(profile.emotion||"暂在梳理中…")}</div></div>
      <div class="dpr-pcard"><div class="dpr-pcard-title">🧠 认知信念</div><div class="dpr-pcard-body">${escapeHtml(profile.cognition||"暂在观察中…")}</div></div>
      <div class="dpr-pcard"><div class="dpr-pcard-title">🤝 人际模式</div><div class="dpr-pcard-body">${escapeHtml(profile.relationship||"暂在观察中…")}</div></div>
      <div class="dpr-pcard"><div class="dpr-pcard-title">💪 应对资源</div><div class="dpr-pcard-body">${escapeHtml(profile.resources||"暂在挖掘中…")}</div></div>
      <div class="dpr-pcard"><div class="dpr-pcard-title">🌿 成长轨迹</div><div class="dpr-pcard-body">${escapeHtml(profile.growth||"刚刚开始…")}</div></div>
      <div class="dpr-pcard" style="margin-top:4px;"><div class="dpr-pcard-title">📝 咨询师观察记录</div></div>
      <div class="dpr-pobs">${obs.length?obs.map(o=>`<div class="dpr-obs-item"><div class="dpr-obs-time">${fmtDate(o.ts)} ${fmtTime(o.ts)}</div><div>${escapeHtml(o.text)}</div></div>`).join(""):'<div class="dpr-empty">暂无观察记录</div>'}</div>`;
    }

    /* ===== 设置 ===== */
    async function renderSettings(){
      updateTab();
      const prompts=await getPrompts(roche);
      const apiCfg=await getApiConfig(roche);
      const c=root.querySelector("#dpr-set");

      let ph="";
      PROMPT_CATEGORIES.forEach((cat,ci)=>{
        let items="";
        cat.items.forEach(item=>{
          items+=`<div class="dpr-prompt-item"><div class="dpr-prompt-item-label">${escapeHtml(item.label)}</div><div class="dpr-prompt-item-note">${escapeHtml(item.note)}</div><textarea class="dpr-prompt-ta" data-pk="${item.key}" data-def="${escapeHtml(item.default)}">${escapeHtml(prompts[item.key]||item.default)}</textarea><div class="dpr-prompt-item-act"><button class="dpr-prompt-reset" data-rk="${item.key}">${I.reset} 恢复默认</button></div></div>`;
        });
        ph+=`<div class="dpr-prompt-cat"><div class="dpr-prompt-cat-hdr" data-ci="${ci}"><span class="dpr-prompt-cat-icon">${cat.icon}</span><span class="dpr-prompt-cat-title">${escapeHtml(cat.title)}</span><span class="dpr-prompt-cat-chev">${I.chevron}</span></div><div class="dpr-prompt-cat-desc">${escapeHtml(cat.desc)}</div><div class="dpr-prompt-cat-body" data-cb="${ci}">${items}</div></div>`;
      });

      c.innerHTML=`
        <div class="dpr-set-card"><div class="dpr-set-title">📝 提示词编辑</div><div class="dpr-api-hint">以下提示词在对应功能中使用。默认已填充推荐内容，可直接编辑。点击分类展开/收起。</div><div style="display:flex;gap:8px;margin-top:8px;"><button class="dpr-btn dpr-btn-pri" style="flex:1;padding:8px 14px;font-size:13px;" id="dpr-sp">${I.save} 保存全部提示词</button><button class="dpr-btn dpr-btn-sec" style="padding:8px 14px;font-size:13px;" id="dpr-rp">全部恢复默认</button></div></div>
        ${ph}
        <div class="dpr-set-card"><div class="dpr-set-title">⚙️ 独立 API 配置</div><div class="dpr-api-hint">配置后插件使用此独立 API 调用 AI。留空则使用 Roche 全局默认。兼容 OpenAI 格式 /v1 端点。</div>
          <div class="dpr-api-fg"><label class="dpr-api-lbl">Endpoint</label><input type="text" class="dpr-api-input" id="dpr-ae" placeholder="https://api.openai.com/v1" value="${escapeHtml(apiCfg.endpoint||'')}"></div>
          <div class="dpr-api-fg"><label class="dpr-api-lbl">API Key</label><input type="password" class="dpr-api-input" id="dpr-ak" placeholder="sk-..." value="${escapeHtml(apiCfg.apiKey||'')}"></div>
          <div class="dpr-api-fg"><label class="dpr-api-lbl">Provider (可选)</label><input type="text" class="dpr-api-input" id="dpr-ap" placeholder="openai / custom" value="${escapeHtml(apiCfg.provider||'')}"></div>
          <div class="dpr-api-fg"><label class="dpr-api-lbl">Model</label><div style="display:flex;gap:8px;align-items:flex-start;"><input type="text" class="dpr-api-input" id="dpr-am" placeholder="gpt-4o" value="${escapeHtml(apiCfg.model||'')}" style="flex:1;"><button class="dpr-api-fetch" id="dpr-af">${I.cloud} 拉取模型</button></div><select class="dpr-api-select" id="dpr-ams" style="display:none;margin-top:8px;"><option value="">-- 拉取后选择 --</option></select><div class="dpr-api-status" id="dpr-ast"></div></div>
          <div style="display:flex;gap:8px;margin-top:8px;"><button class="dpr-btn dpr-btn-pri" style="flex:1;padding:8px 14px;font-size:13px;" id="dpr-sa">${I.save} 保存 API</button><button class="dpr-btn dpr-btn-sec" style="padding:8px 14px;font-size:13px;" id="dpr-ca">清空</button></div>
        </div>
        <div class="dpr-set-card"><div class="dpr-set-title">关于</div><div class="dpr-about"><p><b>心理咨询室·日记 v3.0.0</b></p><p>一本属于你的心理成长日记。</p><p>· 📔 一年一本日记本，书架式管理<br>· ✍️ 写日记自动添加日期时间<br>· 😊 可选心情，自动获取天气<br>· 📷 可上传图片到日记<br>· 📊 Token 估算实时显示<br>· 💌 可选发送给AI咨询师（支持图片）<br>· 📋 已阅日记显示"已阅"印章<br>· 🌱 AI维护专业成长档案<br>· 📝 分类提示词可自定义<br>· ⚙️ 独立API配置与模型拉取</p><p style="margin-top:10px;font-size:11px;opacity:0.7;">本应用非医疗诊断工具，不能替代专业心理咨询/精神科诊疗。如遇紧急情况，请拨打全国心理援助热线 12356。</p></div></div>
        <div class="dpr-set-card"><div class="dpr-set-title">数据管理</div><button class="dpr-danger-btn" id="dpr-clear">清空全部数据</button></div>`;

      // 提示词展开
      c.querySelectorAll(".dpr-prompt-cat-hdr").forEach(h=>{h.onclick=()=>{const i=h.dataset.ci;const b=c.querySelector(`.dpr-prompt-cat-body[data-cb="${i}"]`);const ch=h.querySelector(".dpr-prompt-cat-chev");if(b){const o=b.classList.toggle("open");if(ch)ch.classList.toggle("open",o);}};});
      c.querySelectorAll(".dpr-prompt-reset").forEach(b=>{b.onclick=()=>{const k=b.dataset.rk;const ta=c.querySelector(`textarea[data-pk="${k}"]`);if(ta){ta.value=ta.dataset.def;toast("已恢复该项默认值");}};});
      root.querySelector("#dpr-sp").onclick=async()=>{const ts=c.querySelectorAll("textarea[data-pk]");const sv={};ts.forEach(t=>sv[t.dataset.pk]=t.value);await roche.storage.set(K_PROMPTS,sv);toast("提示词已保存 ✓");};
      root.querySelector("#dpr-rp").onclick=async()=>{const ok=await roche.ui.confirm({title:"恢复默认",message:"将所有提示词恢复为默认值？"}).catch(()=>window.confirm("将所有提示词恢复为默认值？"));if(!ok)return;c.querySelectorAll("textarea[data-pk]").forEach(t=>t.value=t.dataset.def);await roche.storage.set(K_PROMPTS,getDefaultPrompts());toast("已全部恢复默认");};

      // 拉取模型
      root.querySelector("#dpr-af").onclick=async()=>{
        const ep=root.querySelector("#dpr-ae").value.trim(),ak=root.querySelector("#dpr-ak").value.trim();
        const st=root.querySelector("#dpr-ast"),fb=root.querySelector("#dpr-af"),sl=root.querySelector("#dpr-ams");
        if(!ep){st.className="dpr-api-status err";st.textContent="请先填写 Endpoint";return;}
        fb.disabled=true;fb.innerHTML="拉取中…";st.className="dpr-api-status";st.textContent="正在连接…";
        const models=await fetchModels(ep,ak);
        fb.disabled=false;fb.innerHTML=`${I.cloud} 拉取模型`;
        if(models.length){sl.innerHTML='<option value="">-- 选择模型 ('+models.length+') --</option>'+models.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");sl.style.display="block";const cm=root.querySelector("#dpr-am").value.trim();if(cm&&models.includes(cm))sl.value=cm;sl.onchange=()=>{root.querySelector("#dpr-am").value=sl.value;};st.className="dpr-api-status ok";st.textContent="✓ 成功拉取 "+models.length+" 个模型";}
        else{st.className="dpr-api-status err";st.textContent="✗ 拉取失败，请检查地址和密钥。";sl.style.display="none";}
      };
      root.querySelector("#dpr-sa").onclick=async()=>{await roche.storage.set(K_API_CONFIG,{endpoint:root.querySelector("#dpr-ae").value.trim(),apiKey:root.querySelector("#dpr-ak").value.trim(),provider:root.querySelector("#dpr-ap").value.trim(),model:root.querySelector("#dpr-am").value.trim()});toast("API 配置已保存 ✓");};
      root.querySelector("#dpr-ca").onclick=async()=>{root.querySelector("#dpr-ae").value="";root.querySelector("#dpr-ak").value="";root.querySelector("#dpr-ap").value="";root.querySelector("#dpr-am").value="";root.querySelector("#dpr-ams").style.display="none";root.querySelector("#dpr-ast").textContent="";root.querySelector("#dpr-ast").className="dpr-api-status";await roche.storage.delete(K_API_CONFIG);toast("已清空，将使用 Roche 全局默认");};
      root.querySelector("#dpr-clear").onclick=async()=>{const ok=await roche.ui.confirm({title:"清空全部数据",message:"将删除所有日记、成长档案、提示词和API设置，是否继续？"}).catch(()=>window.confirm("将删除所有数据，是否继续？"));if(!ok)return;await Promise.all([roche.storage.delete(K_DIARY),roche.storage.delete(K_PROFILE),roche.storage.delete(K_PROMPTS),roche.storage.delete(K_API_CONFIG)]);toast("已清空全部数据");showView("shelf");};
    }

    await renderShelf();
    return { root };
  }

  async function unmount(container) {
    const s=document.getElementById(STYLE_ID);if(s)s.remove();
    container.replaceChildren();
  }

  window.RochePlugin.register({
    id:PLUGIN_ID, name:"心理咨询室·日记", version:"3.0.0",
    apps:[{id:APP_ID,name:"心理日记",icon:"book",iconImage:"",mount,unmount}]
  });
})();