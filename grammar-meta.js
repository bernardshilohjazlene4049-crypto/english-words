// 词迹语法模块 · 核心考点目录与按需分块加载器 (grammar-meta.js)
window.WSG_META = {
  version: "2.0.0",
  totalClozes: 574,
  totalQuestions: 500,
  handoutQuestions: 18,
  authoredQuestions: 482,
  wrongReasons: [
    { id: "tense", label: "时态/时间标志误判", color: "#0284c7" },
    { id: "voice", label: "主动/被动逻辑混淆", color: "#7c3aed" },
    { id: "clause", label: "从句类型/所缺成分漏判", color: "#059669" },
    { id: "exception", label: "死背口诀忽略严格语法例外", color: "#d97706" },
    { id: "agreement", label: "主谓单复数/语序看错", color: "#e11d48" },
    { id: "careless", label: "审题粗心/固定搭配记混", color: "#64748b" }
  ],
  srsIntervalsDays: [0, 1, 2, 4, 7, 15],
  modules: [
  {
    "id": "1",
    "code": "mod-1",
    "kicker": "专项一 · 讲义 P1–P3",
    "title": "时态和语态",
    "en": "Tense & Voice",
    "tint": "emerald",
    "summary": "锁定时间特征与时点/时段差异，吃透主将从现、完成时四大标志、瞬间动词转化与主动表被动。",
    "clozeCount": 98,
    "questionCount": 100,
    "diagramId": "tense-timeline",
    "kps": [
      {
        "id": "kp-1-1",
        "title": "时态时间轴与10大常考时态判定",
        "short": "10大时态与时点时段",
        "clozeCount": 34,
        "keywords": "时态 时间轴 一般现在 一般过去 一般将来 现在进行 过去进行 现在完成 过去完成 将来完成 时点 时段"
      },
      {
        "id": "kp-1-2",
        "title": "客观真理、主将从现与“一…就…”倒装",
        "short": "主将从现与一…就…",
        "clozeCount": 20,
        "keywords": "反复发生 客观真理 主将从现 if unless as soon as no sooner than hardly scarcely when 部分倒装"
      },
      {
        "id": "kp-1-3",
        "title": "三大完成时标志与非延续性动词转化",
        "short": "完成时与瞬间动词",
        "clozeCount": 27,
        "keywords": "现在完成 过去完成 将来完成 since for so far in the past by the time 瞬间动词 非延续性 be on be dead keep"
      },
      {
        "id": "kp-1-4",
        "title": "被动语态、无被动词、主动表被动与 by 用法",
        "short": "被动与主动表被动",
        "clozeCount": 17,
        "keywords": "被动语态 happen belong to break out take off 主动表被动 写洗切卖燃烧 write wash cut sell burn 感官系动词 by用法"
      }
    ]
  },
  {
    "id": "2",
    "code": "mod-2",
    "kicker": "专项二 · 讲义 P1–P4",
    "title": "虚拟语气",
    "en": "Subjunctive Mood",
    "tint": "ocean",
    "summary": "抓住“时态往前退一步”底层逻辑，辨明应试口诀边界，掌握 if 虚拟、错综混合、“贱命重要”与含蓄虚拟。",
    "clozeCount": 100,
    "questionCount": 100,
    "diagramId": null,
    "kps": [
      {
        "id": "kp-2-1",
        "title": "if 主从句虚拟三时态表与“厕所没水”",
        "short": "if虚拟与主将从现区分",
        "clozeCount": 23,
        "keywords": "虚拟语气 往前退一步 if从句 厕所没水 would could should might were 主将从现区分"
      },
      {
        "id": "kp-2-2",
        "title": "错综混合虚拟、if 省略倒装与 wish / would rather",
        "short": "混合虚拟与省略倒装",
        "clozeCount": 18,
        "keywords": "混合虚拟 错综时间 省略if 部分倒装 were had should wish if only as if would rather"
      },
      {
        "id": "kp-2-3",
        "title": "“贱命重要” (should) do 词族与 suggest / insist 辨析",
        "short": "贱命重要与双义词",
        "clozeCount": 39,
        "keywords": "贱命重要 建议命令重要要求 should省略 advise suggest propose recommend require request demand order insist"
      },
      {
        "id": "kp-2-4",
        "title": "it is high time、in case / lest、含蓄虚拟与两类总结",
        "short": "high time与含蓄虚拟",
        "clozeCount": 20,
        "keywords": "it is high time about time in case lest for fear that 含蓄虚拟 without but for otherwise"
      }
    ]
  },
  {
    "id": "3",
    "code": "mod-3",
    "kicker": "专项三 · 讲义 P1–P5",
    "title": "非谓语动词",
    "en": "Non-finite Verbs",
    "tint": "aurora",
    "summary": "厘清谓语与非谓语边界，用三步决策树突破主/状/表/宾/定成分、独立主格与 7 大固定结构。",
    "clozeCount": 142,
    "questionCount": 100,
    "diagramId": "nonfinite-tree",
    "kps": [
      {
        "id": "kp-3-1",
        "title": "谓语五形式 vs 非谓语三类型与时态语态表",
        "short": "谓语vs非谓语总表",
        "clozeCount": 41,
        "keywords": "谓语动词 非谓语动词 to do doing done having done being done to be done 否定 not"
      },
      {
        "id": "kp-3-2",
        "title": "非谓语作主语、状语与表语（-ing vs -ed）",
        "short": "主语/状语/表语分词",
        "clozeCount": 16,
        "keywords": "作主语 作状语 作表语 目的状语 分词形容词 freezing frozen exciting excited"
      },
      {
        "id": "kp-3-3",
        "title": "非谓语作宾语：24词口诀、介词 to、双义动词与花费",
        "short": "动宾搭配与双义辨析",
        "clozeCount": 47,
        "keywords": "考虑建议盼原谅 be worth doing look forward to object to devote to need doing remember forget stop regret try manage take spend cost pay"
      },
      {
        "id": "kp-3-4",
        "title": "非谓语作定语、独立主格与 7 大必考结构",
        "short": "定语/独立主格/使役",
        "clozeCount": 38,
        "keywords": "后置定语 序数词最高级 独立主格 weather permitting 使役动词 make let have do nothing but prefer rather than too to"
      }
    ]
  },
  {
    "id": "4",
    "code": "mod-4",
    "kicker": "专项四 · 讲义 P1–P4",
    "title": "定语从句 + 状语从句",
    "en": "Attributive & Adverbial Clauses",
    "tint": "teal",
    "summary": "定从“一找二还三连接”精准定成分，辨析 that / which / as 与介词+which，掌握状从逻辑连词与倍数公式。",
    "clozeCount": 90,
    "questionCount": 100,
    "diagramId": "clause-structure",
    "kps": [
      {
        "id": "kp-4-1",
        "title": "定语从句三步法、关系词总表与省略条件",
        "short": "定从三步法与关系词",
        "clozeCount": 20,
        "keywords": "定语从句 先行词 限定性 非限定性 一找二还三连接 who whom whose which that when where why"
      },
      {
        "id": "kp-4-2",
        "title": "that vs which 铁律、as 固定搭配、介词+which 与特殊先行词",
        "short": "that/which/介词+which",
        "clozeCount": 32,
        "keywords": "只用that 只用which 不定代词 序数词 最高级 as is known to all 介词+which the way situation where whose转换"
      },
      {
        "id": "kp-4-3",
        "title": "状语从句 16 组连词、四大秒杀结构与倍数比较",
        "short": "状从连词与倍数比较",
        "clozeCount": 38,
        "keywords": "状语从句 while as since not until unless as long as in that so that although 让步倒装 倍数比较 twice as"
      }
    ]
  },
  {
    "id": "5",
    "code": "mod-5",
    "kicker": "第五次课 · 讲义 P1–P7",
    "title": "名词性从句 + 主谓一致",
    "en": "Noun Clauses & Subject-Verb Agreement",
    "tint": "amber",
    "summary": "从主谓宾句子成分出发打通名从、定从、状从三大从句辨析，吃透主谓一致 11 大核心规则。",
    "clozeCount": 144,
    "questionCount": 100,
    "diagramId": "svo-analyzer",
    "kps": [
      {
        "id": "kp-5-1",
        "title": "七大句子成分总表与主从/宾从（TAG是SB）/表从识别",
        "short": "句子成分与名从位置",
        "clozeCount": 33,
        "keywords": "主语 谓语 宾语 表语 定语 状语 同位语 主语从句 宾语从句 表语从句 形式主语it TAG是SB that省略"
      },
      {
        "id": "kp-5-2",
        "title": "名从 vs 定从对比、what/that、whether/if、陈述语序与同位语从句",
        "short": "what/whether/同位语从句",
        "clozeCount": 47,
        "keywords": "what that whoever whatever whether if or not 陈述语序 the reason why is that 同位语从句 三大从句区分"
      },
      {
        "id": "kp-5-3",
        "title": "主谓一致 11 大必考规则全集",
        "short": "主谓一致11大规则",
        "clozeCount": 64,
        "keywords": "主谓一致 就近原则 就远原则 neither nor as well as 时间金钱距离 each every family population people many a a number of the number of 分数 one of the only one of pair means news"
      }
    ]
  }
],
  diagrams: {"tense-timeline": {"title": "交互式英语时态时间轴（点击节点演示时点 vs 时段动态演进）", "subtitle": "桌面端展示全景横向时间轴，手机端自动切换为大触控纵向时间轨；点击下方任意时态查看公式、标志词与动态高亮路径。", "items": [{"id": "past_perf", "name": "过去完成时", "formula": "had + done", "kind": "时段 / 先于过去", "node": "past_perf", "arc": "arc_past_perf", "color": "#0284c7", "signals": "by + 过去时间, before/by the time + did, no sooner...than", "eg": "By the time the police arrived, the thief had escaped.", "cn": "警察赶到之前，小偷就已经逃跑了。（逃跑发生在赶到之前 = 过去的过去）"}, {"id": "past_simp", "name": "一般过去时", "formula": "did (was / were)", "kind": "过去时点", "node": "past", "arc": null, "color": "#0ea5e9", "signals": "yesterday, ...ago, last week, in 2020, just now", "eg": "She graduated from college three years ago.", "cn": "她三年前大学毕业。（纯粹交代过去某时点发生的动作，与现在无关）"}, {"id": "past_prog", "name": "过去进行时", "formula": "was / were + doing", "kind": "过去某刻正在进行", "node": "past", "arc": null, "color": "#06b6d4", "signals": "at 8 last night, at this time yesterday, when + did", "eg": "I was reading a grammar book when the lights went out.", "cn": "停电那一刻，我正在看语法书。（过去长动作背景 + 短动作切入）"}, {"id": "pres_perf", "name": "现在完成时", "formula": "have / has + done", "kind": "过去→现在时段", "node": "now", "arc": "arc_pres_perf", "color": "#059669", "signals": "since + 过去点, for + 时段, so far, up to now, in the past 5 years", "eg": "Mr. Geng has taught English for over ten years.", "cn": "耿老师教英语已经十多年了。（从过去开始一直持续到现在）"}, {"id": "pres_simp", "name": "一般现在时", "formula": "do / does (am/is/are)", "kind": "规律常态 / 主将从现", "node": "now", "arc": null, "color": "#10b981", "signals": "every day, always, often, 客观真理, if/unless/when 从句表将来", "eg": "Light travels much faster than sound.", "cn": "光比声音传播快得多。（永恒客观真理，不受主句过去时影响）"}, {"id": "pres_prog", "name": "现在进行时", "formula": "am / is / are + doing", "kind": "此刻正在进行", "node": "now", "arc": null, "color": "#14b8a6", "signals": "now, right now, at the moment, Look!, Listen!", "eg": "Listen! Someone is knocking at the door.", "cn": "听！有人正在敲门。（说话这一刻正在持续进行）"}, {"id": "fut_simp", "name": "一般将来时", "formula": "will do / be going to do", "kind": "将来时点", "node": "future", "arc": null, "color": "#6366f1", "signals": "tomorrow, next month, in two days, soon, in the future", "eg": "We will take the ZSB examination next spring.", "cn": "我们明年春天参加专升本考试。"}, {"id": "fut_perf", "name": "将来完成时", "formula": "will have + done", "kind": "截止到将来某刻完成", "node": "fut_perf", "arc": "arc_fut_perf", "color": "#7c3aed", "signals": "by + 将来时间, by the end of next year, by the time + do/does", "eg": "By next June, we will have mastered 3,000 core words.", "cn": "到明年六月为止，我们将已经掌握 3000 核心词汇。"}]}, "svo-analyzer": {"title": "交互式主谓宾与五大基本句型拆解仪（SVG 语法依存弧线）", "subtitle": "点击切换 5 类专升本高频句型，观察主语(S)、谓语(V)、宾语(O)/表语(P)/补语(C)及修饰成分的结构分工。", "sentences": [{"id": "svo", "label": "1. 主谓宾 + 状语 (SVO)", "en": "Diligent students achieve great progress every day.", "cn": "勤奋的学生每天都能取得巨大的进步。", "tokens": [{"t": "Diligent", "role": "定语 Attr", "color": "#d97706", "desc": "形容词修饰名词 students"}, {"t": "students", "role": "主语 S", "color": "#059669", "desc": "动作发出者（复数名词）"}, {"t": "achieve", "role": "谓语 V", "color": "#0284c7", "desc": "及物动词原形（一般现在时）"}, {"t": "great", "role": "定语 Attr", "color": "#d97706", "desc": "形容词修饰名词 progress"}, {"t": "progress", "role": "宾语 O", "color": "#7c3aed", "desc": "不可数名词，承受 achieve 动作"}, {"t": "every day.", "role": "状语 Adv", "color": "#64748b", "desc": "时间频率状语，锁定一般现在时"}], "links": [[0, 1, "修饰"], [1, 2, "发出"], [2, 4, "支配"], [3, 4, "修饰"]]}, {"id": "svoo", "label": "2. 双宾语 TAG是SB (SVOO)", "en": "The teacher told us that practice makes perfect.", "cn": "老师告诉我们熟能生巧。", "tokens": [{"t": "The teacher", "role": "主语 S", "color": "#059669", "desc": "主句动作发出者"}, {"t": "told", "role": "双宾谓语 V", "color": "#0284c7", "desc": "TAG 是 SB 核心动词 tell 的过去式"}, {"t": "us", "role": "间接宾语 IO", "color": "#0d9488", "desc": "指人宾语（切勿误判为定从先行词！）"}, {"t": "that practice makes perfect.", "role": "直接宾语 DO(宾从)", "color": "#7c3aed", "desc": "完整陈述句充当直接宾语，客观真理用一般现在时"}], "links": [[0, 1, "发出"], [1, 2, "告知对象"], [1, 3, "告知内容"]]}, {"id": "svoc", "label": "3. 主谓宾 + 宾补 (SVOC 使役)", "en": "Clear rules make complex grammar easy to learn.", "cn": "清晰的规则让复杂的语法变得容易学。", "tokens": [{"t": "Clear rules", "role": "主语 S", "color": "#059669", "desc": "复数主语"}, {"t": "make", "role": "使役谓语 V", "color": "#0284c7", "desc": "使役动词“使…变得”"}, {"t": "complex grammar", "role": "宾语 O", "color": "#7c3aed", "desc": "被改变状态的对象"}, {"t": "easy to learn.", "role": "宾语补足语 OC", "color": "#d97706", "desc": "补充说明宾语状态（be/make + adj. + to do 主动表被动）"}], "links": [[0, 1, "发出"], [1, 2, "作用于"], [2, 3, "逻辑主表"]]}, {"id": "svp", "label": "4. 主系表 · 感官系动词 (SVP)", "en": "The freshly baked bread smells wonderfully sweet.", "cn": "刚烤好的面包闻起来香甜极了。", "tokens": [{"t": "The freshly baked", "role": "定语 Attr", "color": "#d97706", "desc": "副词+过去分词作前置定语（被动完成：被烤好的）"}, {"t": "bread", "role": "主语 S", "color": "#059669", "desc": "不可数名词作主语（单数）"}, {"t": "smells", "role": "系动词 V", "color": "#0284c7", "desc": "感官系动词主动表被动，三单形式"}, {"t": "wonderfully sweet.", "role": "表语 P", "color": "#7c3aed", "desc": "副词修饰形容词 sweet 作表语（绝不能只填副词 sweetly！）"}], "links": [[0, 1, "修饰"], [1, 2, "主系一致"], [2, 3, "说明性质"]]}, {"id": "sv_mod", "label": "5. 非谓语后置定语干扰主谓一致", "en": "The books borrowed from the library are on the desk.", "cn": "从图书馆借来的那些书在桌子上。", "tokens": [{"t": "The books", "role": "真正主语 S", "color": "#059669", "desc": "复数名词，决定整句谓语用 are"}, {"t": "borrowed from the library", "role": "后置定语 Attr", "color": "#d97706", "desc": "过去分词短语表被动完成（不是真谓语！）"}, {"t": "are", "role": "真正谓语 V", "color": "#0284c7", "desc": "与复数主语 books 保持主谓一致"}, {"t": "on the desk.", "role": "表语 P", "color": "#7c3aed", "desc": "介词短语说明位置状态"}], "links": [[1, 0, "后置修饰"], [0, 2, "复数一致"], [2, 3, "位置表语"]]}]}, "clause-structure": {"title": "交互式三大从句结构透视镜（定从 vs 名从 vs 状从 vs 同位语）", "subtitle": "点击切换 4 大易混从句模型，动态演示连接词角色、从句边界切分（V1 vs V2）以及成分还原逻辑。", "models": [{"id": "attr", "name": "定语从句（还原缺宾语）", "mainPart": "The novel", "clausePart": "that / which I read last week", "tailPart": "touched me deeply.", "conn": "that / which", "connRole": "关系代词 = 先行词 The novel，代入从句作 read 的宾语", "v1": "read（第1谓语：从句谓语）", "v2": "touched（第2谓语：主句真谓语，在此处前切分从句！）", "formula": "有名词先行词 + 从句缺主/宾成分 → 定语从句关系代词"}, {"id": "appos", "name": "同位语从句（解释内容不缺成分）", "mainPart": "The news", "clausePart": "that our team won the match", "tailPart": "cheered everyone up.", "conn": "that（不可换 which！）", "connRole": "纯连词无实义、不作成分；整个从句等价解释 The news 的具体内容", "v1": "won（第1谓语：从句谓语，主谓宾齐全！）", "v2": "cheered（第2谓语：主句真谓语）", "formula": "抽象名词（news/fact/idea）+ 从句主谓宾完整无缺 → 同位语从句只用 that"}, {"id": "noun_reason", "name": "定从 + 表从黄金组合", "mainPart": "The reason [why he was late]", "clausePart": "is [that his car broke down]", "tailPart": "on the highway.", "conn": "前 why + 后 that", "connRole": "前句修饰 reason 缺原因状语用 why；后句在 is 后作表语从句用 that（禁选 because）", "v1": "was late（定从谓语）+ broke down（表从谓语）", "v2": "is（整句核心系动词主干）", "formula": "The reason why ... is that ...（专升本必考双空模板）"}, {"id": "adv_cond", "name": "条件状语从句（主将从现）", "mainPart": "We will cancel the picnic", "clausePart": "unless the weather improves", "tailPart": "tomorrow morning.", "conn": "unless（= if ... not 除非）", "connRole": "从属连词表条件逻辑，不修饰任何名词，也不在从句作主宾", "v1": "will cancel（主句一般将来时）", "v2": "improves（从句一般现在时表将来，三单加 s）", "formula": "无先行词 + 修饰整句条件/时间逻辑 + 将来语境 → 主将从现"}]}, "nonfinite-tree": {"title": "交互式非谓语动词三步决策树（点击真题案例动态点亮推理路径）", "subtitle": "考场遇到动词变形题，按“一判谓语 → 二判主被动 → 三判时间先后”三步即可 100% 锁定唯一正确形式。", "cases": [{"id": "c1", "title": "案例 1：句首分词作状语", "stem": "____ from space, the earth looks like a blue ball.", "answer": "Seen", "path": ["n_root", "n_nonfin", "n_passive", "n_done"], "explain": "① 逗号连接无连词，后句已有谓语 looks → 填非谓语；② 逻辑主语 the earth“被看” → 被动；③ 无将来/正在进行限定，表一般被动状态 → 锁定 Seen！"}, {"id": "c2", "title": "案例 2：将来被动后置定语", "stem": "The bridge ____ next year will link the two islands.", "answer": "to be built", "path": ["n_root", "n_nonfin", "n_passive", "n_to_be_done"], "explain": "① 整句已有谓语 will link 且无连词 → 填非谓语作定语；② 桥是“被建造” → 被动；③ next year 明确表将来尚未发生 → 锁定 to be built！"}, {"id": "c3", "title": "案例 3：主动先完成状语", "stem": "____ all his work, he went home happily.", "answer": "Having finished", "path": ["n_root", "n_nonfin", "n_active", "n_having_done"], "explain": "① 无连词，主句已有谓语 went → 填非谓语；② 主语 he 主动完成工作 → 主动；③ 先把工作做完、再回家（明显先于主句谓语 went） → 锁定 Having finished！"}, {"id": "c4", "title": "案例 4：连词在场填真谓语（防坑！）", "stem": "When the earth ____ from space, it looks blue.", "answer": "is seen（真谓语！）", "path": ["n_root", "n_finite"], "explain": "① 句首出现了从属连词 When 且从句有自己的主语 the earth → 必须填从句【真谓语】is seen！切忌机械背题误选 Seen！"}]}}
};

