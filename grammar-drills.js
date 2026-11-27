window.WSG_DRILLS = {
  "types": [
    {
      "id": "click-role",
      "name": "🔍 句子成分点击识别",
      "desc": "点击句中扮演指定语法角色的那一个词块，练就一眼看穿句子主干的火眼金睛。"
    },
    {
      "id": "drag-order",
      "name": "🧩 语序连词拖拽排序",
      "desc": "拖拽或点击词块按正确英语语法语序成句（强化宾从陈述语序、倒装句与倍数公式）。"
    },
    {
      "id": "verb-fill",
      "name": "✍️ 动词形态精准填空",
      "desc": "根据语境与括号内动词原形，亲手敲出完整准确的时态、被动、虚拟或非谓语形式。"
    },
    {
      "id": "confusable",
      "name": "⚖️ 易混词与结构辨析",
      "desc": "成对攻克专升本最高频易混词组（lie/lay、rise/raise、a/the number of、used to 等）。"
    },
    {
      "id": "error-fix",
      "name": "🩺 高频病句语法改错",
      "desc": "先点击揪出句中藏有语法错误的词块，再选出标准修正方案。"
    },
    {
      "id": "translation",
      "name": "🌐 核心句型拆解翻译",
      "desc": "运用五大专项核心语法骨架，分步拼搭标准地道的专升本高分译句。"
    }
  ],
  "items": [
    {
      "id": "d1",
      "type": "click-role",
      "prompt": "请点击选出本句中决定谓语单复数的【真正核心主语】：",
      "tokens": [
        "The experienced surgeon",
        ", together with two nurses,",
        "is reviewing",
        "the patient's chart",
        "carefully."
      ],
      "ansIdx": 0,
      "exp": "together with two nurses 是伴随介词短语（就远原则），真正核心主语是最前面的单数 The experienced surgeon，故谓语用 is reviewing。"
    },
    {
      "id": "d2",
      "type": "click-role",
      "prompt": "请点击选出本句中的【后置非谓语定语】（修饰主语而非真谓语）：",
      "tokens": [
        "The high-speed railway",
        "built across the mountains",
        "has shortened",
        "our travel time",
        "dramatically."
      ],
      "ansIdx": 1,
      "exp": "built across the mountains 是过去分词短语作后置定语（“被修建在群山间的高铁”）；整句真正的谓语动词是 has shortened！"
    },
    {
      "id": "d3",
      "type": "click-role",
      "prompt": "请点击选出双宾语（TAG是SB）结构中的【直接宾语（宾语从句）】：",
      "tokens": [
        "Our professor",
        "told",
        "all the freshmen",
        "that grammar builds clear thinking."
      ],
      "ansIdx": 3,
      "exp": "told 是双宾动词，all the freshmen 是间接宾语（人），后面的 that 从句整体充当直接宾语（告知的具体内容）。"
    },
    {
      "id": "d4",
      "type": "click-role",
      "prompt": "请点击选出本句中说明宾语状态的【宾语补足语（OC）】：",
      "tokens": [
        "Regular morning exercise",
        "keeps",
        "college students",
        "energetic and focused",
        "all day."
      ],
      "ansIdx": 3,
      "exp": "keeps + 宾语 college students + 形容词短语 energetic and focused 作宾语补足语（逻辑上 students are energetic）。"
    },
    {
      "id": "d5",
      "type": "click-role",
      "prompt": "请点击选出复合句中的【主句真正谓语动词（V2 切分点）】：",
      "tokens": [
        "The reference book",
        "that I borrowed yesterday",
        "contains",
        "hundreds of clear examples."
      ],
      "ansIdx": 2,
      "exp": "borrowed 是定语从句内部的谓语（V1），到第二个谓语 contains 处定语从句结束，contains 才是整句主干的真谓语！"
    },
    {
      "id": "d6",
      "type": "click-role",
      "prompt": "请点击选出句首充当整句【主语】的成分：",
      "tokens": [
        "Reading classic English essays aloud",
        "improves",
        "both pronunciation",
        "and writing style."
      ],
      "ansIdx": 0,
      "exp": "动名词短语 Reading classic English essays aloud 整体充当单数主语，因此谓语动词使用第三人称单数 improves。"
    },
    {
      "id": "d7",
      "type": "drag-order",
      "prompt": "将下列词块排成语法正确的【宾语从句（注意陈述语序）】：「我想知道下一班校车什么时候发车。」",
      "chunks": [
        "I want to know",
        "when",
        "the next campus bus",
        "will leave."
      ],
      "exp": "宾语从句严禁用疑问倒装 will the next campus bus leave，必须保持“连接词 when + 主语 the next campus bus + 谓语 will leave”。"
    },
    {
      "id": "d8",
      "type": "drag-order",
      "prompt": "将下列词块排成正确的【No sooner 句首部分倒装句】：「我们刚到体育馆，大雨就倾盆而下。」",
      "chunks": [
        "No sooner",
        "had we reached",
        "the stadium",
        "than heavy rain poured down."
      ],
      "exp": "No sooner 置于句首时，前句用过去完成时且须将助动词 had 提到主语 we 前面（had we reached），后句搭配 than + 一般过去时。"
    },
    {
      "id": "d9",
      "type": "drag-order",
      "prompt": "将下列词块排成标准的【倍数同级比较句】：「新图书馆的规模是旧馆的三倍大。」",
      "chunks": [
        "The new library is",
        "three times",
        "as large as",
        "the old one."
      ],
      "exp": "倍数永远放在比较结构最前面：倍数（three times）+ as + 形容词原级（large）+ as + 比较对象。"
    },
    {
      "id": "d10",
      "type": "drag-order",
      "prompt": "将下列词块排成【原因定从 + 表从黄金句】：「他迟到的原因是闹钟没响。」",
      "chunks": [
        "The reason",
        "why he was late",
        "is",
        "that his alarm didn't go off."
      ],
      "exp": "固定句式 The reason why ... is that ...，表语从句必须用 that 引导，切勿误用 because。"
    },
    {
      "id": "d11",
      "type": "drag-order",
      "prompt": "将下列词块排成正确的【省略 if 虚拟倒装句】：「要是昨天知道实情，我就帮你了。」",
      "chunks": [
        "Had I known",
        "the truth yesterday,",
        "I would have",
        "helped you."
      ],
      "exp": "If I had known 省略 if 后将 Had 提至主语 I 之前，主句对过去虚拟用 would have helped。"
    },
    {
      "id": "d12",
      "type": "drag-order",
      "prompt": "将下列词块排成正确的【as 让步部分倒装句】：「尽管他还是个孩子，却懂得很多急救知识。」",
      "chunks": [
        "Child",
        "as he is,",
        "he knows a lot",
        "about first aid."
      ],
      "exp": "as 引导让步状语从句倒装时，单数可数名词提前作表语必须省略冠词 a（Child as he is）。"
    },
    {
      "id": "d13",
      "type": "verb-fill",
      "prompt": "用括号内动词的正确形式填空（注意时间状语与主被动）：\nLook at the sign! The pedestrian bridge ____ (repair) right now, so please take the underpass.",
      "answers": [
        "is being repaired"
      ],
      "hint": "“此刻正在被维修”——现在进行时的被动语态（3个单词）。",
      "exp": "right now 锁定现在进行时，天桥是“被维修”，故填 am/is/are + being + done ➔ is being repaired。"
    },
    {
      "id": "d14",
      "type": "verb-fill",
      "prompt": "用括号内动词的正确形式填空（注意时间段与瞬间动词转化）：\nMy grandfather's old comrade ____ (die) for twelve years, yet his stories still inspire us.",
      "answers": [
        "has been dead"
      ],
      "hint": "die 是瞬间动词，搭配 for twelve years 延续至今必须转化为系表状态！",
      "exp": "for twelve years + inspire（现在时）要求现在完成时的延续性状态，die 转化为 be dead ➔ has been dead。"
    },
    {
      "id": "d15",
      "type": "verb-fill",
      "prompt": "用括号内动词的正确形式填空（混合虚拟语气）：\nIf she ____ (take) the doctor's advice last week, she wouldn't have a sore throat now.",
      "answers": [
        "had taken"
      ],
      "hint": "从句时间是 last week（对过去事实相反的虚拟）。",
      "exp": "混合虚拟语气中从句带 last week 表对过去的相反假设，if 从句使用过去完成时 had taken。"
    },
    {
      "id": "d16",
      "type": "verb-fill",
      "prompt": "用括号内动词的正确形式填空（“贱命重要”被动虚拟）：\nIt is essential that every piece of lab equipment ____ (check) before the test begins.",
      "answers": [
        "be checked",
        "should be checked"
      ],
      "hint": "It is essential that... 从句使用 (should) + 被动原形。",
      "exp": "essential 触发主语从句虚拟语气，设备是“被检查”，故填 (should) be checked。"
    },
    {
      "id": "d17",
      "type": "verb-fill",
      "prompt": "用括号内动词的正确形式填空（使役动词被动还原 to）：\nThe young intern was made ____ (rewrite) the entire data summary twice.",
      "answers": [
        "to rewrite"
      ],
      "hint": "make sb. do 变为被动语态 was made 时，原本省略的符号必须补回！",
      "exp": "使役动词 make 在被动语态中必须还原不定式符号 to：be made to do ➔ to rewrite。"
    },
    {
      "id": "d18",
      "type": "verb-fill",
      "prompt": "用括号内动词的正确形式填空（主谓一致就远原则 + 现在完成）：\nA box of rare books, along with several old maps, ____ (donate) to our college library recently.",
      "answers": [
        "has been donated"
      ],
      "hint": "核心主语是单数 A box，recently 提示现在完成时，且书籍是“被捐赠”。",
      "exp": "along with 遵循就远原则，单数主语 A box + recently 现在完成时被动 ➔ has been donated。"
    },
    {
      "id": "d19",
      "type": "confusable",
      "prompt": "辨析易混动词 lie（躺/位于）与 lay（放置/下蛋）：\nExhausted from work, he ____ on the bed right after he ____ his briefcase on the chair.",
      "opts": [
        "A. lay; laid",
        "B. laid; lay",
        "C. lied; laid",
        "D. lay; lain"
      ],
      "ans": 0,
      "exp": "第一空“躺在床上”无宾语，用 lie 的过去式 lay；第二空“把公文包放在椅子上”有宾语 briefcase，用及物动词 lay 的过去式 laid！"
    },
    {
      "id": "d20",
      "type": "confusable",
      "prompt": "辨析 rise（不及物升起/上涨）与 raise（及物举起/提高/筹集）：\nWhen the national flag ____ slowly, all the students ____ their right hands to salute.",
      "opts": [
        "A. raised; rose",
        "B. rose; raised",
        "C. risen; raised",
        "D. rose; risen"
      ],
      "ans": 1,
      "exp": "第一空国旗“升起”无宾语，用 rise 的过去式 rose；第二空“举起右手”有宾语 hands，用及物动词 raise 的过去式 raised。"
    },
    {
      "id": "d21",
      "type": "confusable",
      "prompt": "辨析 used to do 与 be used to doing / be used to do：\nBamboo used to ____ only as building material here, but now locals are used to ____ handicrafts with it.",
      "opts": [
        "A. be used; making",
        "B. use; make",
        "C. being used; making",
        "D. be used; make"
      ],
      "ans": 0,
      "exp": "第一空 used to do（过去常常）+ 竹子被用作材料 ➔ used to be used；第二空 are used to（习惯于，to 为介词）+ doing ➔ making！"
    },
    {
      "id": "d22",
      "type": "confusable",
      "prompt": "辨析 a number of（许多）与 the number of（……的数量）：\n____ wild swans fly here every spring, and ____ them ____ exceeded two thousand this year.",
      "opts": [
        "A. The number of; a number of; has",
        "B. A number of; the number of; has",
        "C. A number of; the number of; have",
        "D. The number of; a number of; have"
      ],
      "ans": 1,
      "exp": "“许多天鹅飞来”用 A number of；“它们的数量已突破两千”用 the number of，中心词是单数 number，谓语用单数 has！"
    },
    {
      "id": "d23",
      "type": "confusable",
      "prompt": "辨析名词性从句中的 that 与 what：\n____ impressed the judges most was ____ the team stayed calm under extreme pressure.",
      "opts": [
        "A. That; what",
        "B. What; that",
        "C. What; what",
        "D. That; that"
      ],
      "ans": 1,
      "exp": "第一空主语从句缺主语（最打动评委的事）用 What；第二空表语从句主谓状齐全、句意完整，用连接词 that。"
    },
    {
      "id": "d24",
      "type": "confusable",
      "prompt": "辨析非限定性定语从句中的 As 与 which：\n____ we had expected, she won first place, ____ brought great honor to our department.",
      "opts": [
        "A. Which; as",
        "B. As; that",
        "C. As; which",
        "D. It; which"
      ],
      "ans": 2,
      "exp": "第一空位于句首表“正如我们所料”只能用 As；第二空位于主句后表顺承结果“这一点给系里带来了荣誉”用 which（逗号后禁选 that）。"
    },
    {
      "id": "d25",
      "type": "error-fix",
      "prompt": "点击找出句中有语法错误的一处并修正：",
      "segments": [
        "Although the task",
        "was extremely urgent,",
        "but every member",
        "checked the data carefully."
      ],
      "errIdx": 2,
      "fixOpts": [
        "去掉 but（改为 every member 或 yet every member）",
        "把 Although 改为 Despite",
        "把 checked 改为 checking"
      ],
      "fixAns": 0,
      "exp": "英汉差异核心铁律：从属连词 Although/Though 与并列连词 but 绝不能在同一个复合句中重复并存（可去掉 but 或改用副词 yet）。"
    },
    {
      "id": "d26",
      "type": "error-fix",
      "prompt": "点击找出句中有语法错误的一处并修正：",
      "segments": [
        "Great changes",
        "have been taken place",
        "in my hometown",
        "since 2018."
      ],
      "errIdx": 1,
      "fixOpts": [
        "改为 have taken place（不及物短语无被动）",
        "改为 were taken place",
        "改为 had taken place"
      ],
      "fixAns": 0,
      "exp": "take place / happen / occur / break out / belong to 属于不及物动词（短语），绝对不能使用被动语态，应改为 have taken place！"
    },
    {
      "id": "d27",
      "type": "error-fix",
      "prompt": "点击找出句中有语法错误的一处并修正：",
      "segments": [
        "Our career advisor",
        "warmly suggested",
        "us to gain",
        "practical experience early."
      ],
      "errIdx": 2,
      "fixOpts": [
        "改为 gaining（或 that we (should) gain）",
        "改为 us gaining to",
        "改为 us gain"
      ],
      "fixAns": 0,
      "exp": "英语中绝对没有 suggest sb. to do sth. 结构！只能用 suggest doing sth. 或 suggest (that) sb. (should) do sth.（advise 才可接 sb. to do）。"
    },
    {
      "id": "d28",
      "type": "error-fix",
      "prompt": "点击找出句中有语法错误的一处并修正：",
      "segments": [
        "Hardly had the bell",
        "rung for class",
        "than the teacher",
        "stepped into the room."
      ],
      "errIdx": 2,
      "fixOpts": [
        "把 than 改为 when（或 before）",
        "把 Hardly 改为 As soon as",
        "把 stepped 改为 had stepped"
      ],
      "fixAns": 0,
      "exp": "固定搭配混淆：No sooner 搭配 than，而 Hardly / Scarcely 必须搭配 when（或 before）！"
    },
    {
      "id": "d29",
      "type": "error-fix",
      "prompt": "点击找出句中有语法错误的一处并修正：",
      "segments": [
        "Neither the twins",
        "nor their mother",
        "know the password",
        "to the tablet."
      ],
      "errIdx": 2,
      "fixOpts": [
        "把 know 改为 knows（就近原则看单数 mother）",
        "把 nor 改为 or",
        "把 know 改为 knowing"
      ],
      "fixAns": 0,
      "exp": "neither...nor... 遵循就近原则，离谓语最近的主语是单数 their mother，一般现在时谓语必须用三单 knows！"
    },
    {
      "id": "d30",
      "type": "error-fix",
      "prompt": "点击找出句中有语法错误的一处并修正：",
      "segments": [
        "The exciting news",
        "which our paper",
        "was accepted",
        "made everyone cheer."
      ],
      "errIdx": 1,
      "fixOpts": [
        "把 which 改为 that（同位语从句不缺成分）",
        "把 which 改为 what",
        "把 was accepted 改为 accepted"
      ],
      "fixAns": 0,
      "exp": "our paper was accepted 是完整被动句，不缺任何成分，用来解释抽象名词 news 的具体内容，属于同位语从句，连接词只能用 that，不能用 which！"
    },
    {
      "id": "d31",
      "type": "translation",
      "cn": "如果明天下雪，我们就把户外迎新活动改到体育馆里举行。（条件状语从句 · 主将从现）",
      "scaffold": "语法骨架：If + 一般现在时从句, 主句 + will do",
      "opts": [
        "A. If it snows tomorrow, we will move the outdoor orientation to the gymnasium.",
        "B. If it will snow tomorrow, we will move the outdoor orientation to the gymnasium.",
        "C. If it snowed tomorrow, we will move the outdoor orientation to the gymnasium."
      ],
      "ans": 0,
      "exp": "真实条件状语从句表将来遵循“主将从现”：从句用一般现在时 snows，主句用一般将来时 will move。"
    },
    {
      "id": "d32",
      "type": "translation",
      "cn": "我们早就该采取切实措施来保护视力了。（It is high time + 虚拟语气）",
      "scaffold": "语法骨架：It is high time that + 主语 + 一般过去时 did / should do（should 不可省）",
      "opts": [
        "A. It is high time that we take practical steps to protect our eyesight.",
        "B. It is high time that we took practical steps to protect our eyesight.",
        "C. It is high time that we have taken practical steps to protect our eyesight."
      ],
      "ans": 1,
      "exp": "It is high time that 从句必须使用一般过去时 took（或 should take，不能单用原形 take）。"
    },
    {
      "id": "d33",
      "type": "translation",
      "cn": "如果天气允许的话，志愿者们这周六将去清理海滩。（独立主格结构）",
      "scaffold": "语法骨架：名词(Weather) + 现在分词(permitting), 主句（注意两句间无连词 if！）",
      "opts": [
        "A. Weather permits, the volunteers will clean up the beach this Saturday.",
        "B. Weather permitted, the volunteers will clean up the beach this Saturday.",
        "C. Weather permitting, the volunteers will clean up the beach this Saturday."
      ],
      "ans": 2,
      "exp": "两分句仅用逗号隔开且无连词 if，须用独立主格 Weather permitting（若有 If 则写 If weather permits）。"
    },
    {
      "id": "d34",
      "type": "translation",
      "cn": "面对确凿的数据，他别无选择，只能修改原先的结论。（前无 do 后有 to）",
      "scaffold": "语法骨架：have no choice / option but + to do sth.",
      "opts": [
        "A. Faced with solid data, he had no choice but revise his original conclusion.",
        "B. Faced with solid data, he had no choice but to revise his original conclusion.",
        "C. Facing with solid data, he had no choice but to revise his original conclusion."
      ],
      "ans": 1,
      "exp": "① be faced with 作状语用过去分词 Faced with；② had no choice but 前无动词 do，后面必须带不定式 to revise！"
    },
    {
      "id": "d35",
      "type": "translation",
      "cn": "我永远不会忘记我们一起为专升本考试奋斗的那些日子。（定语从句关系词甄别）",
      "scaffold": "语法骨架：先看从句谓语 struggled / spent 是否缺宾语！",
      "opts": [
        "A. I will never forget the days when we worked hard together for the ZSB exam.",
        "B. I will never forget the days which we worked hard together for the ZSB exam.",
        "C. I will never forget the days when we spent together for the ZSB exam."
      ],
      "ans": 0,
      "exp": "worked hard 是不及物结构，从句主干完整缺时间状语，故用 when（而 C 中 spent 及物缺宾语却误用了 when）！"
    },
    {
      "id": "d36",
      "type": "translation",
      "cn": "这所乡村小学目前最需要的是有耐心的英语老师。（what 主语从句 + 主谓一致）",
      "scaffold": "语法骨架：What + 从句（作主语）+ 系动词（随复数表语 teachers 用 are）",
      "opts": [
        "A. That this rural school needs most is patient English teachers.",
        "B. What this rural school needs most are patient English teachers.",
        "C. Which this rural school needs most are patient English teachers."
      ],
      "ans": 1,
      "exp": "从句 needs 缺宾语用 What 引导主语从句；整句为主系表结构且表语是复数名词 teachers，系动词用复数 are。"
    }
  ]
};
