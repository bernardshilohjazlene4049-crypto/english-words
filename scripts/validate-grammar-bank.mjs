#!/usr/bin/env node
/**
 * 辽宁专升本英语语法题库与模块完整性自动化校验脚本 V4.0 (scripts/validate-grammar-bank.mjs)
 * 检测项：
 *  1. 五大专项 574 处原版讲义挖空完整保留
 *  2. 500 道主干题（18 讲义题 + 482 自编题）零重复 ID、零重复题干、答案索引有效、选项无重复
 *  3. 500 道变形自测题（followUp）题干 100% 独立去重（500/500 唯一），且与 500 道主干题零重复
 *  4. 零“动词原形只能作谓语”等不准确表述、零【目标结构】占位残留、零提示词答案泄露、零伪造真题标签
 *  5. 全部 18 道讲义题具备 origHandout 原题与改编溯源，全部 500 题具备 grammarNote（严格语法/口诀/应试偏好三层校对）
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const sandbox = { window: {}, console, setTimeout, clearTimeout };
sandbox.window = sandbox;
vm.createContext(sandbox);

for (const fn of [
  "grammar-meta.js",
  "grammar-mod-0.js", "grammar-mod-1.js", "grammar-mod-2.js", "grammar-mod-3.js", "grammar-mod-4.js", "grammar-mod-5.js",
  "grammar-bank-1.js", "grammar-bank-2.js", "grammar-bank-3.js", "grammar-bank-4.js", "grammar-bank-5.js"
]) {
  const full = path.join(rootDir, fn);
  if (!fs.existsSync(full)) throw new Error(`缺失模块文件: ${fn}`);
  vm.runInContext(fs.readFileSync(full, "utf8"), sandbox, { filename: fn });
}

const meta = sandbox.WSG_META;
const validKps = new Set();
for (const m of meta.modules) for (const kp of m.kps) validKps.add(kp.id);

// 1. Verify 574 original clozes in Modules 1..5
let totalClozes = 0;
for (const mid of ["1", "2", "3", "4", "5"]) {
  const mod = sandbox.WSG_MODULES[mid];
  for (const c of mod.cards) {
    const cnt = (c.handoutHtml.match(/<span class="cloze"/g) || []).length;
    totalClozes += cnt;
  }
}
if (totalClozes !== 574) {
  console.error(`❌ 挖空数量校验失败：期望 574 处，实际 ${totalClozes} 处`);
  process.exit(1);
}

// 2. Verify all 500 main questions + 500 unique followUp variants
const allQs = [];
for (const mid of ["1", "2", "3", "4", "5"]) {
  const arr = sandbox.WSG_BANKS[mid];
  if (!Array.isArray(arr) || arr.length !== 100) {
    console.error(`❌ 专项 ${mid} 题量异常：${arr?.length}`);
    process.exit(1);
  }
  allQs.push(...arr);
}

const normText = s => String(s || "").replace(/^变形(自测|对比|题)\s*[：:]\s*/i, "").replace(/^\d+\.\s*（[^）]+）\s*/, "").replace(/\s+/g, " ").trim().toLowerCase();

const seenIds = new Set();
const seenMainStems = new Map();
const seenFollowUpStems = new Map();
let handoutCnt = 0, authoredCnt = 0, origHandoutCnt = 0, grammarNoteCnt = 0;
let mainDupCount = 0, fuDupCount = 0, crossDupCount = 0;
const errors = [];

