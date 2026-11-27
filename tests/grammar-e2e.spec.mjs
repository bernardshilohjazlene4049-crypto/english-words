#!/usr/bin/env node
/**
 * 辽宁专升本英语语法学习系统 V3.0 · Playwright 全流程与多视口自动化测试套件
 * 覆盖视口：390x844 (手机端)、768x1024 (平板端)、1440x900 (桌面端)
 * 覆盖范围：
 *  - 第一阶段：考试切页计时保持与刷新恢复、未答题解析与待复习入列、错答vs未答区分、收藏未答题零污染、搜索清空竞态修复、SRS同日防刷分、动态脚本失败重试UI
 *  - 第二阶段：专项零先导课、574处原版挖空保留、6类交互实训题型、三级提示/逐项解析/变形题、零基础模式降难度推荐
 *  - 第三阶段：3000词即点即查、加入语法题生词本、考场防作弊锁、词法统一学习报告、原版 index.html 零破坏验证
 *  - 第四阶段：v1->v3 数据迁移兼容、备份导入结构校验、Service Worker 注册
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (_) {
    const fallbackBase = process.env.PLAYWRIGHT_MODULE_PATH || "d:/int/skill-runtime/node/node_modules/playwright/index.mjs";
    if (fs.existsSync(fallbackBase)) {
      return await import(pathToFileURL(fallbackBase).href);
    }
    const req = createRequire("d:/int/skill-runtime/node/package.json");
    return req("playwright");
  }
}

const MIME_MAP = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

function startStaticServer(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = decodeURIComponent((req.url || "/").split("?")[0]);
      const relPath = cleanUrl === "/" ? "/index.html" : cleanUrl;
      const fullPath = path.resolve(dir, "." + relPath);
      if (!fullPath.startsWith(dir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.readFile(fullPath, (err, buf) => {
        if (err) {
          res.writeHead(404);
          res.end("Not Found: " + relPath);
          return;
        }
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME_MAP[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
        res.end(buf);
      });
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    results.push({ name, ok: true, ms });
    console.log(`  ✅ PASS (${ms}ms): ${name}`);
  } catch (err) {
    const ms = Date.now() - t0;
    results.push({ name, ok: false, ms, err });
    console.error(`  ❌ FAIL (${ms}ms): ${name}\n     -> ${err?.stack || err}`);
    throw err;
  }
}

async function launchChromium(chromium) {
  for (const opts of [
    { headless: true },
    { headless: true, channel: "chrome" },
    { headless: true, channel: "msedge" }
  ]) {
    try {
      return await chromium.launch(opts);
    } catch (_) {}
  }
  throw new Error("无法启动 Chromium / Chrome / Edge 无头浏览器，请执行 npx playwright install chromium");
}

async function runSuite() {
  console.log("🚀 启动辽宁专升本英语语法 V3.0 Playwright 自动化测试套件...");
  const { chromium } = await loadPlaywright();
  const { server, baseUrl } = await startStaticServer(rootDir);
  let browser;

  try {
    browser = await launchChromium(chromium);

    // =========================================================================
    // PART 1: 390px / 768px / 1440px 多视口响应式布局、无横向溢出与无障碍触控测试
    // =========================================================================
    for (const vp of [
      { width: 390, height: 844, label: "390px 手机端" },
      { width: 768, height: 1024, label: "768px 平板端" },
      { width: 1440, height: 900, label: "1440px 桌面端" }
    ]) {
      await step(`[视口适配] ${vp.label} (${vp.width}x${vp.height}) 全视图零溢出与横纵时间轴切换`, async () => {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
        page.on("response", res => {
          if (res.status() >= 400 && !res.url().endsWith("/favicon.ico")) {
            errors.push(`HTTP ${res.status()}: ${res.url()}`);
          }
        });
        page.on("console", msg => {
          if (msg.type() === "error" && !msg.text().includes("favicon.ico")) errors.push("CONSOLE: " + msg.text());
        });

        await page.goto(`${baseUrl}/grammar.html`, { waitUntil: "networkidle" });
        await page.waitForSelector(".console-hero");

        if (vp.width <= 760) {
          const dockVisible = await page.locator("#mobileDock").isVisible();
          assert.equal(dockVisible, true, `${vp.label} 底部导航应可见`);
          const btnBox = await page.locator("#mobileDock .dock-btn").first().boundingBox();
          assert.ok(btnBox && btnBox.height >= 44, `${vp.label} 触控高度应 >= 44px，实际 ${btnBox?.height}`);
          assert.equal(await page.locator(".tl-vertical").isVisible(), true, "窄屏应切换纵向时间轴");
          assert.equal(await page.locator(".tl-horizontal").isVisible(), false, "窄屏应隐藏横向时间轴");
        } else if (vp.width >= 1024) {
          assert.equal(await page.locator("#desktopNav").isVisible(), true, "桌面端顶部导航应可见");
          assert.equal(await page.locator(".tl-horizontal").isVisible(), true, "宽屏应显示横向时间轴");
          assert.equal(await page.locator(".tl-vertical").isVisible(), false, "宽屏应隐藏纵向时间轴");
        }

        for (const v of ["dashboard", "learn", "drills", "practice", "mistakes", "report"]) {
          await page.evaluate(view => {
            const nav = document.querySelector(`[data-view="${view}"]`);
            if (nav) nav.click();
          }, v);
          await page.waitForTimeout(180);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          assert.ok(overflow <= 2, `${vp.label} 视图 ${v} 出现横向溢出: +${overflow}px`);
        }

        assert.equal(errors.length, 0, `${vp.label} 发现运行错误: ${errors.join("; ")}`);
        await context.close();
      });
    }

    // =========================================================================
    // PART 2: 第一阶段全部缺陷修复端到端验证
    // =========================================================================
    await step("[缺陷修复 1&2] 模拟考切页不丢倒计时、绝对截止时间与刷新持久化 + 考场防泄露锁", async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/grammar.html`, { waitUntil: "networkidle" });

      // 开启 10 题快测考试
      await page.click('[data-action="startExam"][data-count="10"]');
      await page.waitForSelector("#examTimerText");

      // 验证考场锁：body.exam-locked、无提示按钮、题干无点词查义 .w-tok
      const lockedState = await page.evaluate(() => ({
        bodyLocked: document.body.classList.contains("exam-locked"),
        hasHintBtn: !!document.querySelector('[data-action="stepHint"]'),
        wTokCount: document.querySelectorAll("#singleQuestionHost .w-tok").length
      }));
      assert.equal(lockedState.bodyLocked, true, "考试中应激活 body.exam-locked");
      assert.equal(lockedState.hasHintBtn, false, "考试中不应显示逐步提示按钮");
      assert.equal(lockedState.wTokCount, 0, "考试中题干不应开启点词查义");

      // 作答第 1 题并切到第 2 题
      await page.click('#singleQuestionHost .opt-btn[data-idx="1"]');
      await page.click('[data-action="nextQ"]');

      // 切换视图到讲义页 (switchView("learn"))，验证悬浮倒计时条持续工作
      await page.click('#desktopNav [data-view="learn"]');
      await page.waitForSelector("#activeExamFloatBar .exam-float-inner");
      const t1 = await page.locator("#activeExamFloatBar").innerText();
      await page.waitForTimeout(1300);
      const t2 = await page.locator("#activeExamFloatBar").innerText();
      assert.notEqual(t1, t2, "切换页面后悬浮考场倒计时仍在持续跳秒");

      // 刷新整个页面，验证考试题组、当前题号(第2题)、已选答案与倒计时自动恢复
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector("#activeExamFloatBar .exam-float-inner");
      await page.click('[data-action="resumeActiveExam"]');
      await page.waitForSelector("#singleQuestionHost .q-stage-card");

      const restored = await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem("wordsteps-grammar-v1") || "{}");
        return {
          idx: raw.activeExam?.idx,
          answeredCount: Object.keys(raw.activeExam?.choices || {}).length,
          deadlineAt: raw.activeExam?.deadlineAt
        };
      });
      assert.equal(restored.idx, 1, "刷新后应恢复到第 2 题 (idx=1)");
      assert.equal(restored.answeredCount, 1, "刷新后应保留已答的 1 题答案");
      assert.ok(restored.deadlineAt > Date.now(), "刷新后绝对截止时间戳依然有效");

      // 立即交卷（此时 1 题已答，9 题未答），接着测试缺陷 3：未答题解析与入列
      await page.click('[data-action="submitExam"]');
      await page.waitForSelector("#examSummaryBanner .surface");
      const summaryTxt = await page.locator("#examSummaryBanner").innerText();
      assert.match(summaryTxt, /未答\s*9\s*题/, "交卷横幅应准确统计 9 道未答题");

      // 当前正处于第 2 题（未答题），验证展示完整三步解析、逐项排错、变形题与「本题未作答」标识
      const unansCheck = await page.evaluate(() => ({
        pill: document.querySelector("#singleQuestionHost .status-pill.unans")?.textContent || "",
        stepsCnt: document.querySelectorAll("#singleQuestionHost .step-line").length,
        optExpCnt: document.querySelectorAll("#singleQuestionHost .opt-exp-item").length,
        hasFollowUp: !!document.querySelector("#singleQuestionHost .followup-box"),
        paletteUnansCnt: document.querySelectorAll("#qPaletteHost .q-num-btn.unans").length
      }));
      assert.match(unansCheck.pill, /未作答/, "未答题交卷后应显示未作答状态标签");
      assert.equal(unansCheck.stepsCnt, 3, "未答题交卷后应可查看完整 3 步解析");
      assert.equal(unansCheck.optExpCnt, 4, "未答题交卷后应显示 A-D 逐项解析");
      assert.equal(unansCheck.hasFollowUp, true, "未答题交卷后应展示同考点变形题");
      assert.equal(unansCheck.paletteUnansCnt, 9, "题号卡应标记 9 个未答题号");

      // 进入错题本，验证未答题进入今日到期队列，且与历史错答明确区分
      await page.click('#desktopNav [data-view="mistakes"]');
      await page.waitForSelector('[data-mistake-qid]');
      const misHtml = await page.locator("#viewHost").innerText();
      assert.match(misHtml, /考试未作答/, "错题本应明确标识『考试未作答』区别于『历史错答』");
      const dueBtnTxt = await page.locator('[data-action="setMisTab"][data-tab="due"]').innerText();
      const dueNum = Number((dueBtnTxt.match(/\((\d+)\)/) || [])[1] || 0);
      assert.ok(dueNum >= 9, `未答题应自动加入今日到期复习队列，实际到期数=${dueNum}`);

      await context.close();
    });

    await step("[缺陷修复 4·5·6·9] 收藏未答题不入错题本、搜索清空异步竞态、SRS同日防刷分、脚本加载失败重试", async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/grammar.html`, { waitUntil: "networkidle" });

      // 1) 收藏一道从未做过的新题 (attempts === 0)，验证错题本为 0，收藏夹为 1
      await page.click('[data-action="startSmartPractice"]');
      await page.waitForSelector('[data-action="toggleFav"]');
      await page.click('[data-action="toggleFav"]');

      await page.click('#desktopNav [data-view="mistakes"]');
      await page.waitForSelector('[data-action="setMisTab"]');
      const allMisTxt = await page.locator('[data-action="setMisTab"][data-tab="all"]').innerText();
      const favTabTxt = await page.locator('[data-action="setMisTab"][data-tab="fav"]').innerText();
      assert.match(allMisTxt, /\(0\)/, `收藏未答题绝不能计入错题本，实际: ${allMisTxt}`);
      assert.match(favTabTxt, /\(1\)/, `收藏夹应为 1 题，实际: ${favTabTxt}`);

      // 2) 搜索命中单题精准度 + 清空搜索异步竞态测试
      await page.fill("#globalSearchInput", "knock at the door");
      await page.waitForSelector("#searchHost .search-results-panel");
      const hitCards = await page.locator("#searchHost [data-matched-qid]").count();
      assert.equal(hitCards, 1, "搜索专属短语应只精准展示命中的 1 道题，而非全部题库");

      // 快速触发异步搜索并立刻清空输入框
      await page.evaluate(() => {
        const inp = document.getElementById("globalSearchInput");
        inp.value = "have";
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.value = "";
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(280);
      const searchAfterClear = await page.locator("#searchHost").innerHTML();
      assert.equal(searchAfterClear.trim(), "", "清空搜索后旧异步回调不得回写陈旧搜索面板");

      // 3) SRS 间隔复习同日连续作答防刷分测试
      await page.click('#desktopNav [data-view="dashboard"]');
      await page.waitForSelector('[data-action="practiceHandoutOnly"]');
      await page.click('[data-action="practiceHandoutOnly"]');
      await page.waitForSelector("#singleQuestionHost .q-stage-card");
      const firstQid = await page.getAttribute("#singleQuestionHost .q-stage-card", "data-current-qid");
      const ansInfo = await page.evaluate(qid => {
        const q = Object.values(window.WSG_BANKS).flat().find(x => x.id === qid);
        return { ans: q.ans, wrong: (q.ans + 1) % 4 };
      }, firstQid);

      // 先答错 -> srsStage = 0
      await page.click(`#singleQuestionHost .opt-btn[data-idx="${ansInfo.wrong}"]`);
      // 单题重练第 1 次答对 -> srsStage 升至 1
      await page.click('#desktopNav [data-view="mistakes"]');
      await page.waitForSelector(`[data-action="practiceSingleQ"][data-qid="${firstQid}"]`);
      await page.click(`[data-action="practiceSingleQ"][data-qid="${firstQid}"]`);
      await page.waitForSelector("#singleQuestionHost .opt-btn");
      await page.click(`#singleQuestionHost .opt-btn[data-idx="${ansInfo.ans}"]`);

      // 同日再次单题重练（此时 q1 已排期至明日，位于『全部错题/未答』列表）并答对 -> srsStage 必须保持为 1，触发 _sameDayCapped
      await page.click('#desktopNav [data-view="mistakes"]');
      await page.click('[data-action="setMisTab"][data-tab="all"]');
      await page.waitForSelector(`[data-action="practiceSingleQ"][data-qid="${firstQid}"]`);
      await page.click(`[data-action="practiceSingleQ"][data-qid="${firstQid}"]`);
      await page.waitForSelector("#singleQuestionHost .opt-btn");
      await page.click(`#singleQuestionHost .opt-btn[data-idx="${ansInfo.ans}"]`);

      const srsRec = await page.evaluate(qid => {
        const st = JSON.parse(localStorage.getItem("wordsteps-grammar-v1") || "{}");
        return st.records[qid];
      }, firstQid);
      assert.equal(srsRec.srsStage, 1, `同一天连续答对不得跳升多级 SRS，实际 srsStage=${srsRec.srsStage}`);
      assert.equal(srsRec._sameDayCapped, true, "同日二次答对应标记 _sameDayCapped");

      await context.close();

      // 4) 动态脚本加载失败提示与一键重试恢复测试（使用独立无SW上下文模拟首次弱网断连）
      const errCtx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: "block" });
      const page2 = await errCtx.newPage();
      let blockOnce = true;
      await page2.route("**/grammar-drills.js*", route => {
        if (blockOnce) route.abort("failed");
        else route.continue();
      });
      await page2.goto(`${baseUrl}/grammar.html`, { waitUntil: "networkidle" });
      await page2.click('#desktopNav [data-view="drills"]');
      await page2.waitForSelector(".load-err-card", { timeout: 10000 });
      blockOnce = false;
      await page2.click('[data-action="retryDrillsView"]');
      await page2.waitForSelector(".drill-type-grid");
      assert.equal(await page2.locator(".drill-type-btn").count(), 6, "重试后应成功恢复加载 6 类交互实训题型");

      await errCtx.close();
    });

    // =========================================================================
    // PART 3: 第二阶段教学升级（专项零 + 574挖空 + 6类实训 + 零基础降难度 + 逐项解析变形题）
    // =========================================================================
    await step("[教学升级] 专项零先导课、574处原版挖空保留、6类交互实训通关与零基础降难度推题", async () => {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/grammar.html`, { waitUntil: "networkidle" });

      // 1) 开启零基础模式 -> 验证智能推题全部优先抽取 ⭐ diff=1 基础题
      await page.click("#beginnerToggle");
      await page.click('[data-action="startSmartPractice"]');
      await page.waitForSelector("#singleQuestionHost .q-stage-card");
      const diffCheck = await page.evaluate(() => {
        const allQs = Object.values(window.WSG_BANKS).flat();
        const byId = new Map(allQs.map(q => [q.id, q]));
        const curId = document.querySelector("#singleQuestionHost .q-stage-card")?.dataset.currentQid;
        return byId.get(curId)?.diff;
      });
      assert.equal(diffCheck, 1, "零基础模式下智能推荐首题难度应降为 diff=1 (⭐)");

      // 测试三级逐步提示 + 作答后展开三步解析、逐项解析与变形题作答
      await page.click('[data-action="stepHint"]');
      await page.click('[data-action="stepHint"]');
      await page.click('[data-action="stepHint"]');
      assert.equal(await page.locator("#singleQuestionHost .hint-box div").count(), 3, "应支持展开 3 级渐进提示");
      await page.click('#singleQuestionHost .opt-btn[data-idx="0"]');
      await page.click('[data-action="fullStepExp"]');
      assert.equal(await page.locator("#singleQuestionHost .opt-exp-item").count(), 4, "应显示 4 个选项的逐项排错解析");
      await page.click('#singleQuestionHost [data-action="pickFollowUp"][data-fidx="0"]');
      assert.match(await page.locator("#singleQuestionHost .followup-box").innerText(), /变形解析/, "作答变形题后应展示变形解析");

      // 2) 讲义页验证专项零 (4个先导卡片) 与五大专项 574 处原始挖空一字不少
      await page.click('#desktopNav [data-view="learn"]');
      await page.waitForSelector("#kp-0-1");
      assert.equal(await page.locator("#mod-0 .kp-wrapper").count(), 4, "专项零应包含 4 大零基础先导模块");

      await page.click('[data-action="selectLearnMod"][data-mod="all"]');
      await page.waitForSelector("#mod-5");
      const origClozeCnt = await page.locator("#viewHost .cloze:not([data-fnd])").count();
      assert.equal(origClozeCnt, 574, `五大专项必须完整保留 574 处原版讲义挖空，实际=${origClozeCnt}`);

      // 3) 六大交互实训题型逐一实测通关
      await page.click('#desktopNav [data-view="drills"]');
      await page.waitForSelector(".drill-type-grid");

      // Type 1: click-role
      const roleAns = await page.evaluate(() => window.WSG_DRILLS.items.find(x => x.type === "click-role").ansIdx);
      await page.click(`[data-action="drillPickRole"][data-idx="${roleAns}"]`);
      assert.match(await page.locator(".q-stage-card .steps-box").innerText(), /实训通关/);

      // Type 2: drag-order
      await page.click('[data-action="selectDrillType"][data-dtype="drag-order"]');
      const chunks = await page.evaluate(() => window.WSG_DRILLS.items.find(x => x.type === "drag-order").chunks);
      for (const ch of chunks) {
        await page.evaluate(targetText => {
          const btns = [...document.querySelectorAll("#drillSourceBank [data-action='drillAddChunk']")];
          const b = btns.find(el => el.textContent.trim() === targetText);
          if (b) b.click();
        }, ch);
      }
      await page.click('[data-action="drillCheckOrder"]');
      assert.match(await page.locator(".q-stage-card .steps-box").innerText(), /实训通关/);

      // Type 3: verb-fill
      await page.click('[data-action="selectDrillType"][data-dtype="verb-fill"]');
      const verbAns = await page.evaluate(() => window.WSG_DRILLS.items.find(x => x.type === "verb-fill").answers[0]);
      await page.fill("#drillVerbInput", verbAns);
      await page.click('[data-action="drillCheckVerb"]');
      assert.match(await page.locator(".q-stage-card .steps-box").innerText(), /实训通关/);

      // Type 4: confusable
      await page.click('[data-action="selectDrillType"][data-dtype="confusable"]');
      const confAns = await page.evaluate(() => window.WSG_DRILLS.items.find(x => x.type === "confusable").ans);
      await page.click(`[data-action="drillPickMcq"][data-idx="${confAns}"]`);
      assert.match(await page.locator(".q-stage-card .steps-box").innerText(), /实训通关/);

      // Type 5: error-fix
      await page.click('[data-action="selectDrillType"][data-dtype="error-fix"]');
      const errItem = await page.evaluate(() => {
        const it = window.WSG_DRILLS.items.find(x => x.type === "error-fix");
        return { errIdx: it.errIdx, fixAns: it.fixAns };
      });
      await page.click(`[data-action="drillPickErrSeg"][data-idx="${errItem.errIdx}"]`);
      await page.click(`[data-action="drillPickErrFix"][data-idx="${errItem.fixAns}"]`);
      assert.match(await page.locator(".q-stage-card .steps-box").innerText(), /实训通关/);

      // Type 6: translation
      await page.click('[data-action="selectDrillType"][data-dtype="translation"]');
      const trAns = await page.evaluate(() => window.WSG_DRILLS.items.find(x => x.type === "translation").ans);
      await page.click(`[data-action="drillPickMcq"][data-idx="${trAns}"]`);
      assert.match(await page.locator(".q-stage-card .steps-box").innerText(), /实训通关/);

      const doneDrills = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("wordsteps-grammar-v1") || "{}").completedDrills || {}).length);
      assert.equal(doneDrills, 6, "6 类交互实训题型应全部记录通关进度");

      await context.close();
    });

    // =========================================================================
    // PART 4: 第三阶段词汇联动 & 第四阶段数据迁移/备份校验/SW & 原版背单词兼容性
    // =========================================================================
    await step("[词汇联动 & 工程健壮性] 3000词点词查义加词书、统一报告、v1数据迁移、备份校验、SW与主站零破坏", async () => {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", e => pageErrors.push(e.message));

      // 预写入旧版 v1 localStorage 数据，验证自动升级至 schemaVersion 3 且无损迁移历史作答
      await page.addInitScript(() => {
        if (!sessionStorage.getItem("seeded_v1")) {
          localStorage.setItem("wordsteps-grammar-v1", JSON.stringify({
            answers: { q1: 1, q2: 0 },
            mastered: ["1"]
          }));
          sessionStorage.setItem("seeded_v1", "1");
        }
      });

      await page.goto(`${baseUrl}/grammar.html`, { waitUntil: "networkidle" });
      await page.waitForTimeout(450);

      const migCheck = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("wordsteps-grammar-v1") || "{}");
        return { ver: s.schemaVersion, hasQ1: !!s.records?.q1, hasQ2: !!s.records?.q2 };
      });
      assert.equal(migCheck.ver, 3, "旧版数据应自动迁移至 schemaVersion=3");
      assert.equal(migCheck.hasQ1 && migCheck.hasQ2, true, "旧版 answers 中的 q1/q2 应无损迁移为详细记录");

      // 在练习页点击题干英文单词，查看释义音标并一键加入个人词书
      await page.click('[data-action="practiceHandoutOnly"]');
      await page.waitForSelector("#singleQuestionHost .w-tok");
      await page.locator("#singleQuestionHost .w-tok").first().click();
      await page.waitForSelector("#wordPopoverHost .word-pop-card");
      await page.click("#addVocabBtn");

      const vocabBookState = await page.evaluate(() => {
        const v = JSON.parse(localStorage.getItem("wordsteps-v1") || "{}");
        return {
          hasGrammarGroup: (v.books || []).some(b => b.id === "grp-grammar-vocab"),
          addedCnt: (v.groupOverrides?.["grp-grammar-vocab"]?.add || []).length
        };
      });
      assert.equal(vocabBookState.hasGrammarGroup, true, "应在 wordsteps-v1 中创建『语法题生词本』分组");
      assert.equal(vocabBookState.addedCnt, 1, "生词应成功写入语法题生词本");
      await page.click('[data-action="closeWordPop"]');

      // 打开统一学习报告，验证词汇 3000 + 语法 500 联动指标与备份导入结构校验
      await page.click('#desktopNav [data-view="report"]');
      await page.waitForSelector("#importBackupInput", { state: "attached" });
      assert.match(await page.locator("#viewHost").innerText(), /辽宁专升本英语统一学习报告/);
      assert.match(await page.locator("#viewHost").innerText(), /1\s*词/, "报告应实时反映刚加入的 1 个语法联动生词");

      // 上传非法备份 JSON -> 必须拦截拒绝且不覆盖原数据
      await page.setInputFiles("#importBackupInput", {
        name: "bad-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ wrongField: 123 }))
      });
      await page.waitForSelector("#backupMsgBanner .callout.warn");
      assert.match(await page.locator("#backupMsgBanner").innerText(), /导入被拒绝/);

      // 上传合法备份 JSON -> 校验通过并恢复
      await page.setInputFiles("#importBackupInput", {
        name: "good-backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ schemaVersion: 3, records: { q1: { mod: "1", kp: "kp-1-1", attempts: 2, correct: 2, lastOk: true } }, examHistory: [] }))
      });
      await page.waitForSelector("#backupMsgBanner .callout:not(.warn)");
      assert.match(await page.locator("#backupMsgBanner").innerText(), /校验通过/);

      // 验证 Service Worker 注册成功
      const swRegistered = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return false;
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg;
      });
      assert.equal(swRegistered, true, "Service Worker sw.js 应成功注册");

      // 访问主站 3000 词背单词页面 index.html，确保零报错且完全兼容新增的语法生词本！
      await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
      await page.waitForTimeout(350);
      const indexTitle = await page.title();
      assert.ok(indexTitle.length > 0, "3000词主页 index.html 应正常渲染");
      assert.equal(pageErrors.length, 0, `全流程与 index.html 零页面异常: ${pageErrors.join("; ")}`);

      await context.close();
    });

    console.log(`\n🎉 [ALL PLAYWRIGHT E2E TESTS PASSED] 共通过 ${results.length}/${results.length} 项测试！`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runSuite().catch(err => {
  console.error("Playwright E2E Suite Failed:", err);
  process.exit(1);
});
