// 辽宁专升本英语语法学习系统 v2.0 · 核心交互、SVG图解、500题单题引擎与间隔复习 (grammar-app.js)
(() => {
  "use strict";

  const STORE_KEY = "wordsteps-grammar-v1";
  const META = window.WSG_META;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function todayStr(offsetDays = 0) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  function prefersNoMotion() {
    return !!(state.reduceMotion || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  }

  function wsgAnimate(targets, props) {
    if (prefersNoMotion() || !window.anime || typeof window.anime.animate !== "function" || !targets) return;
    try {
      window.anime.animate(targets, props);
    } catch (_) {}
  }

  function announce(msg) {
    const el = $("a11yAnnouncer");
    if (el) el.textContent = msg;
  }

  // ---------------------------------------------------------------------------
  // 1. State Loading & Seamless Backward-Compatible Migration (wordsteps-grammar-v1)
  // ---------------------------------------------------------------------------
  function loadRawState() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  const raw = loadRawState();
  const state = Object.assign({
    // Preserved v1 fields
    tab: "all",
    mask: false,
    dark: false,
    palette: "emerald",
    mastered: [],
    answers: {},
    // Upgraded v2 fields
    view: "dashboard",
    activeMod: "1",
    beginnerMode: false,
    reduceMotion: false,
    dailyGoal: 15,
    records: {},
    kpManual: {},
    expandedZero: {},
    lastStudy: { view: "learn", mod: "1", kp: "kp-1-1", title: "时态时间轴与10大常考时态判定", ts: Date.now() },
    dailyLog: {},
    examHistory: []
  }, raw);

  if (!["dashboard", "learn", "practice", "mistakes", "report"].includes(state.view)) {
    state.view = "dashboard";
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function ensureTodayLog() {
    const t = todayStr();
    if (!state.dailyLog[t]) {
      state.dailyLog[t] = { answered: 0, correct: 0, reviewed: 0, kps: [] };
    }
    return state.dailyLog[t];
  }

  // Question index cache once banks load
  const qById = new Map();
  let allBanksLoaded = false;

  function indexBankQuestions(modId) {
    const arr = window.WSG_BANKS[modId] || [];
    let migrated = false;
    for (const q of arr) {
      qById.set(q.id, q);
      // Migrate legacy state.answers[qid] if present and not yet in state.records
      if (state.answers && state.answers[q.id] !== undefined && !state.records[q.id]) {
        const ansIdx = Number(state.answers[q.id]);
        const ok = ansIdx === q.ans;
        state.records[q.id] = {
          mod: q.mod,
          kp: q.kp,
          attempts: 1,
          correct: ok ? 1 : 0,
          lastAns: ansIdx,
          lastOk: ok,
          fav: false,
          wrongReason: ok ? "" : (q.trap || "clause"),
          masteredMistake: false,
          srsStage: ok ? 2 : 0,
          nextReviewAt: ok ? todayStr(2) : todayStr(0),
          updatedAt: Date.now()
        };
        migrated = true;
      }
    }
    if (migrated) save();
  }

  async function ensureBankIndexed(modId) {
    await window.WSG_ensureBank(modId);
    indexBankQuestions(modId);
  }

  async function ensureAllBanksIndexed() {
    if (allBanksLoaded && qById.size >= 500) return;
    await window.WSG_ensureAllBanks();
    for (const m of ["1", "2", "3", "4", "5"]) indexBankQuestions(m);
    allBanksLoaded = true;
  }

  // ---------------------------------------------------------------------------
  // 2. Fine-Grained KP Mastery, Mistake SRS & Progress Math
  // ---------------------------------------------------------------------------
  function findKpMeta(kpId) {
    for (const m of META.modules) {
      for (const kp of m.kps) {
        if (kp.id === kpId) return { mod: m, kp };
      }
    }
    return null;
  }

  function getKpStats(kpId) {
    const info = findKpMeta(kpId);
    const modId = info ? info.mod.id : "1";
    const bankArr = window.WSG_BANKS[modId] || [];
    const totalInKp = bankArr.length ? bankArr.filter(q => q.kp === kpId).length : Math.round(100 / (info ? info.mod.kps.length : 4));

    let practiced = 0, correctLatest = 0, totalAttempts = 0, totalRight = 0;
    for (const [qid, rec] of Object.entries(state.records)) {
      const rKp = rec.kp || (qById.get(qid) && qById.get(qid).kp);
      if (rKp === kpId && rec.attempts > 0) {
        practiced++;
        if (rec.lastOk) correctLatest++;
        totalAttempts += rec.attempts;
        totalRight += rec.correct || 0;
      }
    }
    const manualDone = !!(state.kpManual[kpId] || (state.mastered && state.mastered.includes(modId)));
    let mastery = 0;
    if (practiced > 0) {
      const targetDepth = Math.min(12, Math.max(5, totalInKp));
      const coveragePart = Math.min(1, practiced / targetDepth) * 55;
      const accuracyPart = (correctLatest / practiced) * 35;
      const bonusPart = manualDone ? 10 : Math.min(10, correctLatest * 1.2);
      mastery = Math.min(100, Math.round(coveragePart + accuracyPart + bonusPart));
    } else if (manualDone) {
      mastery = 25; // 已预习标记，结合实际答题后升至100%
    }
    const acc = totalAttempts > 0 ? Math.round((totalRight / totalAttempts) * 100) : 0;
    return { kpId, modId, totalInKp, practiced, correctLatest, acc, mastery, manualDone };
  }

  function getModStats(modId) {
    const m = META.modules.find(x => x.id === String(modId));
    if (!m) return { mastery: 0, practiced: 0, total: 100, masteredKps: 0, totalKps: 0 };
    const kpStats = m.kps.map(k => getKpStats(k.id));
    const avgMastery = Math.round(kpStats.reduce((s, x) => s + x.mastery, 0) / kpStats.length);
    const practiced = kpStats.reduce((s, x) => s + x.practiced, 0);
    const masteredKps = kpStats.filter(x => x.mastery >= 75).length;
    return { mastery: avgMastery, practiced, total: m.questionCount, masteredKps, totalKps: m.kps.length, kpStats };
  }

  function getOverallStats() {
    const modStats = META.modules.map(m => getModStats(m.id));
    const overallMastery = Math.round(modStats.reduce((s, x) => s + x.mastery, 0) / modStats.length);
    let totalPracticed = 0, totalAttempts = 0, totalRight = 0, mistakeTotal = 0, dueCount = 0, favCount = 0;
    const today = todayStr();
    for (const rec of Object.values(state.records)) {
      if (rec.attempts > 0) {
        totalPracticed++;
        totalAttempts += rec.attempts;
        totalRight += rec.correct || 0;
      }
      if (rec.fav) favCount++;
      const isMistake = (!rec.lastOk || (rec.attempts > rec.correct)) && !rec.masteredMistake && (rec.srsStage || 0) < 5;
      if (isMistake) {
        mistakeTotal++;
        if (!rec.nextReviewAt || rec.nextReviewAt <= today) dueCount++;
      }
    }
    const overallAcc = totalAttempts > 0 ? Math.round((totalRight / totalAttempts) * 100) : 0;
    let masteredKpTotal = 0;
    for (const ms of modStats) masteredKpTotal += ms.masteredKps;

    // Streak calculation
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = todayStr(-i);
      const log = state.dailyLog[d];
      if (log && (log.answered > 0 || (log.kps && log.kps.length > 0))) streak++;
      else if (i > 0) break;
    }

    return { overallMastery, totalPracticed, overallAcc, mistakeTotal, dueCount, favCount, masteredKpTotal, streak, modStats };
  }

  function updateHeaderBadges() {
    document.body.classList.toggle("dark", !!state.dark);
    document.body.classList.toggle("mask-on", !!state.mask);
    document.body.classList.toggle("reduce-motion", !!state.reduceMotion);
    document.body.dataset.palette = state.palette || "emerald";

    const bt = $("beginnerToggle");
    if (bt) {
      bt.setAttribute("aria-pressed", String(!!state.beginnerMode));
      bt.classList.toggle("soft", !!state.beginnerMode);
      bt.textContent = state.beginnerMode ? "🌱 零基础:开" : "🌱 零基础模式";
    }
    const mt = $("maskToggle");
    if (mt) {
      mt.setAttribute("aria-pressed", String(!!state.mask));
      mt.classList.toggle("primary", !!state.mask);
      mt.textContent = state.mask ? "👁 退出挖空" : "🙈 挖空背诵";
    }
    const mot = $("motionToggle");
    if (mot) {
      mot.setAttribute("aria-pressed", String(!!state.reduceMotion));
      mot.classList.toggle("soft", !!state.reduceMotion);
      mot.textContent = state.reduceMotion ? "🎞 动效已减" : "🎞 减弱动效";
    }
    const tb = $("themeBtn");
    if (tb) {
      tb.setAttribute("aria-pressed", String(!!state.dark));
      tb.textContent = state.dark ? "☀️ 冰晶" : "🌙 深空";
    }
    document.querySelectorAll(".dot").forEach(d => d.classList.toggle("active", d.dataset.pal === state.palette));

    const ov = getOverallStats();
    const dueEl = $("navDueCnt");
    if (dueEl) dueEl.textContent = String(ov.dueCount);

    document.querySelectorAll("#desktopNav .view-tab, #mobileDock .dock-btn").forEach(btn => {
      const act = btn.dataset.view === state.view;
      btn.classList.toggle("active", act);
      if (act) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Four Interactive SVG Teaching Diagrams Engine
  // ---------------------------------------------------------------------------
  const diagramStates = {
    "tense-timeline": 3, // default: 现在完成时
    "svo-analyzer": 0,
    "clause-structure": 0,
    "nonfinite-tree": 0
  };

  function renderDiagramInto(diagramId, host) {
    if (!host) return;
    const cfg = META.diagrams[diagramId];
    if (!cfg) return;

    if (diagramId === "tense-timeline") {
      const idx = diagramStates[diagramId] || 0;
      const cur = cfg.items[idx] || cfg.items[0];
      const activeNode = cur.node;
      const activeArc = cur.arc;

      host.innerHTML = `<div class="svg-lab-card" data-diag-root="tense-timeline">
        <div class="svg-lab-head">
          <div>
            <span class="kicker">🔬 交互式 SVG 图解 · 横纵自适应时态时间轴</span>
            <h4 style="margin:5px 0 2px;font-size:15.5px">${esc(cfg.title)}</h4>
            <div style="font-size:12px;color:var(--muted)">${esc(cfg.subtitle)}</div>
          </div>
        </div>
        <div class="svg-stage">
          <!-- Desktop Horizontal SVG Timeline -->
          <svg viewBox="0 0 920 206" class="tl-horizontal" role="img" aria-label="横向英语时态时间轴">
            <defs>
              <linearGradient id="tlAxisG" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#0284c7"/><stop offset="52%" stop-color="#059669"/><stop offset="100%" stop-color="#7c3aed"/>
              </linearGradient>
              <marker id="tlArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed"/>
              </marker>
            </defs>
            <path class="diag-arc" d="M 95 108 Q 180 38 265 108" fill="none" stroke="#0284c7" stroke-width="${activeArc==='arc_past_perf'?4.2:2}" opacity="${activeArc==='arc_past_perf'?1:0.38}" stroke-dasharray="${activeArc==='arc_past_perf'?'none':'5 4'}"/>
            <text x="175" y="48" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0284c7">过去完成 had done</text>

            <path class="diag-arc" d="M 265 108 Q 390 18 515 108" fill="none" stroke="#059669" stroke-width="${activeArc==='arc_pres_perf'?4.4:2.2}" opacity="${activeArc==='arc_pres_perf'?1:0.42}"/>
            <text x="392" y="28" text-anchor="middle" font-size="12" font-weight="800" fill="#059669">现在完成 have/has done（过去→现在）</text>

            <path class="diag-arc" d="M 515 108 Q 670 38 825 108" fill="none" stroke="#7c3aed" stroke-width="${activeArc==='arc_fut_perf'?4.2:2}" opacity="${activeArc==='arc_fut_perf'?1:0.38}" stroke-dasharray="${activeArc==='arc_fut_perf'?'none':'5 4'}"/>
            <text x="685" y="48" text-anchor="middle" font-size="11.5" font-weight="700" fill="#7c3aed">将来完成 will have done</text>

            <line x1="36" y1="108" x2="884" y2="108" stroke="url(#tlAxisG)" stroke-width="4" stroke-linecap="round" marker-end="url(#tlArr)"/>

            ${[
              ["past_perf", 95, "过去的过去", "had done", "#0284c7", 0],
              ["past", 265, "过去（时点）", "did / was doing", "#0ea5e9", 1],
              ["now", 515, "现在 NOW", "do / is doing", "#059669", 4],
              ["future", 685, "将来（时点）", "will do", "#6366f1", 6],
              ["fut_perf", 825, "将来截止点", "by + 将来", "#7c3aed", 7]
            ].map(([nid, cx, lb, sub, col, jumpIdx]) => {
              const on = activeNode === nid;
              return `<g style="cursor:pointer" data-diag="tense-timeline" data-diag-idx="${jumpIdx}">
                ${on ? `<circle class="diag-pulse" cx="${cx}" cy="108" r="19" fill="none" stroke="${col}" stroke-width="2.5" opacity="0.55"/>` : ""}
                <circle cx="${cx}" cy="108" r="${on ? 11 : 8}" fill="${col}"/>
                <text x="${cx}" y="138" text-anchor="middle" font-size="12.5" font-weight="${on ? 800 : 650}" fill="currentColor">${lb}</text>
                <text x="${cx}" y="156" text-anchor="middle" font-size="11" fill="#64748b">${sub}</text>
              </g>`;
            }).join("")}
            <text x="460" y="190" text-anchor="middle" font-size="12" fill="#64748b">点击任意时间节点或下方时态胶囊，动态对比“时点”与“时段”</text>
          </svg>

          <!-- Mobile Vertical SVG Timeline (<= 768px) -->
          <svg viewBox="0 0 340 430" class="tl-vertical" role="img" aria-label="手机端纵向英语时态时间轴">
            <defs>
              <linearGradient id="tlVertG" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#0284c7"/><stop offset="52%" stop-color="#059669"/><stop offset="100%" stop-color="#7c3aed"/>
              </linearGradient>
            </defs>
            <line x1="56" y1="26" x2="56" y2="398" stroke="url(#tlVertG)" stroke-width="4" stroke-linecap="round"/>
            <path d="M 56 48 Q 16 92 56 136" fill="none" stroke="#0284c7" stroke-width="${activeArc==='arc_past_perf'?3.8:1.8}" opacity="${activeArc==='arc_past_perf'?1:0.4}"/>
            <path d="M 56 136 Q 12 180 56 224" fill="none" stroke="#059669" stroke-width="${activeArc==='arc_pres_perf'?4:2}" opacity="${activeArc==='arc_pres_perf'?1:0.45}"/>
            <path d="M 56 224 Q 14 306 56 388" fill="none" stroke="#7c3aed" stroke-width="${activeArc==='arc_fut_perf'?3.8:1.8}" opacity="${activeArc==='arc_fut_perf'?1:0.4}"/>
            ${[
              ["past_perf", 48, "1. 过去的过去", "过去完成时 had done", "#0284c7", 0],
              ["past", 136, "2. 过去时点", "一般过去 did / 过去进行 was doing", "#0ea5e9", 1],
              ["now", 224, "3. 现在基准 NOW", "一般现在 / 现在进行 / 现在完成", "#059669", 3],
              ["future", 310, "4. 将来时点", "一般将来时 will do", "#6366f1", 6],
              ["fut_perf", 388, "5. 将来某刻前", "将来完成时 will have done", "#7c3aed", 7]
            ].map(([nid, cy, lb, sub, col, jumpIdx]) => {
              const on = activeNode === nid;
              return `<g style="cursor:pointer" data-diag="tense-timeline" data-diag-idx="${jumpIdx}">
                ${on ? `<circle class="diag-pulse" cx="56" cy="${cy}" r="16" fill="none" stroke="${col}" stroke-width="2.5"/>` : ""}
                <circle cx="56" cy="${cy}" r="${on ? 10 : 7.5}" fill="${col}"/>
                <rect x="82" y="${cy - 22}" width="244" height="44" rx="10" fill="${on ? 'rgba(16,185,129,0.14)' : 'rgba(148,163,184,0.10)'}" stroke="${on ? col : 'rgba(148,163,184,0.28)'}"/>
                <text x="94" y="${cy - 3}" font-size="12.5" font-weight="800" fill="currentColor">${lb}</text>
                <text x="94" y="${cy + 14}" font-size="11" fill="#64748b">${sub}</text>
              </g>`;
            }).join("")}
          </svg>
        </div>
        <div class="svg-pill-bar" role="tablist" aria-label="选择具体时态演示">
          ${cfg.items.map((it, i) => `<button class="btn sm ${i === idx ? 'primary' : ''}" role="tab" aria-selected="${i === idx}" data-diag="tense-timeline" data-diag-idx="${i}">${esc(it.name)}</button>`).join("")}
        </div>
        <div class="svg-inspector">
          <div><strong>${esc(cur.name)}</strong> · 公式：<code>${esc(cur.formula)}</code> · <span class="kicker">${esc(cur.kind)}</span></div>
          <div style="margin-top:4px"><strong>高频时间词：</strong>${esc(cur.signals)}</div>
          <div style="margin-top:4px"><strong>典型例句：</strong><code>${esc(cur.eg)}</code> — ${esc(cur.cn)}</div>
        </div>
      </div>`;
      wsgAnimate(host.querySelectorAll(".diag-pulse, .svg-inspector"), { scale: [0.96, 1], opacity: [0.5, 1], duration: 280 });
      return;
    }

    if (diagramId === "svo-analyzer") {
      const idx = diagramStates[diagramId] || 0;
      const sent = cfg.sentences[idx] || cfg.sentences[0];
      const n = sent.tokens.length;
      const boxW = Math.floor(780 / n);

      host.innerHTML = `<div class="svg-lab-card" data-diag-root="svo-analyzer">
        <div class="svg-lab-head">
          <div>
            <span class="kicker">🔬 交互式 SVG 图解 · 主谓宾与五大句型拆解仪</span>
            <h4 style="margin:5px 0 2px;font-size:15.5px">${esc(cfg.title)}</h4>
            <div style="font-size:12px;color:var(--muted)">${esc(cfg.subtitle)}</div>
          </div>
        </div>
        <div class="svg-pill-bar" style="margin-bottom:10px">
          ${cfg.sentences.map((s, i) => `<button class="btn sm ${i === idx ? 'primary' : ''}" data-diag="svo-analyzer" data-diag-idx="${i}">${esc(s.label)}</button>`).join("")}
        </div>
        <div class="svg-stage">
          <svg viewBox="0 0 840 176" style="width:100%;min-width:560px;height:auto;display:block" role="img" aria-label="主谓宾成分依存结构SVG图">
            <defs>
              <marker id="svoArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669"/>
              </marker>
            </defs>
            ${sent.links.map(([from, to, rel]) => {
              const x1 = 30 + from * boxW + boxW / 2;
              const x2 = 30 + to * boxW + boxW / 2;
              const midX = (x1 + x2) / 2;
              const arcH = Math.max(16, 68 - Math.abs(x2 - x1) * 0.14);
              return `<g class="svo-arc-g">
                <path d="M ${x1} 76 Q ${midX} ${arcH} ${x2} 76" fill="none" stroke="#059669" stroke-width="2.2" marker-end="url(#svoArr)"/>
                <text x="${midX}" y="${arcH + 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#059669">${esc(rel)}</text>
              </g>`;
            }).join("")}
            ${sent.tokens.map((tk, i) => {
              const x = 30 + i * boxW + 4;
              const w = boxW - 8;
              return `<g>
                <rect x="${x}" y="82" width="${w}" height="68" rx="11" fill="rgba(16,185,129,0.08)" stroke="${tk.color}" stroke-width="2"/>
                <text x="${x + w / 2}" y="106" text-anchor="middle" font-size="12.5" font-weight="800" fill="currentColor">${esc(tk.t.length > 22 ? tk.t.slice(0, 20) + '…' : tk.t)}</text>
                <text x="${x + w / 2}" y="132" text-anchor="middle" font-size="11.5" font-weight="750" fill="${tk.color}">${esc(tk.role)}</text>
              </g>`;
            }).join("")}
          </svg>
        </div>
        <div class="anat-chips" style="margin-top:10px">
          ${sent.tokens.map(tk => `<div class="anat-chip"><b style="color:${tk.color}">${esc(tk.role)} · ${esc(tk.t)}</b><span>${esc(tk.desc)}</span></div>`).join("")}
        </div>
        <div class="sub-note">整句译文：${esc(sent.cn)}</div>
      </div>`;
      wsgAnimate(host.querySelectorAll(".svo-arc-g"), { opacity: [0, 1], translateY: [-6, 0], duration: 320 });
      return;
    }

    if (diagramId === "clause-structure") {
      const idx = diagramStates[diagramId] || 0;
      const m = cfg.models[idx] || cfg.models[0];
      host.innerHTML = `<div class="svg-lab-card" data-diag-root="clause-structure">
        <div class="svg-lab-head">
          <div>
            <span class="kicker">🔬 交互式 SVG 图解 · 三大从句结构与 V1/V2 谓语切分镜</span>
            <h4 style="margin:5px 0 2px;font-size:15.5px">${esc(cfg.title)}</h4>
            <div style="font-size:12px;color:var(--muted)">${esc(cfg.subtitle)}</div>
          </div>
        </div>
        <div class="svg-pill-bar" style="margin-bottom:10px">
          ${cfg.models.map((it, i) => `<button class="btn sm ${i === idx ? 'primary' : ''}" data-diag="clause-structure" data-diag-idx="${i}">${esc(it.name)}</button>`).join("")}
        </div>
        <div class="svg-stage">
          <svg viewBox="0 0 840 165" style="width:100%;min-width:560px;height:auto;display:block" role="img" aria-label="从句边界切分结构图">
            <rect x="24" y="58" width="210" height="68" rx="12" fill="rgba(2,132,199,0.10)" stroke="#0284c7" stroke-width="2"/>
            <text x="129" y="84" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0284c7">主句前部 / 先行词</text>
            <text x="129" y="108" text-anchor="middle" font-size="13" font-weight="800" fill="currentColor">${esc(m.mainPart)}</text>

            <rect x="254" y="48" width="332" height="88" rx="14" fill="rgba(16,185,129,0.13)" stroke="#059669" stroke-width="2.5"/>
            <text x="420" y="74" text-anchor="middle" font-size="11.5" font-weight="800" fill="#059669">【从句区间】连接词：${esc(m.conn)}</text>
            <text x="420" y="102" text-anchor="middle" font-size="13.5" font-weight="800" fill="currentColor">[ ${esc(m.clausePart)} ]</text>
            <text x="420" y="124" text-anchor="middle" font-size="11" fill="#64748b">${esc(m.v1)}</text>

            <rect x="606" y="58" width="210" height="68" rx="12" fill="rgba(124,58,237,0.10)" stroke="#7c3aed" stroke-width="2"/>
            <text x="711" y="84" text-anchor="middle" font-size="11.5" font-weight="700" fill="#7c3aed">第2谓语切分点 / 主句余部</text>
            <text x="711" y="108" text-anchor="middle" font-size="13" font-weight="800" fill="currentColor">${esc(m.tailPart)}</text>

            <path class="cl-bridge" d="M 380 48 Q 250 10 140 56" fill="none" stroke="#d97706" stroke-width="2.2" stroke-dasharray="5 3"/>
            <text x="262" y="24" text-anchor="middle" font-size="11.5" font-weight="700" fill="#d97706">成分还原 / 逻辑关联校验</text>
          </svg>
        </div>
        <div class="svg-inspector">
          <div><strong>连接词诊断：</strong>${esc(m.connRole)}</div>
          <div style="margin-top:4px"><strong>谓语切分：</strong>${esc(m.v1)} ➔ <strong>${esc(m.v2)}</strong></div>
          <div style="margin-top:4px"><strong>考场秒判公式：</strong><code>${esc(m.formula)}</code></div>
        </div>
      </div>`;
      wsgAnimate(host.querySelectorAll(".cl-bridge, .svg-inspector"), { opacity: [0.3, 1], duration: 300 });
      return;
    }

    if (diagramId === "nonfinite-tree") {
      const idx = diagramStates[diagramId] || 0;
      const c = cfg.cases[idx] || cfg.cases[0];
      const on = id => c.path.includes(id);

      const nodeBox = (id, x, y, w, h, title, sub) => {
        const active = on(id);
        return `<g class="${active ? 'nf-active-node' : ''}">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${active ? 'rgba(16,185,129,0.20)' : 'rgba(148,163,184,0.10)'}" stroke="${active ? '#059669' : 'rgba(148,163,184,0.38)'}" stroke-width="${active ? 2.6 : 1.4}"/>
          <text x="${x + w / 2}" y="${y + (sub ? 19 : 25)}" text-anchor="middle" font-size="12" font-weight="${active ? 800 : 650}" fill="currentColor">${title}</text>
          ${sub ? `<text x="${x + w / 2}" y="${y + 35}" text-anchor="middle" font-size="10.5" fill="#64748b">${sub}</text>` : ""}
        </g>`;
      };
      const edge = (n1, n2, x1, y1, x2, y2) => {
        const active = on(n1) && on(n2);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${active ? '#059669' : 'rgba(148,163,184,0.38)'}" stroke-width="${active ? 3 : 1.5}"/>`;
      };

      host.innerHTML = `<div class="svg-lab-card" data-diag-root="nonfinite-tree">
        <div class="svg-lab-head">
          <div>
            <span class="kicker">🔬 交互式 SVG 图解 · 非谓语动词三步判断决策树</span>
            <h4 style="margin:5px 0 2px;font-size:15.5px">${esc(cfg.title)}</h4>
            <div style="font-size:12px;color:var(--muted)">${esc(cfg.subtitle)}</div>
          </div>
        </div>
        <div class="svg-pill-bar" style="margin-bottom:10px">
          ${cfg.cases.map((it, i) => `<button class="btn sm ${i === idx ? 'primary' : ''}" data-diag="nonfinite-tree" data-diag-idx="${i}">${esc(it.title)}</button>`).join("")}
        </div>
        <div class="svg-stage">
          <svg viewBox="0 0 860 226" style="width:100%;min-width:580px;height:auto;display:block" role="img" aria-label="非谓语动词判断决策树SVG">
            ${edge("n_root", "n_finite", 150, 95, 225, 48)}
            ${edge("n_root", "n_nonfin", 150, 115, 225, 145)}
            ${edge("n_nonfin", "n_active", 385, 138, 455, 92)}
            ${edge("n_nonfin", "n_passive", 385, 152, 455, 175)}
            ${edge("n_active", "n_to_do", 585, 84, 655, 38)}
            ${edge("n_active", "n_doing", 585, 92, 655, 88)}
            ${edge("n_active", "n_having_done", 585, 100, 655, 136)}
            ${edge("n_passive", "n_to_be_done", 585, 170, 655, 136)}
            ${edge("n_passive", "n_done", 585, 180, 655, 186)}

            ${nodeBox("n_root", 16, 84, 134, 44, "Step 1 查连词与谓语", "一主一谓铁律")}
            ${nodeBox("n_finite", 225, 24, 185, 44, "有连词 + 有主语", "➔ 填真谓语（时态/主被动）")}
            ${nodeBox("n_nonfin", 225, 124, 160, 44, "无连词（已有真谓语）", "➔ Step 2 判非谓语主被动")}
            ${nodeBox("n_active", 455, 70, 130, 42, "逻辑主动", "Step 3 比时间")}
            ${nodeBox("n_passive", 455, 156, 130, 42, "逻辑被动", "Step 3 比时间")}
            ${nodeBox("n_to_do", 655, 14, 186, 38, "将来/目的：to do", "")}
            ${nodeBox("n_doing", 655, 64, 186, 38, "同时/伴随：doing", "")}
            ${nodeBox("n_having_done", 655, 114, 186, 38, "主动先完成 / 将来被动", "having done / to be done")}
            ${nodeBox("n_to_be_done", 655, 114, 0, 0, "", "")}
            ${nodeBox("n_done", 655, 166, 186, 40, "一般/完成被动：done", "正在被动：being done")}
          </svg>
        </div>
        <div class="svg-inspector">
          <div><strong>例题：</strong><code>${esc(c.stem)}</code> ➔ 锁定答案：<strong><code>${esc(c.answer)}</code></strong></div>
          <div style="margin-top:4px">${esc(c.explain)}</div>
        </div>
      </div>`;
      // Fix clean separate nodes for having_done vs to_be_done in SVG if active:
      if (on("n_to_be_done")) {
        const texts = host.querySelectorAll("svg text");
        texts.forEach(t => { if (t.textContent.includes("主动先完成")) t.textContent = "将来被动：to be done"; });
      }
      wsgAnimate(host.querySelectorAll(".nf-active-node"), { scale: [0.96, 1], duration: 260 });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. View 1: Learning Console (Dashboard)
  // ---------------------------------------------------------------------------
  let consoleDiagramId = "tense-timeline";

  function renderDashboard() {
    const host = $("viewHost");
    const ov = getOverallStats();
    const todayLog = ensureTodayLog();

    // Find weakest KP for Today's recommended task
    let weakest = { kpId: "kp-1-1", modId: "1", title: "时态时间轴与10大常考时态判定", mastery: 101 };
    for (const m of META.modules) {
      for (const kp of m.kps) {
        const st = getKpStats(kp.id);
        if (st.mastery < weakest.mastery) {
          weakest = { kpId: kp.id, modId: m.id, title: kp.title, mastery: st.mastery };
        }
      }
    }

    const qDoneToday = todayLog.answered || 0;
    const goalDone = qDoneToday >= state.dailyGoal;

    host.innerHTML = `
      <div class="console-top-grid">
        <section class="surface console-hero" aria-label="学习总览与继续学习">
          <div>
            <span class="kicker">✨ 专升本语法学习控制台 · 五大专项 574 处挖空 + 500 题分级库</span>
            <h2 style="margin:8px 0 6px;font-size:clamp(21px,2.6vw,28px)">欢迎回来，今天稳步攻克一个语法薄弱点</h2>
            <p style="margin:0;color:var(--muted);font-size:13.5px">综合考点掌握度与实际刷题正确率实时联动；支持零基础六步拆解、交互式 SVG 图解与艾宾浩斯错题间隔复习。</p>
          </div>
          <div class="console-stats-row">
            <div class="stat-tile"><div class="num">${ov.overallMastery}%</div><div class="lbl">综合考点掌握度</div></div>
            <div class="stat-tile"><div class="num">${ov.masteredKpTotal} / 18</div><div class="lbl">已达标独立考点</div></div>
            <div class="stat-tile"><div class="num">${ov.totalPracticed} / 500</div><div class="lbl">题库累计已刷</div></div>
            <div class="stat-tile"><div class="num">${ov.overallAcc}%</div><div class="lbl">历史答题正确率</div></div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
            <button class="btn primary" data-action="continueLast">▶ 继续上次学习：${esc(state.lastStudy?.title || "专项一 · 时态和语态")}</button>
            <button class="btn soft" data-action="startSmartPractice">⚡ 智能刷题 15 道</button>
            <button class="btn" data-action="goView" data-target="learn" data-mod="all">📚 通读全部五章讲义</button>
          </div>
        </section>

        <section class="surface" aria-label="今日学习任务清单">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <h3 style="margin:0;font-size:16.5px">🎯 今日三项核心任务</h3>
            <span class="kicker">连续学习 ${ov.streak} 天</span>
          </div>
          <div class="task-list">
            <div class="task-row ${(todayLog.kps || []).length > 0 ? 'done' : ''}">
              <div>
                <strong>1. 攻克薄弱考点：${esc(weakest.title)}</strong>
                <div style="font-size:12px;color:var(--muted)">当前掌握度 ${weakest.mastery}% · 含零基础拆解与严格语法校对</div>
              </div>
              <button class="btn sm soft" data-action="jumpKp" data-mod="${weakest.modId}" data-kp="${weakest.kpId}">去学习</button>
            </div>
            <div class="task-row ${goalDone ? 'done' : ''}">
              <div>
                <strong>2. 每日语法刷题（${qDoneToday} / ${state.dailyGoal} 题）</strong>
                <div style="font-size:12px;color:var(--muted)">一次一题闯关 · 含提示与三步递进解析</div>
              </div>
              <button class="btn sm ${goalDone ? '' : 'primary'}" data-action="startSmartPractice">${goalDone ? '再练一组' : '去刷题'}</button>
            </div>
            <div class="task-row ${ov.dueCount === 0 && ov.mistakeTotal > 0 ? 'done' : ''}">
              <div>
                <strong>3. 到期错题间隔复习（待复习 ${ov.dueCount} 题）</strong>
                <div style="font-size:12px;color:var(--muted)">错题本共 ${ov.mistakeTotal} 题 · 收藏夹 ${ov.favCount} 题</div>
              </div>
              <button class="btn sm ${ov.dueCount > 0 ? 'primary' : ''}" data-action="startDueReview">${ov.dueCount > 0 ? '立即复习' : '查看错题'}</button>
            </div>
          </div>
        </section>
      </div>

      <section aria-label="五大核心语法专项入口">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <h3 style="margin:0;font-size:17px">📚 五大核心语法专项（保留全部 574 处讲义挖空 + 18 个独立考点）</h3>
          <span style="font-size:12.5px;color:var(--muted)">点击任一专项按需加载讲义或直接开启本专项 100 题训练</span>
        </div>
        <div class="mod-matrix">
          ${META.modules.map((m, idx) => {
            const ms = ov.modStats[idx];
            return `<div class="mod-tile">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                  <span class="kicker">专项 ${m.id}</span>
                  <span style="font-size:12px;font-weight:750;color:var(--green-deep)">掌握 ${ms.mastery}%</span>
                </div>
                <h3>${esc(m.title)}</h3>
                <p>${esc(m.summary)}</p>
              </div>
              <div>
                <div class="bar" aria-label="${esc(m.title)}掌握度 ${ms.mastery}%"><i style="width:${ms.mastery}%"></i></div>
                <div style="font-size:11.5px;color:var(--muted);margin:6px 0 10px">考点 ${ms.masteredKps}/${ms.totalKps} · 挖空 ${m.clozeCount} 处 · 已刷 ${ms.practiced}/${m.questionCount} 题</div>
                <div style="display:flex;gap:6px">
                  <button class="btn sm soft" style="flex:1" data-action="openModLearn" data-mod="${m.id}">看讲义</button>
                  <button class="btn sm" style="flex:1" data-action="openModQuiz" data-mod="${m.id}">练100题</button>
                </div>
              </div>
            </div>`;
          }).join("")}
        </div>
      </section>

      <section class="quick-entrances" aria-label="模拟考试、错题复习与学习报告快捷区">
        <div class="surface" style="margin-bottom:0">
          <span class="kicker">🎲 考场实战模拟</span>
          <h3 style="margin:6px 0 4px;font-size:16px">随机组卷限时考试</h3>
          <p style="margin:0 0 12px;font-size:13px;color:var(--muted)">从 500 题库均衡抽取五大专项题目，交卷后自动生成诊断报告并收录错题。</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button class="btn sm primary" data-action="startExam" data-count="20">20题标准考 (15分)</button>
            <button class="btn sm" data-action="startExam" data-count="10">10题快测</button>
            <button class="btn sm" data-action="startExam" data-count="50">50题全真卷</button>
          </div>
        </div>

        <div class="surface" style="margin-bottom:0">
          <span class="kicker">📕 错因诊断与记忆曲线</span>
          <h3 style="margin:6px 0 4px;font-size:16px">错题本与收藏夹</h3>
          <p style="margin:0 0 12px;font-size:13px;color:var(--muted)">当前待复习错题 <strong>${ov.dueCount}</strong> 道，累计错题 <strong>${ov.mistakeTotal}</strong> 道，星标收藏 <strong>${ov.favCount}</strong> 道。</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button class="btn sm soft" data-action="goView" data-target="mistakes">进入错题本</button>
            <button class="btn sm" data-action=" practiceHandoutOnly">📘 刷18道讲义原题</button>
          </div>
        </div>

        <div class="surface" style="margin-bottom:0">
          <span class="kicker">📊 数据洞察与打印</span>
          <h3 style="margin:6px 0 4px;font-size:16px">学习报告与讲义试卷打印</h3>
          <p style="margin:0 0 12px;font-size:13px;color:var(--muted)">查看 18 个独立考点的强弱项分布、错因统计，或导出无答案测试卷与详解卷。</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button class="btn sm soft" data-action="goView" data-target="report">查看学习报告</button>
            <button class="btn sm" data-action="openPrintModal">🖨 打印讲义/试卷</button>
          </div>
        </div>
      </section>

      <section class="surface" style="margin-top:16px" aria-label="四大语法交互式SVG图解实验室">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
          <div>
            <h3 style="margin:0;font-size:16.5px">🧭 四大核心语法交互式 SVG 图解实验室</h3>
            <div style="font-size:12.5px;color:var(--muted)">支持时态时间轴（手机纵向自适应）、主谓宾成分依存分析、三大从句切分与非谓语三步决策树</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${[
              ["tense-timeline", "⏱ 时态时间轴"],
              ["svo-analyzer", "🔬 主谓宾拆解"],
              ["clause-structure", "🌳 从句结构镜"],
              ["nonfinite-tree", "🧭 非谓语决策树"]
            ].map(([did, lb]) => `<button class="btn sm ${consoleDiagramId === did ? 'primary' : ''}" data-action="switchConsoleDiag" data-diag-id="${did}">${lb}</button>`).join("")}
          </div>
        </div>
        <div id="consoleDiagMount"></div>
      </section>
    `;

    renderDiagramInto(consoleDiagramId, $("consoleDiagMount"));
  }

  // ---------------------------------------------------------------------------
  // 5. View 2: On-Demand 5-Module Grammar Handout + Zero-Basis + 574 Clozes
  // ---------------------------------------------------------------------------
  async function renderLearnView(scrollToKpId = "") {
    const host = $("viewHost");
    const active = state.activeMod || "1";
    host.innerHTML = `<div class="surface" style="text-align:center;padding:32px">正在按需加载语法专项讲义数据…</div>`;

    const modIds = active === "all" ? ["1", "2", "3", "4", "5"] : [active];
    await Promise.all(modIds.map(id => window.WSG_ensureModule(id)));

    const sectionsHtml = modIds.map(mid => {
      const mMeta = META.modules.find(x => x.id === mid);
      const mData = window.WSG_MODULES[mid];
      const ms = getModStats(mid);

      // Module-level diagram if not mod-1 (mod-1 mounts inside kp-1-1 right where original timeline lived)
      const topDiagHtml = (mData.diagramId && mid !== "1")
        ? `<div class="svg-lab-mount" data-diagram="${mData.diagramId}"></div>`
        : "";

      const cardsHtml = mData.cards.map(card => {
        const kpSt = getKpStats(card.kpId);
        const showZero = !!(state.beginnerMode || state.expandedZero[card.kpId]);
        const z = card.zero;
        return `<article class="kp-wrapper" id="${card.kpId}" data-kp-id="${card.kpId}">
          <div class="kp-topbar">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="kicker">考点 ${esc(card.kpId.replace('kp-', ''))}</span>
              <strong style="font-size:14px">${esc(card.title)}</strong>
              <span style="font-size:12px;color:var(--muted)">（本卡含 ${card.clozeCount} 处挖空 · 掌握度 <strong style="color:var(--green-deep)">${kpSt.mastery}%</strong> · 已练 ${kpSt.practiced} 题）</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn sm ${showZero ? 'soft' : ''}" data-action="toggleKpZero" data-kp="${card.kpId}" aria-expanded="${showZero}">🌱 ${showZero ? '收起零基础精讲' : '零基础六步精讲'}</button>
              <button class="btn sm" data-action="revealCardCloze" data-kp="${card.kpId}">👁 本卡翻开/遮罩</button>
              <button class="btn sm ${kpSt.manualDone ? 'soft' : ''}" data-action="toggleKpManual" data-kp="${card.kpId}">${kpSt.manualDone ? '✓ 已标学完' : '○ 标记已学'}</button>
              <button class="btn sm primary" data-action="practiceKp" data-mod="${mid}" data-kp="${card.kpId}">✍️ 练本考点题</button>
            </div>
          </div>
          ${card.handoutHtml.replace('<div class="g-card"', '<div class="g-card" data-kp-card="' + card.kpId + '"').replace(/<\/div>\s*$/, '')}
            <!-- 应试口诀 vs 严格语法规则校对栏 -->
            <div class="calib-grid" aria-label="应试口诀与严格语法规则校对">
              <div class="calib-box tip">
                <span class="calib-tag">⚡ 考场应试秒杀口诀</span>
                <div>${esc(card.strictVsTip.tip)}</div>
              </div>
              <div class="calib-box strict">
                <span class="calib-tag">⚖️ 严格语法规则与防坑边界校对</span>
                <div>${esc(card.strictVsTip.strict)}</div>
              </div>
            </div>

            <!-- 零基础六步精讲面板 -->
            <div class="zero-panel ${showZero ? '' : 'collapsed'}" id="zero-${card.kpId}">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <strong style="color:var(--green-deep);font-size:14px">🌱 零基础六步通关拆解 · ${esc(card.short)}</strong>
                <span style="font-size:12px;color:var(--muted)">概念白话 ➔ 句子拆解 ➔ 解题步骤 ➔ 典型母题 ➔ 变形对比 ➔ 易错预警</span>
              </div>
              <div class="zero-grid">
                <div class="zero-block">
                  <strong class="zb-title">1️⃣ 概念白话理解</strong>
                  <div>${esc(z.concept)}</div>
                </div>
                <div class="zero-block">
                  <strong class="zb-title">2️⃣ 典型句子成分拆解</strong>
                  <div class="anat-chips">
                    ${z.anatomy.map(a => `<div class="anat-chip"><b>${esc(a.part)}：${esc(a.text)}</b><span>${esc(a.role)}</span></div>`).join("")}
                  </div>
                </div>
                <div class="zero-block">
                  <strong class="zb-title">3️⃣ 考场三步解题步骤</strong>
                  <ol class="num-list" style="margin:0">
                    ${z.steps.map(st => `<li>${esc(st)}</li>`).join("")}
                  </ol>
                </div>
                <div class="zero-block">
                  <strong class="zb-title">4️⃣ 典型母题精讲</strong>
                  <div><code>${esc(z.example.q)}</code></div>
                  <div style="margin-top:4px"><strong>答案：</strong><code>${esc(z.example.ans)}</code></div>
                  <div style="margin-top:3px;color:var(--ink-2)">${esc(z.example.why)}</div>
                </div>
                <div class="zero-block">
                  <strong class="zb-title">5️⃣ 举一反三变形题（${esc(z.variant.change)}）</strong>
                  <div><code>${esc(z.variant.q)}</code></div>
                  <div style="margin-top:4px"><strong>变形后答案：</strong><code>${esc(z.variant.ans)}</code></div>
                  <div style="margin-top:3px;color:var(--ink-2)">${esc(z.variant.why)}</div>
                </div>
                <div class="zero-block" style="border-left:3.5px solid var(--danger)">
                  <strong class="zb-title" style="color:var(--danger)">6️⃣ 高频易错陷阱预警</strong>
                  <div>${esc(z.pitfall)}</div>
                </div>
              </div>
            </div>
          </div>
        </article>`;
      }).join("");

      return `<section class="mod-section" id="mod-${mid}" data-mod="${mid}">
        <div class="mod-banner tint-${mMeta.tint}">
          <div>
            <div class="mod-kicker">${esc(mMeta.kicker)} · 专项掌握度 ${ms.mastery}%</div>
            <h2>${esc(mMeta.title)}（${esc(mMeta.en)}）</h2>
            <p>${esc(mMeta.summary)}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn soft" data-action="openModQuiz" data-mod="${mid}">✍️ 练本专项 100 题</button>
          </div>
        </div>
        ${topDiagHtml}
        ${cardsHtml}
      </section>`;
    }).join("");

    host.innerHTML = `
      <div class="chapter-bar">
        <div class="mod-pills" role="tablist" aria-label="选择语法专项章节">
          ${META.modules.map(m => `<button class="btn ${active === m.id ? 'primary' : ''}" role="tab" aria-selected="${active === m.id}" data-action="selectLearnMod" data-mod="${m.id}">${m.id}. ${esc(m.title)}</button>`).join("")}
          <button class="btn ${active === 'all' ? 'primary' : ''}" role="tab" aria-selected="${active === 'all'}" data-action="selectLearnMod" data-mod="all">📚 展开全部五章 (574挖空)</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${state.mask ? `<button class="btn sm soft" data-action="revealAllPageCloze">👁 全部翻开/重置遮罩</button>` : ""}
        </div>
      </div>
      ${sectionsHtml}
    `;

    // Mount any interactive SVG diagrams inside rendered chapters
    host.querySelectorAll(".svg-lab-mount").forEach(el => {
      renderDiagramInto(el.dataset.diagram, el);
    });

    if (scrollToKpId) {
      const targetEl = document.getElementById(scrollToKpId);
      if (targetEl) targetEl.scrollIntoView({ behavior: prefersNoMotion() ? "auto" : "smooth", block: "start" });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. View 3: Single-Question Practice & Timed Mock Exam (Zero Full Re-render!)
  // ---------------------------------------------------------------------------
  const session = {
    mode: "practice", // "practice" | "exam" | "review"
    title: "专项练习",
    filterMod: "all",
    filterKp: "all",
    filterSource: "all", // "all" | "handout" | "authored" | "unseen"
    filterDiff: "all",
    count: 15,
    qids: [],
    idx: 0,
    showHint: false,
    stepLevel: 0, // 0..3 progressive step-by-step explanation
    examSubmitted: false,
    examChoices: {},
    examStartAt: 0,
    examLimitSec: 0,
    timerId: null
  };

  function clearExamTimer() {
    if (session.timerId) {
      clearInterval(session.timerId);
      session.timerId = null;
    }
  }

  async function startSession(opts = {}) {
    clearExamTimer();
    Object.assign(session, {
      mode: opts.mode || "practice",
      title: opts.title || "语法闯关训练",
      filterMod: opts.filterMod ?? session.filterMod ?? "all",
      filterKp: opts.filterKp ?? "all",
      filterSource: opts.filterSource ?? "all",
      filterDiff: opts.filterDiff ?? "all",
      count: Number(opts.count || 15),
      idx: 0,
      showHint: false,
      stepLevel: 0,
      examSubmitted: false,
      examChoices: {}
    });

    if (opts.customQids && opts.customQids.length) {
      await ensureAllBanksIndexed();
      session.qids = [...opts.customQids];
    } else {
      if (session.filterMod !== "all") {
        await ensureBankIndexed(session.filterMod);
      } else {
        await ensureAllBanksIndexed();
      }
      let pool = [];
      const targetMods = session.filterMod === "all" ? ["1", "2", "3", "4", "5"] : [session.filterMod];
      for (const mid of targetMods) {
        pool.push(...(window.WSG_BANKS[mid] || []));
      }
      if (session.filterKp !== "all") pool = pool.filter(q => q.kp === session.filterKp);
      if (session.filterSource === "handout") pool = pool.filter(q => q.source === "handout");
      else if (session.filterSource === "authored") pool = pool.filter(q => q.source === "authored");
      else if (session.filterSource === "unseen") pool = pool.filter(q => !state.records[q.id]?.attempts);
      if (session.filterDiff !== "all") pool = pool.filter(q => String(q.diff) === String(session.filterDiff));

      // Shuffle unless showing the 18 handout items in order
      if (session.filterSource !== "handout") {
        pool = [...pool].sort(() => Math.random() - 0.5);
      }
      session.qids = session.count >= 500 ? pool.map(q => q.id) : pool.slice(0, session.count).map(q => q.id);
    }

    if (session.mode === "exam" && session.qids.length > 0) {
      session.examStartAt = Date.now();
      session.examLimitSec = session.qids.length * 45; // 45s per question
      session.timerId = setInterval(() => {
        const el = $("examTimerText");
        if (!el || session.examSubmitted) { clearExamTimer(); return; }
        const elapsed = Math.floor((Date.now() - session.examStartAt) / 1000);
        const left = Math.max(0, session.examLimitSec - elapsed);
        const mm = String(Math.floor(left / 60)).padStart(2, "0");
        const ss = String(left % 60).padStart(2, "0");
        el.textContent = `⏱ 剩余 ${mm}:${ss}`;
        if (left === 0) submitExam();
      }, 1000);
    }

    state.view = "practice";
    updateHeaderBadges();
    renderPracticeShell();
  }

  function renderPracticeShell() {
    const host = $("viewHost");
    const kpOptions = [];
    for (const m of META.modules) {
      if (session.filterMod === "all" || session.filterMod === m.id) {
        for (const kp of m.kps) kpOptions.push(`<option value="${kp.id}" ${session.filterKp === kp.id ? "selected" : ""}>[${m.id}] ${esc(kp.short)}</option>`);
      }
    }

    host.innerHTML = `
      <section class="surface" aria-label="练习筛选与模式配置">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">
          <div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center">
            <select id="pracModSel" class="btn" aria-label="按语法专项筛选">
              <option value="all" ${session.filterMod === "all" ? "selected" : ""}>全部五大专项 (500题)</option>
              ${META.modules.map(m => `<option value="${m.id}" ${session.filterMod === m.id ? "selected" : ""}>专项${m.id} · ${esc(m.title)} (100题)</option>`).join("")}
            </select>
            <select id="pracKpSel" class="btn" aria-label="按独立考点筛选">
              <option value="all">全部独立考点</option>
              ${kpOptions.join("")}
            </select>
            <select id="pracSrcSel" class="btn" aria-label="按题目来源筛选">
              <option value="all" ${session.filterSource === "all" ? "selected" : ""}>全部题源</option>
              <option value="handout" ${session.filterSource === "handout" ? "selected" : ""}>📘 讲义原题 (18题)</option>
              <option value="authored" ${session.filterSource === "authored" ? "selected" : ""}>✍️ 自编练习题 (482题)</option>
              <option value="unseen" ${session.filterSource === "unseen" ? "selected" : ""}>✨ 仅未做新题</option>
            </select>
            <select id="pracDiffSel" class="btn" aria-label="按难度筛选">
              <option value="all" ${session.filterDiff === "all" ? "selected" : ""}>全部难度</option>
              <option value="1" ${String(session.filterDiff) === "1" ? "selected" : ""}>⭐ 基础巩固</option>
              <option value="2" ${String(session.filterDiff) === "2" ? "selected" : ""}>⭐⭐ 专升本标准</option>
              <option value="3" ${String(session.filterDiff) === "3" ? "selected" : ""}>⭐⭐⭐ 易错拔高</option>
            </select>
            <select id="pracCntSel" class="btn" aria-label="每组题量">
              ${[10, 15, 20, 50, 100, 500].map(n => `<option value="${n}" ${session.count === n ? "selected" : ""}>${n === 500 ? "全部匹配题" : n + " 题/组"}</option>`).join("")}
            </select>
            <button class="btn primary" data-action="applyPracFilter">🔄 生成练习组</button>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${session.mode === "exam" && !session.examSubmitted
              ? `<span class="kicker" id="examTimerText">⏱ 考试进行中</span><button class="btn primary" data-action="submitExam">交卷出分</button>`
              : `<button class="btn soft" data-action="startExam" data-count="20">🎲 开启20题限时模拟考</button>`}
          </div>
        </div>
      </section>

      <div id="examSummaryBanner"></div>

      <div class="trainer-layout">
        <div id="singleQuestionHost" aria-live="polite"></div>
        <aside class="surface" style="margin-bottom:0" aria-label="题号导航卡">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:14px">${esc(session.title)}（${session.qids.length} 题）</strong>
            <span style="font-size:12px;color:var(--muted)" id="sessionScoreMini"></span>
          </div>
          <div class="q-palette-grid" id="qPaletteHost"></div>
          <div style="margin-top:10px;font-size:11.5px;color:var(--muted)">
            快捷键：<code>1-4</code> 选答案 · <code>H</code> 提示 · <code>F</code> 收藏 · <code>←/→</code> 切题
          </div>
        </aside>
      </div>
    `;

    renderSingleQuestionOnly();
    renderPaletteOnly();
  }

  // Partial update: ONLY updates the single current question card & its palette button!
  function renderSingleQuestionOnly() {
    const qHost = $("singleQuestionHost");
    if (!qHost) return;
    if (!session.qids.length) {
      qHost.innerHTML = `<div class="q-stage-card" style="text-align:center;padding:38px">
        <h3>当前筛选条件下暂无匹配题目</h3>
        <p style="color:var(--muted)">请放宽题源、考点或难度筛选条件后点击「生成练习组」。</p>
      </div>`;
      return;
    }

    const qid = session.qids[session.idx];
    const q = qById.get(qid);
    if (!q) return;

    const rec = state.records[qid] || {};
    const kpInfo = findKpMeta(q.kp);
    const isExamHidden = session.mode === "exam" && !session.examSubmitted;

    // Determine whether this question has been answered in the current context
    const chosen = session.mode === "exam"
      ? session.examChoices[qid]
      : session.currentSessionAnswers?.[qid];
    const hasAnswered = chosen !== undefined;

    const diffStars = "⭐".repeat(q.diff || 2);

    qHost.innerHTML = `
      <article class="q-stage-card" data-current-qid="${q.id}">
        <div class="q-meta-row">
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
            <span class="kicker">第 ${session.idx + 1} / ${session.qids.length} 题</span>
            <span class="src-badge ${q.source}">${q.source === "handout" ? "📘 讲义原题" : "✍️ 自编练习题"}</span>
            <button class="btn sm" data-action="jumpKp" data-mod="${q.mod}" data-kp="${q.kp}" title="跳转到对应语法考点讲义">📍 ${esc(kpInfo ? kpInfo.kp.short : q.kp)}</button>
            <span style="font-size:12px" title="难度等级">${diffStars}</span>
          </div>
          <button class="btn sm ${rec.fav ? 'soft' : ''}" data-action="toggleFav" data-qid="${q.id}" aria-pressed="${!!rec.fav}">
            ${rec.fav ? "★ 已收藏" : "☆ 收藏本题"}
          </button>
        </div>

        <div class="q-stem-big">${esc(q.q)}</div>

        <div class="q-options-list" role="radiogroup" aria-label="题目选项">
          ${q.opts.map((optText, idx) => {
            let cls = "opt-btn";
            let tag = "";
            if (hasAnswered) {
              if (isExamHidden) {
                if (idx === chosen) { cls += " selected"; tag = "已选"; }
              } else {
                if (idx === q.ans) { cls += " right"; tag = "✓ 正确答案"; }
                else if (idx === chosen) { cls += " wrong"; tag = "✗ 你的选择"; }
              }
            }
            const disabledAttr = (!isExamHidden && hasAnswered) ? "disabled" : "";
            return `<button class="${cls}" data-action="chooseOpt" data-qid="${q.id}" data-idx="${idx}" ${disabledAttr}>
              <span>${esc(optText)}</span>
              ${tag ? `<span style="font-size:12px">${tag}</span>` : ""}
            </button>`;
          }).join("")}
        </div>

        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-top:16px">
          <div style="display:flex;flex-wrap:wrap;gap:7px">
            <button class="btn sm" data-action="prevQ" ${session.idx === 0 ? "disabled" : ""}>← 上一题</button>
            ${!isExamHidden ? `<button class="btn sm" data-action="toggleHint">💡 ${session.showHint ? "隐藏提示" : "查看提示 (H)"}</button>` : ""}
            ${!isExamHidden && hasAnswered ? `<button class="btn sm soft" data-action="nextStepExp">🪜 ${session.stepLevel < 3 ? `下一步解析 (${session.stepLevel}/3)` : "已展开全部解析"}</button>` : ""}
            ${!isExamHidden && hasAnswered && session.stepLevel < 3 ? `<button class="btn sm" data-action="fullStepExp">展开全解析</button>` : ""}
          </div>
          <button class="btn primary" data-action="nextQ" ${session.idx >= session.qids.length - 1 ? "disabled" : ""}>下一题 →</button>
        </div>

        ${session.showHint && !isExamHidden ? `<div class="hint-box"><strong>💡 破题线索：</strong>${esc(q.hint)}</div>` : ""}

        ${!isExamHidden && hasAnswered ? `
          <div class="steps-box">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">
              <strong style="color:${chosen === q.ans ? 'var(--green-deep)' : 'var(--danger)'}">
                ${chosen === q.ans ? "🎉 回答正确！考点掌握度已提升" : "⚠️ 回答有误，已自动加入错题间隔复习"}
              </strong>
              <span style="font-size:12px;color:var(--muted)">本题历史作答 ${rec.attempts || 1} 次 · 正确 ${rec.correct || 0} 次</span>
            </div>
            ${q.steps.slice(0, Math.max(1, session.stepLevel)).map(st => `<div class="step-line">${esc(st)}</div>`).join("")}
            ${session.stepLevel >= 3 ? `<div style="margin-top:8px;font-size:13.5px"><strong>📌 核心结论：</strong>${esc(q.exp)}</div>` : `<div class="sub-note">点击上方「🪜 下一步解析」逐层推导，或点「展开全解析」一次看全。</div>`}

            ${chosen !== q.ans ? `
              <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line-strong)">
                <div style="font-size:12.5px;font-weight:700">🏷 标记本题错因（便于错题本精准归类复盘）：</div>
                <div class="reason-tags">
                  ${META.wrongReasons.map(wr => `<button class="reason-chip ${(rec.wrongReason || q.trap) === wr.id ? 'active' : ''}" data-action="setWrongReason" data-qid="${q.id}" data-reason="${wr.id}">${esc(wr.label)}</button>`).join("")}
                </div>
              </div>
            ` : ""}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderPaletteOnly() {
    const pHost = $("qPaletteHost");
    if (!pHost) return;
    const isExamHidden = session.mode === "exam" && !session.examSubmitted;
    const ansMap = session.mode === "exam" ? session.examChoices : (session.currentSessionAnswers || {});

    let okCnt = 0, doneCnt = 0;
    pHost.innerHTML = session.qids.map((qid, i) => {
      const q = qById.get(qid);
      const ch = ansMap[qid];
      let cls = "q-num-btn";
      if (i === session.idx) cls += " cur";
      if (ch !== undefined) {
        doneCnt++;
        if (isExamHidden) cls += " done-exam";
        else if (q && ch === q.ans) { cls += " ok"; okCnt++; }
        else cls += " bad";
      }
      return `<button class="${cls}" data-action="jumpQIdx" data-qidx="${i}" aria-label="第 ${i + 1} 题">${i + 1}</button>`;
    }).join("");

    const mini = $("sessionScoreMini");
    if (mini) {
      mini.textContent = isExamHidden ? `已答 ${doneCnt}/${session.qids.length}` : `正确 ${okCnt}/${doneCnt}`;
    }
  }

  function recordQuestionOutcome(q, chosenIdx, isReviewSession = false) {
    const ok = chosenIdx === q.ans;
    const prev = state.records[q.id] || {
      mod: q.mod,
      kp: q.kp,
      attempts: 0,
      correct: 0,
      fav: false,
      wrongReason: "",
      masteredMistake: false,
      srsStage: 0,
      nextReviewAt: todayStr(0)
    };
    prev.mod = q.mod;
    prev.kp = q.kp;
    prev.attempts = (prev.attempts || 0) + 1;
    if (ok) prev.correct = (prev.correct || 0) + 1;
    prev.lastAns = chosenIdx;
    prev.lastOk = ok;
    prev.updatedAt = Date.now();

    if (!ok) {
      prev.masteredMistake = false;
      prev.srsStage = 0;
      prev.nextReviewAt = todayStr(0);
      if (!prev.wrongReason) prev.wrongReason = q.trap || "clause";
    } else {
      const nextStage = Math.min(5, (prev.srsStage || 0) + 1);
      prev.srsStage = nextStage;
      const waitDays = META.srsIntervalsDays[nextStage] ?? 7;
      prev.nextReviewAt = todayStr(waitDays);
      if (nextStage >= 5) prev.masteredMistake = true;
    }

    state.records[q.id] = prev;
    state.answers[q.id] = chosenIdx; // Keep v1 compatibility field synced!

    const log = ensureTodayLog();
    log.answered = (log.answered || 0) + 1;
    if (ok) log.correct = (log.correct || 0) + 1;
    if (isReviewSession) log.reviewed = (log.reviewed || 0) + 1;
    if (!log.kps.includes(q.kp)) log.kps.push(q.kp);

    const kpInfo = findKpMeta(q.kp);
    state.lastStudy = {
      view: "practice",
      mod: q.mod,
      kp: q.kp,
      title: kpInfo ? kpInfo.kp.short : "语法闯关",
      ts: Date.now()
    };
    save();
    updateHeaderBadges();
  }

  function submitExam() {
    if (session.examSubmitted) return;
    clearExamTimer();
    session.examSubmitted = true;
    session.stepLevel = 3;

    let right = 0;
    for (const qid of session.qids) {
      const q = qById.get(qid);
      const ch = session.examChoices[qid];
      if (q && ch !== undefined) {
        recordQuestionOutcome(q, ch, false);
        if (ch === q.ans) right++;
      }
    }
    const sec = Math.max(1, Math.floor((Date.now() - session.examStartAt) / 1000));
    const scorePct = session.qids.length ? Math.round((right / session.qids.length) * 100) : 0;
    state.examHistory.unshift({
      date: todayStr(),
      score: scorePct,
      right,
      total: session.qids.length,
      sec,
      label: `${session.qids.length}题模拟卷`
    });
    state.examHistory = state.examHistory.slice(0, 20);
    save();

    const banner = $("examSummaryBanner");
    if (banner) {
      banner.innerHTML = `<div class="surface" style="border-color:var(--green);background:var(--soft)">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px">
          <div>
            <span class="kicker">🎉 模拟考试已交卷</span>
            <h3 style="margin:5px 0 2px">卷面得分：${scorePct} 分（答对 ${right} / ${session.qids.length} 题 · 用时 ${sec} 秒）</h3>
            <div style="font-size:13px;color:var(--ink-2)">所有错题已自动归入错题本与艾宾浩斯间隔复习队列；点击右侧题号可逐题查看三步详解。</div>
          </div>
          <button class="btn soft" data-action="goView" data-target="mistakes">去错题本复盘</button>
        </div>
      </div>`;
    }
    renderSingleQuestionOnly();
    renderPaletteOnly();
    announce(`模拟考试交卷完成，得分 ${scorePct} 分`);
  }

  // ---------------------------------------------------------------------------
  // 7. View 4: Mistake Notebook, Error Reason Filter, Favorites & SRS Review
  // ---------------------------------------------------------------------------
  const mistakeFilter = { tab: "due", mod: "all", reason: "all" };

  async function renderMistakesView() {
    const host = $("viewHost");
    await ensureAllBanksIndexed();
    const today = todayStr();

    const allRecEntries = Object.entries(state.records);
    const dueIds = [], allMistakeIds = [], favIds = [];

    for (const [qid, rec] of allRecEntries) {
      if (!qById.has(qid)) continue;
      if (rec.fav) favIds.push(qid);
      const isMistake = (!rec.lastOk || (rec.attempts > rec.correct)) && !rec.masteredMistake && (rec.srsStage || 0) < 5;
      if (isMistake) {
        allMistakeIds.push(qid);
        if (!rec.nextReviewAt || rec.nextReviewAt <= today) dueIds.push(qid);
      }
    }

    let activeIds = mistakeFilter.tab === "due" ? dueIds : mistakeFilter.tab === "fav" ? favIds : allMistakeIds;
    if (mistakeFilter.mod !== "all") {
      activeIds = activeIds.filter(id => qById.get(id)?.mod === mistakeFilter.mod);
    }
    if (mistakeFilter.reason !== "all" && mistakeFilter.tab !== "fav") {
      activeIds = activeIds.filter(id => (state.records[id]?.wrongReason || qById.get(id)?.trap) === mistakeFilter.reason);
    }

    host.innerHTML = `
      <section class="surface" aria-label="错题本与间隔复习控制台">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
          <div>
            <span class="kicker">📕 艾宾浩斯间隔复习（当日 ➔ 1天 ➔ 2天 ➔ 4天 ➔ 7天 ➔ 15天斩题）</span>
            <h2 style="margin:6px 0 2px;font-size:21px">错题本、错因归类与星标收藏</h2>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="btn primary" data-action="launchMistakeSession" data-list="due" ${dueIds.length === 0 ? "disabled" : ""}>⏰ 启动今日到期复习 (${dueIds.length})</button>
            <button class="btn soft" data-action="launchMistakeSession" data-list="filtered" ${activeIds.length === 0 ? "disabled" : ""}>🔄 重练当前列表 (${activeIds.length})</button>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center">
          <button class="btn sm ${mistakeFilter.tab === 'due' ? 'primary' : ''}" data-action="setMisTab" data-tab="due">今日到期 (${dueIds.length})</button>
          <button class="btn sm ${mistakeFilter.tab === 'all' ? 'primary' : ''}" data-action="setMisTab" data-tab="all">全部错题 (${allMistakeIds.length})</button>
          <button class="btn sm ${mistakeFilter.tab === 'fav' ? 'primary' : ''}" data-action="setMisTab" data-tab="fav">★ 收藏夹 (${favIds.length})</button>
          <select id="misModSel" class="btn sm" aria-label="错题专项筛选">
            <option value="all" ${mistakeFilter.mod === "all" ? "selected" : ""}>全部专项</option>
            ${META.modules.map(m => `<option value="${m.id}" ${mistakeFilter.mod === m.id ? "selected" : ""}>专项${m.id} · ${esc(m.title)}</option>`).join("")}
          </select>
          <select id="misReasonSel" class="btn sm" aria-label="按错因分类筛选">
            <option value="all" ${mistakeFilter.reason === "all" ? "selected" : ""}>全部错因分类</option>
            ${META.wrongReasons.map(w => `<option value="${w.id}" ${mistakeFilter.reason === w.id ? "selected" : ""}>${esc(w.label)}</option>`).join("")}
          </select>
        </div>
      </section>

      ${activeIds.length === 0 ? `
        <div class="surface" style="text-align:center;padding:36px">
          <h3 style="margin:0 0 6px">当前列表干干净净 ✨</h3>
          <p style="margin:0 0 14px;color:var(--muted)">去题库挑战一组新题，答错的题目会自动按错因和艾宾浩斯复习周期收入此处。</p>
          <button class="btn primary" data-action="startSmartPractice">去刷一组语法题</button>
        </div>
      ` : activeIds.slice(0, 60).map(qid => {
        const q = qById.get(qid);
        const rec = state.records[qid] || {};
        const wr = META.wrongReasons.find(x => x.id === (rec.wrongReason || q.trap));
        return `<div class="surface" style="padding:16px 18px">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
              <span class="src-badge ${q.source}">${q.source === "handout" ? "📘 讲义原题" : "✍️ 自编题"}</span>
              ${wr && mistakeFilter.tab !== "fav" ? `<span class="kicker" style="color:var(--danger)">错因：${esc(wr.label)}</span>` : ""}
              <span style="font-size:12px;color:var(--muted)">记忆阶梯 Lv.${rec.srsStage || 0}/5 · 下次复习：${esc(rec.nextReviewAt || today)}</span>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn sm soft" data-action="practiceSingleQ" data-qid="${q.id}">单题重练</button>
              ${mistakeFilter.tab !== "fav" ? `<button class="btn sm" data-action="markMistakeMastered" data-qid="${q.id}">✓ 斩掉此错题</button>` : ""}
            </div>
          </div>
          <div style="font-weight:700;margin-bottom:6px">${esc(q.q)}</div>
          <div style="font-size:13px;color:var(--green-deep)"><strong>正确答案：</strong>${esc(q.opts[q.ans])}</div>
          <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${esc(q.exp)}</div>
        </div>`;
      }).join("")}
    `;
  }

  // ---------------------------------------------------------------------------
  // 8. View 5: Fine-Grained Study Report & Backup
  // ---------------------------------------------------------------------------
  async function renderReportView() {
    await ensureAllBanksIndexed();
    const host = $("viewHost");
    const ov = getOverallStats();

    // Error reason distribution
    const reasonCounts = {};
    for (const w of META.wrongReasons) reasonCounts[w.id] = 0;
    for (const [qid, rec] of Object.entries(state.records)) {
      if (rec.attempts > (rec.correct || 0)) {
        const r = rec.wrongReason || qById.get(qid)?.trap || "clause";
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }
    const maxR = Math.max(1, ...Object.values(reasonCounts));

    host.innerHTML = `
      <section class="surface" aria-label="整体学习诊断报告">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px">
          <div>
            <span class="kicker">📊 独立考点掌握度算法 = 刷题覆盖深度(55%) + 实测正确率(35%) + 讲义复盘(10%)</span>
            <h2 style="margin:6px 0 2px;font-size:22px">语法掌握度诊断报告</h2>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            <button class="btn sm soft" data-action="exportBackup">⬇ 导出学习记录 JSON</button>
            <label class="btn sm" style="cursor:pointer">⬆ 导入恢复<input type="file" id="importBackupInput" accept=".json" style="display:none"></label>
          </div>
        </div>

        <div class="console-stats-row" style="margin-bottom:16px">
          <div class="stat-tile"><div class="num">${ov.overallMastery}%</div><div class="lbl">总掌握度</div></div>
          <div class="stat-tile"><div class="num">${ov.totalPracticed} / 500</div><div class="lbl">题库覆盖数</div></div>
          <div class="stat-tile"><div class="num">${ov.overallAcc}%</div><div class="lbl">累计正确率</div></div>
          <div class="stat-tile"><div class="num">${state.examHistory.length} 次</div><div class="lbl">已完成模拟考</div></div>
        </div>

        <div class="two-col">
          <div class="mini-box">
            <strong>📈 五大专项掌握度对比（SVG 条形图）</strong>
            <svg viewBox="0 0 420 185" style="width:100%;height:auto;margin-top:8px" role="img" aria-label="五大专项掌握度条形图">
              ${META.modules.map((m, i) => {
                const ms = ov.modStats[i];
                const y = 14 + i * 34;
                const w = Math.max(4, Math.round(ms.mastery * 2.2));
                return `<g>
                  <text x="0" y="${y + 15}" font-size="12" font-weight="700" fill="currentColor">${m.id}. ${esc(m.title)}</text>
                  <rect x="132" y="${y + 3}" width="224" height="14" rx="7" fill="rgba(148,163,184,0.22)"/>
                  <rect x="132" y="${y + 3}" width="${w}" height="14" rx="7" fill="#059669"/>
                  <text x="366" y="${y + 15}" font-size="12" font-weight="800" fill="#059669">${ms.mastery}%</text>
                </g>`;
              }).join("")}
            </svg>
          </div>

          <div class="mini-box">
            <strong>🏷 历史错因分布统计</strong>
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:7px">
              ${META.wrongReasons.map(w => {
                const cnt = reasonCounts[w.id] || 0;
                const pct = Math.round((cnt / maxR) * 100);
                return `<div>
                  <div style="display:flex;justify-content:space-between;font-size:12px"><span>${esc(w.label)}</span><strong>${cnt} 题</strong></div>
                  <div class="bar" style="height:6px;margin-top:3px"><i style="width:${cnt ? pct : 0}%;background:${w.color}"></i></div>
                </div>`;
              }).join("")}
            </div>
          </div>
        </div>
      </section>

      <section class="surface" aria-label="18个独立考点掌握度明细表">
        <h3 style="margin:0 0 10px;font-size:16.5px">🎯 18 个独立考点精细掌握度与靶向补强表</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>所属专项</th><th>独立考点名称</th><th>已刷题数</th><th>答题正确率</th><th>综合掌握度</th><th>靶向行动</th></tr>
            </thead>
            <tbody>
              ${META.modules.map(m => m.kps.map(kp => {
                const st = getKpStats(kp.id);
                return `<tr>
                  <td>专项 ${m.id}</td>
                  <td><strong>${esc(kp.title)}</strong></td>
                  <td>${st.practiced} / ${st.totalInKp}</td>
                  <td>${st.practiced ? st.acc + "%" : "—"}</td>
                  <td><strong style="color:${st.mastery >= 75 ? 'var(--green-deep)' : st.mastery >= 40 ? 'var(--amber)' : 'var(--muted)'}">${st.mastery}%</strong></td>
                  <td>
                    <button class="btn sm soft" data-action="jumpKp" data-mod="${m.id}" data-kp="${kp.id}">讲义</button>
                    <button class="btn sm" data-action="practiceKp" data-mod="${m.id}" data-kp="${kp.id}">强化练题</button>
                  </td>
                </tr>`;
              }).join("")).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // ---------------------------------------------------------------------------
  // 9. Precision Global Search (Fixes "1 question match shows all questions"!)
  // ---------------------------------------------------------------------------
  let searchSeq = 0;

  async function runGlobalSearch(rawQuery) {
    const q = (rawQuery || "").trim().toLowerCase();
    const sHost = $("searchHost");
    const clearBtn = $("clearSearchBtn");
    if (clearBtn) clearBtn.style.display = q ? "inline-flex" : "none";
    if (!q) {
      sHost.innerHTML = "";
      return;
    }

    const seq = ++searchSeq;
    sHost.innerHTML = `<div class="search-results-panel">正在全库精准检索「${esc(rawQuery)}」…</div>`;
    await Promise.all([window.WSG_ensureAllModules(), ensureAllBanksIndexed()]);
    if (seq !== searchSeq) return;

    // 1. Match individual KP cards
    const matchedKps = [];
    for (const m of META.modules) {
      const mData = window.WSG_MODULES[m.id];
      for (const card of mData.cards) {
        const plain = card.handoutHtml.replace(/<[^>]+>/g, " ");
        const hay = `${card.title} ${card.short} ${plain} ${card.strictVsTip.tip} ${card.strictVsTip.strict} ${card.zero.concept}`.toLowerCase();
        if (hay.includes(q)) {
          matchedKps.push({ mod: m, card });
        }
      }
    }

    // 2. Match ONLY the exact matching individual questions (NEVER showing non-matching questions!)
    const matchedQs = [];
    for (const item of qById.values()) {
      const hay = `${item.q} ${item.opts.join(" ")} ${item.exp} ${item.hint} ${item.sourceLabel}`.toLowerCase();
      if (hay.includes(q)) matchedQs.push(item);
    }

    sHost.innerHTML = `
      <section class="search-results-panel" aria-label="精准搜索结果">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px">
          <strong>🔎 关键词「${esc(rawQuery)}」精准命中：${matchedKps.length} 个语法考点 · ${matchedQs.length} 道对应单题</strong>
          <button class="btn sm" data-action="clearSearch">✕ 关闭搜索结果</button>
        </div>

        ${matchedKps.length > 0 ? `
          <div style="margin-bottom:12px">
            <div style="font-size:12.5px;font-weight:750;color:var(--muted);margin-bottom:6px">📚 命中的独立语法考点（${matchedKps.length}）</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px">
              ${matchedKps.map(({ mod, card }) => `<div class="mini-box" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <div>
                  <span class="kicker">专项 ${mod.id}</span>
                  <div style="font-weight:750;margin-top:3px">${esc(card.title)}</div>
                </div>
                <button class="btn sm soft" data-action="jumpKp" data-mod="${mod.id}" data-kp="${card.kpId}">定位讲义</button>
              </div>`).join("")}
            </div>
          </div>
        ` : ""}

        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <span style="font-size:12.5px;font-weight:750;color:var(--muted)">✍️ 命中的题库单题（精准展示 ${matchedQs.length} 道，绝不混入无关题目）</span>
            ${matchedQs.length > 1 ? `<button class="btn sm primary" data-action="practiceMatchedQs">练习这 ${matchedQs.length} 道命中题</button>` : ""}
          </div>
          ${matchedQs.length === 0
            ? `<div class="mini-box" style="color:var(--muted)">题库中无包含该关键词的题目。</div>`
            : matchedQs.slice(0, 25).map(item => `<div class="mini-box" data-matched-qid="${item.id}" style="margin-bottom:8px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px">
                <div style="flex:1;min-width:220px">
                  <span class="src-badge ${item.source}">${item.source === "handout" ? "📘 讲义原题" : "✍️ 自编练习题"}</span>
                  <div style="font-weight:700;margin-top:4px">${esc(item.q)}</div>
                  <div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(item.opts.join("  "))}</div>
                </div>
                <button class="btn sm primary" data-action="practiceSingleQ" data-qid="${item.id}">单题作答</button>
              </div>`).join("")}
          ${matchedQs.length > 25 ? `<div class="sub-note">共命中 ${matchedQs.length} 道题，已展示前 25 道；可点击右上角「练习这 ${matchedQs.length} 道命中题」进入单题模式逐一作答。</div>` : ""}
        </div>
      </section>
    `;
    sHost._lastMatchedQids = matchedQs.map(x => x.id);
  }

  // ---------------------------------------------------------------------------
  // 10. 3-Mode Print Engine (Full Handout / Blank Exam Paper / Answer Key)
  // ---------------------------------------------------------------------------
  let lastPrintPaperQids = [];

  function openPrintModal() {
    const mHost = $("modalHost");
    const countLabel = session.qids && session.qids.length ? `当前练习组（${session.qids.length} 题）` : "均衡随机抽取 20 题标准卷";
    mHost.innerHTML = `
      <div class="modal-backdrop" data-action="closeModalBg">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="printDialogTitle">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 id="printDialogTitle" style="margin:0;font-size:18px">🖨 打印与纸质资料导出中心</h3>
            <button class="btn sm" data-action="closeModal" aria-label="关闭弹窗">✕</button>
          </div>
          <p style="margin:0 0 14px;font-size:13.5px;color:var(--muted)">纯前端排版直出 A4 纸质文档（在系统打印窗口选择「另存为 PDF」即可保存高清电子版）：</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn primary" style="justify-content:flex-start;padding:12px 16px" data-action="execPrint" data-pmode="handout">
              📄 1. 打印完整五大专项语法讲义（含 574 处填空答案与严格规则校对）
            </button>
            <button class="btn soft" style="justify-content:flex-start;padding:12px 16px" data-action="execPrint" data-pmode="exam-blank">
              📝 2. 打印无答案测试卷（基于${esc(countLabel)}，隐藏全部答案与提示）
            </button>
            <button class="btn" style="justify-content:flex-start;padding:12px 16px" data-action="execPrint" data-pmode="exam-key">
              ✅ 3. 打印配套答案速查表与三步详解卷（与上一份测试卷一一对应）
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async function executePrint(pmode) {
    const pSheet = $("printSheet");
    $("modalHost").innerHTML = "";

    if (pmode === "handout") {
      await window.WSG_ensureAllModules();
      pSheet.innerHTML = `
        <div class="print-header">
          <h1>辽宁专升本英语 · 五大核心语法专项讲义全解</h1>
          <div>包含全部 574 处讲义核心填空、表格、应试口诀与严格语法边界校对 · 日期：${todayStr()}</div>
        </div>
        ${META.modules.map(m => {
          const md = window.WSG_MODULES[m.id];
          return `<section style="margin-bottom:20px">
            <h2>专项 ${m.id}：${esc(m.title)}（${esc(m.en)}）</h2>
            ${md.cards.map(c => `<div class="print-card">
              ${c.handoutHtml}
              <div style="margin-top:8px;font-size:10pt;border-top:1px dashed #999;padding-top:6px">
                <strong>【应试口诀】</strong>${esc(c.strictVsTip.tip)}<br>
                <strong>【严格语法校对】</strong>${esc(c.strictVsTip.strict)}
              </div>
            </div>`).join("")}
          </section>`;
        }).join("")}
      `;
    } else {
      await ensureAllBanksIndexed();
      if (session.qids && session.qids.length) {
        lastPrintPaperQids = [...session.qids];
      } else if (!lastPrintPaperQids.length) {
        // Pick 4 balanced questions from each of the 5 modules = 20 questions
        lastPrintPaperQids = [];
        for (const mid of ["1", "2", "3", "4", "5"]) {
          const arr = [...(window.WSG_BANKS[mid] || [])].sort(() => Math.random() - 0.5).slice(0, 4);
          lastPrintPaperQids.push(...arr.map(x => x.id));
        }
      }
      const paperQs = lastPrintPaperQids.map(id => qById.get(id)).filter(Boolean);

      if (pmode === "exam-blank") {
        pSheet.innerHTML = `
          <div class="print-header">
            <h1>辽宁专升本英语 · 语法专项测试卷（无答案版）</h1>
            <div>总题数：${paperQs.length} 题　｜　姓名：__________　｜　日期：${todayStr()}　｜　得分：______</div>
          </div>
          ${paperQs.map((q, idx) => `<div class="print-q">
            <div><strong>${idx + 1}.</strong> [${esc(q.sourceLabel)}] ${esc(q.q.replace(/^\d+\.\s*（[^）]+）/, ""))}</div>
            <div class="print-opts">${q.opts.map(o => `<span>${esc(o)}</span>`).join("")}</div>
          </div>`).join("")}
        `;
      } else {
        pSheet.innerHTML = `
          <div class="print-header">
            <h1>辽宁专升本英语 · 语法测试卷参考答案与分步解析</h1>
            <div>配套题数：${paperQs.length} 题　｜　生成日期：${todayStr()}</div>
          </div>
          <div class="print-card">
            <strong>一、快速对答案表：</strong><br>
            ${paperQs.map((q, idx) => `<span style="display:inline-block;min-width:72px;margin:3px 6px 3px 0">${idx + 1}. <strong>${chrFromIdx(q.ans)}</strong></span>`).join("")}
          </div>
          <h3>二、逐题三步详解</h3>
          ${paperQs.map((q, idx) => `<div class="print-q">
            <div><strong>${idx + 1}. 正确答案：${esc(q.opts[q.ans])}</strong>（考点：${esc(findKpMeta(q.kp)?.kp.title || q.kp)}）</div>
            <div style="font-size:10pt;margin-top:3px">${q.steps.map(s => esc(s)).join(" ")}</div>
            <div style="font-size:10pt;margin-top:2px"><strong>总结：</strong>${esc(q.exp)}</div>
          </div>`).join("")}
        `;
      }
    }

    document.body.dataset.printMode = pmode;
    setTimeout(() => window.print(), 60);
  }

  function chrFromIdx(i) {
    return String.fromCharCode(65 + Number(i || 0));
  }

  // ---------------------------------------------------------------------------
  // 11. Router & Global Event Delegation
  // ---------------------------------------------------------------------------
  async function switchView(viewName, extra = {}) {
    clearExamTimer();
    state.view = viewName;
    if (extra.mod) state.activeMod = extra.mod;
    save();
    updateHeaderBadges();

    if (viewName === "dashboard") {
      renderDashboard();
    } else if (viewName === "learn") {
      await renderLearnView(extra.kp || "");
    } else if (viewName === "practice") {
      if (!session.qids.length) {
        await startSession({ mode: "practice", title: "智能综合闯关", count: 15 });
      } else {
        renderPracticeShell();
      }
    } else if (viewName === "mistakes") {
      await renderMistakesView();
    } else if (viewName === "report") {
      await renderReportView();
    }
    if (!extra.kp) window.scrollTo({ top: 0, behavior: prefersNoMotion() ? "auto" : "smooth" });
  }

  document.addEventListener("click", async e => {
    // 1. Cloze pill click in mask mode
    const clozeEl = e.target.closest(".cloze");
    if (clozeEl && state.mask) {
      clozeEl.classList.toggle("revealed");
      return;
    }

    // 2. Interactive SVG Diagram switchers
    const diagTrigger = e.target.closest("[data-diag]");
    if (diagTrigger) {
      const did = diagTrigger.dataset.diag;
      diagramStates[did] = Number(diagTrigger.dataset.diagIdx || 0);
      const root = diagTrigger.closest("[data-diag-root]")?.parentElement;
      renderDiagramInto(did, root);
      return;
    }

    // 3. Top / Mobile View Navigation
    const navBtn = e.target.closest("[data-view]");
    if (navBtn) {
      await switchView(navBtn.dataset.view);
      return;
    }

    // 4. Data-action handlers
    const actEl = e.target.closest("[data-action]");
    if (!actEl) return;
    const act = actEl.dataset.action;

    switch (act) {
      case "goView":
        await switchView(actEl.dataset.target, { mod: actEl.dataset.mod });
        break;

      case "continueLast": {
        const ls = state.lastStudy || {};
        if (ls.view === "practice") await switchView("practice");
        else await switchView("learn", { mod: ls.mod || "1", kp: ls.kp || "" });
        break;
      }

      case "openModLearn":
        await switchView("learn", { mod: actEl.dataset.mod });
        break;

      case "selectLearnMod":
        state.activeMod = actEl.dataset.mod;
        save();
        await renderLearnView();
        break;

      case "jumpKp": {
        const mid = actEl.dataset.mod || "1";
        const kpid = actEl.dataset.kp || "";
        const kpInfo = findKpMeta(kpid);
        state.lastStudy = { view: "learn", mod: mid, kp: kpid, title: kpInfo ? kpInfo.kp.short : "语法讲义", ts: Date.now() };
        ensureTodayLog().kps.push(kpid);
        save();
        await switchView("learn", { mod: mid, kp: kpid });
        break;
      }

      case "toggleKpZero": {
        const kpid = actEl.dataset.kp;
        const panel = $("zero-" + kpid);
        if (panel) {
          const isHidden = panel.classList.toggle("collapsed");
          state.expandedZero[kpid] = !isHidden;
          actEl.setAttribute("aria-expanded", String(!isHidden));
          actEl.classList.toggle("soft", !isHidden);
          actEl.textContent = !isHidden ? "🌱 收起零基础精讲" : "🌱 零基础六步精讲";
          save();
        }
        break;
      }

      case "revealCardCloze": {
        const kpid = actEl.dataset.kp;
        if (!state.mask) {
          state.mask = true;
          updateHeaderBadges();
        }
        const wrapper = document.getElementById(kpid);
        if (wrapper) {
          const list = [...wrapper.querySelectorAll(".cloze")];
          const anyHidden = list.some(x => !x.classList.contains("revealed"));
          list.forEach(x => x.classList.toggle("revealed", anyHidden));
        }
        break;
      }

      case "revealAllPageCloze": {
        const list = [...document.querySelectorAll("#viewHost .cloze")];
        const anyHidden = list.some(x => !x.classList.contains("revealed"));
        list.forEach(x => x.classList.toggle("revealed", anyHidden));
        break;
      }

      case "toggleKpManual": {
        const kpid = actEl.dataset.kp;
        state.kpManual[kpid] = !state.kpManual[kpid];
        if (state.kpManual[kpid]) {
          const log = ensureTodayLog();
          if (!log.kps.includes(kpid)) log.kps.push(kpid);
        }
        save();
        await renderLearnView();
        updateHeaderBadges();
        break;
      }

      case "openModQuiz": {
        const mid = actEl.dataset.mod;
        session.currentSessionAnswers = {};
        await startSession({ mode: "practice", title: `专项 ${mid} 强化训练`, filterMod: mid, filterKp: "all", filterSource: "all", count: 100 });
        break;
      }

      case "practiceKp": {
        const mid = actEl.dataset.mod;
        const kpid = actEl.dataset.kp;
        const info = findKpMeta(kpid);
        session.currentSessionAnswers = {};
        await startSession({ mode: "practice", title: info ? info.kp.short : "考点专练", filterMod: mid, filterKp: kpid, filterSource: "all", count: 35 });
        break;
      }

      case "startSmartPractice":
        session.currentSessionAnswers = {};
        await startSession({ mode: "practice", title: "智能每日闯关", filterMod: "all", filterKp: "all", filterSource: "unseen", count: state.dailyGoal || 15 });
        if (!session.qids.length) {
          await startSession({ mode: "practice", title: "全库综合巩固", filterMod: "all", filterKp: "all", filterSource: "all", count: 15 });
        }
        break;

      case "practiceHandoutOnly":
      case " practiceHandoutOnly":
        session.currentSessionAnswers = {};
        await startSession({ mode: "practice", title: "18道讲义原题精练", filterMod: "all", filterKp: "all", filterSource: "handout", count: 18 });
        break;

      case "startExam": {
        const cnt = Number(actEl.dataset.count || 20);
        session.currentSessionAnswers = {};
        await startSession({ mode: "exam", title: `${cnt}题全真模拟考`, filterMod: "all", filterKp: "all", filterSource: "all", count: cnt });
        break;
      }

      case "applyPracFilter": {
        session.currentSessionAnswers = {};
        await startSession({
          mode: "practice",
          title: "自定义筛选训练",
          filterMod: $("pracModSel")?.value || "all",
          filterKp: $("pracKpSel")?.value || "all",
          filterSource: $("pracSrcSel")?.value || "all",
          filterDiff: $("pracDiffSel")?.value || "all",
          count: Number($("pracCntSel")?.value || 15)
        });
        break;
      }

      case "chooseOpt": {
        const qid = actEl.dataset.qid;
        const idx = Number(actEl.dataset.idx);
        const q = qById.get(qid);
        if (!q) break;

        if (session.mode === "exam" && !session.examSubmitted) {
          session.examChoices[qid] = idx;
          renderSingleQuestionOnly();
          renderPaletteOnly();
          break;
        }

        if (!session.currentSessionAnswers) session.currentSessionAnswers = {};
        if (session.currentSessionAnswers[qid] !== undefined) break;
        session.currentSessionAnswers[qid] = idx;
        session.stepLevel = 1; // Start with Step 1 revealed for active learning!
        recordQuestionOutcome(q, idx, session.mode === "review");

        renderSingleQuestionOnly();
        renderPaletteOnly();
        const cardEl = document.querySelector("#singleQuestionHost .q-stage-card");
        wsgAnimate(cardEl, { scale: [0.99, 1], duration: 200 });
        announce(idx === q.ans ? "回答正确" : "回答错误，已展开第一步解析");
        break;
      }

      case "toggleHint":
        session.showHint = !session.showHint;
        renderSingleQuestionOnly();
        break;

      case "nextStepExp":
        session.stepLevel = Math.min(3, (session.stepLevel || 1) + 1);
        renderSingleQuestionOnly();
        break;

      case "fullStepExp":
        session.stepLevel = 3;
        renderSingleQuestionOnly();
        break;

      case "prevQ":
        if (session.idx > 0) {
          session.idx--;
          session.showHint = false;
          session.stepLevel = session.examSubmitted ? 3 : 1;
          renderSingleQuestionOnly();
          renderPaletteOnly();
        }
        break;

      case "nextQ":
        if (session.idx < session.qids.length - 1) {
          session.idx++;
          session.showHint = false;
          session.stepLevel = session.examSubmitted ? 3 : 1;
          renderSingleQuestionOnly();
          renderPaletteOnly();
        }
        break;

      case "jumpQIdx":
        session.idx = Number(actEl.dataset.qidx || 0);
        session.showHint = false;
        session.stepLevel = session.examSubmitted ? 3 : 1;
        renderSingleQuestionOnly();
        renderPaletteOnly();
        break;

      case "submitExam":
        submitExam();
        break;

      case "toggleFav": {
        const qid = actEl.dataset.qid;
        const q = qById.get(qid);
        if (!state.records[qid]) {
          state.records[qid] = { mod: q?.mod || "1", kp: q?.kp || "kp-1-1", attempts: 0, correct: 0, fav: true, srsStage: 0 };
        } else {
          state.records[qid].fav = !state.records[qid].fav;
        }
        save();
        renderSingleQuestionOnly();
        break;
      }

      case "setWrongReason": {
        const qid = actEl.dataset.qid;
        if (state.records[qid]) {
          state.records[qid].wrongReason = actEl.dataset.reason;
          save();
          renderSingleQuestionOnly();
        }
        break;
      }

      case "startDueReview": {
        await ensureAllBanksIndexed();
        const today = todayStr();
        const due = Object.entries(state.records)
          .filter(([qid, r]) => qById.has(qid) && (!r.lastOk || r.attempts > r.correct) && !r.masteredMistake && (r.srsStage || 0) < 5 && (!r.nextReviewAt || r.nextReviewAt <= today))
          .map(([qid]) => qid);
        if (!due.length) {
          await switchView("mistakes");
        } else {
          session.currentSessionAnswers = {};
          await startSession({ mode: "review", title: "今日到期错题间隔复习", customQids: due });
        }
        break;
      }

      case "setMisTab":
        mistakeFilter.tab = actEl.dataset.tab;
        await renderMistakesView();
        break;

      case "launchMistakeSession": {
        await ensureAllBanksIndexed();
        const today = todayStr();
        let ids = Object.entries(state.records).filter(([qid, r]) => {
          if (!qById.has(qid)) return false;
          if (actEl.dataset.list === "due") {
            return (!r.lastOk || r.attempts > r.correct) && !r.masteredMistake && (r.srsStage || 0) < 5 && (!r.nextReviewAt || r.nextReviewAt <= today);
          }
          if (mistakeFilter.tab === "fav") return !!r.fav;
          const isM = (!r.lastOk || r.attempts > r.correct) && !r.masteredMistake && (r.srsStage || 0) < 5;
          if (!isM) return false;
          if (mistakeFilter.mod !== "all" && qById.get(qid)?.mod !== mistakeFilter.mod) return false;
          if (mistakeFilter.reason !== "all" && (r.wrongReason || qById.get(qid)?.trap) !== mistakeFilter.reason) return false;
          return true;
        }).map(([qid]) => qid);
        if (ids.length) {
          session.currentSessionAnswers = {};
          await startSession({ mode: "review", title: "错题靶向重练", customQids: ids });
        }
        break;
      }

      case "practiceSingleQ": {
        await ensureAllBanksIndexed();
        const qid = actEl.dataset.qid;
        $("globalSearchInput").value = "";
        $("searchHost").innerHTML = "";
        $("clearSearchBtn").style.display = "none";
        session.currentSessionAnswers = {};
        await startSession({ mode: "practice", title: "单题精练", customQids: [qid] });
        break;
      }

      case "practiceMatchedQs": {
        const qids = $("searchHost")._lastMatchedQids || [];
        if (qids.length) {
          $("globalSearchInput").value = "";
          $("searchHost").innerHTML = "";
          $("clearSearchBtn").style.display = "none";
          session.currentSessionAnswers = {};
          await startSession({ mode: "practice", title: `搜索命中专练`, customQids: qids });
        }
        break;
      }

      case "markMistakeMastered": {
        const qid = actEl.dataset.qid;
        if (state.records[qid]) {
          state.records[qid].masteredMistake = true;
          state.records[qid].srsStage = 5;
          save();
          updateHeaderBadges();
          await renderMistakesView();
        }
        break;
      }

      case "switchConsoleDiag":
        consoleDiagramId = actEl.dataset.diagId;
        renderDashboard();
        break;

      case "openPrintModal":
        openPrintModal();
        break;

      case "closeModal":
        $("modalHost").innerHTML = "";
        break;

      case "closeModalBg":
        if (e.target === actEl) $("modalHost").innerHTML = "";
        break;

      case "execPrint":
        await executePrint(actEl.dataset.pmode);
        break;

      case "clearSearch":
        $("globalSearchInput").value = "";
        await runGlobalSearch("");
        break;

      case "exportBackup": {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `wordsteps-grammar-backup-${todayStr()}.json`;
        a.click();
        break;
      }
    }
  });

  // Change listeners for dynamic dropdowns & backup import
  document.addEventListener("change", async e => {
    if (e.target.id === "pracModSel") {
      session.filterMod = e.target.value;
      session.filterKp = "all";
      renderPracticeShell();
    } else if (e.target.id === "misModSel") {
      mistakeFilter.mod = e.target.value;
      await renderMistakesView();
    } else if (e.target.id === "misReasonSel") {
      mistakeFilter.reason = e.target.value;
      await renderMistakesView();
    } else if (e.target.id === "importBackupInput" && e.target.files?.[0]) {
      const txt = await e.target.files[0].text();
      try {
        const parsed = JSON.parse(txt);
        Object.assign(state, parsed);
        save();
        updateHeaderBadges();
        await renderReportView();
        announce("学习记录备份已成功导入");
      } catch (_) {}
    }
  });

  // Header quick buttons & palette dots
  $("beginnerToggle")?.addEventListener("click", async () => {
    state.beginnerMode = !state.beginnerMode;
    save();
    updateHeaderBadges();
    if (state.view === "learn") await renderLearnView();
    else await switchView("learn", { mod: state.activeMod || "1" });
  });

  $("maskToggle")?.addEventListener("click", async () => {
    state.mask = !state.mask;
    if (!state.mask) document.querySelectorAll(".cloze.revealed").forEach(el => el.classList.remove("revealed"));
    save();
    updateHeaderBadges();
    if (state.view === "learn") await renderLearnView();
    else if (state.mask) await switchView("learn", { mod: state.activeMod || "1" });
  });

  $("printMenuBtn")?.addEventListener("click", openPrintModal);

  $("motionToggle")?.addEventListener("click", () => {
    state.reduceMotion = !state.reduceMotion;
    save();
    updateHeaderBadges();
  });

  $("themeBtn")?.addEventListener("click", () => {
    state.dark = !state.dark;
    save();
    updateHeaderBadges();
  });

  document.querySelectorAll(".dot").forEach(dot => {
    dot.addEventListener("click", () => {
      state.palette = dot.dataset.pal;
      save();
      updateHeaderBadges();
    });
  });

  $("globalSearchInput")?.addEventListener("input", e => runGlobalSearch(e.target.value));
  $("clearSearchBtn")?.addEventListener("click", () => {
    $("globalSearchInput").value = "";
    runGlobalSearch("");
  });

  // Keyboard Accessibility & Trainer Shortcuts
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && $("modalHost")?.innerHTML) {
      $("modalHost").innerHTML = "";
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("cloze") && state.mask) {
      e.preventDefault();
      e.target.classList.toggle("revealed");
      return;
    }
    const tag = (e.target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (state.view === "practice" && session.qids.length) {
      if (["1", "2", "3", "4"].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const btn = document.querySelector(`#singleQuestionHost .opt-btn[data-idx="${idx}"]`);
        if (btn && !btn.disabled) btn.click();
      } else if (e.key.toLowerCase() === "h") {
        document.querySelector('[data-action="toggleHint"]')?.click();
      } else if (e.key.toLowerCase() === "f") {
        document.querySelector('[data-action="toggleFav"]')?.click();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        const nxt = document.querySelector('[data-action="nextQ"]');
        if (nxt && !nxt.disabled) nxt.click();
      } else if (e.key === "ArrowLeft") {
        const prv = document.querySelector('[data-action="prevQ"]');
        if (prv && !prv.disabled) prv.click();
      }
    }
  });

  // Startup initialization + idle background indexing for legacy answers migration
  updateHeaderBadges();
  switchView(state.view);

  setTimeout(() => {
    ensureAllBanksIndexed().then(() => {
      updateHeaderBadges();
      if (state.view === "dashboard") renderDashboard();
    }).catch(() => {});
  }, 260);
})();