for (const q of allQs) {
  if (seenIds.has(q.id)) errors.push(`重复题目 ID: ${q.id}`);
  seenIds.add(q.id);

  const mStem = normText(q.q);
  if (!mStem) {
    errors.push(`空题干 (${q.id})`);
  } else if (seenMainStems.has(mStem)) {
    mainDupCount++;
    errors.push(`重复主干题 (${q.id} 与 ${seenMainStems.get(mStem)}): ${q.q}`);
  } else {
    seenMainStems.set(mStem, q.id);
  }

  if (!validKps.has(q.kp)) errors.push(`失效考点 ID (${q.id}): ${q.kp}`);
  if (!Array.isArray(q.opts) || q.opts.length < 2) errors.push(`选项数量不足 (${q.id})`);
  if (typeof q.ans !== "number" || q.ans < 0 || q.ans >= q.opts.length) errors.push(`错误答案索引 (${q.id}): ans=${q.ans}`);
  if (new Set(q.opts).size !== q.opts.length) errors.push(`存在重复选项 (${q.id})`);

  if (q.source === "handout") {
    handoutCnt++;
    if (!q.origHandout || !q.origHandout.doc || !q.origHandout.origQ) {
      errors.push(`讲义题缺失原题溯源 origHandout (${q.id})`);
    } else {
      origHandoutCnt++;
    }
  } else if (q.source === "authored") {
    authoredCnt++;
  } else {
    errors.push(`未知题源 (${q.id}): ${q.source}`);
  }

  if (q.grammarNote && q.grammarNote.strict && q.grammarNote.mnemonic && q.grammarNote.examPref) {
    grammarNoteCnt++;
  } else {
    errors.push(`缺失三层语法校对 grammarNote (${q.id})`);
  }

  if (/真题/.test(q.sourceLabel || "") || /真题/.test(q.q || "")) {
    errors.push(`检测到疑似伪造真题表述 (${q.id})`);
  }

  // Check inaccurate bare-infinitive claims & placeholder artifacts
  const positiveAssertionText = [q.q, q.hint, ...(q.hints || []), ...(q.steps || [])].join(" ");
  if (/原形[^。；]*?(只能|只可|仅能)(作|充当)谓语/.test(positiveAssertionText)) {
    errors.push(`存在“原形只能作谓语”不准确语法表述 (${q.id})`);
  }
  const fullJson = JSON.stringify(q);
  if (fullJson.includes("【目标结构】")) {
    errors.push(`残留【目标结构】占位符 (${q.id})`);
  }

  if (!q.hint || !Array.isArray(q.hints) || q.hints.length !== 3) errors.push(`缺失三级提示 (${q.id})`);
  if (!Array.isArray(q.steps) || q.steps.length !== 3 || !q.exp) errors.push(`缺失三步解析或总结 (${q.id})`);
  if (!Array.isArray(q.optExps) || q.optExps.length !== q.opts.length) errors.push(`逐项解析数量与选项不一致 (${q.id})`);

  // Validate followUp uniqueness & structure
  const fu = q.followUp;
  if (!fu || !fu.q || !Array.isArray(fu.opts) || fu.opts.length < 2 || typeof fu.ans !== "number" || fu.ans < 0 || fu.ans >= fu.opts.length || !fu.exp) {
    errors.push(`变形题结构不完整或答案越界 (${q.id})`);
  } else {
    if (new Set(fu.opts).size !== fu.opts.length) errors.push(`变形题存在重复选项 (${q.id})`);
    const fuStem = normText(fu.q);
    const blankMatches = (fu.q.match(/____/g) || []).length;
    const afterColon = String(fu.q).split("：").pop().trim();
    if (/^[a-z]/.test(afterColon)) errors.push(`变形题句首未大写 (${q.id}): ${fu.q}`);
    if (blankMatches > 1 && !fu.opts[0].includes(";")) errors.push(`变形题出现多余双挖空 (${q.id}): ${fu.q}`);
    if (!fuStem || !fuStem.includes("____")) {
      errors.push(`变形题缺少挖空 ____ (${q.id}): ${fu.q}`);
    }
    if (seenFollowUpStems.has(fuStem)) {
      fuDupCount++;
      errors.push(`重复变形题干 (${q.id} 与 ${seenFollowUpStems.get(fuStem)}): ${fu.q}`);
    } else {
      seenFollowUpStems.set(fuStem, q.id);
    }
    if (seenMainStems.has(fuStem)) {
      crossDupCount++;
      errors.push(`变形题与主干题重复 (${q.id}): ${fu.q}`);
    }
  }

  // Check answer leak in hints
  const ansClean = String(q.opts[q.ans] || "").replace(/^[A-D]\.\s*/, "").trim();
  const ansWords = (ansClean.match(/[a-zA-Z]{3,}/g) || []).filter(w => !["the", "been", "have", "has", "had", "not", "for", "with"].includes(w.toLowerCase()));
  for (const w of ansWords) {
    const re = new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    for (const h of [q.hint, ...(q.hints || [])]) {
      if (re.test(h)) errors.push(`提示词泄露答案词 "${w}" (${q.id}): ${h}`);
    }
  }
}

if (handoutCnt !== 18 || authoredCnt !== 482) {
  errors.push(`题源比例异常：讲义原题=${handoutCnt}, 自编题=${authoredCnt}`);
}

console.log(JSON.stringify({
  stage: "P0-Validator",
  mainQuestions: allQs.length,
  uniqueMainStems: seenMainStems.size,
  mainDuplicates: mainDupCount,
  followUpQuestions: seenFollowUpStems.size,
  followUpDuplicates: fuDupCount,
  crossMainFollowUpDuplicates: crossDupCount,
  handoutProvenanceCount: origHandoutCnt,
  threeTierGrammarNoteCount: grammarNoteCnt,
  originalClozes: totalClozes,
  errorCount: errors.length
}));

if (errors.length > 0) {
  console.error(`❌ 题库校验发现 ${errors.length} 个问题：\n` + errors.slice(0, 25).join("\n"));
  process.exit(1);
}

console.log(`✅ [Grammar Bank Validator V4.0 PASS] 主干 500/500 唯一 | 变形自测 500/500 唯一 | 主变交叉重复 0 | 讲义溯源 18/18 | 三层规则校对 500/500 | 讲义挖空 574 处`);
