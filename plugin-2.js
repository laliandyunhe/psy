/* ==========================================================
 * 心理咨询室 (psych-counseling-room) - Roche 插件
 * 独立 App：AI 心理陪伴 + 成长档案记忆系统 + 心理自评量表
 * 重要：本插件不提供医疗诊断，不能替代专业心理咨询/精神科诊疗。
 * ========================================================== */

(function () {
  "use strict";

  const PLUGIN_ID = "psych-counseling-room";
  const APP_ID = "psych-counseling-room-home";

  /* ------------------------- 存储 key ------------------------- */
  const K_HISTORY = "chat-history";     // 对话历史
  const K_LOG = "growth-log";           // 第一层：成长日志（原始记录）
  const K_MANUAL = "user-manual";       // 第二层：自我认知说明书（稳定规律总结）
  const K_SCALES = "scale-results";     // 量表结果
  const K_META = "session-meta";        // 计数器等元信息

  const SUMMARY_EVERY_N_TURNS = 6; // 每 N 轮用户消息，自动整理一次记忆

  /* ------------------------- 危机关键词（客户端兜底，不依赖模型） ------------------------- */
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

  /* ------------------------- 系统提示词（人设 + 伦理约束 + 记忆规则） ------------------------- */
  function buildSystemPrompt(personaName, manualText) {
    return `你现在的身份是"心理咨询室"里的 AI 心理陪伴者，与你对话的用户是 ${personaName || "用户"}。请始终遵守以下规则：

【角色定位】
- 你不是医生、不是精神科医生，也不是持证心理咨询师本人，不能给出诊断结论，不能给药物剂量建议，不能替代专业诊疗。
- 你是一个了解心理学基础方法（认知行为、人本主义、正念、情绪聚焦等）、受过良好倾听训练的 AI 陪伴者。
- 你的目标是帮助用户觉察情绪、梳理想法、看见自己的模式，建立更健康的应对方式——而不是替用户下结论、贴标签。

【伦理边界（严格遵守）】
- 绝不能说"你有抑郁症/焦虑症/XX障碍"这类诊断式断言，只能描述你观察到的情绪或行为模式，并在合适时建议寻求专业评估。
- 不做保证式安慰（不要说"一切都会好起来的"），不夸大、不否认用户的感受。
- 不要把相关性当因果，不要过度解读用户没说过的动机。
- 允许后续新的信息推翻你之前的判断，不要固化对用户的看法或反复强化某个标签。
- 如果用户的表达出现自杀、自残、伤害他人、被虐待、急性心理危机等信号：
  1) 立刻放下常规的探讨式提问，用稳定、不评判、不说教的语气回应；
  2) 明确清楚地给出资源：全国统一心理援助热线 12356（24小时）；紧急情况拨打 120 或 110；
  3) 不要追问可能让情绪更下坠的细节，不要说教，回复保持简短、稳定；
  4) 持续表达关心，鼓励联系身边信任的人或专业机构，不要让用户觉得被评判或被抛下。

【对话风格】
- 温和、耐心、不评判，像一个有边界感、克制的专业倾听者，而不是"救世主"或"人生导师"。
- 多用开放式问题引导用户自己表达和觉察，少替用户下结论。
- 默认回复简洁自然，像正常聊天；不要每次都列条目、加小标题，除非用户明确要求梳理、总结或复盘。

【记忆系统 —— 请严格遵守，这是本工具的核心能力】
你会在每轮对话前收到"已归纳的自我认知说明书"作为背景参考（可能为空）。你不需要在每条回复里主动重复这些内容，只在真正相关时自然地体现出"记得"用户，而不是生硬背诵。

关于记录内容，请始终区分四类信息，绝不能混为一谈：
1. 用户明确说过的事实
2. 用户自己的猜测
3. 你（AI）自己的观察与假设
4. 专业人士（医生/心理咨询师）给出的观点（如果用户转述过）

不要把相关性直接当因果，不要用单次事件就下"稳定规律"的结论——规律需要重复出现的证据支持。

【心理量表使用规则】
- 当你观察到用户的情绪困扰持续存在、并且用户看起来愿意更客观地了解自己当下的状态时，可以温和地建议做一个简短的自评量表（PHQ-9 抑郁自评 或 GAD-7 焦虑自评），并说明这只是自我觉察工具，不是诊断结果。
- 如果决定建议量表，请在回复的最后单独另起一行，只输出以下标记之一，不要加任何其它文字、不要用引号包裹、不要解释这是"标记"或"代码"：
[[SCALE:PHQ9]]
或
[[SCALE:GAD7]]
- 不要在一次回复里同时输出两个标记；一次对话中最多建议一次；如果用户明确表示不想做，本次对话不要再提。
- 除非满足上述"适当时机"，否则不要主动提及或建议量表。

以下是目前已归纳的《自我认知说明书》（可能为空，为空说明还没有足够重复证据）：
----------------
${manualText && manualText.trim() ? manualText.trim() : "（暂无稳定规律总结，证据积累中）"}
----------------
请基于以上人设、边界与记忆规则进行对话。`;
  }

  /* 用于后台自动整理记忆的提示词：只负责总结，不对外可见 */
  function buildSummaryPrompt(existingManual, recentTurnsText) {
    return `你是一个严谨的记录整理助手，不与用户对话，只做结构化整理，请只输出 JSON，不要输出任何其它文字、不要用 markdown 代码块包裹。

任务：根据下面提供的"已有自我认知说明书"和"最近一段对话原文"，输出更新后的两部分内容。

规则：
- 第一层"log_entries"：从最近对话中提取值得记录的原始条目（情绪、事件、身体状态、人际、重要转折），每条尽量一句话，并标注类型 type，取值只能是 fact（用户明确说过的事实）/ guess（用户自己的猜测）/ ai_observation（你的观察与假设）/ professional（转述的专业人士观点）之一。没有值得记录的内容就返回空数组。
- 第二层"manual_update"：只有在最近对话中出现了与"已有说明书"里已有内容重复、或出现至少两次同类模式的新证据时，才更新这一层，用简短的自然语言总结稳定规律（例如什么容易触发情绪、什么能带来恢复、常见的应对模式）。如果证据不足，直接返回已有说明书原文，不要编造新规律。
- 绝不能把单次事件当成"稳定规律"。
- 绝不能给出诊断性语言。

已有自我认知说明书：
${existingManual && existingManual.trim() ? existingManual.trim() : "（空）"}

最近对话原文：
${recentTurnsText}

请只输出如下 JSON 格式：
{"log_entries": [{"type": "fact", "text": "..."}], "manual_update": "..."}`;
  }

  /* ------------------------- 量表定义 ------------------------- */
  const SCALES = {
    PHQ9: {
      name: "PHQ-9 抑郁自评量表",
      intro: "过去两周里，以下情况困扰你的频率有多高？这只是自我觉察参考，不是诊断结果。",
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
        if (score <= 9) return "得分处于轻度区间，建议多留意近期的情绪与作息，必要时和信任的人聊聊。";
        if (score <= 14) return "得分处于中度区间，建议考虑找专业心理咨询师聊聊，会更有帮助。";
        if (score <= 19) return "得分处于中重度区间，建议尽快寻求专业心理咨询或精神科医生的评估。";
        return "得分处于重度区间，强烈建议尽快联系专业精神科医生或心理危机干预资源，全国心理援助热线 12356 可以提供支持。";
      }
    },
    GAD7: {
      name: "GAD-7 焦虑自评量表",
      intro: "过去两周里，以下情况困扰你的频率有多高？这只是自我觉察参考，不是诊断结果。",
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
        if (score <= 4) return "目前得分处于最轻微区间，属于常见的情绪波动范围。";
        if (score <= 9) return "得分处于轻度区间，建议留意近期的压力来源和放松方式。";
        if (score <= 14) return "得分处于中度区间，建议考虑找专业心理咨询师聊聊，会更有帮助。";
        return "得分处于重度区间，建议尽快寻求专业心理咨询或精神科医生的评估。";
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

  /* ------------------------- 样式 ------------------------- */
  const STYLE_ID = `${PLUGIN_ID}-style`;
  const STYLE_TEXT = `
.roche-plugin-psych-room {
  --pr-bg: #f6f4f1;
  --pr-card: #ffffff;
  --pr-ink: #2c2a28;
  --pr-sub: #7a746c;
  --pr-accent: #6f8f7a;
  --pr-accent-soft: #e4ede6;
  --pr-danger: #c0564a;
  --pr-border: #e7e2da;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--pr-bg);
  color: var(--pr-ink);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  box-sizing: border-box;
}
.roche-plugin-psych-room * { box-sizing: border-box; }

.pr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--pr-border);
  background: var(--pr-card);
}
.pr-header-title { font-size: 16px; font-weight: 600; display:flex; align-items:center; gap:8px; }
.pr-header-title .dot { width:8px;height:8px;border-radius:50%;background:var(--pr-accent); }
.pr-back-btn {
  border: none; background: transparent; color: var(--pr-sub);
  font-size: 13px; cursor: pointer; padding: 4px 8px;
}

.pr-disclaimer {
  font-size: 11.5px; color: var(--pr-sub); background: var(--pr-accent-soft);
  padding: 6px 14px; line-height: 1.5;
}

.pr-tabs {
  display: flex; background: var(--pr-card); border-bottom: 1px solid var(--pr-border);
}
.pr-tab {
  flex: 1; text-align: center; padding: 10px 4px; font-size: 13px;
  color: var(--pr-sub); cursor: pointer; border-bottom: 2px solid transparent;
}
.pr-tab.active { color: var(--pr-accent); border-bottom-color: var(--pr-accent); font-weight: 600; }

.pr-panel { flex: 1; overflow-y: auto; display: none; }
.pr-panel.active { display: flex; flex-direction: column; }

/* 对话 */
.pr-chat-log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.pr-msg { max-width: 82%; padding: 9px 12px; border-radius: 14px; font-size: 14px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.pr-msg.user { align-self: flex-end; background: var(--pr-accent); color: #fff; border-bottom-right-radius: 4px; }
.pr-msg.ai { align-self: flex-start; background: var(--pr-card); border: 1px solid var(--pr-border); border-bottom-left-radius: 4px; }
.pr-msg.system-note { align-self: center; background: #fbe9e7; color: var(--pr-danger); border: 1px solid #f0c6c0; font-size: 13px; }
.pr-msg-time { font-size: 10px; color: var(--pr-sub); margin-top: 3px; }
.pr-scale-btn {
  align-self: flex-start; background: var(--pr-accent-soft); color: var(--pr-accent);
  border: 1px solid var(--pr-accent); border-radius: 10px; padding: 8px 12px; font-size: 13px; cursor: pointer;
}
.pr-typing { align-self: flex-start; color: var(--pr-sub); font-size: 12.5px; padding: 4px 12px; }

.pr-input-bar {
  display: flex; gap: 8px; padding: 10px; border-top: 1px solid var(--pr-border); background: var(--pr-card);
}
.pr-input-bar textarea {
  flex: 1; resize: none; border: 1px solid var(--pr-border); border-radius: 10px;
  padding: 9px 11px; font-size: 14px; font-family: inherit; max-height: 90px; min-height: 38px;
}
.pr-send-btn {
  border: none; background: var(--pr-accent); color: #fff; border-radius: 10px;
  padding: 0 16px; font-size: 14px; cursor: pointer;
}
.pr-send-btn:disabled { opacity: 0.5; }

/* 档案 */
.pr-archive { padding: 14px; overflow-y: auto; }
.pr-section-title { font-size: 14px; font-weight: 600; margin: 14px 0 8px; color: var(--pr-ink); }
.pr-manual-card {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: 12px;
  padding: 12px; font-size: 13.5px; line-height: 1.7; white-space: pre-wrap;
}
.pr-log-item {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: 10px;
  padding: 9px 11px; margin-bottom: 8px; font-size: 13px; line-height: 1.5;
}
.pr-log-meta { font-size: 11px; color: var(--pr-sub); margin-bottom: 3px; }
.pr-tag { display:inline-block; font-size:10.5px; padding:1px 6px; border-radius:8px; margin-right:6px; }
.pr-tag.fact { background:#e4ede6; color:#4a7059; }
.pr-tag.guess { background:#f3ecdd; color:#8a6d2f; }
.pr-tag.ai_observation { background:#e5eaf3; color:#3f5a8a; }
.pr-tag.professional { background:#f0e3ee; color:#7a3f74; }
.pr-empty { color: var(--pr-sub); font-size: 13px; text-align: center; padding: 30px 10px; }

/* 量表 */
.pr-scales-list { padding: 14px; overflow-y: auto; }
.pr-scale-card {
  background: var(--pr-card); border: 1px solid var(--pr-border); border-radius: 12px;
  padding: 14px; margin-bottom: 12px;
}
.pr-scale-card h4 { margin: 0 0 4px; font-size: 14px; }
.pr-scale-card p { margin: 0 0 10px; font-size: 12.5px; color: var(--pr-sub); }
.pr-scale-start { border: none; background: var(--pr-accent); color: #fff; border-radius: 8px; padding: 7px 14px; font-size: 13px; cursor: pointer; }
.pr-scale-item { margin-bottom: 12px; }
.pr-scale-item-q { font-size: 13.5px; margin-bottom: 6px; }
.pr-scale-options { display: flex; flex-direction: column; gap: 6px; }
.pr-scale-options label { font-size: 13px; display: flex; align-items: center; gap: 6px; }
.pr-scale-submit { border: none; background: var(--pr-accent); color: #fff; border-radius: 8px; padding: 9px; font-size: 14px; cursor: pointer; width: 100%; margin-top: 6px; }
.pr-scale-result { background: var(--pr-accent-soft); border-radius: 10px; padding: 12px; font-size: 13.5px; line-height: 1.6; }
.pr-history-item { font-size: 12.5px; color: var(--pr-sub); border-top: 1px solid var(--pr-border); padding: 6px 0; }

/* 关于 */
.pr-about { padding: 16px; font-size: 13.5px; line-height: 1.8; color: var(--pr-sub); }
.pr-about b { color: var(--pr-ink); }
.pr-clear-btn { margin-top: 14px; border: 1px solid var(--pr-danger); color: var(--pr-danger); background: transparent; border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
`;

  /* ------------------------- 主渲染 ------------------------- */
  async function mount(container, roche) {
    // 注入样式
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
      <div class="pr-disclaimer">AI 心理陪伴与自我觉察工具，不能替代专业诊疗。紧急情况请拨打 120 / 110，全国心理援助热线 12356。</div>
      <div class="pr-tabs">
        <div class="pr-tab active" data-tab="chat">对话</div>
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
      <div class="pr-panel" data-panel="archive">
        <div class="pr-archive" id="pr-archive"></div>
      </div>
      <div class="pr-panel" data-panel="scales">
        <div class="pr-scales-list" id="pr-scales-list"></div>
      </div>
      <div class="pr-panel" data-panel="about">
        <div class="pr-about">
          <p><b>心理咨询室</b>是一个 AI 心理陪伴与自我成长记录工具。</p>
          <p>它会持续、自动地帮你梳理对话中的情绪、事件与身体状态，逐步归纳出属于你自己的"自我认知说明书"，并在合适的时机建议做简短的心理自评量表。</p>
          <p><b>重要说明：</b>本工具不是医生、不是持证心理咨询师，不能给出诊断，不能替代专业心理咨询或精神科诊疗。如果你正处于危机中，请立刻联系 12356（全国心理援助热线）、120 或 110，或身边任何你信任的人。</p>
          <p>所有对话与档案数据保存在本地插件存储中，卸载插件会一并清除。</p>
          <button class="pr-clear-btn" id="pr-clear">清空我的全部数据</button>
        </div>
      </div>
    `;
    container.appendChild(root);

    /* ---------------- 事件：关闭 / 切换 tab ---------------- */
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
      };
    });

    root.querySelector("#pr-clear").onclick = async () => {
      const ok = await roche.ui.confirm({
        title: "清空全部数据",
        message: "将删除本插件保存的对话记录、成长档案和量表结果，且不可恢复，确认继续吗？"
      }).catch(() => window.confirm("将删除本插件保存的对话记录、成长档案和量表结果，且不可恢复，确认继续吗？"));
      if (!ok) return;
      await Promise.all([
        roche.storage.delete(K_HISTORY),
        roche.storage.delete(K_LOG),
        roche.storage.delete(K_MANUAL),
        roche.storage.delete(K_SCALES),
        roche.storage.delete(K_META)
      ]);
      roche.ui.toast && roche.ui.toast("已清空");
      await renderChatLog();
      await renderArchive();
      await renderScales();
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
        hint.textContent = "想到什么都可以在这里说，我会安静地听，慢慢陪你梳理。";
        chatLogEl.appendChild(hint);
      }
      history.forEach((m) => appendMsgEl(m));
      chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }

    function appendMsgEl(m) {
      if (m.role === "scale-suggest") {
        const btn = document.createElement("button");
        btn.className = "pr-scale-btn";
        btn.textContent = `开始 ${SCALES[m.scale].name} →`;
        btn.onclick = async () => {
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

      // 客户端危机关键词兜底：先立即给出稳定资源，不等待模型
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
        const [manual, history, personaObj] = await Promise.all([
          getJSON(roche, K_MANUAL, ""),
          getJSON(roche, K_HISTORY, []),
          roche.persona.getActiveUserPersona().catch(() => null)
        ]);
        const personaName = personaObj ? (personaObj.name || personaObj.handle || "") : "";

        const systemPrompt = buildSystemPrompt(personaName, manual);
        const recent = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-20);
        const messages = [
          { role: "system", content: systemPrompt },
          ...recent.map((m) => ({ role: m.role, content: m.content }))
        ];

        const result = await roche.ai.chat({ messages, temperature: 0.7 });
        let replyText = (result && result.text ? result.text : "").trim();

        // 解析量表建议标记
        let scaleSuggest = null;
        const scaleMatch = replyText.match(/\[\[SCALE:(PHQ9|GAD7)\]\]/);
        if (scaleMatch) {
          scaleSuggest = scaleMatch[1];
          replyText = replyText.replace(/\[\[SCALE:(PHQ9|GAD7)\]\]/, "").trim();
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

        await maybeRunSummary(roche);
      } catch (err) {
        typingEl.remove();
        const errMsg = { role: "assistant", content: "（这轮没能顺利收到回复，网络或接口可能出了点问题，可以再试一次）", ts: nowTs() };
        appendMsgEl(errMsg);
      } finally {
        sendBtn.disabled = false;
      }
    };

    /* ---------------- 后台记忆整理 ---------------- */
    async function maybeRunSummary(roche) {
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

        const summaryPrompt = buildSummaryPrompt(manual, recentTurnsText);
        const result = await roche.ai.chat({
          messages: [{ role: "user", content: summaryPrompt }],
          temperature: 0.2
        });
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
      } catch (e) {
        // 后台整理失败不打断用户对话
      }
    }

    /* ---------------- 成长档案渲染 ---------------- */
    const archiveEl = root.querySelector("#pr-archive");
    async function renderArchive() {
      const [manual, log] = await Promise.all([
        getJSON(roche, K_MANUAL, ""),
        getJSON(roche, K_LOG, [])
      ]);
      const tagLabel = { fact: "事实", guess: "用户猜测", ai_observation: "AI观察", professional: "专业人士观点" };

      let html = `<div class="pr-section-title">自我认知说明书</div>`;
      html += `<div class="pr-manual-card">${manual && manual.trim() ? escapeHtml(manual) : "还在积累证据中，说明书会随着对话逐渐生成。"}</div>`;
      html += `<div class="pr-section-title">成长日志（最近在前）</div>`;
      if (!log.length) {
        html += `<div class="pr-empty">暂无记录，继续聊聊，日志会自动生成。</div>`;
      } else {
        [...log].reverse().slice(0, 100).forEach((item) => {
          html += `<div class="pr-log-item">
            <div class="pr-log-meta"><span class="pr-tag ${item.type}">${tagLabel[item.type] || "记录"}</span>${fmtTime(item.ts)}</div>
            <div>${escapeHtml(item.text)}</div>
          </div>`;
        });
      }
      archiveEl.innerHTML = html;
    }

    /* ---------------- 心理量表渲染 ---------------- */
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
        html += `<div class="pr-empty">还没有测评记录</div>`;
      } else {
        [...history].reverse().forEach((r) => {
          html += `<div class="pr-history-item">${fmtTime(r.ts)} · ${SCALES[r.scale].name} · 得分 ${r.score}</div>`;
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
      html += `<button class="pr-scale-submit" data-submit="${key}">提交</button>`;
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
          roche.ui.toast ? roche.ui.toast("请完成所有题目") : alert("请完成所有题目");
          return;
        }

        const resultEl = formEl.querySelector(`[data-result="${key}"]`);
        resultEl.style.display = "block";
        resultEl.innerHTML = `<b>得分：${total}</b><br>${s.interpret(total)}<br><span style="color:#7a746c;font-size:12px;">此结果仅供自我觉察参考，不构成诊断。如有需要，请寻求专业帮助。</span>`;

        const history = await getJSON(roche, K_SCALES, []);
        history.push({ ts: nowTs(), scale: key, score: total });
        await roche.storage.set(K_SCALES, history);

        // 高风险自评（PHQ-9 第9题：自伤/自杀念头）单独触发关心提示，即使总分不高
        if (key === "PHQ9") {
          const item9 = formEl.querySelector(`input[name="pr-q-PHQ9-8"]:checked`);
          if (item9 && Number(item9.value) > 0) {
            resultEl.innerHTML += `<hr style="border:none;border-top:1px solid #e7e2da;margin:10px 0;"><div style="color:#c0564a;">你刚才提到有过这样的念头，我很在意你的安全。如果这种感觉变得强烈，请联系全国心理援助热线 12356，或拨打 120 / 110，也可以联系身边信任的人。</div>`;
          }
        }

        // 同步写入成长日志，作为"事实"类记录
        const log = await getJSON(roche, K_LOG, []);
        log.push({ ts: nowTs(), type: "fact", text: `完成了一次 ${s.name}，得分 ${total}。` });
        await roche.storage.set(K_LOG, log);

        await renderScales();
      };
    }

    /* ---------------- 初始渲染 ---------------- */
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
    version: "1.0.0",
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
