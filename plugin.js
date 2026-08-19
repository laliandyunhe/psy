/* ==========================================================
 * 心理咨询室 (psych-counseling-room) - Roche 插件 v1.2.0
 * 功能升级：
 * 1. 移除置顶免责提示，界面更沉浸清爽
 * 2. 顶部 Tab 采用 SVG 矢量图标 + 响应式布局，彻底解决拥挤换行
 * 3. 深度重构“成长档案”：多维度认知画像（信念/情绪/人际/资源）+ 结构化日志 + 分类筛选
 * 4. 实时记忆系统：总结时自动沉淀至 Roche 宿主主记忆 (roche.memory.write) 及插件私有认知库
 * 5. 量表交互直达：AI 发送量表建议后，点击即刻跳转并展开对应量表开始测评
 * 6. 丰富量表库：扩充至 10 款常见心理评估量表（PHQ9, GAD7, SAS, SDS, SCL90, PCL5, ISI, RSES, PSS10, CDRISC10）
 * ========================================================== */

(function () {
  "use strict";

  const PLUGIN_ID = "psych-counseling-room";
  const APP_ID = "psych-counseling-room-home";

  /* ------------------------- 存储 Key ------------------------- */
  const K_HISTORY = "chat-history";
  const K_LOG = "growth-log";
  const K_PROFILE = "growth-profile-v2";      // 结构化多维成长档案画像
  const K_MANUAL = "user-manual";
  const K_SCALES = "scale-results";
  const K_META = "session-meta";
  const K_PROMPT = "system-prompt-override";
  const K_API_CONFIG = "api-config";
  const K_KEYWORDS = "keyword-bindings";

  const SUMMARY_EVERY_N_TURNS = 4; // 每4轮进行一次增量档案与记忆同步

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

  /* ------------------------- 默认系统提示词 ------------------------- */
  const DEFAULT_SYSTEM_PROMPT = `你是一位“心理状态评估 + 日常陪伴 + 深度自我探索”的专业心理支持助手。
综合采用循证心理学、认知行为视角(CBT)、接纳承诺疗法(ACT)与人本主义流派工作。

【核心定位与风格】
- 温和、敏锐、稳定、不评判、具备专业洞察力。
- 优先倾听并接纳情绪体验（Empathy），再帮助梳理认知信念与应对行为。
- 像真诚的朋友与咨询师一样自然聊天，避免生硬的说教、罗列条目。

【量表触发规则】
- 当感知到用户存在持续的情绪困扰、睡眠问题、压力或创伤体验，且适合量化评估时，可在回复最后单独另起一行，输出量表标记：
[[SCALE:PHQ9]] 或 [[SCALE:GAD7]] 或 [[SCALE:SAS]] 或 [[SCALE:SDS]] 或 [[SCALE:SCL90]] 或 [[SCALE:PCL5]] 或 [[SCALE:ISI]] 或 [[SCALE:RSES]] 或 [[SCALE:PSS10]] 或 [[SCALE:CDRISC10]]
- 一次最多推荐 1 个针对性量表。用户排斥时立即停止推荐。

【当前用户的成长档案与认知画像】
----------------
{{MANUAL_TEXT}}
----------------`;

  /* ------------------------- 10 套经典心理量表定义 ------------------------- */
  const SCALES = {
    PHQ9: {
      name: "PHQ-9 抑郁自评量表",
      category: "情绪体验",
      intro: "过去两周里，以下情况困扰你的频率有多高？",
      options: ["完全没有", "有几天", "一半以上天数", "几乎每天"],
      items: [
        "做事时提不起劲或没有兴趣",
        "感到心情低落、沮丧或绝望",
        "入睡困难、睡不安稳或睡眠过多",
        "感觉疲倦或没有活力",
        "食欲不振或吃太多",
        "觉得自己很糟，或觉得自己很失败，或让自己/家人失望",
        "对事物专注有困难，例如阅读或看电视时",
        "动作或说话速度缓慢到别人已察觉，或烦躁坐立不安",
        "有过觉得死了会更好，或想用某种方式伤害自己的念头"
      ],
      interpret(score) {
        if (score <= 4) return "得分处于正常/极轻微区间，属于常见的情绪波动范围。";
        if (score <= 9) return "轻度抑郁倾向，建议多留意作息、适度运动并保持表达。";
        if (score <= 14) return "中度抑郁倾向，建议考虑寻求专业心理咨询师的帮助与支持。";
        if (score <= 19) return "中重度抑郁倾向，建议寻求专业心理咨询或精神专科医学评估。";
        return "重度抑郁倾向，强烈建议尽早前往专业医院精神卫生科就诊或拨打热线 12356。";
      }
    },
    GAD7: {
      name: "GAD-7 广泛性焦虑自评量表",
      category: "情绪体验",
      intro: "过去两周里，以下困扰出现的频率有多高？",
      options: ["完全没有", "有几天", "一半以上天数", "几乎每天"],
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
        if (score <= 4) return "得分处于正常轻微区间，无明显广泛性焦虑。";
        if (score <= 9) return "轻度焦虑，可尝试呼吸练习、正念冥想或减少咖啡因摄入。";
        if (score <= 14) return "中度焦虑，建议结合认知行为调适或寻求专业心理咨询。";
        return "重度焦虑，建议尽快前往专科医疗机构或心理门诊寻求专业评估。";
      }
    },
    SAS: {
      name: "SAS 焦虑状态自评（简版）",
      category: "情绪体验",
      intro: "评估最近一周内你的主观躯体化与焦虑体验。",
      options: ["没有或很少", "小部分时间", "相当多时间", "绝大部分时间"],
      items: [
        "觉得比平时更容易紧张和着急",
        "无缘无故地感到害怕",
        "容易心里烦乱或感到惊恐",
        "觉得身体各部分都在发抖或颤抖",
        "因为头痛、颈痛、背痛等肌肉紧绷而苦恼"
      ],
      interpret(score) {
        if (score <= 5) return "无明显躯体性焦虑反应，状态稳定。";
        if (score <= 10) return "轻度紧张紧绷感，建议注意肌肉放松与劳逸结合。";
        return "焦虑躯体化反应较为明显，建议通过专业支持进一步排查与疏导。";
      }
    },
    SDS: {
      name: "SDS 抑郁状态自评（简版）",
      category: "情绪体验",
      intro: "评估最近一周你的心境与动力感受。",
      options: ["没有或很少", "小部分时间", "相当多时间", "绝大部分时间"],
      items: [
        "感到情绪低沉、郁郁寡欢",
        "觉得自己的生活没有太大意思或缺乏动力",
        "经常无缘无故想要哭泣或感到难受",
        "夜间睡眠不好、容易早醒或多梦",
        "感到精力耗竭，做事变得很吃力"
      ],
      interpret(score) {
        if (score <= 5) return "心境平稳，未见明显抑郁状态。";
        if (score <= 10) return "存在轻度心境低落，建议增加户外光照与轻度社交。";
        return "提示中度以上心境低落体验，建议关注心理健康，及时寻求专业陪伴。";
      }
    },
    ISI: {
      name: "ISI 失眠严重程度指数量表",
      category: "躯体与作息",
      intro: "评估最近两周的睡眠质量与困扰程度。",
      options: ["无", "轻度", "中度", "严重", "极度严重"],
      items: [
        "入睡困难的严重程度",
        "难以维持睡眠（夜间易醒）的严重程度",
        "早醒问题的严重程度",
        "对当前睡眠模式的满意程度",
        "睡眠问题对日间功能（如疲劳、情绪、注意力）的干扰程度"
      ],
      interpret(score) {
        if (score <= 7) return "无临床意义的显著失眠。";
        if (score <= 14) return "轻度亚临床失眠，建议建立固定睡眠生物钟并改善睡眠卫生。";
        if (score <= 21) return "中度临床失眠，建议咨询睡眠专科或心理医生。";
        return "重度失眠，强烈建议就医进行全面睡眠评估。";
      }
    },
    PSS10: {
      name: "PSS-10 知觉压力量表",
      category: "压力负荷",
      intro: "评估在过去一个月中，你感到生活不可控或超负荷的频率。",
      options: ["从不", "很少", "有时", "经常", "总是"],
      items: [
        "因为发生了意料之外的事情而感到心烦意乱",
        "感觉无法控制生活中重要的事情",
        "感到紧张和充满压力",
        "感觉事情堆积如山，自己无法一一克服",
        "难以应对所有必须要做的事情"
      ],
      interpret(score) {
        if (score <= 6) return "知觉压力水平较低，心理适应与应对良好。";
        if (score <= 13) return "处于中等压力水平，注意适时减负与建立心理边界。";
        return "处于较高压力超负荷状态，建议主动释放压力并寻求外界资源支持。";
      }
    },
    RSES: {
      name: "RSES 罗森伯格自尊量表（核心版）",
      category: "认知与信念",
      intro: "了解你对自己整体的评价与接纳态度。",
      options: ["非常不同意", "不同意", "同意", "非常同意"],
      items: [
        "我觉得自己是一个有价值的人，至少与别人不相上下",
        "我觉得自己有许多优点",
        "我能够像大多数人一样把事情做好",
        "我对自己持有一种积极的态度",
        "总的来说，我对自己感到满意"
      ],
      interpret(score) {
        if (score >= 12) return "自尊水平良好，对自己持有积极、客观的接纳态度。";
        if (score >= 8) return "自尊水平中等，有时容易受到外部评价波动，可多进行自我肯定。";
        return "自尊水平偏低，可能存在较强的自我苛责与否定，建议练习无条件自我接纳。";
      }
    },
    CDRISC10: {
      name: "CD-RISC-10 心理韧性量表",
      category: "资源与应对",
      intro: "评估在面对困境、变化或挫折时的适应与复原能力。",
      options: ["从不", "很少", "有时", "经常", "总是"],
      items: [
        "在面临变化时，我能够适应",
        "无论发生什么事情，我都能应付过去",
        "面对困难时，我能够看到幽默有趣的一面",
        "在压力之下，我能够保持专注和清晰思考",
        "在经历了困难与挫折后，我能很快恢复过来"
      ],
      interpret(score) {
        if (score >= 15) return "心理韧性（复原力）极佳，具有强大的抗逆力与自我调节资源。";
        if (score >= 10) return "心理韧性处于中等水平，面对逆境通常能够逐步适应。";
        return "当前心理能量较为疲惫，韧性缓冲不足，此时更需要休整与滋养自我。";
      }
    },
    SCL90: {
      name: "SCL-90 综合症状自评（核心筛选）",
      category: "身心状态",
      intro: "评估近期综合心理困扰及躯体不适感。",
      options: ["从无", "轻度", "中度", "偏重", "严重"],
      items: [
        "头痛、肌肉酸痛或身体发紧",
        "神经过敏，心中不踏实或容易惊吓",
        "感到头脑中有不必要的想法反复出现",
        "容易发脾气，难以控制情绪冲动",
        "感到孤单，即使和别人在一起也是如此"
      ],
      interpret(score) {
        if (score <= 5) return "身心综合状态良好，未见明显困扰。";
        if (score <= 11) return "存在轻度身心疲劳或情绪波动，宜调节生活节奏。";
        return "提示存在一定强度的身心综合困扰，建议寻求专业心理工作者深入梳理。";
      }
    },
    PCL5: {
      name: "PCL-5 创伤后应激自评（核心筛选）",
      category: "创伤应激",
      intro: "评估过去一个月内受到重大创伤或应激事件影响的程度。",
      options: ["完全没有", "有一点", "中等程度", "相当严重", "极度严重"],
      items: [
        "有关该应激事件的不适回忆反复闯入脑海",
        "当遇到提醒该事件的情境时感到非常痛苦",
        "刻意避免去想、谈论或感受该事件",
        "对以前喜欢的活动失去兴趣",
        "处于高度警觉状态，容易受惊吓"
      ],
      interpret(score) {
        if (score <= 5) return "无明显应激困扰，创伤适应良好。";
        if (score <= 10) return "存在轻度创伤后应激反应，建议建立安全感与社会支持。";
        return "创伤应激反应较为明显，建议联系专业创伤心理治疗师进行系统干预。";
      }
    }
  };

  /* ------------------------- 矢量 SVG 图标库 ------------------------- */
  const ICONS = {
    chat: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    archive: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    scales: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    prompt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    keywords: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
    about: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    back: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`
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

  /* ------------------------- 样式表 ------------------------- */
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
  --pr-purple: #8b5cf6;
  --pr-radius: 12px;
  --pr-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);

  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--pr-bg);
  color: var(--pr-text-main);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
  box-sizing: border-box;
  overflow: hidden;
}
.roche-plugin-psych-room * { box-sizing: border-box; }

/* 顶部栏 */
.pr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--pr-card);
  border-bottom: 1px solid var(--pr-border);
  z-index: 10;
}
.pr-header-title { font-size: 15px; font-weight: 600; display:flex; align-items:center; gap:8px; }
.pr-header-title .dot { width:8px; height:8px; border-radius:50%; background:var(--pr-accent); }
.pr-back-btn {
  display: inline-flex; align-items: center; gap: 4px;
  border: 1px solid var(--pr-border); background: #fff; color: var(--pr-text-sub);
  font-size: 12.5px; cursor: pointer; padding: 5px 10px; border-radius: 6px; transition: all 0.2s;
}
.pr-back-btn:hover { background: #f1f5f9; color: var(--pr-text-main); }

/* SVG 图标紧凑 Tab 导航 */
.pr-tabs {
  display: flex;
  background: var(--pr-card);
  border-bottom: 1px solid var(--pr-border);
  padding: 0 8px;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.pr-tabs::-webkit-scrollbar { display: none; }
.pr-tab {
  flex: 1;
  min-width: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  font-size: 11px;
  color: var(--pr-text-sub);
  cursor: pointer;
  border-bottom: 2.5px solid transparent;
  font-weight: 500;
  transition: all 0.2s;
  gap: 4px;
  white-space: nowrap;
}
.pr-tab svg { stroke: currentColor; transition: stroke 0.2s; }
.pr-tab:hover { color: var(--pr-primary); }
.pr-tab.active { color: var(--pr-primary); border-bottom-color: var(--pr-primary); font-weight: 600; }

.pr-panel { flex: 1; overflow-y: auto; display: none; }
.pr-panel.active { display: flex; flex-direction: column; }

/* 对话区 */
.pr-chat-log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.pr-msg { max-width: 82%; padding: 10px 14px; border-radius: var(--pr-radius); font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; box-shadow: var(--pr-shadow); }
.pr-msg.user { align-self: flex-end; background: var(--pr-primary); color: #fff; border-bottom-right-radius: 2px; }
.pr-msg.ai { align-self: flex-start; background: var(--pr-card); border: 1px solid var(--pr-border); color: var(--pr-text-main); border-bottom-left-radius: 2px; }
.pr-msg.system-note { align-self: center; background: var(--pr-danger-light); color: var(--pr-danger); border: 1px solid #fecaca; font-size: 13px; max-width: 92%; }

/* AI 推荐量表卡片 */
.pr-scale-invite-card {
  align-self: flex-start;
  background: #ffffff;
  border: 1px solid #bfdbfe;
  border-left: 4px solid var(--pr-primary);
  border-radius: 8px;
  padding: 12px 14px;
  max-width: 85%;
  box-shadow: var(--pr-shadow);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pr-scale-invite-title { font-size: 13.5px; font-weight: 600; color: var(--pr-primary); display: flex; align-items: center; gap: 6px; }
.pr-scale-invite-desc { font-size: 12.5px; color: var(--pr-text-sub); }
.pr-scale-invite-btn {
  align-self: flex-start;
  background: var(--pr-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12.5px;
  cursor: pointer;
  margin-top: 4px;
  font-weight: 500;
  transition: opacity 0.2s;
}
.pr-scale-invite-btn:hover { opacity: 0.9; }

.pr-typing { align-self: flex-start; color: var(--pr-text-sub); font-size: 12px; padding: 4px 12px; }

.pr-input-bar {
  display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--pr-border); background: var(--pr-card);
}
.pr-input-bar textarea {
  flex: 1; resize: none; border: 1px solid var(--pr-border); border-radius: 8px;
  padding: 9px 12px; font-size: 14px; font-family: inherit; outline: none; transition: border 0.2s; max-height: 80px; min-height: 38px;
}
.pr-input-bar textarea:focus { border-color: var(--pr-primary); }
.pr-send-btn {
  border: none; background: var(--pr-primary); color: #fff; border-radius: 8px;
  padding: 0 16px; font-size: 13.5px; font-weight: 500; cursor: pointer; transition: background 0.2s;
}
.pr-send-btn:hover { background: #2563eb; }
.pr-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 成长档案专区 */
.pr-archive-container { padding: 14px; overflow-y: auto; }
.pr-profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.pr-profile-card {
  background: var(--pr-card);
  border: 1px solid var(--pr-border);
  border-radius: var(--pr-radius);
  padding: 12px 14px;
  box-shadow: var(--pr-shadow);
}
.pr-profile-card-header {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--pr-text-main);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pr-profile-card-body {
  font-size: 12.5px;
  color: var(--pr-text-sub);
  line-height: 1.6;
  white-space: pre-wrap;
}

.pr-filter-bar {
  display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 10px; scrollbar-width: none;
}
.pr-filter-btn {
  border: 1px solid var(--pr-border); background: #fff; color: var(--pr-text-sub);
  font-size: 12px; padding: 4px 10px; border-radius: 14px; cursor: pointer; white-space: nowrap;
}
.pr-filter-btn.active { background: var(--pr-primary); color: #fff; border-color: var(--pr-primary); }

.pr-log-item {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: 8px;
  padding: 10px 12px; margin-bottom: 8px; font-size: 13px; line-height: 1.5; box-shadow: var(--pr-shadow);
}
.pr-log-meta { font-size: 11px; color: var(--pr-text-sub); margin-bottom: 4px; display: flex; justify-content: space-between; }
.pr-tag { display:inline-block; font-size:10.5px; padding:1px 6px; border-radius:4px; font-weight:500; }
.pr-tag.fact { background:#dcfce7; color:#15803d; }
.pr-tag.cognitive { background:#fef3c7; color:#b45309; }
.pr-tag.ai_observation { background:#e0f2fe; color:#0369a1; }
.pr-tag.professional { background:#f3e8ff; color:#6b21a8; }
.pr-tag.scale_result { background:#fee2e2; color:#b91c1c; }

/* 量表专区 */
.pr-scales-list { padding: 14px; overflow-y: auto; }
.pr-scale-card {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: var(--pr-radius);
  padding: 14px; margin-bottom: 12px; box-shadow: var(--pr-shadow); transition: border 0.2s;
}
.pr-scale-card.highlight { border: 2px solid var(--pr-primary); }
.pr-scale-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
.pr-scale-card h4 { margin: 0 0 4px; font-size: 14.5px; color: var(--pr-text-main); }
.pr-scale-badge { font-size: 11px; padding: 2px 6px; background: #f1f5f9; color: var(--pr-text-sub); border-radius: 4px; }
.pr-scale-card p { margin: 4px 0 10px; font-size: 12.5px; color: var(--pr-text-sub); }
.pr-scale-start { border: none; background: var(--pr-primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 12.5px; cursor: pointer; }
.pr-scale-item { margin-bottom: 12px; border-bottom: 1px dashed var(--pr-border); padding-bottom: 10px; }
.pr-scale-item-q { font-size: 13.5px; margin-bottom: 6px; font-weight: 500; }
.pr-scale-options { display: flex; flex-direction: column; gap: 6px; }
.pr-scale-options label { font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.pr-scale-submit { border: none; background: var(--pr-primary); color: #fff; border-radius: 6px; padding: 8px; font-size: 13.5px; cursor: pointer; width: 100%; margin-top: 8px; }
.pr-scale-result { background: var(--pr-primary-light); border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.6; }

/* 提示词与设置 */
.pr-card-box {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: var(--pr-radius);
  padding: 14px; margin-bottom: 12px; box-shadow: var(--pr-shadow);
}
.pr-section-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: var(--pr-text-main); display: flex; align-items: center; justify-content: space-between; }
.pr-textarea {
  width: 100%; border: 1px solid var(--pr-border); border-radius: 8px;
  padding: 10px; font-size: 12.5px; font-family: monospace; line-height: 1.5; outline: none; min-height: 180px;
}
.pr-textarea:focus { border-color: var(--pr-primary); }
.pr-btn {
  border: none; background: var(--pr-primary); color: #fff; border-radius: 6px;
  padding: 7px 14px; font-size: 12.5px; cursor: pointer; font-weight: 500;
}
.pr-btn-secondary { background: #f1f5f9; color: var(--pr-text-main); border: 1px solid var(--pr-border); }
.pr-btn-secondary:hover { background: #e2e8f0; }

.pr-form-group { margin-bottom: 10px; }
.pr-form-group label { display: block; font-size: 12px; color: var(--pr-text-sub); margin-bottom: 4px; }
.pr-input {
  width: 100%; border: 1px solid var(--pr-border); border-radius: 6px;
  padding: 7px 10px; font-size: 13px; outline: none;
}
.pr-input:focus { border-color: var(--pr-primary); }

.pr-kw-item {
  display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--pr-border);
  border-radius: 8px; padding: 10px; margin-bottom: 10px; background: #fafafa;
}
.pr-kw-row { display: flex; gap: 8px; align-items: center; }

.pr-about { padding: 16px; font-size: 13px; line-height: 1.8; color: var(--pr-text-sub); }
.pr-about b { color: var(--pr-text-main); }
.pr-clear-btn { margin-top: 14px; border: 1px solid var(--pr-danger); color: var(--pr-danger); background: transparent; border-radius: 6px; padding: 7px 14px; font-size: 12.5px; cursor: pointer; }
.pr-empty { color: var(--pr-text-sub); font-size: 13px; text-align: center; padding: 24px 10px; }
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
        <button class="pr-back-btn" id="pr-close">${ICONS.back} 返回</button>
      </div>

      <!-- 紧凑响应式 SVG 导航栏 -->
      <div class="pr-tabs">
        <div class="pr-tab active" data-tab="chat">${ICONS.chat}<span>对话</span></div>
        <div class="pr-tab" data-tab="archive">${ICONS.archive}<span>成长档案</span></div>
        <div class="pr-tab" data-tab="scales">${ICONS.scales}<span>心理量表</span></div>
        <div class="pr-tab" data-tab="prompt">${ICONS.prompt}<span>配置与API</span></div>
        <div class="pr-tab" data-tab="keywords">${ICONS.keywords}<span>关键词</span></div>
        <div class="pr-tab" data-tab="about">${ICONS.about}<span>关于</span></div>
      </div>

      <!-- 对话面板 -->
      <div class="pr-panel active" data-panel="chat">
        <div class="pr-chat-log" id="pr-chat-log"></div>
        <div class="pr-input-bar">
          <textarea id="pr-input" placeholder="想到什么就说什么…" rows="1"></textarea>
          <button class="pr-send-btn" id="pr-send">发送</button>
        </div>
      </div>

      <!-- 成长档案面板 -->
      <div class="pr-panel" data-panel="archive">
        <div class="pr-archive-container">
          <div class="pr-section-title">
            <span>多维自我认知画像</span>
            <span style="font-size:11px;color:var(--pr-accent);font-weight:normal;">● 记忆实时同步中</span>
          </div>
          <div class="pr-profile-grid" id="pr-profile-grid"></div>

          <div class="pr-section-title" style="margin-top:16px;">
            <span>成长与心路历程</span>
          </div>
          <div class="pr-filter-bar" id="pr-log-filters">
            <button class="pr-filter-btn active" data-filter="all">全部</button>
            <button class="pr-filter-btn" data-filter="fact">核心事实</button>
            <button class="pr-filter-btn" data-filter="cognitive">认知信念</button>
            <button class="pr-filter-btn" data-filter="ai_observation">AI观察</button>
            <button class="pr-filter-btn" data-filter="scale_result">量表记录</button>
          </div>
          <div id="pr-log-list"></div>
        </div>
      </div>

      <!-- 量表面板 -->
      <div class="pr-panel" data-panel="scales">
        <div class="pr-scales-list" id="pr-scales-list"></div>
      </div>

      <!-- 提示词与 API 面板 -->
      <div class="pr-panel" data-panel="prompt">
        <div class="pr-archive-container">
          <div class="pr-card-box">
            <div class="pr-section-title">系统提示词 (System Prompt)</div>
            <p style="font-size:12px;color:var(--pr-text-sub);margin-bottom:8px;">可在此预览或调整提示词（{{MANUAL_TEXT}} 会自动替换为多维认知画像与记忆）。</p>
            <textarea class="pr-textarea" id="pr-prompt-input"></textarea>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button class="pr-btn" id="pr-save-prompt">保存提示词</button>
              <button class="pr-btn pr-btn-secondary" id="pr-reset-prompt">恢复默认</button>
            </div>
          </div>
          <div class="pr-card-box">
            <div class="pr-section-title">独立 API 配置</div>
            <p style="font-size:12px;color:var(--pr-text-sub);margin-bottom:8px;">配置后将优先使用独立模型端点，留空则使用 Roche 宿主默认 AI 模型。</p>
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
            <button class="pr-btn" id="pr-save-api">保存 API 配置</button>
          </div>
        </div>
      </div>

      <!-- 关键词面板 -->
      <div class="pr-panel" data-panel="keywords">
        <div class="pr-archive-container">
          <div class="pr-card-box">
            <div class="pr-section-title">关键词与关联背景</div>
            <p style="font-size:12px;color:var(--pr-text-sub);margin-bottom:10px;">当用户发送的消息中包含指定关键词时，插件会自动将关联背景附带发送给 AI。</p>
            <div id="pr-kw-list"></div>
            <button class="pr-btn pr-btn-secondary" id="pr-add-kw" style="margin-top:8px;">+ 添加绑定</button>
            <div style="margin-top:14px;">
              <button class="pr-btn" id="pr-save-kw">保存绑定</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 关于面板 -->
      <div class="pr-panel" data-panel="about">
        <div class="pr-about">
          <p><b>心理咨询室 v1.2.0</b></p>
          <p>专为深度自我探索、情绪安抚与心理陪伴设计的 Roche 原生插件。</p>
          <p>· <b>双向记忆</b>：AI 实时提炼核心事实并同步沉淀至宿主记忆。<br>
             · <b>专业画像</b>：全方位拆解认知模式、情绪与压力源、人际模式及复原资源。<br>
             · <b>10 套量表</b>：覆盖抑郁、焦虑、失眠、自尊、韧性与创伤应激等维度。</p>
          <button class="pr-clear-btn" id="pr-clear">清空我的全部记录与数据</button>
        </div>
      </div>
    `;
    container.appendChild(root);

    /* ---------------- Tab 切换与路由 ---------------- */
    root.querySelector("#pr-close").onclick = () => roche.ui.closeApp();

    function switchTab(tabName) {
      root.querySelectorAll(".pr-tab").forEach((t) => t.classList.remove("active"));
      root.querySelectorAll(".pr-panel").forEach((p) => p.classList.remove("active"));
      const tabEl = root.querySelector(`.pr-tab[data-tab="${tabName}"]`);
      if (tabEl) tabEl.classList.add("active");
      const panelEl = root.querySelector(`.pr-panel[data-panel="${tabName}"]`);
      if (panelEl) panelEl.classList.add("active");

      if (tabName === "archive") renderArchive();
      if (tabName === "scales") renderScales();
      if (tabName === "prompt") renderPromptAndAPI();
      if (tabName === "keywords") renderKeywords();
    }

    root.querySelectorAll(".pr-tab").forEach((tabEl) => {
      tabEl.onclick = () => switchTab(tabEl.dataset.tab);
    });

    /* ---------------- 清空数据 ---------------- */
    root.querySelector("#pr-clear").onclick = async () => {
      const ok = await roche.ui.confirm({
        title: "清空全部数据",
        message: "将删除保存的聊天记录、成长画像、量表得分和设置，是否继续？"
      }).catch(() => window.confirm("将删除保存的聊天记录、成长画像、量表得分和设置，是否继续？"));
      if (!ok) return;

      await Promise.all([
        roche.storage.delete(K_HISTORY),
        roche.storage.delete(K_LOG),
        roche.storage.delete(K_PROFILE),
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

    /* ---------------- 提示词与 API 配置 ---------------- */
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

    /* ---------------- 关键词绑定 ---------------- */
    async function renderKeywords() {
      const bindings = await getJSON(roche, K_KEYWORDS, []);
      const containerEl = root.querySelector("#pr-kw-list");
      containerEl.innerHTML = "";
      bindings.forEach((item) => {
        const itemEl = document.createElement("div");
        itemEl.className = "pr-kw-item";
        itemEl.innerHTML = `
          <div class="pr-kw-row">
            <input type="text" class="pr-input kw-key" placeholder="触发关键词 (如: 压力大)" value="${escapeHtml(item.keyword || "")}">
            <button class="pr-btn pr-btn-secondary del-kw" style="color:var(--pr-danger);">删除</button>
          </div>
          <textarea class="pr-textarea kw-text" placeholder="匹配后注入的背景文本..." style="min-height:50px;margin-top:4px;">${escapeHtml(item.text || "")}</textarea>
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
          <input type="text" class="pr-input kw-key" placeholder="触发关键词 (如: 压力大)" value="">
          <button class="pr-btn pr-btn-secondary del-kw" style="color:var(--pr-danger);">删除</button>
        </div>
        <textarea class="pr-textarea kw-text" placeholder="匹配后注入的背景文本..." style="min-height:50px;margin-top:4px;"></textarea>
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
        if (kw && txt) bindings.push({ keyword: kw, text: txt });
      });
      await roche.storage.set(K_KEYWORDS, bindings);
      roche.ui.toast ? roche.ui.toast("关键词绑定已保存") : alert("关键词绑定已保存");
    };

    /* ---------------- 对话逻辑与量表点击直达 ---------------- */
    const chatLogEl = root.querySelector("#pr-chat-log");
    const inputEl = root.querySelector("#pr-input");
    const sendBtn = root.querySelector("#pr-send");

    async function renderChatLog() {
      const history = await getJSON(roche, K_HISTORY, []);
      chatLogEl.innerHTML = "";
      if (history.length === 0) {
        const hint = document.createElement("div");
        hint.className = "pr-empty";
        hint.textContent = "无论此刻是开心、疲惫还是困惑，这里都随时倾听你。";
        chatLogEl.appendChild(hint);
      }
      history.forEach((m) => appendMsgEl(m));
      chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }

    function appendMsgEl(m) {
      if (m.role === "scale-suggest") {
        const scaleMeta = SCALES[m.scale] || { name: m.scale, intro: "心理量表自评" };
        const card = document.createElement("div");
        card.className = "pr-scale-invite-card";
        card.innerHTML = `
          <div class="pr-scale-invite-title">${ICONS.scales} 推荐测评：${escapeHtml(scaleMeta.name)}</div>
          <div class="pr-scale-invite-desc">${escapeHtml(scaleMeta.intro)}</div>
          <button class="pr-scale-invite-btn">立即开始自评 →</button>
        `;
        card.querySelector(".pr-scale-invite-btn").onclick = () => {
          openAndExpandScale(m.scale);
        };
        chatLogEl.appendChild(card);
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "pr-msg " + (m.role === "user" ? "user" : m.role === "system-note" ? "system-note" : "ai");
      wrap.textContent = m.content;
      chatLogEl.appendChild(wrap);
    }

    function openAndExpandScale(scaleKey) {
      switchTab("scales");
      setTimeout(() => {
        const cardEl = root.querySelector(`.pr-scale-card[data-scale="${scaleKey}"]`);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
          cardEl.classList.add("highlight");
          setTimeout(() => cardEl.classList.remove("highlight"), 1800);
          const startBtn = cardEl.querySelector(`[data-start="${scaleKey}"]`);
          const formEl = cardEl.querySelector(`.pr-scale-form[data-form="${scaleKey}"]`);
          if (formEl && formEl.style.display !== "block" && startBtn) {
            startBtn.click();
          }
        }
      }, 100);
    }

    async function pushHistory(msg) {
      const history = await getJSON(roche, K_HISTORY, []);
      history.push(msg);
      await roche.storage.set(K_HISTORY, history);
    }

    function autoGrow() {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + "px";
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
      typingEl.textContent = "倾听与思考中…";
      chatLogEl.appendChild(typingEl);
      chatLogEl.scrollTop = chatLogEl.scrollHeight;

      try {
        const [profile, history, promptTpl, apiConfig, bindings] = await Promise.all([
          getJSON(roche, K_PROFILE, {}),
          getJSON(roche, K_HISTORY, []),
          getJSON(roche, K_PROMPT, DEFAULT_SYSTEM_PROMPT),
          getJSON(roche, K_API_CONFIG, {}),
          getJSON(roche, K_KEYWORDS, [])
        ]);

        // 拼接多维认知画像
        const profileText = [
          `【认知与信念模式】: ${profile.cognition || "暂在梳理中"}`,
          `【情绪与压力源】: ${profile.emotion || "暂在观察中"}`,
          `【人际与依恋特征】: ${profile.relationship || "暂在观察中"}`,
          `【应对资源与积极优势】: ${profile.resources || "暂在挖掘中"}`
        ].join("\n");

        let matchedAddon = "";
        bindings.forEach(b => {
          if (b.keyword && text.includes(b.keyword)) {
            matchedAddon += `\n[匹配到用户关联背景(${b.keyword})：${b.text}]`;
          }
        });

        let systemPrompt = promptTpl.replace("{{MANUAL_TEXT}}", profileText);
        if (matchedAddon) systemPrompt += "\n\n" + matchedAddon;

        const recent = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-20);
        const messages = [
          { role: "system", content: systemPrompt },
          ...recent.map((m) => ({ role: m.role, content: m.content }))
        ];

        const chatOpts = { messages, temperature: 0.7 };
        if (apiConfig.provider) chatOpts.provider = apiConfig.provider;
        if (apiConfig.model) chatOpts.model = apiConfig.model;
        if (apiConfig.endpoint) chatOpts.endpoint = apiConfig.endpoint;
        if (apiConfig.apiKey) chatOpts.apiKey = apiConfig.apiKey;

        const result = await roche.ai.chat(chatOpts);
        let replyText = (result && result.text ? result.text : "").trim();

        // 识别量表触发指令
        let scaleSuggest = null;
        const scaleMatch = replyText.match(/\[\[SCALE:([A-Za-z0-9]+)\]\]/);
        if (scaleMatch && SCALES[scaleMatch[1]]) {
          scaleSuggest = scaleMatch[1];
          replyText = replyText.replace(/\[\[SCALE:[A-Za-z0-9]+\]\]/, "").trim();
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

        // 触发实时记忆沉淀与成长档案更新
        await maybeRunSummary(roche, apiConfig);
      } catch (err) {
        typingEl.remove();
        const errMsg = { role: "assistant", content: "（网络或 AI 服务响应稍有延迟，请检查设置或稍后再试）", ts: nowTs() };
        appendMsgEl(errMsg);
      } finally {
        sendBtn.disabled = false;
      }
    };

    /* ---------------- 实时记忆系统与成长画像自动沉淀 ---------------- */
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
        const [profile, history] = await Promise.all([
          getJSON(roche, K_PROFILE, {}),
          getJSON(roche, K_HISTORY, [])
        ]);
        const recentTurns = history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-SUMMARY_EVERY_N_TURNS * 2)
          .map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`)
          .join("\n");
        if (!recentTurns.trim()) return;

        const summaryPrompt = `你是一位心理成长档案梳理专家。请根据最近对话，提取心理事实并更新用户的四维认知画像。
必须只输出严格的 JSON 格式：
{
  "log_entries": [
    {"type": "fact" | "cognitive" | "ai_observation", "text": "简练记录"}
  ],
  "profile_update": {
    "cognition": "认知模式/信念/对自我的看法",
    "emotion": "主要情绪体验/压力诱发源",
    "relationship": "人际互动风格/安全感来源",
    "resources": "拥有的积极资源/支持系统/有效应对策略"
  },
  "host_memory_facts": [
    "需同步写入长期记忆的核心事实（如：用户在面对考试时易出现灾难化思维）"
  ]
}

当前画像：
${JSON.stringify(profile)}

最近对话：
${recentTurns}`;

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

        // 1. 更新结构化日志
        const log = await getJSON(roche, K_LOG, []);
        (parsed.log_entries || []).forEach((entry) => {
          if (entry && entry.text) {
            log.push({ ts: nowTs(), type: entry.type || "ai_observation", text: entry.text });
          }
        });
        await roche.storage.set(K_LOG, log);

        // 2. 更新多维自我画像
        if (parsed.profile_update && typeof parsed.profile_update === "object") {
          const newProfile = { ...profile, ...parsed.profile_update };
          await roche.storage.set(K_PROFILE, newProfile);
        }

        // 3. 实时同步到 Roche 宿主主记忆库 (roche.memory.write)
        if (roche.memory && roche.memory.write && Array.isArray(parsed.host_memory_facts)) {
          for (const factText of parsed.host_memory_facts) {
            if (factText && typeof factText === "string") {
              try {
                await roche.memory.write({
                  summaryText: `[心理成长档案] ${factText}`,
                  who: ["用户"],
                  action: factText,
                  when: "近期咨询对话",
                  where: "心理咨询室",
                  source: "psych-counseling-room"
                });
              } catch (memErr) {}
            }
          }
        }
      } catch (e) {}
    }

    /* ---------------- 成长档案渲染 ---------------- */
    const profileGridEl = root.querySelector("#pr-profile-grid");
    const logListEl = root.querySelector("#pr-log-list");
    let currentLogFilter = "all";

    async function renderArchive() {
      const [profile, log] = await Promise.all([
        getJSON(roche, K_PROFILE, {}),
        getJSON(roche, K_LOG, [])
      ]);

      // 1. 渲染四维画像卡片
      profileGridEl.innerHTML = `
        <div class="pr-profile-card">
          <div class="pr-profile-card-header">🧠 认知与信念模式</div>
          <div class="pr-profile-card-body">${escapeHtml(profile.cognition || "正在通过对话持续建立中…")}</div>
        </div>
        <div class="pr-profile-card">
          <div class="pr-profile-card-header">🌊 情绪与压力诱因</div>
          <div class="pr-profile-card-body">${escapeHtml(profile.emotion || "暂未记录到明显突出的压力源…")}</div>
        </div>
        <div class="pr-profile-card">
          <div class="pr-profile-card-header">🤝 人际与依恋特征</div>
          <div class="pr-profile-card-body">${escapeHtml(profile.relationship || "持续探索中…")}</div>
        </div>
        <div class="pr-profile-card">
          <div class="pr-profile-card-header">🌱 应对资源与优势</div>
          <div class="pr-profile-card-body">${escapeHtml(profile.resources || "记录你的内在力量与有效方法…")}</div>
        </div>
      `;

      // 2. 渲染日志列表
      renderFilteredLogs(log);
    }

    function renderFilteredLogs(log) {
      const tagLabel = {
        fact: "核心事实",
        cognitive: "认知信念",
        ai_observation: "AI洞察",
        scale_result: "量表测评"
      };

      const filtered = log.filter((item) => {
        if (currentLogFilter === "all") return true;
        return item.type === currentLogFilter;
      });

      if (!filtered.length) {
        logListEl.innerHTML = `<div class="pr-empty">暂无该分类下的成长记录</div>`;
        return;
      }

      let html = "";
      [...filtered].reverse().slice(0, 50).forEach((item) => {
        html += `
          <div class="pr-log-item">
            <div class="pr-log-meta">
              <span class="pr-tag ${item.type || 'ai_observation'}">${tagLabel[item.type] || "记录"}</span>
              <span>${fmtTime(item.ts)}</span>
            </div>
            <div>${escapeHtml(item.text)}</div>
          </div>
        `;
      });
      logListEl.innerHTML = html;
    }

    root.querySelectorAll("#pr-log-filters .pr-filter-btn").forEach((btn) => {
      btn.onclick = async () => {
        root.querySelectorAll("#pr-log-filters .pr-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentLogFilter = btn.dataset.filter;
        const log = await getJSON(roche, K_LOG, []);
        renderFilteredLogs(log);
      };
    });

    /* ---------------- 量表渲染与交互 ---------------- */
    const scalesListEl = root.querySelector("#pr-scales-list");

    async function renderScales() {
      const history = await getJSON(roche, K_SCALES, []);
      let html = "";
      Object.keys(SCALES).forEach((key) => {
        const s = SCALES[key];
        html += `
          <div class="pr-scale-card" data-scale="${key}">
            <div class="pr-scale-card-top">
              <h4>${escapeHtml(s.name)}</h4>
              <span class="pr-scale-badge">${escapeHtml(s.category || "自评")}</span>
            </div>
            <p>${escapeHtml(s.intro)}</p>
            <button class="pr-scale-start" data-start="${key}">开始测评</button>
            <div class="pr-scale-form" data-form="${key}" style="display:none;margin-top:12px;"></div>
          </div>
        `;
      });

      html += `<div class="pr-section-title" style="margin-top:20px;"><span>测评历史轨迹</span></div>`;
      if (!history.length) {
        html += `<div class="pr-empty">暂无量表记录</div>`;
      } else {
        [...history].reverse().forEach((r) => {
          html += `
            <div class="pr-log-item">
              <div class="pr-log-meta">
                <span class="pr-tag scale_result">得分：${r.score}</span>
                <span>${fmtTime(r.ts)}</span>
              </div>
              <div style="font-weight:500;">${(SCALES[r.scale] || {}).name || r.scale}</div>
            </div>
          `;
        });
      }
      scalesListEl.innerHTML = html;

      scalesListEl.querySelectorAll("[data-start]").forEach((btn) => {
        btn.onclick = () => {
          const key = btn.dataset.start;
          const formEl = scalesListEl.querySelector(`.pr-scale-form[data-form="${key}"]`);
          const isOpening = formEl.style.display === "none";
          formEl.style.display = isOpening ? "block" : "none";
          btn.textContent = isOpening ? "收起量表" : "开始测评";

          if (isOpening && !formEl.dataset.built) {
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
        html += `
          <div class="pr-scale-item">
            <div class="pr-scale-item-q">${idx + 1}. ${escapeHtml(q)}</div>
            <div class="pr-scale-options">
              ${s.options.map((opt, val) => `
                <label><input type="radio" name="pr-q-${key}-${idx}" value="${val}"> ${escapeHtml(opt)}</label>
              `).join("")}
            </div>
          </div>
        `;
      });
      html += `<button class="pr-scale-submit" data-submit="${key}">提交量表并同步结果</button>`;
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
          roche.ui.toast ? roche.ui.toast("请回答所有题目后再提交") : alert("请回答所有题目后再提交");
          return;
        }

        const interpretText = s.interpret(total);
        const resultEl = formEl.querySelector(`[data-result="${key}"]`);
        resultEl.style.display = "block";
        resultEl.innerHTML = `<b>测评得分：${total} 分</b><br>${interpretText}`;

        // 1. 保存量表历史
        const history = await getJSON(roche, K_SCALES, []);
        history.push({ ts: nowTs(), scale: key, score: total });
        await roche.storage.set(K_SCALES, history);

        // 2. 精简发送至对话并记录
        const summaryMsgText = `【量表测评结果】我刚刚完成了《${s.name}》，得分为 ${total} 分。解析参考：${interpretText}`;
        const scaleUserMsg = { role: "user", content: summaryMsgText, ts: nowTs() };
        await pushHistory(scaleUserMsg);

        // 3. 记录日志
        const log = await getJSON(roche, K_LOG, []);
        log.push({ ts: nowTs(), type: "scale_result", text: `完成了《${s.name}》，得分 ${total}。${interpretText}` });
        await roche.storage.set(K_LOG, log);

        // 4. 同步写入宿主记忆
        if (roche.memory && roche.memory.write) {
          try {
            await roche.memory.write({
              summaryText: `完成了心理量表《${s.name}》，得分 ${total} 分。${interpretText}`,
              who: ["用户"],
              action: `完成量表 ${s.name}`,
              when: "刚刚",
              where: "心理咨询室",
              source: "psych-counseling-room"
            });
          } catch (e) {}
        }

        roche.ui.toast ? roche.ui.toast("量表结果已同步至对话与成长档案！") : alert("量表结果已同步");
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
    version: "1.2.0",
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