window.WSG_MODULES = window.WSG_MODULES || {};
window.WSG_BANKS = window.WSG_BANKS || {};
window._wsgLoading = window._wsgLoading || {};

window.WSG_loadScript = function(src) {
  if (window._wsgLoading[src]) return window._wsgLoading[src];
  window._wsgLoading[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => {
      delete window._wsgLoading[src];
      reject(new Error("加载模块失败: " + src));
    };
    document.head.appendChild(s);
  });
  return window._wsgLoading[src];
};

window.WSG_ensureModule = function(modId) {
  if (window.WSG_MODULES[modId]) return Promise.resolve(window.WSG_MODULES[modId]);
  return window.WSG_loadScript("./grammar-mod-" + modId + ".js").then(() => window.WSG_MODULES[modId]);
};

window.WSG_ensureBank = function(modId) {
  if (window.WSG_BANKS[modId]) return Promise.resolve(window.WSG_BANKS[modId]);
  return window.WSG_loadScript("./grammar-bank-" + modId + ".js").then(() => window.WSG_BANKS[modId]);
};

window.WSG_ensureAllModules = function() {
  return Promise.all(["1", "2", "3", "4", "5"].map(id => window.WSG_ensureModule(id)));
};

window.WSG_ensureAllBanks = function() {
  return Promise.all(["1", "2", "3", "4", "5"].map(id => window.WSG_ensureBank(id)));
};
