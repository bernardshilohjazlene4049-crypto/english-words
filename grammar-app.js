// 辽宁专升本英语语法学习系统 V3.0 · 全缺陷修复、专项零、6类实训、3000词联动与离线支持 (grammar-app.js)
(() => {
  "use strict";

  const GRAMMAR_STORE_KEY = "wordsteps-grammar-v1";
  const VOCAB_STORE_KEY = "wordsteps-v1";
  const META = window.WSG_META;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const shuffle = arr => (window.WSG_shuffle ? window.WSG_shuffle(arr) : [...arr]);

  function todayStr(offsetDays = 0) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  function prefersNoMotion() {
    return !!(state.reduceMotion || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  }

  function wsgAnimate(targets, props) {
    if (prefersNoMotion() || !window.anime || typeof window.anime.animate !== "function" || !targets) return;
    try { window.anime.animate(targets, props); } catch (_) {}
  }

  function announce(msg) {
    const el = $("a11yAnnouncer");
    if (el) el.textContent = msg;
  }

  // ---------------------------------------------------------------------------
  // 1. Versioned State Migration (v1 -> v2 -> v3) & Backup Schema Validator
  // ---------------------------------------------------------------------------
  function loadRawState() {
    try {
      return JSON.parse(localStorage.getItem(GRAMMAR_STORE_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function migrateStateToV3(input) {
    const base = {
      schemaVersion: 3,
      tab: "all",
      mask: false,
      dark: false,
      palette: "emerald",
      mastered: [],
      answers: {},
      view: "dashboard",
      activeMod: "1",
      beginnerMode: false,
      reduceMotion: false,
      dailyGoal: 15,
      records: {},
      kpManual: {},
      expandedZero: {},
      completedDrills: {},
      activeExam: null,
      lastStudy: { view: "learn", mod: "1", kp: "kp-1-1", title: "10大时态与时点时段", ts: Date.now() },
      dailyLog: {},
      examHistory: []
    };
    if (!input || typeof input !== "object" || Array.isArray(input)) return base;
    const merged = Object.assign(base, input);
    merged.schemaVersion = 3;
    if (!merged.records || typeof merged.records !== "object" || Array.isArray(merged.records)) merged.records = {};
    if (!merged.answers || typeof merged.answers !== "object" || Array.isArray(merged.answers)) merged.answers = {};
    if (!Array.isArray(merged.mastered)) merged.mastered = [];
    if (!Array.isArray(merged.examHistory)) merged.examHistory = [];
    if (!merged.completedDrills || typeof merged.completedDrills !== "object") merged.completedDrills = {};

    // Clean any corrupted v2 favorite-only records that had attempts === 0 without unansweredCount
    for (const rec of Object.values(merged.records)) {
      if (rec && typeof rec === "object") {
        if ((rec.attempts || 0) === 0 && !(rec.unansweredCount > 0)) {
          delete rec.lastOk;
        }
      }
    }
    if (!["dashboard", "learn", "drills", "practice", "mistakes", "report"].includes(merged.view)) {
      merged.view = "dashboard";
    }
    return merged;
  }

  function validateBackupPayload(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return { ok: false, error: "备份文件根结构必须是 JSON 对象。" };
    }
    const hasKnownKey = ["records", "answers", "mastered", "kpManual", "examHistory", "schemaVersion"].some(k => k in obj);
    if (!hasKnownKey) {
      return { ok: false, error: "未识别的备份文件：缺少语法学习记录字段。" };
    }
    if (obj.records !== undefined && (typeof obj.records !== "object" || Array.isArray(obj.records) || obj.records === null)) {
      return { ok: false, error: "备份文件中的 records 字段格式损坏。" };
    }
    if (obj.records) {
      for (const [k, r] of Object.entries(obj.records)) {
        if (!/^q\d+$/.test(k) || !r || typeof r !== "object") {
          return { ok: false, error: `题目记录 ${k} 数据结构异常。` };
        }
        if (r.attempts !== undefined && (typeof r.attempts !== "number" || r.attempts < 0)) {
          return { ok: false, error: `题目记录 ${k} 的作答次数无效。` };
        }
      }
    }
    if (obj.examHistory !== undefined && !Array.isArray(obj.examHistory)) {
      return { ok: false, error: "examHistory 字段必须是数组。" };
    }
    return { ok: true };
  }

  let state = migrateStateToV3(loadRawState());

  function save() {
    try {
      localStorage.setItem(GRAMMAR_STORE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function ensureTodayLog() {
    const t = todayStr();
    if (!state.dailyLog[t]) state.dailyLog[t] = { answered: 0, correct: 0, reviewed: 0, kps: [] };
    return state.dailyLog[t];
  }

  // Canonical mistake check: MUST have attempts > 0 with error OR unanswered exam record!
  function isMistakeRecord(rec) {
    if (!rec || rec.masteredMistake || (rec.srsStage || 0) >= 5) return false;
    const hasWrongAttempt = (rec.attempts || 0) > 0 && (rec.lastOk === false || (rec.attempts || 0) > (rec.correct || 0));
    const hasUnansweredExam = (rec.unansweredCount || 0) > 0 && rec.lastOk !== true;
    return hasWrongAttempt || hasUnansweredExam;
  }

  // ---------------------------------------------------------------------------
  // 2. Question Indexing & Load-Error Recovery UI
  // ---------------------------------------------------------------------------
  const qById = new Map();
  let allBanksLoaded = false;

  function indexBankQuestions(modId) {
    const arr = window.WSG_BANKS[modId] || [];
    let migrated = false;
    for (const q of arr) {
      qById.set(q.id, q);
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
          lastStatus: ok ? "right" : "wrong",
          fav: false,
          wrongReason: ok ? "" : (q.trap || "clause"),
          masteredMistake: false,
          srsStage: ok ? 1 : 0,
          lastSrsPromoteDate: ok ? todayStr(0) : "",
          nextReviewAt: ok ? todayStr(1) : todayStr(0),
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

  function renderLoadError(host, err, retryAction, extraAttrs = "") {
    if (!host) return;
    host.innerHTML = `<div class="load-err-card" role="alert">
      <h3 style="margin:0 0 6px;color:var(--danger)">⚠️ 学习资源加载未完成</h3>
      <p style="margin:0 0 14px;font-size:13.5px;color:var(--muted)">${esc(err?.message || "网络连接波动或静态脚本加载超时，请重试。")}</p>
      <button class="btn primary" data-action="${retryAction}" ${extraAttrs}>🔄 立即重试加载</button>
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // 3. 3,000-Word Shared Dictionary Lookup, Pronunciation & Personal Wordbook
  // ---------------------------------------------------------------------------
  let vocabIndex = null;
  const IRREGULAR_LEMMAS = {
    went: "go", gone: "go", saw: "see", seen: "see", took: "take", taken: "take",
    wrote: "write", written: "write", spoke: "speak", spoken: "speak", broke: "break", broken: "break",
    bought: "buy", brought: "bring", taught: "teach", caught: "catch", thought: "think", fought: "fight",
    felt: "feel", kept: "keep", left: "leave", lost: "lose", paid: "pay", said: "say",
    sold: "sell", sent: "send", spent: "spend", stood: "stand", told: "tell", won: "win",
    wore: "wear", worn: "wear", held: "hold", built: "build", found: "find", knew: "know", known: "know",
    grew: "grow", grown: "grow", flew: "fly", flown: "fly", drew: "draw", drawn: "draw",
    chose: "choose", chosen: "choose", drove: "drive", driven: "drive", ate: "eat", eaten: "eat",
    fell: "fall", fallen: "fall", gave: "give", given: "give", forgot: "forget", forgotten: "forget",
    hid: "hide", hidden: "hide", lay: "lie", lain: "lie", laid: "lay", rose: "rise", risen: "rise",
    sang: "sing", sung: "sing", sat: "sit", slept: "sleep", swam: "swim", threw: "throw", thrown: "throw",
    woke: "wake", woken: "wake", meant: "mean", met: "meet", led: "lead", read: "read",
    ran: "run", begun: "begin", began: "begin", drank: "drink", drunk: "drink",
    children: "child", men: "man", women: "woman", mice: "mouse", teeth: "tooth", feet: "foot",
    better: "good", best: "good", worse: "bad", worst: "bad", further: "far", farther: "far"
  };

  function readVocabStore() {
    try {
      return JSON.parse(localStorage.getItem(VOCAB_STORE_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  async function lookupEnglishWord(rawWord) {
    const clean = String(rawWord || "").replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
    const low = clean.toLowerCase();
    if (!low) return null;

    await window.WSG_ensureVocab().catch(() => {});
    if (!vocabIndex && Array.isArray(window.WS_VOCAB_LIST)) {
      vocabIndex = new Map();
      for (const item of window.WS_VOCAB_LIST) {
        vocabIndex.set(item.w.toLowerCase(), item);
      }
    }

    const vStore = readVocabStore();
    if (Array.isArray(vStore.custom)) {
      for (const cw of vStore.custom) {
        if (cw.word && cw.word.toLowerCase() === low) {
          return { id: cw.id, w: cw.word, cn: cw.cn, ipa: cw.ipa || "", ex: cw.example || "", matchedFrom: clean, inCustom: true };
        }
      }
    }

    const candidates = [low];
    if (IRREGULAR_LEMMAS[low]) candidates.push(IRREGULAR_LEMMAS[low]);
    if (low.endsWith("ies") && low.length > 4) candidates.push(low.slice(0, -3) + "y");
    if (low.endsWith("ied") && low.length > 4) candidates.push(low.slice(0, -3) + "y");
    if (low.endsWith("es") && low.length > 4) candidates.push(low.slice(0, -2), low.slice(0, -1));
    if (low.endsWith("s") && low.length > 3) candidates.push(low.slice(0, -1));
    if (low.endsWith("ing") && low.length > 5) {
      const stem = low.slice(0, -3);
      candidates.push(stem, stem + "e");
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) candidates.push(stem.slice(0, -1));
    }
    if (low.endsWith("ed") && low.length > 4) {
      const stem = low.slice(0, -2);
      candidates.push(stem, low.slice(0, -1));
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) candidates.push(stem.slice(0, -1));
    }
    if (low.endsWith("ly") && low.length > 4) candidates.push(low.slice(0, -2));
    if (low.endsWith("er") && low.length > 4) candidates.push(low.slice(0, -2), low.slice(0, -1));
    if (low.endsWith("est") && low.length > 5) candidates.push(low.slice(0, -3), low.slice(0, -2));

    if (vocabIndex) {
      for (const cand of candidates) {
        if (vocabIndex.has(cand)) {
          return Object.assign({}, vocabIndex.get(cand), { matchedFrom: clean });
        }
      }
    }
    return { id: null, w: low, cn: "", ipa: "", ex: "", matchedFrom: clean };
  }

  function speakWord(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const vStore = readVocabStore();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = vStore.accent || "en-GB";
      u.rate = Number(vStore.rate) || 1;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  function addWordToPersonalVocab(entry, customCn = "") {
    const vStore = readVocabStore();
    if (!vStore.records || typeof vStore.records !== "object") vStore.records = {};
    if (!Array.isArray(vStore.books)) vStore.books = [{ id: "core", name: "辽宁专升本核心词汇" }];
    if (!Array.isArray(vStore.custom)) vStore.custom = [];
    if (!vStore.groupOverrides || typeof vStore.groupOverrides !== "object") vStore.groupOverrides = {};

    const grpId = "grp-grammar-vocab";
    if (!vStore.books.some(b => b.id === grpId)) {
      vStore.books.splice(1, 0, { id: grpId, name: "语法题生词本", customGroup: true });
    }
    if (!vStore.groupOverrides[grpId]) {
      vStore.groupOverrides[grpId] = { add: [], remove: [] };
    }

    let wordId = entry.id;
    if (!wordId) {
      const exist = vStore.custom.find(x => String(x.word).toLowerCase() === entry.w.toLowerCase());
      if (exist) {
        wordId = exist.id;
      } else {
        wordId = "gvoc-" + Date.now();
        vStore.custom.push({
          id: wordId,
          word: entry.w,
          cn: (customCn || "语法练习积累生词").trim(),
          ipa: entry.ipa || "",
          example: entry.ex || "",
          translation: "",
          image: "",
          book: grpId
        });
      }
    }

    if (!vStore.groupOverrides[grpId].add.includes(wordId)) {
      vStore.groupOverrides[grpId].add.push(wordId);
    }
    vStore.groupOverrides[grpId].remove = (vStore.groupOverrides[grpId].remove || []).filter(x => x !== wordId);

    const prevRec = vStore.records[wordId] || { level: 0, seen: 0, wrong: 0, correct: 0, fav: false, master: false, due: null };
    prevRec.fav = true;
    vStore.records[wordId] = prevRec;

    try {
      localStorage.setItem(VOCAB_STORE_KEY, JSON.stringify(vStore));
      return { ok: true, wordId };
    } catch (_) {
      return { ok: false };
    }
  }

  function isWordInGrammarBook(entry) {
    const vStore = readVocabStore();
    const ov = vStore.groupOverrides?.["grp-grammar-vocab"];
    if (entry.id && ov && Array.isArray(ov.add) && ov.add.includes(entry.id)) return true;
    if (Array.isArray(vStore.custom) && vStore.custom.some(x => String(x.word).toLowerCase() === entry.w.toLowerCase() && x.book === "grp-grammar-vocab")) return true;
    if (entry.id && vStore.records?.[entry.id]?.fav) return true;
    return false;
  }

  function tokenizeEnglishText(rawText, allowLookup = true) {
    const safe = esc(rawText);
    if (!allowLookup) return safe;
    return safe.replace(/\b([A-Za-z][A-Za-z'-]{1,24})\b/g, (m, w) => `<span class="w-tok" tabindex="0" role="button" data-word="${w}" title="点击查看释义与发音">${w}</span>`);
  }

  async function openWordPopover(wordStr) {
    // Strictly block during unsubmitted exam mode!
    if (session.mode === "exam" && !session.examSubmitted && state.view === "practice") return;
    const pHost = $("wordPopoverHost");
    if (!pHost) return;
    pHost.innerHTML = `<div class="word-pop-backdrop" data-action="closeWordPopBg"><div class="word-pop-card">正在查询词库「${esc(wordStr)}」…</div></div>`;

    const entry = await lookupEnglishWord(wordStr);
    if (!entry) { pHost.innerHTML = ""; return; }
    const savedAlready = isWordInGrammarBook(entry);
    const vStore = readVocabStore();
    const rec = entry.id ? vStore.records?.[entry.id] : null;
    const statusLabel = rec?.master ? "✓ 词库已斩" : rec?.seen ? `复习阶梯 Lv.${rec.level || 1}` : entry.id ? "3000考纲核心词" : "考纲拓展词";

    pHost.innerHTML = `
      <div class="word-pop-backdrop" data-action="closeWordPopBg">
        <div class="word-pop-card" role="dialog" aria-modal="true" aria-label="单词速查卡片">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <span class="kicker">${esc(statusLabel)}</span>
              <h3 style="margin:6px 0 2px;font-size:22px">${esc(entry.w)} ${entry.matchedFrom.toLowerCase() !== entry.w.toLowerCase() ? `<span style="font-size:12.5px;color:var(--muted);font-weight:500">（原词形：${esc(entry.matchedFrom)}）</span>` : ""}</h3>
              ${entry.ipa ? `<div style="font-size:13.5px;color:var(--muted);font-family:Consolas,monospace">/${esc(entry.ipa)}/</div>` : ""}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn sm soft" data-action="speakPopWord" data-w="${esc(entry.w)}" aria-label="朗读单词发音">🔊 发音</button>
              <button class="btn sm" data-action="closeWordPop" aria-label="关闭查词">✕</button>
            </div>
          </div>

          <div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--glass-sub);border:1px solid var(--line)">
            ${entry.cn
              ? `<div style="font-size:15px;font-weight:700">${esc(entry.cn)}</div>`
              : `<div style="font-size:13px;color:var(--muted);margin-bottom:6px">该词未在 3000 基础词表中，可补充释义一键收入个人词书：</div>
                 <input id="popCustomCn" class="fill-input" style="width:100%;min-height:38px;font-size:13.5px" placeholder="输入中文释义（可选，默认记为语法生词）">`}
            ${entry.ex ? `<div style="margin-top:6px;font-size:12.5px;color:var(--muted)">例：${esc(entry.ex)}</div>` : ""}
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px">
            <a class="btn sm" href="./index.html" title="前往词迹背单词查看生词本">📖 打开词迹词书</a>
            <button class="btn sm ${savedAlready ? 'soft' : 'primary'}" id="addVocabBtn" data-action="saveWordToBook">
              ${savedAlready ? "★ 已在语法生词本" : "⭐ 加入个人生词本"}
            </button>
          </div>
        </div>
      </div>
    `;
    pHost._currentEntry = entry;
  }

  // ---------------------------------------------------------------------------
  // 4. Mastery & Overall Statistics (Grammar + 3,000-Word Unified Metrics)
  // ---------------------------------------------------------------------------
  function allModulesList(includeZero = false) {
    return includeZero && META.foundationModule ? [META.foundationModule, ...META.modules] : META.modules;
  }

  function findKpMeta(kpId) {
    for (const m of allModulesList(true)) {
      for (const kp of m.kps) {
        if (kp.id === kpId) return { mod: m, kp };
      }
    }
    return null;
  }

  function getKpStats(kpId) {
    if (kpId.startsWith("kp-0-")) {
      const done = !!state.kpManual[kpId];
      return { kpId, modId: "0", totalInKp: 0, practiced: 0, correctLatest: 0, acc: done ? 100 : 0, mastery: done ? 100 : 0, manualDone: done };
    }
    const info = findKpMeta(kpId);
    const modId = info ? info.mod.id : "1";
    const bankArr = window.WSG_BANKS[modId] || [];
    const totalInKp = bankArr.length ? bankArr.filter(q => q.kp === kpId).length : Math.round(100 / (info ? info.mod.kps.length : 4));

    let practiced = 0, correctLatest = 0, totalAttempts = 0, totalRight = 0;
    for (const [qid, rec] of Object.entries(state.records)) {
      const rKp = rec.kp || (qById.get(qid) && qById.get(qid).kp);
      if (rKp === kpId && (rec.attempts || 0) > 0) {
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
      mastery = 25;
    }
    const acc = totalAttempts > 0 ? Math.round((totalRight / totalAttempts) * 100) : 0;
    return { kpId, modId, totalInKp, practiced, correctLatest, acc, mastery, manualDone };
  }

  function getModStats(modId) {
    const m = allModulesList(true).find(x => x.id === String(modId));
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
      if ((rec.attempts || 0) > 0) {
        totalPracticed++;
        totalAttempts += rec.attempts;
        totalRight += rec.correct || 0;
      }
      if (rec.fav) favCount++;
      if (isMistakeRecord(rec)) {
        mistakeTotal++;
        if (!rec.nextReviewAt || rec.nextReviewAt <= today) dueCount++;
      }
    }
    const overallAcc = totalAttempts > 0 ? Math.round((totalRight / totalAttempts) * 100) : 0;
    const masteredKpTotal = modStats.reduce((s, ms) => s + ms.masteredKps, 0);
    const drillsDone = Object.keys(state.completedDrills || {}).length;

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const log = state.dailyLog[todayStr(-i)];
      if (log && (log.answered > 0 || (log.kps && log.kps.length > 0))) streak++;
      else if (i > 0) break;
    }
    return { overallMastery, totalPracticed, overallAcc, mistakeTotal, dueCount, favCount, masteredKpTotal, drillsDone, streak, modStats };
  }

  function getVocabSummaryStats() {
    const vStore = readVocabStore();
    const recs = vStore.records || {};
    const today = todayStr();
    let learned = 0, mastered = 0, due = 0, fav = 0;
    for (const r of Object.values(recs)) {
      if (!r || typeof r !== "object") continue;
      if (r.seen || r.master) learned++;
      if (r.master) mastered++;
      if (r.fav) fav++;
      if (r.seen && !r.master && r.due && r.due <= today) due++;
    }
    const grammarBookWords = (vStore.groupOverrides?.["grp-grammar-vocab"]?.add || []).length;
    return { totalBase: 3000 + (Array.isArray(vStore.custom) ? vStore.custom.length : 0), learned, mastered, due, fav, grammarBookWords };
  }

  // ---------------------------------------------------------------------------
  // 5. Persistent Absolute-Deadline Exam Heartbeat (Never Lost on View Switch!)
  // ---------------------------------------------------------------------------
  let globalExamTicker = null;

  function formatMMSS(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function renderActiveExamFloatBar() {
    const bar = $("activeExamFloatBar");
    if (!bar) return;
    const ex = state.activeExam;
    if (!ex || !ex.active || ex.submitted) {
      bar.style.display = "none";
      bar.innerHTML = "";
      document.body.classList.remove("exam-locked");
      return;
    }

    const leftSec = Math.max(0, Math.ceil((ex.deadlineAt - Date.now()) / 1000));
    const answeredCnt = Object.keys(ex.choices || {}).length;
    const inExamStage = state.view === "practice" && session.mode === "exam" && !session.examSubmitted;
    document.body.classList.toggle("exam-locked", inExamStage);

    const inlineTimer = $("examTimerText");
    if (inlineTimer) inlineTimer.textContent = `⏱ 剩余 ${formatMMSS(leftSec)}`;

    if (inExamStage) {
      bar.style.display = "none";
    } else {
      bar.style.display = "block";
      bar.innerHTML = `<div class="exam-float-inner">
        <div>
          <strong>⏱ ${esc(ex.title)} 正在计时中</strong>
          <span style="margin-left:10px;font-family:Consolas,monospace;font-weight:800;color:var(--ocean)">剩余 ${formatMMSS(leftSec)}</span>
          <span style="margin-left:10px;font-size:12.5px;color:var(--muted)">已答 ${answeredCnt} / ${ex.qids.length} 题（第 ${ex.idx + 1} 题）</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn sm primary" data-action="resumeActiveExam">▶ 返回考场继续作答</button>
          <button class="btn sm" data-action="submitExamNow">交卷结算</button>
        </div>
      </div>`;
    }
  }

  function syncExamHeartbeat() {
    const ex = state.activeExam;
    if (!ex || !ex.active || ex.submitted) {
      if (globalExamTicker) { clearInterval(globalExamTicker); globalExamTicker = null; }
      renderActiveExamFloatBar();
      return;
    }
    renderActiveExamFloatBar();
    if (!globalExamTicker) {
      globalExamTicker = setInterval(async () => {
        const cur = state.activeExam;
        if (!cur || !cur.active || cur.submitted) {
          clearInterval(globalExamTicker);
          globalExamTicker = null;
          renderActiveExamFloatBar();
          return;
        }
        const left = Math.ceil((cur.deadlineAt - Date.now()) / 1000);
        renderActiveExamFloatBar();
        if (left <= 0) {
          clearInterval(globalExamTicker);
          globalExamTicker = null;
          await ensureAllBanksIndexed().catch(() => {});
          restoreSessionFromActiveExam();
          submitExam();
        }
      }, 1000);
    }
  }

  function restoreSessionFromActiveExam() {
    const ex = state.activeExam;
    if (!ex || !ex.active) return false;
    session.mode = "exam";
    session.title = ex.title || "限时模拟考试";
    session.qids = [...(ex.qids || [])];
    session.idx = Math.min(Math.max(0, Number(ex.idx || 0)), Math.max(0, session.qids.length - 1));
    session.examChoices = Object.assign({}, ex.choices || {});
    session.examSubmitted = !!ex.submitted;
    session.examStartAt = ex.startedAt || Date.now();
    session.examDeadlineAt = ex.deadlineAt || Date.now();
    session.hintLevel = 0;
    session.stepLevel = ex.submitted ? 3 : 0;
    return true;
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

    renderActiveExamFloatBar();
  }

  // ---------------------------------------------------------------------------
  // 6. Four Interactive SVG Teaching Diagrams
  // ---------------------------------------------------------------------------
  const diagramStates = { "tense-timeline": 3, "svo-analyzer": 0, "clause-structure": 0, "nonfinite-tree": 0 };

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
          </svg>

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
          <div style="margin-top:4px"><strong>典型例句：</strong>${tokenizeEnglishText(cur.eg, true)} — ${esc(cur.cn)}</div>
        </div>
      </div>`;
      wsgAnimate(host.querySelectorAll(".diag-pulse, .svg-inspector"), { scale: [0.96, 1], opacity: [0.5, 1], duration: 260 });
      return;
    }

    if (diagramId === "svo-analyzer") {
      const idx = diagramStates[diagramId] || 0;
      const sent = cfg.sentences[idx] || cfg.sentences[0];
      const n = sent.tokens.length;
      const boxW = Math.floor(780 / n);
      host.innerHTML = `<div class="svg-lab-card" data-diag-root="svo-analyzer">
        <div class="svg-lab-head"><div><span class="kicker">🔬 交互式 SVG 图解 · 主谓宾与五大句型拆解仪</span><h4 style="margin:5px 0 2px;font-size:15.5px">${esc(cfg.title)}</h4></div></div>
        <div class="svg-pill-bar" style="margin-bottom:10px">
          ${cfg.sentences.map((s, i) => `<button class="btn sm ${i === idx ? 'primary' : ''}" data-diag="svo-analyzer" data-diag-idx="${i}">${esc(s.label)}</button>`).join("")}
        </div>
        <div class="svg-stage">
          <svg viewBox="0 0 840 176" style="width:100%;min-width:560px;height:auto;display:block" role="img" aria-label="主谓宾成分依存结构SVG图">
            <defs><marker id="svoArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 1 L 10 5 L 0 9 z" fill="#059669"/></marker></defs>
            ${sent.links.map(([from, to, rel]) => {
              const x1 = 30 + from * boxW + boxW / 2, x2 = 30 + to * boxW + boxW / 2, midX = (x1 + x2) / 2, arcH = Math.max(16, 68 - Math.abs(x2 - x1) * 0.14);
              return `<g class="svo-arc-g"><path d="M ${x1} 76 Q ${midX} ${arcH} ${x2} 76" fill="none" stroke="#059669" stroke-width="2.2" marker-end="url(#svoArr)"/><text x="${midX}" y="${arcH + 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#059669">${esc(rel)}</text></g>`;
            }).join("")}
            ${sent.tokens.map((tk, i) => {
              const x = 30 + i * boxW + 4, w = boxW - 8;
              return `<g><rect x="${x}" y="82" width="${w}" height="68" rx="11" fill="rgba(16,185,129,0.08)" stroke="${tk.color}" stroke-width="2"/><text x="${x + w / 2}" y="106" text-anchor="middle" font-size="12.5" font-weight="800" fill="currentColor">${esc(tk.t.length > 22 ? tk.t.slice(0, 20) + '…' : tk.t)}</text><text x="${x + w / 2}" y="132" text-anchor="middle" font-size="11.5" font-weight="750" fill="${tk.color}">${esc(tk.role)}</text></g>`;
            }).join("")}
          </svg>
        </div>
        <div class="anat-chips" style="margin-top:10px">${sent.tokens.map(tk => `<div class="anat-chip"><b style="color:${tk.color}">${esc(tk.role)} · ${esc(tk.t)}</b><span>${esc(tk.desc)}</span></div>`).join("")}</div>
      </div>`;
      wsgAnimate(host.querySelectorAll(".svo-arc-g"), { opacity: [0, 1], translateY: [-6, 0], duration: 280 });
      return;
    }

    if (diagramId === "clause-structure") {
      const idx = diagramStates[diagramId] || 0;
      const m = cfg.models[idx] || cfg.models[0];
      host.innerHTML = `<div class="svg-lab-card" data-diag-root="clause-structure">
        <div class="svg-lab-head"><div><span class="kicker">🔬 交互式 SVG 图解 · 三大从句结构与 V1/V2 谓语切分镜</span><h4 style="margin:5px 0 2px;font-size:15.5px">${esc(cfg.title)}</h4></div></div>
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
          </svg>
        </div>
        <div class="svg-inspector">
          <div><strong>连接词诊断：</strong>${esc(m.connRole)}</div>
          <div style="margin-top:4px"><strong>考场秒判公式：</strong><code>${esc(m.formula)}</code></div>
        </div>
      </div>`;
      return;
    }

    if (diagramId === "nonfinite-tree") {
      const idx = diagramStates[diagramId] || 0;
      const c = cfg.cases[idx] || cfg.cases[0];
      const on = id => c.path.includes(id);
      const nodeBox = (id, x, y, w, h, title, sub) => {
        const active = on(id);
        return `<g class="${active ? 'nf-active-node' : ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${active ? 'rgba(16,185,129,0.20)' : 'rgba(148,163,184,0.10)'}" stroke="${active ? '#059669' : 'rgba(148,163,184,0.38)'}" stroke-width="${active ? 2.6 : 1.4}"/><text x="${x + w / 2}" y="${y + (sub ? 19 : 25)}" text-anchor="middle" font-size="12" font-weight="${active ? 800 : 650}" fill="currentColor">${title}</text>${sub ? `<text x="${x + w / 2}" y="${y + 35}" text-anchor="middle" font-size="10.5" fill="#64748b">${sub}</text>` : ""}</g>`;
      };
      const edge = (n1, n2, x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on(n1) && on(n2) ? '#059669' : 'rgba(148,163,184,0.38)'}" stroke-width="${on(n1) && on(n2) ? 3 : 1.5}"/>`;

      host.innerHTML = `<div class="svg-lab-card" data-diag-root="nonfinite-tree">
        <div class="svg-lab-head"><div><span class="kicker">🔬 交互式 SVG 图解 · 非谓语动词三步判断决策树</span><h4 style="margin:5px 0 2px;font-size:15.5px">${esc(cfg.title)}</h4></div></div>
        <div class="svg-pill-bar" style="margin-bottom:10px">
          ${cfg.cases.map((it, i) => `<button class="btn sm ${i === idx ? 'primary' : ''}" data-diag="nonfinite-tree" data-diag-idx="${i}">${esc(it.title)}</button>`).join("")}
        </div>
        <div class="svg-stage">
          <svg viewBox="0 0 860 226" style="width:100%;min-width:580px;height:auto;display:block" role="img" aria-label="非谓语动词判断决策树SVG">
            ${edge("n_root", "n_finite", 150, 95, 225, 48)}${edge("n_root", "n_nonfin", 150, 115, 225, 145)}
            ${edge("n_nonfin", "n_active", 385, 138, 455, 92)}${edge("n_nonfin", "n_passive", 385, 152, 455, 175)}
            ${edge("n_active", "n_to_do", 585, 84, 655, 38)}${edge("n_active", "n_doing", 585, 92, 655, 88)}
            ${edge("n_active", "n_having_done", 585, 100, 655, 136)}${edge("n_passive", "n_to_be_done", 585, 170, 655, 136)}${edge("n_passive", "n_done", 585, 180, 655, 186)}
            ${nodeBox("n_root", 16, 84, 134, 44, "Step 1 查连词与谓语", "一主一谓铁律")}
            ${nodeBox("n_finite", 225, 24, 185, 44, "有连词 + 有主语", "➔ 填真谓语")}
            ${nodeBox("n_nonfin", 225, 124, 160, 44, "无连词（已有真谓语）", "➔ Step 2 判主被动")}
            ${nodeBox("n_active", 455, 70, 130, 42, "逻辑主动", "Step 3 比时间")}
            ${nodeBox("n_passive", 455, 156, 130, 42, "逻辑被动", "Step 3 比时间")}
            ${nodeBox("n_to_do", 655, 14, 186, 38, "将来/目的：to do", "")}
            ${nodeBox("n_doing", 655, 64, 186, 38, "同时/伴随：doing", "")}
            ${nodeBox(on("n_to_be_done") ? "n_to_be_done" : "n_having_done", 655, 114, 186, 38, on("n_to_be_done") ? "将来被动：to be done" : "主动先完成：having done", "")}
            ${nodeBox("n_done", 655, 166, 186, 40, "一般/完成被动：done", "正在被动：being done")}
          </svg>
        </div>
        <div class="svg-inspector"><div><strong>例题：</strong>${tokenizeEnglishText(c.stem, true)} ➔ 锁定答案：<strong><code>${esc(c.answer)}</code></strong></div><div style="margin-top:4px">${esc(c.explain)}</div></div>
      </div>`;
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Adaptive Question Recommender (Weak KPs + Due SRS + Lower Zero-Basis Diff)
  // ---------------------------------------------------------------------------
  async function buildAdaptivePracticeQids(count = 15) {
    await ensureAllBanksIndexed();
    const today = todayStr();
    const allItems = [...qById.values()];
    const kpStatsMap = {};
    for (const m of META.modules) {
      for (const kp of m.kps) kpStatsMap[kp.id] = getKpStats(kp.id);
    }

    const scored = allItems.map(q => {
      const rec = state.records[q.id];
      const ks = kpStatsMap[q.kp] || { mastery: 0, acc: 0, practiced: 0 };
      let score = 0;

      // 1. Due SRS mistake review gets top priority
      if (rec && isMistakeRecord(rec) && (!rec.nextReviewAt || rec.nextReviewAt <= today)) {
        score += 75;
      }
      // 2. Weak knowledge point priority
      score += (100 - ks.mastery) * 0.45;
      // 3. Error rate boost
      if (ks.practiced > 0) score += (100 - ks.acc) * 0.25;
      // 4. Unseen question freshness
      if (!rec || !rec.attempts) score += 20;
      else if (rec.lastOk) score -= 25;

      // 5. Beginner Mode lowers initial difficulty to diff=1 (shields from diff=3 traps initially!)
      if (state.beginnerMode) {
        if (q.diff === 1) score += 60;
        else if (q.diff === 2) score += 10;
        else if (q.diff === 3) score -= 120;
      } else {
        if (ks.mastery < 40 && q.diff === 1) score += 18;
        else if (ks.mastery >= 40 && ks.mastery < 75 && q.diff === 2) score += 18;
        else if (ks.mastery >= 75 && q.diff === 3) score += 22;
      }

      score += Math.random() * 12; // controlled tie-breaking jitter
      return { id: q.id, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return shuffle(scored.slice(0, Math.min(scored.length, Math.max(count, count + 6)))).slice(0, count).map(x => x.id);
  }

  // ---------------------------------------------------------------------------
  // 8. View 1: Learning Console (Dashboard)
  // ---------------------------------------------------------------------------
  let consoleDiagramId = "tense-timeline";

  function renderDashboard() {
    const host = $("viewHost");
    const ov = getOverallStats();
    const voc = getVocabSummaryStats();
    const todayLog = ensureTodayLog();
    const fndStats = getModStats("0");

    let weakest = { kpId: "kp-1-1", modId: "1", title: "时态时间轴与10大常考时态判定", mastery: 101 };
    if (state.beginnerMode && fndStats.mastery < 100) {
      weakest = { kpId: "kp-0-1", modId: "0", title: "专项零 · 词性与五大基本句型先导课", mastery: fndStats.mastery };
    } else {
      for (const m of META.modules) {
        for (const kp of m.kps) {
          const st = getKpStats(kp.id);
          if (st.mastery < weakest.mastery) weakest = { kpId: kp.id, modId: m.id, title: kp.title, mastery: st.mastery };
        }
      }
    }

    const qDoneToday = todayLog.answered || 0;
    const goalDone = qDoneToday >= state.dailyGoal;

    host.innerHTML = `
      <div class="console-top-grid">
        <section class="surface console-hero" aria-label="学习总览与继续学习">
          <div>
            <span class="kicker">✨ 语法 V3.0 控制台 · 专项零先导 + 574挖空 + 500分级题 + 3000词即点即查</span>
            <h2 style="margin:8px 0 6px;font-size:clamp(21px,2.6vw,28px)">欢迎回来，科学推进你的专升本语法与词汇进度</h2>
            <p style="margin:0;color:var(--muted);font-size:13.5px">${state.beginnerMode ? "🌱 当前已开启【零基础模式】：智能刷题已自动降低初始难度，优先推送⭐基础巩固题与专项零先导课。" : "结合薄弱考点、历史正确率与到期复习曲线智能推题；练习中点击任意英文单词即可查考纲释义、听发音并收入生词本。"}</p>
          </div>
          <div class="console-stats-row">
            <div class="stat-tile"><div class="num">${ov.overallMastery}%</div><div class="lbl">五大专项总掌握度</div></div>
            <div class="stat-tile"><div class="num">${ov.totalPracticed} / 500</div><div class="lbl">语法题库已刷</div></div>
            <div class="stat-tile"><div class="num">${ov.drillsDone} / ${META.totalDrills}</div><div class="lbl">6类交互实训完成</div></div>
            <div class="stat-tile"><div class="num">${voc.learned} / 3000</div><div class="lbl">联动考纲词已学</div></div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
            <button class="btn primary" data-action="continueLast">▶ 继续上次学习：${esc(state.lastStudy?.title || "时态和语态")}</button>
            <button class="btn soft" data-action="startSmartPractice">⚡ 智能自适应刷题 15 道</button>
            <button class="btn" data-action="openModLearn" data-mod="0">🌱 专项零：零基础先导课 (${fndStats.mastery}%)</button>
            <button class="btn" data-action="goView" data-target="drills">🎮 6类交互实训工坊</button>
          </div>
        </section>

        <section class="surface" aria-label="今日学习任务清单">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <h3 style="margin:0;font-size:16.5px">🎯 今日自适应学习任务</h3>
            <span class="kicker">连续学习 ${ov.streak} 天</span>
          </div>
          <div class="task-list">
            <div class="task-row ${(todayLog.kps || []).length > 0 ? 'done' : ''}">
              <div>
                <strong>1. 推荐优先攻克：${esc(weakest.title)}</strong>
                <div style="font-size:12px;color:var(--muted)">当前掌握度 ${weakest.mastery}% · 含零基础拆解与严格语法校对</div>
              </div>
              <button class="btn sm soft" data-action="jumpKp" data-mod="${weakest.modId}" data-kp="${weakest.kpId}">去学习</button>
            </div>
            <div class="task-row ${goalDone ? 'done' : ''}">
              <div>
                <strong>2. 智能推荐语法闯关（${qDoneToday} / ${state.dailyGoal} 题）</strong>
                <div style="font-size:12px;color:var(--muted)">${state.beginnerMode ? "零基础保护：优先抽取 ⭐ 基础难度题" : "按薄弱考点 + 错题率 + 到期曲线智能抽题"}</div>
              </div>
              <button class="btn sm ${goalDone ? '' : 'primary'}" data-action="startSmartPractice">${goalDone ? '再练一组' : '去刷题'}</button>
            </div>
            <div class="task-row ${ov.dueCount === 0 && ov.mistakeTotal > 0 ? 'done' : ''}">
              <div>
                <strong>3. 到期错题与未答题间隔复习（待复习 ${ov.dueCount} 题）</strong>
                <div style="font-size:12px;color:var(--muted)">错题/未答池共 ${ov.mistakeTotal} 题 · 每日限升 1 阶防刷分</div>
              </div>
              <button class="btn sm ${ov.dueCount > 0 ? 'primary' : ''}" data-action="startDueReview">${ov.dueCount > 0 ? '立即复习' : '查看错题'}</button>
            </div>
          </div>
        </section>
      </div>

      <section aria-label="专项零与五大核心语法专项入口">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <h3 style="margin:0;font-size:17px">📚 专项零先导 + 五大核心语法专项（保留全部 574 处讲义挖空 + 18 个考纲独立考点）</h3>
          <button class="btn sm soft" data-action="openModLearn" data-mod="0">🌱 零基础先学「专项零：词性/代词/五大句型」→</button>
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

      <section class="quick-entrances" aria-label="模拟考试、交互工坊与词法统一报告快捷区">
        <div class="surface" style="margin-bottom:0">
          <span class="kicker">🎲 绝对时钟持久化考场</span>
          <h3 style="margin:6px 0 4px;font-size:16px">随机组卷限时考试</h3>
          <p style="margin:0 0 12px;font-size:13px;color:var(--muted)">切页或刷新不丢进度与倒计时；考中严格锁定提示与查词，交卷后自动区分错答与未答并解锁全解析。</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button class="btn sm primary" data-action="startExam" data-count="20">20题标准考 (15分)</button>
            <button class="btn sm" data-action="startExam" data-count="10">10题快测</button>
            <button class="btn sm" data-action="startExam" data-count="50">50题全真卷</button>
          </div>
        </div>

        <div class="surface" style="margin-bottom:0">
          <span class="kicker">🎮 六大新题型实训</span>
          <h3 style="margin:6px 0 4px;font-size:16px">多维语法交互实训工坊</h3>
          <p style="margin:0 0 12px;font-size:13px;color:var(--muted)">涵盖成分点击识别、连词拖拽排序、动词手写变形、易混词辨析、病句改错与句型翻译（已完成 ${ov.drillsDone}/${META.totalDrills}）。</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button class="btn sm soft" data-action="goView" data-target="drills">进入实训工坊</button>
            <button class="btn sm" data-action="practiceHandoutOnly">📘 刷18道讲义原题</button>
          </div>
        </div>

        <div class="surface" style="margin-bottom:0">
          <span class="kicker">📊 3000词 × 500语法题联动</span>
          <h3 style="margin:6px 0 4px;font-size:16px">统一英语学习报告与打印</h3>
          <p style="margin:0 0 12px;font-size:13px;color:var(--muted)">汇总词汇熟度、语法生词本（${voc.grammarBookWords} 词）、18 考点诊断与三态 A4 讲义/试卷打印。</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button class="btn sm soft" data-action="goView" data-target="report">查看统一报告</button>
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
  // 9. View 2: Lectures (Module 0 Foundation + Modules 1–5 with 574 Original Clozes)
  // ---------------------------------------------------------------------------
  async function renderLearnView(scrollToKpId = "") {
    const host = $("viewHost");
    const active = state.activeMod ?? (state.beginnerMode ? "0" : "1");
    host.innerHTML = `<div class="surface" style="text-align:center;padding:32px">正在按需加载语法专项讲义数据…</div>`;

    const modIds = active === "all" ? ["1", "2", "3", "4", "5"] : [String(active)];
    try {
      await Promise.all(modIds.map(id => window.WSG_ensureModule(id)));
    } catch (err) {
      renderLoadError(host, err, "retryLearnView");
      return;
    }

    const allNavMods = allModulesList(true);
    const sectionsHtml = modIds.map(mid => {
      const mMeta = allNavMods.find(x => x.id === mid);
      const mData = window.WSG_MODULES[mid];
      const ms = getModStats(mid);
      const topDiagHtml = (mData.diagramId && mid !== "1")
        ? `<div class="svg-lab-mount" data-diagram="${mData.diagramId}"></div>`
        : "";

      const cardsHtml = mData.cards.map(card => {
        const kpSt = getKpStats(card.kpId);
        const showZero = !!(state.beginnerMode || mid === "0" || state.expandedZero[card.kpId]);
        const z = card.zero;
        return `<article class="kp-wrapper" id="${card.kpId}" data-kp-id="${card.kpId}">
          <div class="kp-topbar">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="kicker">${mid === "0" ? "先导模块" : "考点"} ${esc(card.kpId.replace('kp-', ''))}</span>
              <strong style="font-size:14px">${esc(card.title)}</strong>
              <span style="font-size:12px;color:var(--muted)">（${mid === "0" ? "零基础先导" : `含 ${card.clozeCount} 处考纲挖空 · 已练 ${kpSt.practiced} 题`} · 掌握度 <strong style="color:var(--green-deep)">${kpSt.mastery}%</strong>）</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn sm ${showZero ? 'soft' : ''}" data-action="toggleKpZero" data-kp="${card.kpId}" aria-expanded="${showZero}">🌱 ${showZero ? '收起零基础精讲' : '零基础六步精讲'}</button>
              <button class="btn sm" data-action="revealCardCloze" data-kp="${card.kpId}">👁 本卡翻开/遮罩</button>
              <button class="btn sm ${kpSt.manualDone ? 'soft' : ''}" data-action="toggleKpManual" data-kp="${card.kpId}">${kpSt.manualDone ? '✓ 已标学完' : '○ 标记已学'}</button>
              ${mid === "0"
                ? `<button class="btn sm primary" data-action="goView" data-target="drills">🎮 去实训工坊练手</button>`
                : `<button class="btn sm primary" data-action="practiceKp" data-mod="${mid}" data-kp="${card.kpId}">✍️ 练本考点题</button>`}
            </div>
          </div>
          ${card.handoutHtml.replace('<div class="g-card"', '<div class="g-card" data-kp-card="' + card.kpId + '"').replace(/<\/div>\s*$/, '')}
            <div class="calib-grid" aria-label="应试口诀与严格语法规则校对">
              <div class="calib-box tip"><span class="calib-tag">⚡ 考场应试秒杀口诀</span><div>${esc(card.strictVsTip.tip)}</div></div>
              <div class="calib-box strict"><span class="calib-tag">⚖️ 严格语法规则与防坑边界校对</span><div>${esc(card.strictVsTip.strict)}</div></div>
            </div>
            <div class="zero-panel ${showZero ? '' : 'collapsed'}" id="zero-${card.kpId}">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <strong style="color:var(--green-deep);font-size:14px">🌱 零基础六步通关拆解 · ${esc(card.short)}</strong>
                <span style="font-size:12px;color:var(--muted)">概念白话 ➔ 句子拆解 ➔ 解题步骤 ➔ 典型母题 ➔ 变形对比 ➔ 易错预警</span>
              </div>
              <div class="zero-grid">
                <div class="zero-block"><strong class="zb-title">1️⃣ 概念白话理解</strong><div>${esc(z.concept)}</div></div>
                <div class="zero-block"><strong class="zb-title">2️⃣ 典型句子成分拆解</strong><div class="anat-chips">${z.anatomy.map(a => `<div class="anat-chip"><b>${esc(a.part)}：${esc(a.text)}</b><span>${esc(a.role)}</span></div>`).join("")}</div></div>
                <div class="zero-block"><strong class="zb-title">3️⃣ 考场三步解题步骤</strong><ol class="num-list" style="margin:0">${z.steps.map(st => `<li>${esc(st)}</li>`).join("")}</ol></div>
                <div class="zero-block"><strong class="zb-title">4️⃣ 典型母题精讲</strong><div>${tokenizeEnglishText(z.example.q, true)}</div><div style="margin-top:4px"><strong>答案：</strong><code>${esc(z.example.ans)}</code></div><div style="margin-top:3px;color:var(--ink-2)">${esc(z.example.why)}</div></div>
                <div class="zero-block"><strong class="zb-title">5️⃣ 举一反三变形题（${esc(z.variant.change)}）</strong><div>${tokenizeEnglishText(z.variant.q, true)}</div><div style="margin-top:4px"><strong>变形后答案：</strong><code>${esc(z.variant.ans)}</code></div><div style="margin-top:3px;color:var(--ink-2)">${esc(z.variant.why)}</div></div>
                <div class="zero-block" style="border-left:3.5px solid var(--danger)"><strong class="zb-title" style="color:var(--danger)">6️⃣ 高频易错陷阱预警</strong><div>${esc(z.pitfall)}</div></div>
              </div>
            </div>
          </div>
        </article>`;
      }).join("");

      return `<section class="mod-section" id="mod-${mid}" data-mod="${mid}">
        <div class="mod-banner tint-${mMeta.tint}">
          <div>
            <div class="mod-kicker">${esc(mMeta.kicker)} · 掌握度 ${ms.mastery}%</div>
            <h2>${esc(mMeta.title)}（${esc(mMeta.en)}）</h2>
            <p>${esc(mMeta.summary)}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${mid === "0"
              ? `<button class="btn soft" data-action="selectLearnMod" data-mod="1">学完先导，进入专项一 →</button>`
              : `<button class="btn soft" data-action="openModQuiz" data-mod="${mid}">✍️ 练本专项 100 题</button>`}
          </div>
        </div>
        ${topDiagHtml}
        ${cardsHtml}
      </section>`;
    }).join("");

    host.innerHTML = `
      <div class="chapter-bar">
        <div class="mod-pills" role="tablist" aria-label="选择语法专项章节">
          <button class="btn ${active === '0' ? 'primary' : ''}" role="tab" aria-selected="${active === '0'}" data-action="selectLearnMod" data-mod="0">🌱 0. 零基础先导课</button>
          ${META.modules.map(m => `<button class="btn ${active === m.id ? 'primary' : ''}" role="tab" aria-selected="${active === m.id}" data-action="selectLearnMod" data-mod="${m.id}">${m.id}. ${esc(m.title)}</button>`).join("")}
          <button class="btn ${active === 'all' ? 'primary' : ''}" role="tab" aria-selected="${active === 'all'}" data-action="selectLearnMod" data-mod="all">📚 展开五大考纲专项 (574挖空)</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${state.mask ? `<button class="btn sm soft" data-action="revealAllPageCloze">👁 全部翻开/重置遮罩</button>` : ""}
        </div>
      </div>
      ${sectionsHtml}
    `;

    host.querySelectorAll(".svg-lab-mount").forEach(el => renderDiagramInto(el.dataset.diagram, el));
    if (scrollToKpId) {
      document.getElementById(scrollToKpId)?.scrollIntoView({ behavior: prefersNoMotion() ? "auto" : "smooth", block: "start" });
    }
  }

  // ---------------------------------------------------------------------------
  // 10. View 3: 6-Type Interactive Grammar Skill Lab (Drills)
  // ---------------------------------------------------------------------------
  const drillState = {
    type: "click-role",
    idxInType: 0,
    dragBuilt: [],
    dragPool: null,
    pickedSeg: null,
    pickedFix: null,
    checkedResult: null
  };

  async function renderDrillsView() {
    const host = $("viewHost");
    try {
      await window.WSG_ensureDrills();
    } catch (err) {
      renderLoadError(host, err, "retryDrillsView");
      return;
    }

    const D = window.WSG_DRILLS;
    const list = D.items.filter(x => x.type === drillState.type);
    const curIdx = Math.min(drillState.idxInType, Math.max(0, list.length - 1));
    drillState.idxInType = curIdx;
    const item = list[curIdx];
    const doneCount = Object.keys(state.completedDrills || {}).length;

    if (item.type === "drag-order" && !drillState.dragPool) {
      drillState.dragPool = shuffle(item.chunks.map((t, i) => ({ origIdx: i, text: t })));
      drillState.dragBuilt = [];
    }

    let bodyHtml = "";
    if (item.type === "click-role") {
      bodyHtml = `
        <div style="font-weight:720;margin-bottom:12px">${esc(item.prompt)}</div>
        <div class="token-bank" role="group" aria-label="点击句子成分词块">
          ${item.tokens.map((tk, i) => {
            let cls = "seg-chip";
            if (drillState.checkedResult) {
              if (i === item.ansIdx) cls += " picked-ok";
              else if (i === drillState.pickedSeg) cls += " picked-bad";
            }
            return `<button class="${cls}" data-action="drillPickRole" data-idx="${i}" ${drillState.checkedResult ? "disabled" : ""}>${esc(tk)}</button>`;
          }).join("")}
        </div>`;
    } else if (item.type === "drag-order") {
      bodyHtml = `
        <div style="font-weight:720;margin-bottom:10px">${esc(item.prompt)}</div>
        <div style="font-size:12.5px;color:var(--muted);margin-bottom:6px">📥 已排好的句子区（支持拖拽排序，或直接点击词块移入/移出）：</div>
        <div class="drop-zone" id="drillDropZone" aria-label="已排序词块区">
          ${drillState.dragBuilt.length === 0
            ? `<span style="color:var(--muted);font-size:13px">点击下方词块或将其拖入此处按正确语序成句…</span>`
            : drillState.dragBuilt.map((c, bi) => `<button class="drag-chip" draggable="true" data-drag-built="${bi}" data-action="drillRemoveChunk" data-bidx="${bi}">${esc(c.text)}</button>`).join("")}
        </div>
        <div style="font-size:12.5px;color:var(--muted);margin:10px 0 6px">🧩 待选词块池：</div>
        <div class="token-bank" id="drillSourceBank" aria-label="待选词块池">
          ${(drillState.dragPool || []).map((c, pi) => `<button class="drag-chip" draggable="true" data-drag-pool="${pi}" data-action="drillAddChunk" data-pidx="${pi}">${esc(c.text)}</button>`).join("")}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" data-action="drillCheckOrder" ${drillState.dragBuilt.length !== item.chunks.length ? "disabled" : ""}>✓ 提交检验语序</button>
          <button class="btn" data-action="drillResetOrder">↺ 重置词块</button>
        </div>`;
    } else if (item.type === "verb-fill") {
      bodyHtml = `
        <div style="font-weight:720;white-space:pre-line;margin-bottom:12px">${tokenizeEnglishText(item.prompt, true)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <input id="drillVerbInput" class="fill-input" type="text" autocomplete="off" spellcheck="false" placeholder="输入正确的英文动词形式…" aria-label="输入动词正确形式">
          <button class="btn primary" data-action="drillCheckVerb">✓ 核对变形</button>
          <button class="btn sm" data-action="drillVerbHint">💡 提示</button>
        </div>
        <div id="drillVerbHintBox"></div>`;
    } else if (item.type === "confusable" || item.type === "translation") {
      const stemText = item.type === "translation" ? `中文原句：${item.cn}\n${item.scaffold}` : item.prompt;
      bodyHtml = `
        <div style="font-weight:720;white-space:pre-line;margin-bottom:12px">${tokenizeEnglishText(stemText, true)}</div>
        <div class="q-options-list">
          ${item.opts.map((opt, i) => {
            let cls = "opt-btn";
            if (drillState.checkedResult) {
              if (i === item.ans) cls += " right";
              else if (i === drillState.pickedSeg) cls += " wrong";
            }
            return `<button class="${cls}" data-action="drillPickMcq" data-idx="${i}" ${drillState.checkedResult ? "disabled" : ""}>${tokenizeEnglishText(opt, !drillState.checkedResult ? false : true)}</button>`;
          }).join("")}
        </div>`;
    } else if (item.type === "error-fix") {
      bodyHtml = `
        <div style="font-weight:720;margin-bottom:10px">第一步：${esc(item.prompt)}</div>
        <div class="token-bank" style="margin-bottom:12px">
          ${item.segments.map((seg, i) => {
            let cls = "seg-chip";
            if (drillState.pickedSeg !== null) {
              if (i === item.errIdx) cls += " picked-ok";
              else if (i === drillState.pickedSeg) cls += " picked-bad";
            }
            return `<button class="${cls}" data-action="drillPickErrSeg" data-idx="${i}">${esc(seg)}</button>`;
          }).join("")}
        </div>
        ${drillState.pickedSeg !== null ? `
          <div style="font-weight:720;margin-bottom:8px">第二步：选择正确的语法修改方案：</div>
          <div class="q-options-list">
            ${item.fixOpts.map((fo, fi) => {
              let cls = "opt-btn";
              if (drillState.checkedResult) {
                if (fi === item.fixAns) cls += " right";
                else if (fi === drillState.pickedFix) cls += " wrong";
              }
              return `<button class="${cls}" data-action="drillPickErrFix" data-idx="${fi}" ${drillState.checkedResult ? "disabled" : ""}>${esc(fo)}</button>`;
            }).join("")}
          </div>
        ` : ""}`;
    }

    host.innerHTML = `
      <section class="surface" aria-label="六大交互实训题型切换">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div>
            <span class="kicker">🎮 多维语法主动输出实训 · 告别纯刷ABCD</span>
            <h2 style="margin:5px 0 2px;font-size:21px">六大交互实训工坊（已通关 ${doneCount} / ${D.items.length}）</h2>
          </div>
        </div>
        <div class="drill-type-grid" role="tablist" aria-label="实训题型列表">
          ${D.types.map(t => {
            const subTotal = D.items.filter(x => x.type === t.id).length;
            const subDone = D.items.filter(x => x.type === t.id && state.completedDrills[x.id]).length;
            return `<button class="drill-type-btn ${drillState.type === t.id ? 'active' : ''}" role="tab" aria-selected="${drillState.type === t.id}" data-action="selectDrillType" data-dtype="${t.id}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong>${esc(t.name)}</strong>
                <span class="kicker">${subDone}/${subTotal}</span>
              </div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px">${esc(t.desc)}</div>
            </button>`;
          }).join("")}
        </div>
      </section>

      <section class="q-stage-card" aria-live="polite">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <span class="kicker">实训第 ${curIdx + 1} / ${list.length} 关 ${state.completedDrills[item.id] ? "· ✓ 已通关" : ""}</span>
          <div style="display:flex;gap:6px">
            <button class="btn sm" data-action="prevDrill" ${curIdx === 0 ? "disabled" : ""}>← 上一关</button>
            <button class="btn sm primary" data-action="nextDrill" ${curIdx >= list.length - 1 ? "disabled" : ""}>下一关 →</button>
          </div>
        </div>

        ${bodyHtml}

        ${drillState.checkedResult ? `
          <div class="steps-box" style="margin-top:14px">
            <strong style="color:${drillState.checkedResult.ok ? 'var(--green-deep)' : 'var(--danger)'}">
              ${drillState.checkedResult.ok ? "🎉 实训通关！掌握精准到位" : `⚠️ 再核对一下：${esc(drillState.checkedResult.msg || "请参考下方标准解析")}`}
            </strong>
            <div style="margin-top:6px;font-size:13.5px">${esc(item.exp)}</div>
          </div>
        ` : ""}
      </section>
    `;

    // Attach HTML5 drag-and-drop onto #drillDropZone if present
    const dz = $("drillDropZone");
    if (dz) {
      host.querySelectorAll("[data-drag-pool]").forEach(el => {
        el.addEventListener("dragstart", ev => ev.dataTransfer?.setData("text/plain", "pool:" + el.dataset.dragPool));
      });
      dz.addEventListener("dragover", ev => ev.preventDefault());
      dz.addEventListener("drop", ev => {
        ev.preventDefault();
        const rawData = ev.dataTransfer?.getData("text/plain") || "";
        if (rawData.startsWith("pool:")) {
          const pi = Number(rawData.slice(5));
          if (drillState.dragPool && drillState.dragPool[pi]) {
            const [moved] = drillState.dragPool.splice(pi, 1);
            drillState.dragBuilt.push(moved);
            renderDrillsView();
          }
        }
      });
    }
  }

  function markDrillCompleted(item) {
    state.completedDrills[item.id] = true;
    save();
    updateHeaderBadges();
  }

  // ---------------------------------------------------------------------------
  // 11. View 4: 500-Question Single-Question Trainer & Persistent Mock Exam
  // ---------------------------------------------------------------------------
  const session = {
    mode: "practice",
    title: "语法闯关训练",
    filterMod: "all",
    filterKp: "all",
    filterSource: "all",
    filterDiff: "all",
    count: 15,
    qids: [],
    idx: 0,
    hintLevel: 0, // 0..3 progressive hints!
    stepLevel: 0, // 0..3 progressive steps!
    followUpPicked: null,
    examSubmitted: false,
    examChoices: {},
    examStartAt: 0,
    examDeadlineAt: 0,
    currentSessionAnswers: {}
  };

  async function startSession(opts = {}) {
    const isExam = opts.mode === "exam";
    Object.assign(session, {
      mode: opts.mode || "practice",
      title: opts.title || "语法闯关训练",
      filterMod: opts.filterMod ?? session.filterMod ?? "all",
      filterKp: opts.filterKp ?? "all",
      filterSource: opts.filterSource ?? "all",
      filterDiff: opts.filterDiff ?? (state.beginnerMode && !opts.mode ? "1" : "all"),
      count: Number(opts.count || 15),
      idx: 0,
      hintLevel: 0,
      stepLevel: 0,
      followUpPicked: null,
      examSubmitted: false,
      examChoices: {},
      currentSessionAnswers: {}
    });

    const host = $("viewHost");
    try {
      if (opts.customQids && opts.customQids.length) {
        await ensureAllBanksIndexed();
        session.qids = [...opts.customQids];
      } else {
        if (session.filterMod !== "all") await ensureBankIndexed(session.filterMod);
        else await ensureAllBanksIndexed();

        let pool = [];
        const targetMods = session.filterMod === "all" ? ["1", "2", "3", "4", "5"] : [session.filterMod];
        for (const mid of targetMods) pool.push(...(window.WSG_BANKS[mid] || []));
        if (session.filterKp !== "all") pool = pool.filter(q => q.kp === session.filterKp);
        if (session.filterSource === "handout") pool = pool.filter(q => q.source === "handout");
        else if (session.filterSource === "authored") pool = pool.filter(q => q.source === "authored");
        else if (session.filterSource === "unseen") pool = pool.filter(q => !(state.records[q.id]?.attempts > 0));
        if (session.filterDiff !== "all") pool = pool.filter(q => String(q.diff) === String(session.filterDiff));

        if (session.filterSource !== "handout") pool = shuffle(pool);
        session.qids = session.count >= 500 ? pool.map(q => q.id) : pool.slice(0, session.count).map(q => q.id);
      }
    } catch (err) {
      state.view = "practice";
      updateHeaderBadges();
      renderLoadError(host, err, "retryPracticeLoad");
      return;
    }

    if (isExam && session.qids.length > 0) {
      const now = Date.now();
      const limitSec = session.qids.length * 45;
      session.examStartAt = now;
      session.examDeadlineAt = now + limitSec * 1000;
      state.activeExam = {
        active: true,
        submitted: false,
        title: session.title,
        qids: [...session.qids],
        idx: 0,
        choices: {},
        startedAt: now,
        deadlineAt: session.examDeadlineAt,
        limitSec
      };
      save();
      syncExamHeartbeat();
    }

    state.view = "practice";
    save();
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

    const inActiveExam = session.mode === "exam" && !session.examSubmitted;
    const leftSec = inActiveExam && state.activeExam ? Math.max(0, Math.ceil((state.activeExam.deadlineAt - Date.now()) / 1000)) : 0;

    host.innerHTML = `
      <section class="surface" aria-label="练习筛选与考试控制栏">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">
          ${inActiveExam ? `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="status-pill unans">🔒 考场纯净模式（已关闭点词查义、提示与提前答案泄露；切页或刷新自动保留进度）</span>
            </div>
          ` : `
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
          `}
          <div style="display:flex;gap:6px;align-items:center">
            ${inActiveExam
              ? `<span class="kicker" id="examTimerText">⏱ 剩余 ${formatMMSS(leftSec)}</span><button class="btn primary" data-action="submitExam">交卷出分</button>`
              : `<button class="btn soft" data-action="startExam" data-count="20">🎲 开启20题限时模拟考</button>`}
          </div>
        </div>
      </section>

      <div id="examSummaryBanner">${session.lastExamBannerHtml || ""}</div>

      <div class="trainer-layout">
        <div id="singleQuestionHost" aria-live="polite"></div>
        <aside class="surface" style="margin-bottom:0" aria-label="题号导航卡">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:14px">${esc(session.title)}（${session.qids.length} 题）</strong>
            <span style="font-size:12px;color:var(--muted)" id="sessionScoreMini"></span>
          </div>
          <div class="q-palette-grid" id="qPaletteHost"></div>
          <div style="margin-top:10px;font-size:11.5px;color:var(--muted)">
            ${inActiveExam ? "考试中可自由切题修改答案，交卷后解锁完整解析与点词查义。" : "💡 点击题干任意英文单词可查释义与发音；快捷键 1-4 / H / F / ← →"}
          </div>
        </aside>
      </div>
    `;

    renderSingleQuestionOnly();
    renderPaletteOnly();
  }

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
    const allowLookup = !isExamHidden;

    const chosen = session.mode === "exam" ? session.examChoices[qid] : session.currentSessionAnswers?.[qid];
    const hasAnswered = chosen !== undefined;
    // CRITICAL FIX: After exam submission, EVEN unanswered questions show full explanation & status!
    const showPostAnswer = session.examSubmitted || (!isExamHidden && hasAnswered);
    const isUnansweredPostExam = session.examSubmitted && !hasAnswered;

    const hintsArr = Array.isArray(q.hints) && q.hints.length ? q.hints : [q.hint];
    const diffStars = "⭐".repeat(q.diff || 2);

    let statusHeaderHtml = "";
    if (showPostAnswer) {
      if (isUnansweredPostExam) {
        statusHeaderHtml = `<span class="status-pill unans">⚪ 本题未作答 · 已自动加入待复习队列</span>`;
      } else if (chosen === q.ans) {
        statusHeaderHtml = `<span class="status-pill right">🎉 回答正确${rec._sameDayCapped ? "（今日已完成升阶巩固）" : " · 考点掌握度提升"}</span>`;
      } else {
        statusHeaderHtml = `<span class="status-pill wrong">✗ 错答（误选 ${String.fromCharCode(65 + chosen)}）· 已加入待复习队列</span>`;
      }
    }

    const fu = q.followUp;
    const fuDone = session.followUpPicked !== null && session.followUpPicked !== undefined;

    qHost.innerHTML = `
      <article class="q-stage-card" data-current-qid="${q.id}">
        <div class="q-meta-row">
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
            <span class="kicker">第 ${session.idx + 1} / ${session.qids.length} 题</span>
            <span class="src-badge ${q.source}">${q.source === "handout" ? "📘 讲义原题" : "✍️ 自编练习题"}</span>
            ${!isExamHidden ? `<button class="btn sm" data-action="jumpKp" data-mod="${q.mod}" data-kp="${q.kp}" title="跳转到对应语法考点讲义">📍 ${esc(kpInfo ? kpInfo.kp.short : q.kp)}</button>` : ""}
            <span style="font-size:12px" title="难度等级">${diffStars}</span>
          </div>
          <button class="btn sm ${rec.fav ? 'soft' : ''}" data-action="toggleFav" data-qid="${q.id}" aria-pressed="${!!rec.fav}">
            ${rec.fav ? "★ 已收藏" : "☆ 收藏本题"}
          </button>
        </div>

        <div class="q-stem-big">${tokenizeEnglishText(q.q, allowLookup)}</div>

        <div class="q-options-list" role="radiogroup" aria-label="题目选项">
          ${q.opts.map((optText, idx) => {
            let cls = "opt-btn";
            let tag = "";
            if (isExamHidden) {
              if (idx === chosen) { cls += " selected"; tag = "已选"; }
            } else if (showPostAnswer) {
              if (idx === q.ans) { cls += " right"; tag = "✓ 正确答案"; }
              else if (hasAnswered && idx === chosen) { cls += " wrong"; tag = "✗ 你的选择"; }
            }
            const disabledAttr = showPostAnswer ? "disabled" : "";
            return `<button class="${cls}" data-action="chooseOpt" data-qid="${q.id}" data-idx="${idx}" ${disabledAttr}>
              <span>${esc(optText)}</span>
              ${tag ? `<span style="font-size:12px">${tag}</span>` : ""}
            </button>`;
          }).join("")}
        </div>

        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-top:16px">
          <div style="display:flex;flex-wrap:wrap;gap:7px">
            <button class="btn sm" data-action="prevQ" ${session.idx === 0 ? "disabled" : ""}>← 上一题</button>
            ${!isExamHidden ? `<button class="btn sm" data-action="stepHint">💡 ${session.hintLevel < hintsArr.length ? `逐步提示 (${session.hintLevel}/${hintsArr.length})` : "已显示全部提示"}</button>` : ""}
            ${showPostAnswer ? `<button class="btn sm soft" data-action="nextStepExp">🪜 ${session.stepLevel < 3 ? `下一步解析 (${session.stepLevel}/3)` : "已展开全部解析"}</button>` : ""}
            ${showPostAnswer && session.stepLevel < 3 ? `<button class="btn sm" data-action="fullStepExp">展开全解析</button>` : ""}
          </div>
          <button class="btn primary" data-action="nextQ" ${session.idx >= session.qids.length - 1 ? "disabled" : ""}>下一题 →</button>
        </div>

        ${session.hintLevel > 0 && !isExamHidden ? `
          <div class="hint-box">
            ${hintsArr.slice(0, session.hintLevel).map(h => `<div style="margin-bottom:4px">💡 ${esc(h)}</div>`).join("")}
          </div>
        ` : ""}

        ${showPostAnswer ? `
          <div class="steps-box">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
              ${statusHeaderHtml}
              <span style="font-size:12px;color:var(--muted)">作答 ${rec.attempts || 0} 次 · 正确 ${rec.correct || 0} 次${rec.unansweredCount ? ` · 考试未答 ${rec.unansweredCount} 次` : ""}</span>
            </div>

            ${q.steps.slice(0, Math.max(1, session.stepLevel)).map(st => `<div class="step-line">${esc(st)}</div>`).join("")}

            ${session.stepLevel >= 3 ? `
              <div style="margin-top:8px;font-size:13.5px"><strong>📌 核心语法结论：</strong>${esc(q.exp)}</div>

              ${Array.isArray(q.optExps) ? `
                <div style="margin-top:10px">
                  <strong style="font-size:12.5px;color:var(--muted)">🔍 A–D 逐项排错诊断：</strong>
                  <div class="opt-exp-list">
                    ${q.optExps.map((oe, oi) => `<div class="opt-exp-item ${oi === q.ans ? 'is-ans' : ''}">${esc(oe)}</div>`).join("")}
                  </div>
                </div>
              ` : ""}

              ${(isUnansweredPostExam || chosen !== q.ans) && q.wrongDiag ? `
                <div class="callout warn" style="margin-top:10px">
                  <strong>🩺 典型错因剖析：</strong>${esc(q.wrongDiag)}
                </div>
              ` : ""}

              ${fu ? `
                <div class="followup-box">
                  <strong style="font-size:13px;color:var(--ocean)">🔄 同考点举一反三变形自测</strong>
                  <div style="font-weight:680;margin:6px 0 8px;font-size:13.5px">${tokenizeEnglishText(fu.q, true)}</div>
                  <div style="display:flex;flex-wrap:wrap;gap:8px">
                    ${fu.opts.map((fo, fi) => {
                      let fcls = "btn sm";
                      if (fuDone) {
                        if (fi === fu.ans) fcls += " primary";
                        else if (fi === session.followUpPicked) fcls += " danger";
                      }
                      return `<button class="${fcls}" data-action="pickFollowUp" data-fidx="${fi}" ${fuDone ? "disabled" : ""}>${esc(fo)}</button>`;
                    }).join("")}
                  </div>
                  ${fuDone ? `<div style="margin-top:7px;font-size:12.5px;color:var(--ink-2)"><strong>变形解析：</strong>${esc(fu.exp)}</div>` : ""}
                </div>
              ` : ""}
            ` : `<div class="sub-note">点击上方「🪜 下一步解析」逐步展开三步推导、A–D 逐项诊断与举一反三变形题。</div>`}

            ${(isUnansweredPostExam || chosen !== q.ans) ? `
              <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line-strong)">
                <div style="font-size:12.5px;font-weight:700">🏷 标记本题归因分类（错题本支持按错因与未答专项筛选）：</div>
                <div class="reason-tags">
                  ${META.wrongReasons.map(wr => `<button class="reason-chip ${(rec.wrongReason || (isUnansweredPostExam ? 'unanswered' : q.trap)) === wr.id ? 'active' : ''}" data-action="setWrongReason" data-qid="${q.id}" data-reason="${wr.id}">${esc(wr.label)}</button>`).join("")}
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

    let okCnt = 0, doneCnt = 0, unansCnt = 0;
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
      } else if (session.examSubmitted) {
        unansCnt++;
        cls += " unans";
      }
      return `<button class="${cls}" data-action="jumpQIdx" data-qidx="${i}" aria-label="第 ${i + 1} 题">${i + 1}</button>`;
    }).join("");

    const mini = $("sessionScoreMini");
    if (mini) {
      if (isExamHidden) mini.textContent = `已答 ${doneCnt}/${session.qids.length}`;
      else if (session.examSubmitted) mini.textContent = `对${okCnt} · 错${doneCnt - okCnt} · 未答${unansCnt}`;
      else mini.textContent = `正确 ${okCnt}/${doneCnt}`;
    }
  }

  function recordQuestionOutcome(q, chosenIdx, isReviewSession = false) {
    const ok = chosenIdx === q.ans;
    const today = todayStr(0);
    const prev = state.records[q.id] || {
      mod: q.mod,
      kp: q.kp,
      attempts: 0,
      correct: 0,
      unansweredCount: 0,
      fav: false,
      wrongReason: "",
      masteredMistake: false,
      srsStage: 0,
      lastSrsPromoteDate: "",
      nextReviewAt: today
    };
    prev.mod = q.mod;
    prev.kp = q.kp;
    prev.attempts = (prev.attempts || 0) + 1;
    if (ok) prev.correct = (prev.correct || 0) + 1;
    prev.lastAns = chosenIdx;
    prev.lastOk = ok;
    prev.lastStatus = ok ? "right" : "wrong";
    prev.updatedAt = Date.now();
    delete prev._sameDayCapped;

    if (!ok) {
      prev.masteredMistake = false;
      prev.srsStage = 0;
      prev.nextReviewAt = today;
      if (!prev.wrongReason || prev.wrongReason === "unanswered") prev.wrongReason = q.trap || "clause";
    } else {
      // Anti-farming SRS guard: promote at most ONCE per calendar day AND only when due!
      const isDueToday = !prev.nextReviewAt || prev.nextReviewAt <= today;
      const notPromotedToday = prev.lastSrsPromoteDate !== today;
      if (isDueToday && notPromotedToday) {
        const nextStage = Math.min(5, (prev.srsStage || 0) + 1);
        prev.srsStage = nextStage;
        prev.lastSrsPromoteDate = today;
        const waitDays = META.srsIntervalsDays[nextStage] ?? 7;
        prev.nextReviewAt = todayStr(waitDays);
        if (nextStage >= 5) prev.masteredMistake = true;
      } else {
        prev._sameDayCapped = true;
      }
    }

    state.records[q.id] = prev;
    state.answers[q.id] = chosenIdx;

    const log = ensureTodayLog();
    log.answered = (log.answered || 0) + 1;
    if (ok) log.correct = (log.correct || 0) + 1;
    if (isReviewSession) log.reviewed = (log.reviewed || 0) + 1;
    if (!log.kps.includes(q.kp)) log.kps.push(q.kp);

    const kpInfo = findKpMeta(q.kp);
    state.lastStudy = { view: "practice", mod: q.mod, kp: q.kp, title: kpInfo ? kpInfo.kp.short : "语法闯关", ts: Date.now() };
    save();
    updateHeaderBadges();
  }

  function recordUnansweredExamQuestion(q) {
    const today = todayStr(0);
    const prev = state.records[q.id] || {
      mod: q.mod,
      kp: q.kp,
      attempts: 0,
      correct: 0,
      unansweredCount: 0,
      fav: false,
      wrongReason: "unanswered",
      masteredMistake: false,
      srsStage: 0,
      lastSrsPromoteDate: "",
      nextReviewAt: today
    };
    prev.mod = q.mod;
    prev.kp = q.kp;
    prev.unansweredCount = (prev.unansweredCount || 0) + 1;
    prev.lastOk = false;
    prev.lastStatus = "unanswered";
    prev.masteredMistake = false;
    prev.srsStage = 0;
    prev.nextReviewAt = today;
    if (!prev.wrongReason) prev.wrongReason = "unanswered";
    prev.updatedAt = Date.now();
    state.records[q.id] = prev;
  }

  function submitExam() {
    if (session.examSubmitted) return;
    session.examSubmitted = true;
    session.stepLevel = 3;

    let right = 0, wrong = 0, unanswered = 0;
    for (const qid of session.qids) {
      const q = qById.get(qid);
      if (!q) continue;
      const ch = session.examChoices[qid];
      if (ch !== undefined) {
        recordQuestionOutcome(q, ch, false);
        if (ch === q.ans) right++;
        else wrong++;
      } else {
        unanswered++;
        recordUnansweredExamQuestion(q);
      }
    }

    const startTs = state.activeExam?.startedAt || session.examStartAt || Date.now();
    const sec = Math.max(1, Math.floor((Date.now() - startTs) / 1000));
    const scorePct = session.qids.length ? Math.round((right / session.qids.length) * 100) : 0;

    if (state.activeExam) {
      state.activeExam.active = false;
      state.activeExam.submitted = true;
    }

    state.examHistory.unshift({
      date: todayStr(),
      score: scorePct,
      right,
      wrong,
      unanswered,
      total: session.qids.length,
      sec,
      label: `${session.qids.length}题模拟卷`
    });
    state.examHistory = state.examHistory.slice(0, 25);
    save();
    syncExamHeartbeat();

    session.lastExamBannerHtml = `<div class="surface" style="border-color:var(--green);background:var(--soft)">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px">
        <div>
          <span class="kicker">🎉 模拟考试已交卷结算</span>
          <h3 style="margin:5px 0 2px">卷面得分：${scorePct} 分（答对 ${right} 题 · 错答 ${wrong} 题 · 未答 ${unanswered} 题 · 用时 ${sec} 秒）</h3>
          <div style="font-size:13px;color:var(--ink-2)">错答与未答题目已分别标记状态并加入待复习队列；现在点击右侧任意题号（含紫色未答题）均可查看完整三步详解与逐项排错！</div>
        </div>
        <button class="btn soft" data-action="goView" data-target="mistakes">去错题与待复习本</button>
      </div>
    </div>`;

    if (state.view === "practice") {
      renderPracticeShell();
    }
    updateHeaderBadges();
    announce(`模拟考试已交卷，得分 ${scorePct} 分，答对 ${right} 题，错答 ${wrong} 题，未答 ${unanswered} 题`);
  }

  // ---------------------------------------------------------------------------
  // 12. View 5: Mistake Notebook (Distinguishes Wrong vs Unanswered, Strict attempts>0)
  // ---------------------------------------------------------------------------
  const mistakeFilter = { tab: "due", mod: "all", reason: "all" };

  async function renderMistakesView() {
    const host = $("viewHost");
    try {
      await ensureAllBanksIndexed();
    } catch (err) {
      renderLoadError(host, err, "retryMistakesView");
      return;
    }
    const today = todayStr();
    const dueIds = [], allMistakeIds = [], favIds = [];

    for (const [qid, rec] of Object.entries(state.records)) {
      if (!qById.has(qid)) continue;
      if (rec.fav) favIds.push(qid);
      if (isMistakeRecord(rec)) {
        allMistakeIds.push(qid);
        if (!rec.nextReviewAt || rec.nextReviewAt <= today) dueIds.push(qid);
      }
    }

    let activeIds = mistakeFilter.tab === "due" ? dueIds : mistakeFilter.tab === "fav" ? favIds : allMistakeIds;
    if (mistakeFilter.mod !== "all") activeIds = activeIds.filter(id => qById.get(id)?.mod === mistakeFilter.mod);
    if (mistakeFilter.reason !== "all" && mistakeFilter.tab !== "fav") {
      activeIds = activeIds.filter(id => (state.records[id]?.wrongReason || qById.get(id)?.trap) === mistakeFilter.reason);
    }

    host.innerHTML = `
      <section class="surface" aria-label="错题本与间隔复习控制台">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
          <div>
            <span class="kicker">📕 艾宾浩斯真实间隔防刷分机制（每日最多升 1 阶：当日 ➔ 1天 ➔ 2天 ➔ 4天 ➔ 7天 ➔ 15天斩题）</span>
            <h2 style="margin:6px 0 2px;font-size:21px">错题本、未答补练与星标收藏</h2>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="btn primary" data-action="launchMistakeSession" data-list="due" ${dueIds.length === 0 ? "disabled" : ""}>⏰ 启动今日到期复习 (${dueIds.length})</button>
            <button class="btn soft" data-action="launchMistakeSession" data-list="filtered" ${activeIds.length === 0 ? "disabled" : ""}>🔄 专练当前筛选 (${activeIds.length})</button>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center">
          <button class="btn sm ${mistakeFilter.tab === 'due' ? 'primary' : ''}" data-action="setMisTab" data-tab="due">今日到期 (${dueIds.length})</button>
          <button class="btn sm ${mistakeFilter.tab === 'all' ? 'primary' : ''}" data-action="setMisTab" data-tab="all">全部错题/未答 (${allMistakeIds.length})</button>
          <button class="btn sm ${mistakeFilter.tab === 'fav' ? 'primary' : ''}" data-action="setMisTab" data-tab="fav">★ 收藏夹 (${favIds.length})</button>
          <select id="misModSel" class="btn sm" aria-label="错题专项筛选">
            <option value="all" ${mistakeFilter.mod === "all" ? "selected" : ""}>全部专项</option>
            ${META.modules.map(m => `<option value="${m.id}" ${mistakeFilter.mod === m.id ? "selected" : ""}>专项${m.id} · ${esc(m.title)}</option>`).join("")}
          </select>
          <select id="misReasonSel" class="btn sm" aria-label="按错因或未答筛选">
            <option value="all" ${mistakeFilter.reason === "all" ? "selected" : ""}>全部错因/状态</option>
            ${META.wrongReasons.map(w => `<option value="${w.id}" ${mistakeFilter.reason === w.id ? "selected" : ""}>${esc(w.label)}</option>`).join("")}
          </select>
        </div>
      </section>

      ${activeIds.length === 0 ? `
        <div class="surface" style="text-align:center;padding:36px">
          <h3 style="margin:0 0 6px">当前列表暂无待处理题目 ✨</h3>
          <p style="margin:0 0 14px;color:var(--muted)">收藏未做过的题目只会进入「★ 收藏夹」，绝不会误计入错题本。</p>
          <button class="btn primary" data-action="startSmartPractice">去智能刷题</button>
        </div>
      ` : activeIds.slice(0, 60).map(qid => {
        const q = qById.get(qid);
        const rec = state.records[qid] || {};
        const isUnans = rec.lastStatus === "unanswered" || ((rec.attempts || 0) === 0 && (rec.unansweredCount || 0) > 0);
        const wr = META.wrongReasons.find(x => x.id === (rec.wrongReason || (isUnans ? "unanswered" : q.trap)));
        return `<div class="surface" style="padding:16px 18px" data-mistake-qid="${q.id}">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
              <span class="src-badge ${q.source}">${q.source === "handout" ? "📘 讲义原题" : "✍️ 自编题"}</span>
              ${mistakeFilter.tab !== "fav" ? `<span class="status-pill ${isUnans ? 'unans' : 'wrong'}">${isUnans ? "⚪ 考试未作答" : "✗ 历史错答"}</span>` : `<span class="kicker">★ 已收藏</span>`}
              ${wr && mistakeFilter.tab !== "fav" ? `<span class="kicker">归因：${esc(wr.label)}</span>` : ""}
              ${mistakeFilter.tab !== "fav" ? `<span style="font-size:12px;color:var(--muted)">记忆阶梯 Lv.${rec.srsStage || 0}/5 · 下次到期：${esc(rec.nextReviewAt || today)}</span>` : ""}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn sm soft" data-action="practiceSingleQ" data-qid="${q.id}">单题重练</button>
              ${mistakeFilter.tab !== "fav" ? `<button class="btn sm" data-action="markMistakeMastered" data-qid="${q.id}">✓ 斩掉此题</button>` : ""}
            </div>
          </div>
          <div style="font-weight:700;margin-bottom:6px">${tokenizeEnglishText(q.q, true)}</div>
          <div style="font-size:13px;color:var(--green-deep)"><strong>正确答案：</strong>${esc(q.opts[q.ans])}</div>
          <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${esc(q.exp)}</div>
        </div>`;
      }).join("")}
    `;
  }

  // ---------------------------------------------------------------------------
  // 13. View 6: Unified English Report (3,000 Words + Grammar 500 + Backup Validation)
  // ---------------------------------------------------------------------------
  async function renderReportView() {
    const host = $("viewHost");
    try {
      await ensureAllBanksIndexed();
    } catch (err) {
      renderLoadError(host, err, "retryReportView");
      return;
    }
    const ov = getOverallStats();
    const voc = getVocabSummaryStats();

    const reasonCounts = {};
    for (const w of META.wrongReasons) reasonCounts[w.id] = 0;
    for (const [qid, rec] of Object.entries(state.records)) {
      if (isMistakeRecord(rec)) {
        const isUnans = rec.lastStatus === "unanswered" || ((rec.attempts || 0) === 0 && (rec.unansweredCount || 0) > 0);
        const r = rec.wrongReason || (isUnans ? "unanswered" : qById.get(qid)?.trap || "clause");
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }
    const maxR = Math.max(1, ...Object.values(reasonCounts));
    const vocabPct = Math.round((voc.learned / 3000) * 100);
    const readinessScore = Math.round(vocabPct * 0.5 + ov.overallMastery * 0.5);

    host.innerHTML = `
      <section class="surface" aria-label="专升本英语词汇与语法统一学习报告">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px">
          <div>
            <span class="kicker">📊 词汇 3000 × 语法 500 全景备考大盘（Schema v${state.schemaVersion}）</span>
            <h2 style="margin:6px 0 2px;font-size:22px">辽宁专升本英语统一学习报告</h2>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            <button class="btn sm soft" data-action="exportBackup">⬇ 导出语法备份 JSON</button>
            <label class="btn sm" style="cursor:pointer">⬆ 校验并导入备份<input type="file" id="importBackupInput" accept=".json" style="display:none"></label>
          </div>
        </div>
        <div id="backupMsgBanner"></div>

        <div class="console-stats-row" style="margin-bottom:16px">
          <div class="stat-tile"><div class="num">${readinessScore}%</div><div class="lbl">英语综合备考指数</div></div>
          <div class="stat-tile"><div class="num">${voc.learned} / 3000</div><div class="lbl">核心词汇已学（已斩 ${voc.mastered}）</div></div>
          <div class="stat-tile"><div class="num">${ov.overallMastery}%</div><div class="lbl">五大语法专项掌握度</div></div>
          <div class="stat-tile"><div class="num">${voc.grammarBookWords} 词</div><div class="lbl">语法题联动积累生词</div></div>
        </div>

        <div class="two-col" style="margin-bottom:14px">
          <div class="mini-box">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>🔤 词汇模块实时状态（词迹 3000 词库）</strong>
              <a class="btn sm soft" href="./index.html">去背单词 →</a>
            </div>
            <p>已学习词条：<strong>${voc.learned}</strong> · 已彻底斩词：<strong>${voc.mastered}</strong> · 今日待复习词汇：<strong>${voc.due}</strong> · 星标收藏：<strong>${voc.fav}</strong> · 语法联动生词本：<strong>${voc.grammarBookWords}</strong> 词</p>
            <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, vocabPct)}%"></i></div>
          </div>
          <div class="mini-box">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>📐 语法模块实时状态（500 题 + 6 类实训）</strong>
              <button class="btn sm soft" data-action="startSmartPractice">智能补强 →</button>
            </div>
            <p>题库已覆盖：<strong>${ov.totalPracticed} / 500</strong> · 答题正确率：<strong>${ov.overallAcc}%</strong> · 6类交互实训：<strong>${ov.drillsDone} / ${META.totalDrills}</strong> · 模拟考次数：<strong>${state.examHistory.length}</strong> 次</p>
            <div class="bar" style="margin-top:8px"><i style="width:${ov.overallMastery}%"></i></div>
          </div>
        </div>

        <div class="two-col">
          <div class="mini-box">
            <strong>📈 五大语法专项掌握度（SVG 对比图）</strong>
            <svg viewBox="0 0 420 185" style="width:100%;height:auto;margin-top:8px" role="img" aria-label="五大专项掌握度条形图">
              ${META.modules.map((m, i) => {
                const ms = ov.modStats[i];
                const y = 14 + i * 34;
                const w = Math.max(4, Math.round(ms.mastery * 2.2));
                return `<g><text x="0" y="${y + 15}" font-size="12" font-weight="700" fill="currentColor">${m.id}. ${esc(m.title)}</text><rect x="132" y="${y + 3}" width="224" height="14" rx="7" fill="rgba(148,163,184,0.22)"/><rect x="132" y="${y + 3}" width="${w}" height="14" rx="7" fill="#059669"/><text x="366" y="${y + 15}" font-size="12" font-weight="800" fill="#059669">${ms.mastery}%</text></g>`;
              }).join("")}
            </svg>
          </div>
          <div class="mini-box">
            <strong>🏷 错答与考试未答分布诊断</strong>
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:7px">
              ${META.wrongReasons.map(w => {
                const cnt = reasonCounts[w.id] || 0;
                const pct = Math.round((cnt / maxR) * 100);
                return `<div><div style="display:flex;justify-content:space-between;font-size:12px"><span>${esc(w.label)}</span><strong>${cnt} 题</strong></div><div class="bar" style="height:6px;margin-top:3px"><i style="width:${cnt ? pct : 0}%;background:${w.color}"></i></div></div>`;
              }).join("")}
            </div>
          </div>
        </div>
      </section>

      <section class="surface" aria-label="18个独立考点精细掌握度明细表">
        <h3 style="margin:0 0 10px;font-size:16.5px">🎯 18 个考纲独立考点精细掌握度与靶向补强表</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>所属专项</th><th>独立考点名称</th><th>已刷题数</th><th>答题正确率</th><th>综合掌握度</th><th>靶向行动</th></tr></thead>
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
  // 14. Race-Free Global Search (Seq incremented BEFORE empty-query return!)
  // ---------------------------------------------------------------------------
  let searchSeq = 0;

  async function runGlobalSearch(rawQuery) {
    // CRITICAL FIX: Increment searchSeq FIRST so clearing input cancels any pending async search!
    const seq = ++searchSeq;
    const q = (rawQuery || "").trim().toLowerCase();
    const sHost = $("searchHost");
    const clearBtn = $("clearSearchBtn");
    if (clearBtn) clearBtn.style.display = q ? "inline-flex" : "none";
    if (!q) {
      if (sHost) sHost.innerHTML = "";
      return;
    }

    sHost.innerHTML = `<div class="search-results-panel">正在全库精准检索「${esc(rawQuery)}」…</div>`;
    try {
      await Promise.all([window.WSG_ensureAllModules(true), ensureAllBanksIndexed()]);
    } catch (err) {
      if (seq !== searchSeq) return;
      renderLoadError(sHost, err, "retrySearch");
      return;
    }
    if (seq !== searchSeq) return;

    const matchedKps = [];
    for (const m of allModulesList(true)) {
      const mData = window.WSG_MODULES[m.id];
      if (!mData) continue;
      for (const card of mData.cards) {
        const plain = card.handoutHtml.replace(/<[^>]+>/g, " ");
        const hay = `${card.title} ${card.short} ${plain} ${card.strictVsTip.tip} ${card.strictVsTip.strict} ${card.zero.concept}`.toLowerCase();
        if (hay.includes(q)) matchedKps.push({ mod: m, card });
      }
    }

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
                <div><span class="kicker">专项 ${mod.id}</span><div style="font-weight:750;margin-top:3px">${esc(card.title)}</div></div>
                <button class="btn sm soft" data-action="jumpKp" data-mod="${mod.id}" data-kp="${card.kpId}">定位讲义</button>
              </div>`).join("")}
            </div>
          </div>` : ""}
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <span style="font-size:12.5px;font-weight:750;color:var(--muted)">✍️ 命中的题库单题（精准展示 ${matchedQs.length} 道）</span>
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
        </div>
      </section>
    `;
    sHost._lastMatchedQids = matchedQs.map(x => x.id);
  }

  // ---------------------------------------------------------------------------
  // 15. 3-Mode Print Engine
  // ---------------------------------------------------------------------------
  let lastPrintPaperQids = [];

  function openPrintModal() {
    const mHost = $("modalHost");
    const countLabel = session.qids && session.qids.length ? `当前练习组（${session.qids.length} 题）` : "均衡抽取 20 题标准卷";
    mHost.innerHTML = `
      <div class="modal-backdrop" data-action="closeModalBg">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="printDialogTitle">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 id="printDialogTitle" style="margin:0;font-size:18px">🖨 打印与纸质资料导出中心</h3>
            <button class="btn sm" data-action="closeModal" aria-label="关闭弹窗">✕</button>
          </div>
          <p style="margin:0 0 14px;font-size:13.5px;color:var(--muted)">支持直出 A4 纸质文档或在系统打印面板另存为 PDF：</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn primary" style="justify-content:flex-start;padding:12px 16px" data-action="execPrint" data-pmode="handout">📄 1. 打印完整语法讲义（含专项零 + 五大专项 574 处填空答案）</button>
            <button class="btn soft" style="justify-content:flex-start;padding:12px 16px" data-action="execPrint" data-pmode="exam-blank">📝 2. 打印无答案测试卷（基于${esc(countLabel)}，隐藏全部答案与提示）</button>
            <button class="btn" style="justify-content:flex-start;padding:12px 16px" data-action="execPrint" data-pmode="exam-key">✅ 3. 打印配套答案速查表与逐项详解卷</button>
          </div>
        </div>
      </div>
    `;
  }

  async function executePrint(pmode) {
    const pSheet = $("printSheet");
    $("modalHost").innerHTML = "";
    if (pmode === "handout") {
      await window.WSG_ensureAllModules(true);
      pSheet.innerHTML = `
        <div class="print-header">
          <h1>辽宁专升本英语 · 核心语法讲义全解（含专项零与五大专项）</h1>
          <div>包含全部 574 处考纲核心填空、应试口诀与严格语法校对 · 日期：${todayStr()}</div>
        </div>
        ${allModulesList(true).map(m => {
          const md = window.WSG_MODULES[m.id];
          return `<section style="margin-bottom:20px"><h2>专项 ${m.id}：${esc(m.title)}</h2>
            ${md.cards.map(c => `<div class="print-card">${c.handoutHtml}<div style="margin-top:8px;font-size:10pt;border-top:1px dashed #999;padding-top:6px"><strong>【应试口诀】</strong>${esc(c.strictVsTip.tip)}<br><strong>【严格语法校对】</strong>${esc(c.strictVsTip.strict)}</div></div>`).join("")}
          </section>`;
        }).join("")}
      `;
    } else {
      await ensureAllBanksIndexed();
      if (session.qids && session.qids.length) lastPrintPaperQids = [...session.qids];
      else if (!lastPrintPaperQids.length) {
        lastPrintPaperQids = [];
        for (const mid of ["1", "2", "3", "4", "5"]) {
          const arr = shuffle(window.WSG_BANKS[mid] || []).slice(0, 4);
          lastPrintPaperQids.push(...arr.map(x => x.id));
        }
      }
      const paperQs = lastPrintPaperQids.map(id => qById.get(id)).filter(Boolean);
      if (pmode === "exam-blank") {
        pSheet.innerHTML = `
          <div class="print-header"><h1>辽宁专升本英语 · 语法测试卷（无答案版）</h1><div>总题数：${paperQs.length} 题 ｜ 姓名：__________ ｜ 日期：${todayStr()} ｜ 得分：______</div></div>
          ${paperQs.map((q, idx) => `<div class="print-q"><div><strong>${idx + 1}.</strong> [${esc(q.sourceLabel)}] ${esc(q.q.replace(/^\d+\.\s*（[^）]+）/, ""))}</div><div class="print-opts">${q.opts.map(o => `<span>${esc(o)}</span>`).join("")}</div></div>`).join("")}
        `;
      } else {
        pSheet.innerHTML = `
          <div class="print-header"><h1>辽宁专升本英语 · 测试卷参考答案与详解</h1><div>配套题数：${paperQs.length} 题 ｜ 日期：${todayStr()}</div></div>
          <div class="print-card"><strong>一、快速对答案表：</strong><br>${paperQs.map((q, idx) => `<span style="display:inline-block;min-width:72px;margin:3px 6px 3px 0">${idx + 1}. <strong>${String.fromCharCode(65 + q.ans)}</strong></span>`).join("")}</div>
          <h3>二、逐题三步详解</h3>
          ${paperQs.map((q, idx) => `<div class="print-q"><div><strong>${idx + 1}. 正确答案：${esc(q.opts[q.ans])}</strong></div><div style="font-size:10pt;margin-top:3px">${q.steps.map(s => esc(s)).join(" ")}</div><div style="font-size:10pt;margin-top:2px"><strong>总结：</strong>${esc(q.exp)}</div></div>`).join("")}
        `;
      }
    }
    document.body.dataset.printMode = pmode;
    setTimeout(() => window.print(), 60);
  }

  // ---------------------------------------------------------------------------
  // 16. Router & Global Event Delegation (Exam Timer Preserved Across Views!)
  // ---------------------------------------------------------------------------
  async function switchView(viewName, extra = {}) {
    // DO NOT kill activeExam timer when switching views!
    state.view = viewName;
    if (extra.mod !== undefined && extra.mod !== null) state.activeMod = String(extra.mod);
    save();
    updateHeaderBadges();

    if (viewName === "dashboard") {
      renderDashboard();
    } else if (viewName === "learn") {
      await renderLearnView(extra.kp || "");
    } else if (viewName === "drills") {
      await renderDrillsView();
    } else if (viewName === "practice") {
      if (state.activeExam && state.activeExam.active && !state.activeExam.submitted) {
        await ensureAllBanksIndexed();
        restoreSessionFromActiveExam();
        renderPracticeShell();
      } else if (!session.qids.length) {
        const smartIds = await buildAdaptivePracticeQids(state.dailyGoal || 15);
        await startSession({ mode: "practice", title: "智能自适应闯关", customQids: smartIds });
      } else {
        renderPracticeShell();
      }
    } else if (viewName === "mistakes") {
      await renderMistakesView();
    } else if (viewName === "report") {
      await renderReportView();
    }
    syncExamHeartbeat();
    if (!extra.kp) window.scrollTo({ top: 0, behavior: prefersNoMotion() ? "auto" : "smooth" });
  }

  document.addEventListener("click", async e => {
    // 0. Clickable English word lookup (.w-tok)
    const wTok = e.target.closest(".w-tok");
    if (wTok && !(session.mode === "exam" && !session.examSubmitted && state.view === "practice")) {
      e.stopPropagation();
      openWordPopover(wTok.dataset.word);
      return;
    }

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

    // 3. View Navigation
    const navBtn = e.target.closest("[data-view]");
    if (navBtn) {
      await switchView(navBtn.dataset.view);
      return;
    }

    const actEl = e.target.closest("[data-action]");
    if (!actEl) return;
    const act = actEl.dataset.action;

    switch (act) {
      case "goView":
        await switchView(actEl.dataset.target, { mod: actEl.dataset.mod });
        break;

      case "resumeActiveExam":
        await switchView("practice");
        break;

      case "submitExamNow":
        await ensureAllBanksIndexed();
        restoreSessionFromActiveExam();
        submitExam();
        await switchView("practice");
        break;

      case "continueLast": {
        if (state.activeExam?.active && !state.activeExam.submitted) {
          await switchView("practice");
          break;
        }
        const ls = state.lastStudy || {};
        if (ls.view === "practice") await switchView("practice");
        else if (ls.view === "drills") await switchView("drills");
        else await switchView("learn", { mod: ls.mod || "1", kp: ls.kp || "" });
        break;
      }

      case "openModLearn":
        await switchView("learn", { mod: actEl.dataset.mod });
        break;

      case "selectLearnMod":
        state.activeMod = String(actEl.dataset.mod);
        save();
        await renderLearnView();
        break;

      case "retryLearnView":
        await renderLearnView();
        break;
      case "retryDrillsView":
        await renderDrillsView();
        break;
      case "retryPracticeLoad":
        await startSession({ mode: session.mode, count: session.count });
        break;
      case "retryMistakesView":
        await renderMistakesView();
        break;
      case "retryReportView":
        await renderReportView();
        break;
      case "retrySearch":
        await runGlobalSearch($("globalSearchInput")?.value || "");
        break;

      case "jumpKp": {
        const mid = String(actEl.dataset.mod || "1");
        const kpid = actEl.dataset.kp || "";
        const kpInfo = findKpMeta(kpid);
        state.lastStudy = { view: "learn", mod: mid, kp: kpid, title: kpInfo ? kpInfo.kp.short : "语法讲义", ts: Date.now() };
        const log = ensureTodayLog();
        if (kpid && !log.kps.includes(kpid)) log.kps.push(kpid);
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
        if (!state.mask) { state.mask = true; updateHeaderBadges(); }
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

      // --- 6 Interactive Drill Handlers ---
      case "selectDrillType":
        Object.assign(drillState, { type: actEl.dataset.dtype, idxInType: 0, dragBuilt: [], dragPool: null, pickedSeg: null, pickedFix: null, checkedResult: null });
        state.lastStudy = { view: "drills", title: "交互实训工坊", ts: Date.now() };
        save();
        await renderDrillsView();
        break;

      case "prevDrill":
      case "nextDrill":
        drillState.idxInType += (act === "nextDrill" ? 1 : -1);
        Object.assign(drillState, { dragBuilt: [], dragPool: null, pickedSeg: null, pickedFix: null, checkedResult: null });
        await renderDrillsView();
        break;

      case "drillPickRole": {
        const idx = Number(actEl.dataset.idx);
        const item = window.WSG_DRILLS.items.filter(x => x.type === drillState.type)[drillState.idxInType];
        drillState.pickedSeg = idx;
        const ok = idx === item.ansIdx;
        drillState.checkedResult = { ok, msg: ok ? "" : `正确成分应为「${item.tokens[item.ansIdx]}」` };
        if (ok) markDrillCompleted(item);
        await renderDrillsView();
        break;
      }

      case "drillAddChunk": {
        const pi = Number(actEl.dataset.pidx);
        if (drillState.dragPool && drillState.dragPool[pi]) {
          const [moved] = drillState.dragPool.splice(pi, 1);
          drillState.dragBuilt.push(moved);
          drillState.checkedResult = null;
          await renderDrillsView();
        }
        break;
      }

      case "drillRemoveChunk": {
        const bi = Number(actEl.dataset.bidx);
        if (drillState.dragBuilt[bi]) {
          const [moved] = drillState.dragBuilt.splice(bi, 1);
          drillState.dragPool.push(moved);
          drillState.checkedResult = null;
          await renderDrillsView();
        }
        break;
      }

      case "drillResetOrder":
        Object.assign(drillState, { dragBuilt: [], dragPool: null, checkedResult: null });
        await renderDrillsView();
        break;

      case "drillCheckOrder": {
        const item = window.WSG_DRILLS.items.filter(x => x.type === drillState.type)[drillState.idxInType];
        const userSent = drillState.dragBuilt.map(x => x.text).join(" ");
        const rightSent = item.chunks.join(" ");
        const ok = userSent === rightSent;
        drillState.checkedResult = { ok, msg: ok ? "" : `正确语序为：${rightSent}` };
        if (ok) markDrillCompleted(item);
        await renderDrillsView();
        break;
      }

      case "drillVerbHint": {
        const item = window.WSG_DRILLS.items.filter(x => x.type === drillState.type)[drillState.idxInType];
        const hb = $("drillVerbHintBox");
        if (hb) hb.innerHTML = `<div class="hint-box">💡 ${esc(item.hint)}</div>`;
        break;
      }

      case "drillCheckVerb": {
        const item = window.WSG_DRILLS.items.filter(x => x.type === drillState.type)[drillState.idxInType];
        const val = ($("drillVerbInput")?.value || "").trim().replace(/\s+/g, " ").toLowerCase();
        const ok = item.answers.some(a => a.toLowerCase() === val);
        drillState.checkedResult = { ok, msg: ok ? "" : `标准答案：${item.answers[0]}` };
        if (ok) markDrillCompleted(item);
        await renderDrillsView();
        break;
      }

      case "drillPickMcq": {
        const idx = Number(actEl.dataset.idx);
        const item = window.WSG_DRILLS.items.filter(x => x.type === drillState.type)[drillState.idxInType];
        drillState.pickedSeg = idx;
        const ok = idx === item.ans;
        drillState.checkedResult = { ok, msg: ok ? "" : `正确答案是 ${item.opts[item.ans]}` };
        if (ok) markDrillCompleted(item);
        await renderDrillsView();
        break;
      }

      case "drillPickErrSeg": {
        const idx = Number(actEl.dataset.idx);
        drillState.pickedSeg = idx;
        drillState.checkedResult = null;
        await renderDrillsView();
        break;
      }

      case "drillPickErrFix": {
        const fi = Number(actEl.dataset.idx);
        const item = window.WSG_DRILLS.items.filter(x => x.type === drillState.type)[drillState.idxInType];
        drillState.pickedFix = fi;
        const ok = drillState.pickedSeg === item.errIdx && fi === item.fixAns;
        drillState.checkedResult = { ok, msg: ok ? "" : `病句位置：「${item.segments[item.errIdx]}」➔ 应${item.fixOpts[item.fixAns]}` };
        if (ok) markDrillCompleted(item);
        await renderDrillsView();
        break;
      }

      // --- Practice & Exam Handlers ---
      case "openModQuiz":
        session.lastExamBannerHtml = "";
        await startSession({ mode: "practice", title: `专项 ${actEl.dataset.mod} 强化训练`, filterMod: actEl.dataset.mod, filterKp: "all", filterSource: "all", count: 100 });
        break;

      case "practiceKp": {
        const mid = actEl.dataset.mod, kpid = actEl.dataset.kp, info = findKpMeta(kpid);
        session.lastExamBannerHtml = "";
        await startSession({ mode: "practice", title: info ? info.kp.short : "考点专练", filterMod: mid, filterKp: kpid, filterSource: "all", count: 35 });
        break;
      }

      case "startSmartPractice": {
        session.lastExamBannerHtml = "";
        try {
          const smartIds = await buildAdaptivePracticeQids(state.dailyGoal || 15);
          await startSession({ mode: "practice", title: state.beginnerMode ? "零基础友好智能闯关" : "自适应弱项智能闯关", customQids: smartIds });
        } catch (err) {
          state.view = "practice";
          updateHeaderBadges();
          renderLoadError($("viewHost"), err, "startSmartPractice");
        }
        break;
      }

      case "practiceHandoutOnly":
        session.lastExamBannerHtml = "";
        await startSession({ mode: "practice", title: "18道讲义原题精练", filterMod: "all", filterKp: "all", filterSource: "handout", count: 18 });
        break;

      case "startExam": {
        const cnt = Number(actEl.dataset.count || 20);
        session.lastExamBannerHtml = "";
        await startSession({ mode: "exam", title: `${cnt}题全真模拟考`, filterMod: "all", filterKp: "all", filterSource: "all", filterDiff: "all", count: cnt });
        break;
      }

      case "applyPracFilter":
        session.lastExamBannerHtml = "";
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

      case "chooseOpt": {
        const qid = actEl.dataset.qid;
        const idx = Number(actEl.dataset.idx);
        const q = qById.get(qid);
        if (!q) break;

        if (session.mode === "exam" && !session.examSubmitted) {
          session.examChoices[qid] = idx;
          if (state.activeExam && state.activeExam.active) {
            state.activeExam.choices[qid] = idx;
            state.activeExam.idx = session.idx;
            save();
          }
          renderSingleQuestionOnly();
          renderPaletteOnly();
          break;
        }

        if (session.currentSessionAnswers[qid] !== undefined) break;
        session.currentSessionAnswers[qid] = idx;
        session.stepLevel = 1;
        session.followUpPicked = null;
        recordQuestionOutcome(q, idx, session.mode === "review");
        renderSingleQuestionOnly();
        renderPaletteOnly();
        wsgAnimate(document.querySelector("#singleQuestionHost .q-stage-card"), { scale: [0.99, 1], duration: 180 });
        announce(idx === q.ans ? "回答正确" : "回答错误，已展开第一步解析");
        break;
      }

      case "stepHint": {
        const q = qById.get(session.qids[session.idx]);
        const maxH = Array.isArray(q?.hints) ? q.hints.length : 1;
        session.hintLevel = Math.min(maxH, (session.hintLevel || 0) + 1);
        renderSingleQuestionOnly();
        break;
      }

      case "nextStepExp":
        session.stepLevel = Math.min(3, (session.stepLevel || 1) + 1);
        renderSingleQuestionOnly();
        break;

      case "fullStepExp":
        session.stepLevel = 3;
        renderSingleQuestionOnly();
        break;

      case "pickFollowUp":
        session.followUpPicked = Number(actEl.dataset.fidx);
        renderSingleQuestionOnly();
        break;

      case "prevQ":
      case "nextQ": {
        const delta = act === "nextQ" ? 1 : -1;
        const nextIdx = session.idx + delta;
        if (nextIdx >= 0 && nextIdx < session.qids.length) {
          session.idx = nextIdx;
          if (session.mode === "exam" && state.activeExam?.active && !session.examSubmitted) {
            state.activeExam.idx = nextIdx;
            save();
          }
          session.hintLevel = 0;
          session.followUpPicked = null;
          session.stepLevel = session.examSubmitted ? 3 : 1;
          renderSingleQuestionOnly();
          renderPaletteOnly();
        }
        break;
      }

      case "jumpQIdx":
        session.idx = Number(actEl.dataset.qidx || 0);
        if (session.mode === "exam" && state.activeExam?.active && !session.examSubmitted) {
          state.activeExam.idx = session.idx;
          save();
        }
        session.hintLevel = 0;
        session.followUpPicked = null;
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
          // CRITICAL FIX: attempts=0 and NO lastOk=false so favoriting NEVER pollutes mistake book!
          state.records[qid] = { mod: q?.mod || "1", kp: q?.kp || "kp-1-1", attempts: 0, correct: 0, unansweredCount: 0, fav: true, srsStage: 0 };
        } else {
          state.records[qid].fav = !state.records[qid].fav;
        }
        save();
        updateHeaderBadges();
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
          .filter(([qid, r]) => qById.has(qid) && isMistakeRecord(r) && (!r.nextReviewAt || r.nextReviewAt <= today))
          .map(([qid]) => qid);
        if (!due.length) await switchView("mistakes");
        else {
          session.lastExamBannerHtml = "";
          await startSession({ mode: "review", title: "今日到期错题与未答复习", customQids: due });
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
        const ids = Object.entries(state.records).filter(([qid, r]) => {
          if (!qById.has(qid)) return false;
          if (actEl.dataset.list === "due") return isMistakeRecord(r) && (!r.nextReviewAt || r.nextReviewAt <= today);
          if (mistakeFilter.tab === "fav") return !!r.fav;
          if (!isMistakeRecord(r)) return false;
          if (mistakeFilter.mod !== "all" && qById.get(qid)?.mod !== mistakeFilter.mod) return false;
          const isUnans = r.lastStatus === "unanswered" || ((r.attempts || 0) === 0 && (r.unansweredCount || 0) > 0);
          if (mistakeFilter.reason !== "all" && (r.wrongReason || (isUnans ? "unanswered" : qById.get(qid)?.trap)) !== mistakeFilter.reason) return false;
          return true;
        }).map(([qid]) => qid);
        if (ids.length) {
          session.lastExamBannerHtml = "";
          await startSession({ mode: "review", title: "错题靶向重练", customQids: ids });
        }
        break;
      }

      case "practiceSingleQ": {
        await ensureAllBanksIndexed();
        const qid = actEl.dataset.qid;
        $("globalSearchInput").value = "";
        await runGlobalSearch("");
        session.lastExamBannerHtml = "";
        await startSession({ mode: "practice", title: "单题精练", customQids: [qid] });
        break;
      }

      case "practiceMatchedQs": {
        const qids = $("searchHost")._lastMatchedQids || [];
        if (qids.length) {
          $("globalSearchInput").value = "";
          await runGlobalSearch("");
          session.lastExamBannerHtml = "";
          await startSession({ mode: "practice", title: "搜索命中专练", customQids: qids });
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

      // --- Word Lookup Popover Actions ---
      case "closeWordPop":
        $("wordPopoverHost").innerHTML = "";
        break;
      case "closeWordPopBg":
        if (e.target === actEl) $("wordPopoverHost").innerHTML = "";
        break;
      case "speakPopWord":
        speakWord(actEl.dataset.w);
        break;
      case "saveWordToBook": {
        const entry = $("wordPopoverHost")?._currentEntry;
        if (entry) {
          const customCn = $("popCustomCn")?.value || "";
          const res = addWordToPersonalVocab(entry, customCn);
          if (res.ok) {
            const btn = $("addVocabBtn");
            if (btn) { btn.textContent = "✓ 已收入语法生词本"; btn.className = "btn sm soft"; }
            announce(`已将 ${entry.w} 加入词迹语法生词本`);
          }
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
        const payload = Object.assign({}, state, { exportedAt: new Date().toISOString(), app: "wordsteps-grammar" });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `wordsteps-grammar-v3-backup-${todayStr()}.json`;
        a.click();
        break;
      }
    }
  });

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
      const banner = $("backupMsgBanner");
      try {
        const txt = await e.target.files[0].text();
        const parsed = JSON.parse(txt);
        const check = validateBackupPayload(parsed);
        if (!check.ok) {
          if (banner) banner.innerHTML = `<div class="callout warn" role="alert">❌ 导入被拒绝：${esc(check.error)}</div>`;
          return;
        }
        state = migrateStateToV3(parsed);
        save();
        updateHeaderBadges();
        await renderReportView();
        const b2 = $("backupMsgBanner");
        if (b2) b2.innerHTML = `<div class="callout" role="status">✓ 备份校验通过，历史学习记录已安全恢复！</div>`;
        announce("语法学习备份校验通过并已恢复");
      } catch (_) {
        if (banner) banner.innerHTML = `<div class="callout warn" role="alert">❌ 文件不是合法的 JSON 备份格式，已拒绝导入以保护现有数据。</div>`;
      }
    }
  });

  $("beginnerToggle")?.addEventListener("click", async () => {
    state.beginnerMode = !state.beginnerMode;
    if (state.beginnerMode) state.activeMod = "0";
    save();
    updateHeaderBadges();
    await switchView(state.view);
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
  $("motionToggle")?.addEventListener("click", () => { state.reduceMotion = !state.reduceMotion; save(); updateHeaderBadges(); });
  $("themeBtn")?.addEventListener("click", () => { state.dark = !state.dark; save(); updateHeaderBadges(); });
  document.querySelectorAll(".dot").forEach(dot => dot.addEventListener("click", () => { state.palette = dot.dataset.pal; save(); updateHeaderBadges(); }));

  $("globalSearchInput")?.addEventListener("input", e => runGlobalSearch(e.target.value));
  $("clearSearchBtn")?.addEventListener("click", () => { $("globalSearchInput").value = ""; runGlobalSearch(""); });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if ($("wordPopoverHost")?.innerHTML) { $("wordPopoverHost").innerHTML = ""; return; }
      if ($("modalHost")?.innerHTML) { $("modalHost").innerHTML = ""; return; }
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("w-tok")) {
      e.preventDefault();
      openWordPopover(e.target.dataset.word);
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("cloze") && state.mask) {
      e.preventDefault();
      e.target.classList.toggle("revealed");
      return;
    }
    if (e.key === "Enter" && e.target.id === "drillVerbInput") {
      document.querySelector('[data-action="drillCheckVerb"]')?.click();
      return;
    }
    const tag = (e.target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (state.view === "practice" && session.qids.length) {
      if (["1", "2", "3", "4"].includes(e.key)) {
        const btn = document.querySelector(`#singleQuestionHost .opt-btn[data-idx="${Number(e.key) - 1}"]`);
        if (btn && !btn.disabled) btn.click();
      } else if (e.key.toLowerCase() === "h") {
        document.querySelector('[data-action="stepHint"]')?.click();
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

  // Service Worker Registration for Offline Learning & Resource Update Toast
  function registerOfflineServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("./sw.js?v=" + encodeURIComponent(window.WSG_ASSET_VERSION || "3.0.0"))
      .then(reg => {
        const promptUpdate = worker => {
          const toast = $("swUpdateToast");
          if (!toast) return;
          toast.style.display = "flex";
          toast.innerHTML = `<span>✨ 发现新版本语法学习资源</span><button class="btn sm primary" id="swReloadBtn">立即更新</button>`;
          $("swReloadBtn")?.addEventListener("click", () => {
            worker.postMessage({ type: "SKIP_WAITING" });
          });
        };
        if (reg.waiting) promptUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) promptUpdate(nw);
          });
        });
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          location.reload();
        });
      }).catch(() => {});
  }

  // Startup initialization + restore activeExam if running!
  updateHeaderBadges();
  if (state.activeExam && state.activeExam.active && !state.activeExam.submitted) {
    ensureAllBanksIndexed().then(() => {
      restoreSessionFromActiveExam();
      syncExamHeartbeat();
      switchView(state.view);
    }).catch(() => switchView(state.view));
  } else {
    switchView(state.view);
    setTimeout(() => {
      ensureAllBanksIndexed().then(() => {
        updateHeaderBadges();
        if (state.view === "dashboard") renderDashboard();
      }).catch(() => {});
    }, 260);
  }
  registerOfflineServiceWorker();
})();
