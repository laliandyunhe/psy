/* ==========================================================
 * 心理咨询室 (psych-counseling-room) - Roche 插件 v1.1.0
 * 独立 App：AI 心理陪伴 + 提示词查看与配置 + 自定义 API 配置 + 丰富量表 + 关键词触发文本发送
 * 重要：本插件不提供医疗诊断，不能替代专业心理咨询/精神科诊疗。
 * ========================================================== */

(function () {
  "use strict";

  const PLUGIN_ID = "psych-counseling-room";
  const APP_ID = "psych-counseling-room-home";

  /* ------------------------- 存储 key ------------------------- */
  const K_HISTORY = "chat-history";            // 对话历史
  const K_LOG = "growth-log";                  // 第一层：成长日志
  const K_MANUAL = "user-manual";              // 第二层：自我认知说明书
  const K_SCALES = "scale-results";            // 量表结果
  const K_META = "session-meta";               // 计数器等元信息
  const K_PROMPT = "system-prompt-override";   // 用户自定义提示词
  const K_API_CONFIG = "api-config";           // 用户单独配置的 API 参数
  const K_KEYWORDS = "keyword-bindings";       // 关键词触发关联文本绑定列表

  const SUMMARY_EVERY_N_TURNS = 6;

  /* ------------------------- 危机关键词 ------------------------- */
  const CRISIS_KEYWORDS = [
    "自杀", "不想活", "活不下去", "自残", "割腕", "伤害自己",
    "结束生命", "了结自己", "跳楼", "轻生", "想死"
  ];

  const CRISIS_MESSAGE =
    "我很在乎你现在的安全。这种感觉很沉重，你愿意告诉我这些话，本身就需要很大的勇气。\n\n" +
    "如果你现在有伤害自己的冲动或计划，请立刻联系：\n" +
    "· 全国统一心理援助热线：12356（24 小时）\n" +
    "· 紧急危险请拨打：120（急救）或 110（警方）\n" +
    "· 也可以联系身边任何一个你信任、现在能联系上的人，先不要一个人待着。\n\n" +
    "我会一直在这里陪你说话，但我不是能在紧急情况下保护你人身安全的人，专业的人和身边的人可以。";

  /* ------------------------- 默认系统提示词（结合图片参考与规范） ------------------------- */
  const DEFAULT_SYSTEM_PROMPT = `你是一位“心理状态评估 + 日常陪伴”型心理支持助手。综合采用循证医学、循证心理学、心理咨询、精神健康风险识别与危机干预的视角工作。你不是精神科医生，心理治疗师或急救人员的替代品。你的核心价值是：倾听用户表达出的心理状态、识别可能的风险与智慧边界、提供温和、稳定、不评判的陪伴、给出低门槛、现实可执行的小行动建议、在需要时整理阶段性心理状态记录。

【角色定位与整体风格】
- 你不是医生，不做诊断，不给药物建议。
- 整体风格温和、稳定、治愈、清晰、有判断力。但要先接住用户的感受，再帮助梳理发生了什么。
- 默认回复简洁自然，像正常聊天；不要每次都列条目、加小标题，除非用户明确要求梳理、总结或复盘。

【工作原则】
- 先安全，再评估，再陪伴。一旦出现安全风险，立即切换到“危机优先模式”，不要继续普通陪伴。
- 验证与确认：验证，但表达要生活化。识别情绪、想法、行为之间的循环；接纳情绪，澄清情绪的价值作用；做应对引导。
- 记忆原则：只记录对后续支持有利的信息；不记录无关隐秘细节；不把用户的暂时状态写成永久标签。

【评估模式与提问规则】
- 模式一：首次心理状态评估。了解当前状态、初步判断风险等级。
- 模式二：后续心理状态评估。对比与之前状态的变化。
- 模式三：日常陪伴。用户只是想倾诉、表达情绪、寻求安慰时，采用“陪伴+行动型”：先接住情绪，再给1-2个极小行动。
- 提问规则：除了首次轻量筛选可以提出5-8个简短问题外，其他场景应尽量：一次只问一个问题。问最影响判断的问题。不审讯式追问。不逼用户讲创伤细节。用户不想回答时尊重跳过。

【自检清单（每次回复前隐式自检）】
- 是否先接住了情绪？是否避免了诊断化、标签化？
- 是否区分了“初步判断”和“医学诊断”？
- 是否检查了自伤、他伤等高风险？是否有风险立即切危机模式？
- 建议是否足够小、具体、现实可执行？是否避免指导用药？
- 是否保持了温和但有判断力的语言，并留下了可继续的空间？

【心理量表使用规则】
- 当你观察到用户的情绪困扰持续存在，且适合评估时，可在回复最后单独另起一行，输出以下标记之一：
[[SCALE:PHQ9]] 或 [[SCALE:GAD7]] 或 [[SCALE:SAS]] 或 [[SCALE:SDS]] 或 [[SCALE:SCL90]] 或 [[SCALE:PCL5]]
- 一次最多输出一个标记；如果用户明确不想做，不要再提。

【自我认知说明书】
----------------
{{MANUAL_TEXT}}
----------------`;

  /* ------------------------- 量表定义 ------------------------- */
  const SCALES = {
    PHQ9: {
      name: "PHQ-9 抑郁自评量表",
      intro: "过去两周里，以下情况困扰你的频率有多高？仅供自我觉察参考。",
      options: ["完全没有", "有几天", "一半以上的天数", "几乎每天"],
      items: [
        "做事时提不起劲或没有兴趣",
        "感到心情低落、沮丧或绝望",
        "入睡困难、睡不安稳或睡眠过多",
        "感觉疲倦或没有活力",
        "食欲不振或吃太多",
        "觉得自己很糟，或觉得自己很失败，或让自己/家人失望",
        "对事物专注有困难，例如阅读报纸或看电视时",
        "动作或说话速度缓慢到别人已经察觉，或正好相反，烦躁或坐立不安",
        "有过觉得死了会更好，或想用某种方式伤害自己的念头"
      ],
      interpret(score) {
        if (score <= 4) return "目前得分处于最轻微区间，属于常见的情绪波动范围。";
        if (score <= 9) return "得分处于轻度区间，建议多留意近期的情绪与作息。";
        if (score <= 14) return "得分处于中度区间，建议考虑找专业心理咨询师聊聊。";
        if (score <= 19) return "得分处于中重度区间，建议寻求专业心理咨询或精神科评估。";
        return "得分处于重度区间，强烈建议联系专业精神科医生或心理危机干预资源（热线 12356）。";
      }
    },
    GAD7: {
      name: "GAD-7 焦虑自评量表",
      intro: "过去两周里，以下情况困扰你的频率有多高？仅供自我觉察参考。",
      options: ["完全没有", "有几天", "一半以上的天数", "几乎每天"],
      items: [
        "感觉紧张、焦虑或急躁",
        "无法停止或控制担忧",
        "对各种各样的事情担忧过多",
        "很难放松下来",
        "由于不安而无法静坐",
        "变得容易烦恼或急躁",
        "感到似乎有可怕的事会发生而害怕"
      ],
      interpret(score) {
        if (score <= 4) return "目前得分处于最轻微区间，属于正常范围。";
        if (score <= 9) return "得分处于轻度区间，建议留意压力来源与放松。";
        if (score <= 14) return "得分处于中度区间，建议找专业心理咨询师交流。";
        return "得分处于重度区间，建议尽快寻求专业评估与支持。";
      }
    },
    SAS: {
      name: "SAS 焦虑自评量表（简版）",
      intro: "评估最近一周的焦虑体验主观感受。",
      options: ["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"],
      items: [
        "觉得比平时更容易紧张和着急",
        "无缘无故地感到害怕",
        "容易心里烦乱或感到惊恐",
        "觉得身体各部分都在发抖或颤抖",
        "因为头痛、颈痛、背痛而苦恼"
      ],
      interpret(score) {
        const standardScore = Math.round(score * 1.25 * 4); // 简版转化参考
        if (standardScore < 50) return "正常范围，无明显焦虑症状。";
        if (standardScore <= 59) return "轻度焦虑，注意适当调适放松。";
        if (standardScore <= 69) return "中度焦虑，建议结合心理咨询寻求支持。";
        return "重度焦虑，建议寻求专业医疗机构进一步评估。";
      }
    },
    SDS: {
      name: "SDS 抑郁自评量表（简版）",
      intro: "评估最近一周抑郁情绪体验的主观感受。",
      options: ["没有或很少时间", "小部分时间", "相当多时间", "绝大部分或全部时间"],
      items: [
        "感到情绪低沉、郁郁寡欢",
        "早晨起来感觉最好（反向或同向感受）",
        "经常无缘无故想要哭泣或吸鼻子",
        "夜间睡眠不好或早醒",
        "吃得和平时一样多（食欲变差）"
      ],
      interpret(score) {
        if (score <= 8) return "处于正常范围，无抑郁倾向。";
        if (score <= 12) return "轻度抑郁倾向，建议多进行户外活动或倾诉。";
        return "中重度抑郁倾向，建议联系专业心理服务人员。";
      }
    },
    SCL90: {
      name: "SCL-90 症状清单（核心评估版）",
      intro: "评估近期综合心理困扰及躯体化体验。",
      options: ["从无", "轻度", "中度", "偏重", "严重"],
      items: [
        "头痛或身体肌肉酸痛",
        "神经过敏，心中不踏实",
        "感到头脑中有不必要的想法",
        "容易发脾气，不能控制愤怒",
        "感到孤单，即使和别人在一起也是如此"
      ],
      interpret(score) {
        if (score <= 8) return "整体心理状态良好。";
        if (score <= 14) return "存在轻度情绪或躯体不适感，注意自我调节。";
        return "提示存在一定强度的心理困扰，建议寻求心理专家深入梳理。";
      }
    },
    PCL5: {
      name: "PCL-5 创伤后应激自评（核心筛选）",
      intro: "评估过去一个月内受到创伤或重大事件影响的困扰程度。",
      options: ["完全没有", "有一点", "中等程度", "相当严重", "极度严重"],
      items: [
        "有关该应激事件的不适回忆反复闯入脑海",
        "当遇到提醒该事件的情境时感到非常痛苦",
        "刻意避免去想或谈论该应激事件",
        "对以前喜欢的活动失去兴趣",
        "极其警觉、警惕，容易受惊吓"
      ],
      interpret(score) {
        if (score <= 6) return "无明显应激困扰。";
        if (score <= 12) return "提示存在轻微创伤后应激反应，宜加强社会支持。";
        return "创伤应激反应较为突出，建议寻求专业创伤心理治疗支持。";
      }
    }
  };

  /* ------------------------- 工具函数 ------------------------- */
  function nowTs() { return Date.now(); }

  function fmtTime(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function containsCrisisKeyword(text) {
    const t = String(text || "");
    return CRISIS_KEYWORDS.some((kw) => t.includes(kw));
  }

  async function getJSON(roche, key, fallback) {
    try {
      const v = await roche.storage.get(key);
      return v === undefined || v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  /* ------------------------- 现代简约 UI 样式 ------------------------- */
  const STYLE_ID = `${PLUGIN_ID}-style`;
  const STYLE_TEXT = `
.roche-plugin-psych-room {
  --pr-bg: #f8fafc;
  --pr-card: #ffffff;
  --pr-primary: #3b82f6;
  --pr-primary-light: #eff6ff;
  --pr-text-main: #0f172a;
  --pr-text-sub: #64748b;
  --pr-border: #e2e8f0;
  --pr-danger: #ef4444;
  --pr-danger-light: #fef2f2;
  --pr-accent: #10b981;
  --pr-radius: 12px;
  --pr-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);

  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--pr-bg);
  color: var(--pr-text-main);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
  box-sizing: border-box;
}
.roche-plugin-psych-room * { box-sizing: border-box; }

.pr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: var(--pr-card);
  border-bottom: 1px solid var(--pr-border);
}
.pr-header-title { font-size: 16px; font-weight: 600; display:flex; align-items:center; gap:8px; }
.pr-header-title .dot { width:8px; height:8px; border-radius:50%; background:var(--pr-accent); }
.pr-back-btn {
  border: 1px solid var(--pr-border); background: #fff; color: var(--pr-text-sub);
  font-size: 13px; cursor: pointer; padding: 5px 12px; border-radius: 6px; transition: all 0.2s;
}
.pr-back-btn:hover { background: #f1f5f9; color: var(--pr-text-main); }

.pr-disclaimer {
  font-size: 12px; color: #b45309; background: #fffbeb;
  padding: 8px 18px; border-bottom: 1px solid #fef3c7; line-height: 1.4;
}

.pr-tabs {
  display: flex; background: var(--pr-card); border-bottom: 1px solid var(--pr-border); padding: 0 10px; gap: 4px;
}
.pr-tab {
  padding: 12px 16px; font-size: 13.5px; color: var(--pr-text-sub); cursor: pointer;
  border-bottom: 2px solid transparent; font-weight: 500; transition: all 0.2s;
}
.pr-tab:hover { color: var(--pr-primary); }
.pr-tab.active { color: var(--pr-primary); border-bottom-color: var(--pr-primary); font-weight: 600; }

.pr-panel { flex: 1; overflow-y: auto; display: none; }
.pr-panel.active { display: flex; flex-direction: column; }

/* 对话区 */
.pr-chat-log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.pr-msg { max-width: 80%; padding: 10px 14px; border-radius: var(--pr-radius); font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; box-shadow: var(--pr-shadow); }
.pr-msg.user { align-self: flex-end; background: var(--pr-primary); color: #fff; border-bottom-right-radius: 2px; }
.pr-msg.ai { align-self: flex-start; background: var(--pr-card); border: 1px solid var(--pr-border); color: var(--pr-text-main); border-bottom-left-radius: 2px; }
.pr-msg.system-note { align-self: center; background: var(--pr-danger-light); color: var(--pr-danger); border: 1px solid #fecaca; font-size: 13px; max-width: 90%; }
.pr-scale-btn {
  align-self: flex-start; background: var(--pr-primary-light); color: var(--pr-primary);
  border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; font-weight: 500;
}
.pr-scale-btn:hover { background: #dbeafe; }
.pr-typing { align-self: flex-start; color: var(--pr-text-sub); font-size: 12.5px; padding: 4px 12px; }

.pr-input-bar {
  display: flex; gap: 10px; padding: 12px; border-top: 1px solid var(--pr-border); background: var(--pr-card);
}
.pr-input-bar textarea {
  flex: 1; resize: none; border: 1px solid var(--pr-border); border-radius: 8px;
  padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; transition: border 0.2s; max-height: 90px; min-height: 40px;
}
.pr-input-bar textarea:focus { border-color: var(--pr-primary); }
.pr-send-btn {
  border: none; background: var(--pr-primary); color: #fff; border-radius: 8px;
  padding: 0 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;
}
.pr-send-btn:hover { background: #2563eb; }
.pr-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 档案与通用卡片 */
.pr-card-box {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: var(--pr-radius);
  padding: 16px; margin-bottom: 14px; box-shadow: var(--pr-shadow);
}
.pr-section-title { font-size: 14.5px; font-weight: 600; margin: 16px 0 10px; color: var(--pr-text-main); display: flex; align-items: center; justify-content: space-between; }
.pr-log-item {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: 8px;
  padding: 10px 12px; margin-bottom: 8px; font-size: 13px; line-height: 1.5;
}
.pr-log-meta { font-size: 11px; color: var(--pr-text-sub); margin-bottom: 4px; }
.pr-tag { display:inline-block; font-size:10.5px; padding:2px 6px; border-radius:4px; margin-right:6px; font-weight:500; }
.pr-tag.fact { background:#dcfce7; color:#15803d; }
.pr-tag.guess { background:#fef3c7; color:#b45309; }
.pr-tag.ai_observation { background:#e0f2fe; color:#0369a1; }
.pr-tag.professional { background:#f3e8ff; color:#6b21a8; }
.pr-empty { color: var(--pr-text-sub); font-size: 13px; text-align: center; padding: 30px 10px; }

/* 提示词查看与配置 */
.pr-prompt-container { padding: 16px; overflow-y: auto; }
.pr-textarea {
  width: 100%; border: 1px solid var(--pr-border); border-radius: 8px;
  padding: 10px; font-size: 13px; font-family: monospace; line-height: 1.5; outline: none; min-height: 220px;
}
.pr-textarea:focus { border-color: var(--pr-primary); }
.pr-btn-group { display: flex; gap: 10px; margin-top: 10px; }
.pr-btn {
  border: none; background: var(--pr-primary); color: #fff; border-radius: 6px;
  padding: 8px 16px; font-size: 13px; cursor: pointer; font-weight: 500;
}
.pr-btn-secondary { background: #f1f5f9; color: var(--pr-text-main); border: 1px solid var(--pr-border); }
.pr-btn-secondary:hover { background: #e2e8f0; }

/* 单独 API 配置 */
.pr-form-group { margin-bottom: 12px; }
.pr-form-group label { display: block; font-size: 12.5px; color: var(--pr-text-sub); margin-bottom: 4px; }
.pr-input {
  width: 100%; border: 1px solid var(--pr-border); border-radius: 6px;
  padding: 8px 10px; font-size: 13px; outline: none;
}
.pr-input:focus { border-color: var(--pr-primary); }

/* 关键词绑定配置 */
.pr-kw-item {
  display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--pr-border);
  border-radius: 8px; padding: 10px; margin-bottom: 10px; background: #fafafa;
}
.pr-kw-row { display: flex; gap: 8px; align-items: center; }

/* 量表 */
.pr-scales-list { padding: 16px; overflow-y: auto; }
.pr-scale-card {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: var(--pr-radius);
  padding: 14px; margin-bottom: 12px; box-shadow: var(--pr-shadow);
}
.pr-scale-card h4 { margin: 0 0 4px; font-size: 14.5px; }
.pr-scale-card p { margin: 0 0 10px; font-size: 12.5px; color: var(--pr-text-sub); }
.pr-scale-start { border: none; background: var(--pr-primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 12.5px; cursor: pointer; }
.pr-scale-item { margin-bottom: 12px; border-bottom: 1px dashed var(--pr-border); padding-bottom: 10px; }
.pr-scale-item-q { font-size: 13.5px; margin-bottom: 6px; font-weight: 500; }
.pr-scale-options { display: flex; flex-direction: column; gap: 6px; }
.pr-scale-options label { font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.pr-scale-submit { border: none; background: var(--pr-primary); color: #fff; border-radius: 6px; padding: 8px; font-size: 13.5px; cursor: pointer; width: 100%; margin-top: 8px; }
.pr-scale-result { background: var(--pr-primary-light); border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.6; }
.pr-history-item { font-size: 12.5px; color: var(--pr-text-sub); border-top: 1px solid var(--pr-border); padding: 8px 0; }

/* 关于 */
.pr-about { padding: 16px; font-size: 13.5px; line-height: 1.8; color: var(--pr-text-sub); }
.pr-about b { color: var(--pr-text-main); }
.pr-clear-btn { margin-top: 14px; border: 1px solid var(--pr-danger); color: var(--pr-danger); background: transparent; border-radius: 6px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
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
    root.className = "roche-plugin-psych-room";
    root.innerHTML = `
      <div class="pr-header">
        <div class="pr-header-title"><span class="dot"></span>心理咨询室</div>
        <button class="pr-back-btn" id="pr-close">返回</button>
      </div>
      <div class="pr-disclaimer">非医疗诊断工具。极度痛苦或有危险冲动时，请立即拨打 12356 或 120。</div>
      <div class="pr-tabs">
        <div class="pr-tab active" data-tab="chat">对话</div>
        <div class="pr-tab" data-tab="prompt">提示词与API</div>
        <div class="pr-tab" data-tab="keywords">关键词关联</div>
        <div class="pr-tab" data-tab="archive">成长档案</div>
        <div class="pr-tab" data-tab="scales">心理量表</div>
        <div class="pr-tab" data-tab="about">关于</div>
      </div>
      <div class="pr-panel active" data-panel="chat">
        <div class="pr-chat-log" id="pr-chat-log"></div>
        <div class="pr-input-bar">
          <textarea id="pr-input" placeholder="想到什么就说什么…" rows="1"></textarea>
          <button class="pr-send-btn" id="pr-send">发送</button>
        </div>
      </div>
      <div class="pr-panel" data-panel="prompt">
        <div class="pr-prompt-container">
          <div class="pr-card-box">
            <div class="pr-section-title">系统提示词 (System Prompt)</div>
            <p style="font-size:12px;color:var(--pr-text-sub);margin-bottom:8px;">可在此预览或调整注入AI的提示词规则（注：{{MANUAL_TEXT}} 会被自动替换为说明书）。</p>
            <textarea class="pr-textarea" id="pr-prompt-input"></textarea>
            <div class="pr-btn-group">
              <button class="pr-btn" id="pr-save-prompt">保存提示词</button>
              <button class="pr-btn pr-btn-secondary" id="pr-reset-prompt">恢复默认</button>
            </div>
          </div>
          <div class="pr-card-box">
            <div class="pr-section-title">单独 API 设置</div>
            <p style="font-size:12px;color:var(--pr-text-sub);margin-bottom:8px;">配置后插件发送AI请求将优先使用此处的配置，留空则使用 Roche 宿主默认配置。</p>
            <div class="pr-form-group">
              <label>Provider</label>
              <input type="text" class="pr-input" id="pr-api-provider" placeholder="例如: openai, custom">
            </div>
            <div class="pr-form-group">
              <label>Model</label>
              <input type="text" class="pr-input" id="pr-api-model" placeholder="例如: gpt-4o, claude-3-5-sonnet">
            </div>
            <div class="pr-form-group">
              <label>Endpoint</label>
              <input type="text" class="pr-input" id="pr-api-endpoint" placeholder="例如: https://api.openai.com/v1">
            </div>
            <div class="pr-form-group">
              <label>API Key</label>
              <input type="password" class="pr-input" id="pr-api-key" placeholder="sk-...">
            </div>
            <button class="pr-btn" id="pr-save-api">保存 API 设置</button>
          </div>
        </div>
      </div>
      <div class="pr-panel" data-panel="keywords">
        <div class="pr-prompt-container">
          <div class="pr-card-box">
            <div class="pr-section-title">关键词与关联文本绑定</div>
            <p style="font-size:12px;color:var(--pr-text-sub);margin-bottom:10px;">当用户发送的消息中包含指定关键词时，插件会自动将关联文本作为补充背景信息发送给 AI。</p>
            <div id="pr-kw-list"></div>
            <button class="pr-btn pr-btn-secondary" id="pr-add-kw" style="margin-top:8px;">+ 添加关键词绑定</button>
            <div style="margin-top:14px;">
              <button class="pr-btn" id="pr-save-kw">保存所有绑定</button>
            </div>
          </div>
        </div>
      </div>
      <div class="pr-panel" data-panel="archive">
        <div class="pr-archive" id="pr-archive" style="padding:16px;"></div>
      </div>
      <div class="pr-panel" data-panel="scales">
        <div class="pr-scales-list" id="pr-scales-list"></div>
      </div>
      <div class="pr-panel" data-panel="about">
        <div class="pr-about">
          <p><b>心理咨询室</b>是一个 AI 心理陪伴与自我成长记录工具。</p>
          <p>新版本支持提示词自定义、精细化 API 接入、Token 节省型量表结果推送以及自定义关键词匹配上下文。</p>
          <button class="pr-clear-btn" id="pr-clear">清空我的全部数据</button>
        </div>
      </div>
    `;
    container.appendChild(root);

    /* ---------------- Tab 切换 ---------------- */
    root.querySelector("#pr-close").onclick = () => roche.ui.closeApp();

    root.querySelectorAll(".pr-tab").forEach((tabEl) => {
      tabEl.onclick = async () => {
        root.querySelectorAll(".pr-tab").forEach((t) => t.classList.remove("active"));
        root.querySelectorAll(".pr-panel").forEach((p) => p.classList.remove("active"));
        tabEl.classList.add("active");
        const name = tabEl.dataset.tab;
        root.querySelector(`.pr-panel[data-panel="${name}"]`).classList.add("active");
        if (name === "archive") await renderArchive();
        if (name === "scales") await renderScales();
        if (name === "prompt") await renderPromptAndAPI();
        if (name === "keywords") await renderKeywords();
      };
    });

    root.querySelector("#pr-clear").onclick = async () => {
      const ok = await roche.ui.confirm({
        title: "清空全部数据",
        message: "将删除保存的记录、设置和档案，是否继续？"
      }).catch(() => window.confirm("将删除保存的记录、设置和档案，是否继续？"));
      if (!ok) return;
      await Promise.all([
        roche.storage.delete(K_HISTORY),
        roche.storage.delete(K_LOG),
        roche.storage.delete(K_MANUAL),
        roche.storage.delete(K_SCALES),
        roche.storage.delete(K_META),
        roche.storage.delete(K_PROMPT),
        roche.storage.delete(K_API_CONFIG),
        roche.storage.delete(K_KEYWORDS)
      ]);
      roche.ui.toast && roche.ui.toast("已清空");
      await renderChatLog();
    };

    /* ---------------- 提示词与 API 配置渲染 ---------------- */
    async function renderPromptAndAPI() {
      const savedPrompt = await getJSON(roche, K_PROMPT, DEFAULT_SYSTEM_PROMPT);
      root.querySelector("#pr-prompt-input").value = savedPrompt;

      const apiConfig = await getJSON(roche, K_API_CONFIG, {});
      root.querySelector("#pr-api-provider").value = apiConfig.provider || "";
      root.querySelector("#pr-api-model").value = apiConfig.model || "";
      root.querySelector("#pr-api-endpoint").value = apiConfig.endpoint || "";
      root.querySelector("#pr-api-key").value = apiConfig.apiKey || "";
    }

    root.querySelector("#pr-save-prompt").onclick = async () => {
      const text = root.querySelector("#pr-prompt-input").value;
      await roche.storage.set(K_PROMPT, text);
      roche.ui.toast ? roche.ui.toast("提示词已保存") : alert("提示词已保存");
    };

    root.querySelector("#pr-reset-prompt").onclick = async () => {
      root.querySelector("#pr-prompt-input").value = DEFAULT_SYSTEM_PROMPT;
      await roche.storage.set(K_PROMPT, DEFAULT_SYSTEM_PROMPT);
      roche.ui.toast ? roche.ui.toast("已恢复默认提示词") : alert("已恢复默认提示词");
    };

    root.querySelector("#pr-save-api").onclick = async () => {
      const config = {
        provider: root.querySelector("#pr-api-provider").value.trim(),
        model: root.querySelector("#pr-api-model").value.trim(),
        endpoint: root.querySelector("#pr-api-endpoint").value.trim(),
        apiKey: root.querySelector("#pr-api-key").value.trim()
      };
      await roche.storage.set(K_API_CONFIG, config);
      roche.ui.toast ? roche.ui.toast("API 设置已保存") : alert("API 设置已保存");
    };

    /* ---------------- 关键词绑定配置 ---------------- */
    async function renderKeywords() {
      const bindings = await getJSON(roche, K_KEYWORDS, []);
      const containerEl = root.querySelector("#pr-kw-list");
      containerEl.innerHTML = "";
      bindings.forEach((item, index) => {
        const itemEl = document.createElement("div");
        itemEl.className = "pr-kw-item";
        itemEl.innerHTML = `
          <div class="pr-kw-row">
            <input type="text" class="pr-input kw-key" placeholder="触发关键词 (如: 抑郁)" value="${escapeHtml(item.keyword || "")}">
            <button class="pr-btn pr-btn-secondary del-kw" style="color:var(--pr-danger);">删除</button>
          </div>
          <textarea class="pr-textarea kw-text" placeholder="匹配后注入的背景文本..." style="min-height:60px;margin-top:4px;">${escapeHtml(item.text || "")}</textarea>
        `;
        itemEl.querySelector(".del-kw").onclick = () => itemEl.remove();
        containerEl.appendChild(itemEl);
      });
    }

    root.querySelector("#pr-add-kw").onclick = () => {
      const containerEl = root.querySelector("#pr-kw-list");
      const itemEl = document.createElement("div");
      itemEl.className = "pr-kw-item";
      itemEl.innerHTML = `
        <div class="pr-kw-row">
          <input type="text" class="pr-input kw-key" placeholder="触发关键词 (如: 抑郁)" value="">
          <button class="pr-btn pr-btn-secondary del-kw" style="color:var(--pr-danger);">删除</button>
        </div>
        <textarea class="pr-textarea kw-text" placeholder="匹配后注入的背景文本..." style="min-height:60px;margin-top:4px;"></textarea>
      `;
      itemEl.querySelector(".del-kw").onclick = () => itemEl.remove();
      containerEl.appendChild(itemEl);
    };

    root.querySelector("#pr-save-kw").onclick = async () => {
      const items = root.querySelectorAll("#pr-kw-list .pr-kw-item");
      const bindings = [];
      items.forEach((el) => {
        const kw = el.querySelector(".kw-key").value.trim();
        const txt = el.querySelector(".kw-text").value.trim();
        if (kw && txt) {
          bindings.push({ keyword: kw, text: txt });
        }
      });
      await roche.storage.set(K_KEYWORDS, bindings);
      roche.ui.toast ? roche.ui.toast("关键词绑定已保存") : alert("关键词绑定已保存");
    };

    /* ---------------- 对话逻辑 ---------------- */
    const chatLogEl = root.querySelector("#pr-chat-log");
    const inputEl = root.querySelector("#pr-input");
    const sendBtn = root.querySelector("#pr-send");

    async function renderChatLog() {
      const history = await getJSON(roche, K_HISTORY, []);
      chatLogEl.innerHTML = "";
      if (history.length === 0) {
        const hint = document.createElement("div");
        hint.className = "pr-empty";
        hint.textContent = "想到什么都可以在这里说，我会倾听并陪伴你。";
        chatLogEl.appendChild(hint);
      }
      history.forEach((m) => appendMsgEl(m));
      chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }

    function appendMsgEl(m) {
      if (m.role === "scale-suggest") {
        const btn = document.createElement("button");
        btn.className = "pr-scale-btn";
        btn.textContent = `开始 ${(SCALES[m.scale] || {}).name || m.scale} →`;
        btn.onclick = () => {
          root.querySelector('.pr-tab[data-tab="scales"]').click();
        };
        chatLogEl.appendChild(btn);
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "pr-msg " + (m.role === "user" ? "user" : m.role === "system-note" ? "system-note" : "ai");
      wrap.textContent = m.content;
      chatLogEl.appendChild(wrap);
    }

    async function pushHistory(msg) {
      const history = await getJSON(roche, K_HISTORY, []);
      history.push(msg);
      await roche.storage.set(K_HISTORY, history);
    }

    function autoGrow() {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + "px";
    }
    inputEl.addEventListener("input", autoGrow);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    sendBtn.onclick = async () => {
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = "";
      autoGrow();
      sendBtn.disabled = true;

      const userMsg = { role: "user", content: text, ts: nowTs() };
      appendMsgEl(userMsg);
      await pushHistory(userMsg);
      chatLogEl.scrollTop = chatLogEl.scrollHeight;

      if (containsCrisisKeyword(text)) {
        const noteMsg = { role: "system-note", content: CRISIS_MESSAGE, ts: nowTs() };
        appendMsgEl(noteMsg);
        await pushHistory(noteMsg);
        chatLogEl.scrollTop = chatLogEl.scrollHeight;
      }

      const typingEl = document.createElement("div");
      typingEl.className = "pr-typing";
      typingEl.textContent = "对方正在输入…";
      chatLogEl.appendChild(typingEl);
      chatLogEl.scrollTop = chatLogEl.scrollHeight;

      try {
        const [manual, history, promptTpl, apiConfig, bindings] = await Promise.all([
          getJSON(roche, K_MANUAL, ""),
          getJSON(roche, K_HISTORY, []),
          getJSON(roche, K_PROMPT, DEFAULT_SYSTEM_PROMPT),
          getJSON(roche, K_API_CONFIG, {}),
          getJSON(roche, K_KEYWORDS, [])
        ]);

        // 匹配关键词并注入文本
        let matchedAddon = "";
        bindings.forEach(b => {
          if (b.keyword && text.includes(b.keyword)) {
            matchedAddon += `\n[检测到关键词"${b.keyword}"的关联背景信息：${b.text}]`;
          }
        });

        let systemPrompt = promptTpl.replace("{{MANUAL_TEXT}}", manual && manual.trim() ? manual.trim() : "（暂无）");
        if (matchedAddon) {
          systemPrompt += "\n\n" + matchedAddon;
        }

        const recent = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-20);
        const messages = [
          { role: "system", content: systemPrompt },
          ...recent.map((m) => ({ role: m.role, content: m.content }))
        ];

        // 拼接 API 请求参数
        const chatOpts = { messages, temperature: 0.7 };
        if (apiConfig.provider) chatOpts.provider = apiConfig.provider;
        if (apiConfig.model) chatOpts.model = apiConfig.model;
        if (apiConfig.endpoint) chatOpts.endpoint = apiConfig.endpoint;
        if (apiConfig.apiKey) chatOpts.apiKey = apiConfig.apiKey;

        const result = await roche.ai.chat(chatOpts);
        let replyText = (result && result.text ? result.text : "").trim();

        let scaleSuggest = null;
        const scaleMatch = replyText.match(/\[\[SCALE:(PHQ9|GAD7|SAS|SDS|SCL90|PCL5)\]\]/);
        if (scaleMatch) {
          scaleSuggest = scaleMatch[1];
          replyText = replyText.replace(/\[\[SCALE:(PHQ9|GAD7|SAS|SDS|SCL90|PCL5)\]\]/, "").trim();
        }

        typingEl.remove();

        const aiMsg = { role: "assistant", content: replyText, ts: nowTs() };
        appendMsgEl(aiMsg);
        await pushHistory(aiMsg);

        if (scaleSuggest) {
          const suggestMsg = { role: "scale-suggest", scale: scaleSuggest, ts: nowTs() };
          appendMsgEl(suggestMsg);
          await pushHistory(suggestMsg);
        }
        chatLogEl.scrollTop = chatLogEl.scrollHeight;

        await maybeRunSummary(roche, apiConfig);
      } catch (err) {
        typingEl.remove();
        const errMsg = { role: "assistant", content: "（这轮网络或 API 接口请求出现异常，请检查配置或稍后重试）", ts: nowTs() };
        appendMsgEl(errMsg);
      } finally {
        sendBtn.disabled = false;
      }
    };

    /* ---------------- 后台整理 ---------------- */
    async function maybeRunSummary(roche, apiConfig) {
      const meta = await getJSON(roche, K_META, { msgCountSinceSummary: 0 });
      meta.msgCountSinceSummary = (meta.msgCountSinceSummary || 0) + 1;
      if (meta.msgCountSinceSummary < SUMMARY_EVERY_N_TURNS) {
        await roche.storage.set(K_META, meta);
        return;
      }
      meta.msgCountSinceSummary = 0;
      await roche.storage.set(K_META, meta);

      try {
        const [manual, history] = await Promise.all([
          getJSON(roche, K_MANUAL, ""),
          getJSON(roche, K_HISTORY, [])
        ]);
        const recentTurnsText = history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-SUMMARY_EVERY_N_TURNS * 2)
          .map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`)
          .join("\n");
        if (!recentTurnsText.trim()) return;

        const summaryPrompt = `你是一个记录整理助手，请只输出 JSON：\n{"log_entries": [{"type": "fact", "text": "..."}], "manual_update": "..."}\n\n已有说明书：\n${manual}\n\n最近对话：\n${recentTurnsText}`;
        
        const chatOpts = {
          messages: [{ role: "user", content: summaryPrompt }],
          temperature: 0.2
        };
        if (apiConfig.provider) chatOpts.provider = apiConfig.provider;
        if (apiConfig.model) chatOpts.model = apiConfig.model;
        if (apiConfig.endpoint) chatOpts.endpoint = apiConfig.endpoint;
        if (apiConfig.apiKey) chatOpts.apiKey = apiConfig.apiKey;

        const result = await roche.ai.chat(chatOpts);
        const raw = (result && result.text ? result.text : "").trim()
          .replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) { return; }

        const log = await getJSON(roche, K_LOG, []);
        (parsed.log_entries || []).forEach((entry) => {
          if (entry && entry.text) {
            log.push({ ts: nowTs(), type: entry.type || "ai_observation", text: entry.text });
          }
        });
        await roche.storage.set(K_LOG, log);

        if (parsed.manual_update && typeof parsed.manual_update === "string" && parsed.manual_update.trim()) {
          await roche.storage.set(K_MANUAL, parsed.manual_update.trim());
        }
      } catch (e) {}
    }

    /* ---------------- 档案与量表 ---------------- */
    const archiveEl = root.querySelector("#pr-archive");
    async function renderArchive() {
      const [manual, log] = await Promise.all([
        getJSON(roche, K_MANUAL, ""),
        getJSON(roche, K_LOG, [])
      ]);
      const tagLabel = { fact: "事实", guess: "用户猜测", ai_observation: "AI观察", professional: "专业观点" };

      let html = `<div class="pr-card-box"><div class="pr-section-title">自我认知说明书</div><div>${manual && manual.trim() ? escapeHtml(manual) : "说明书积累中…"}</div></div>`;
      html += `<div class="pr-section-title">成长日志</div>`;
      if (!log.length) {
        html += `<div class="pr-empty">暂无记录</div>`;
      } else {
        [...log].reverse().slice(0, 50).forEach((item) => {
          html += `<div class="pr-log-item">
            <div class="pr-log-meta"><span class="pr-tag ${item.type}">${tagLabel[item.type] || "记录"}</span>${fmtTime(item.ts)}</div>
            <div>${escapeHtml(item.text)}</div>
          </div>`;
        });
      }
      archiveEl.innerHTML = html;
    }

    const scalesListEl = root.querySelector("#pr-scales-list");
    async function renderScales() {
      const history = await getJSON(roche, K_SCALES, []);
      let html = "";
      Object.keys(SCALES).forEach((key) => {
        const s = SCALES[key];
        html += `<div class="pr-scale-card" data-scale="${key}">
          <h4>${s.name}</h4>
          <p>${s.intro}</p>
          <button class="pr-scale-start" data-start="${key}">开始测评</button>
          <div class="pr-scale-form" data-form="${key}" style="display:none;margin-top:12px;"></div>
        </div>`;
      });
      html += `<div class="pr-section-title">历史记录</div>`;
      if (!history.length) {
        html += `<div class="pr-empty">暂无测评记录</div>`;
      } else {
        [...history].reverse().forEach((r) => {
          html += `<div class="pr-history-item">${fmtTime(r.ts)} · ${(SCALES[r.scale] || {}).name || r.scale} · 得分 ${r.score}</div>`;
        });
      }
      scalesListEl.innerHTML = html;

      scalesListEl.querySelectorAll("[data-start]").forEach((btn) => {
        btn.onclick = () => {
          const key = btn.dataset.start;
          const formEl = scalesListEl.querySelector(`.pr-scale-form[data-form="${key}"]`);
          formEl.style.display = formEl.style.display === "none" ? "block" : "none";
          if (formEl.style.display === "block" && !formEl.dataset.built) {
            buildScaleForm(key, formEl);
            formEl.dataset.built = "1";
          }
        };
      });
    }

    function buildScaleForm(key, formEl) {
      const s = SCALES[key];
      let html = "";
      s.items.forEach((q, idx) => {
        html += `<div class="pr-scale-item">
          <div class="pr-scale-item-q">${idx + 1}. ${q}</div>
          <div class="pr-scale-options">
            ${s.options.map((opt, val) => `
              <label><input type="radio" name="pr-q-${key}-${idx}" value="${val}"> ${opt}</label>
            `).join("")}
          </div>
        </div>`;
      });
      html += `<button class="pr-scale-submit" data-submit="${key}">提交量表并精简推送AI</button>`;
      html += `<div class="pr-scale-result" data-result="${key}" style="display:none;margin-top:10px;"></div>`;
      formEl.innerHTML = html;

      formEl.querySelector(`[data-submit="${key}"]`).onclick = async () => {
        let total = 0;
        let answeredAll = true;
        s.items.forEach((q, idx) => {
          const checked = formEl.querySelector(`input[name="pr-q-${key}-${idx}"]:checked`);
          if (!checked) { answeredAll = false; return; }
          total += Number(checked.value);
        });
        if (!answeredAll) {
          roche.ui.toast ? roche.ui.toast("请回答所有题目") : alert("请回答所有题目");
          return;
        }

        const interpretText = s.interpret(total);
        const resultEl = formEl.querySelector(`[data-result="${key}"]`);
        resultEl.style.display = "block";
        resultEl.innerHTML = `<b>得分：${total}</b><br>${interpretText}`;

        const history = await getJSON(roche, K_SCALES, []);
        history.push({ ts: nowTs(), scale: key, score: total });
        await roche.storage.set(K_SCALES, history);

        // 仅将【量表得分 + 结论】精简发送给 AI，以大幅节省 Token，不发送原题列表
        const summaryMsgText = `【量表自评结果】我刚刚完成了《${s.name}》，得分为 ${total} 分。解析说明：${interpretText}`;
        const scaleUserMsg = { role: "user", content: summaryMsgText, ts: nowTs() };
        await pushHistory(scaleUserMsg);

        // 记录日志
        const log = await getJSON(roche, K_LOG, []);
        log.push({ ts: nowTs(), type: "fact", text: `完成了 ${s.name}，得分 ${total}。` });
        await roche.storage.set(K_LOG, log);

        roche.ui.toast ? roche.ui.toast("结果已精简同步至对话，可切回对话查看") : alert("结果已同步至对话");
        await renderScales();
      };
    }

    await renderChatLog();
    return { root };
  }

  async function unmount(container) {
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    container.replaceChildren();
  }

  window.RochePlugin.register({
    id: PLUGIN_ID,
    name: "心理咨询室",
    version: "1.1.0",
    apps: [
      {
        id: APP_ID,
        name: "心理咨询室",
        icon: "psychology",
        iconImage: "",
        mount,
        unmount
      }
    ]
  });
})();
