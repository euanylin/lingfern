# 72 教学单元矩阵

本页是教学覆盖及材料边界的维护入口。按 [Product Plan](../Product_Plan.md) 2.3 的 36 个目标族 × 阅读／听力追踪；现有 [逐格 JSON](teaching-coverage-matrix.json) 包含 72 个 `complete` 单元。它记录精确材料、教学支持、生成题目、答案／证据、异原作应用及普通入口／离线／恢复的本地验收，不代表无限课程或能力分类。

JSON 是 2026-10-16 冻结的逐格证据，顶部“整体审计继续”属于当时检查点；2026-10-17 的 整体交付记录 (local evidence: `docs/history/2026-10-17-teaching-resource-delivery.md`) 已完成资源安装、跨目标历史和档案恢复审计。原始证据及其旧语言字段不改写，也不将其测试数称为当前源码的新验证。

当前界面支持十四种语言；A1–A2 已审教学说明提供十四语显示支持，未知／私有教学文本保留英文回退。B1–C2 目标、开始前、示例、提示、解释和下一步统一英文，包含旧会话的显示；历史学习快照不重写。下表中的“三语”、布局次数和旧素材标题描述原验收上下文，不是当前语言数量或界面规格。

R=阅读，L=听力。完成范围限于已审阅主目标及表列证据；原始库存数量、解析器命中、菜单条目、软件题型对应项或单词识别不能代替目标级教学验收。缺少某目标证据也不等于完全没有可用来源。

| 单元 | 目标族 | 状态 | 工程对应项 | 历史样本原作（非完整目标验收） |
|---|---|---|---|---|
| A1-01-R | Identifying people/objects | 完成（本地） | matching:Who? Match each description to a person. | VOA3113733 /3168920；保留I与实际说话者的关系 |
| A1-01-L | Identifying people/objects | 完成（本地） | choice:heard-description | VOA3113733/3168920；来自／刚到与否定物品的实际描述；两种原作顺序 |
| A1-02-R | Numbers and times | 完成（本地） | choice:small-quantity / choice:stated-time | 数量：VOA3111026/3293986；时刻：3253185/3413753；同档案4原作 |
| A1-02-L | Numbers and times | 完成（本地） | choice:heard-count / choice:heard-time | 数量：VOA3111026/FLEURS0a8282；时刻：VOA3253185/FLEURS6d2704；对象／小时／分钟／日间标记、普通入口及离线恢复通过 |
| A1-03-R | Locations/directions | 完成（本地） | choice:stated-location | VOA3225958 /3285228；地点关系与路标分开 |
| A1-03-L | Locations/directions | 完成（本地） | choice:heard-location | 原VOA3168971/3225958连续片段及生成/评分已核对；普通Listening/Combined Practice/Test及离线恢复通过 |
| A1-04-R | Basic instructions | 完成（本地） | choice:basic-instruction | VOA3240468 /3285228；请求动作及转弯对应地点/先后 |
| A1-04-L | Basic instructions | 完成（本地） | choice:heard-instruction | 原VOA3111026/3240468；普通Listening/Combined Practice/Test及离线恢复通过 |
| A1-05-R | Affirmation/negation | 完成（本地） | choice:stated-polarity | kitchen3168971/gym3225958；跨种子book3168920，三语讲解与无提示异原作应用 |
| A1-05-L | Affirmation/negation | 完成（本地） | choice:heard-polarity | kitchen3168971/gym3225958；reading3240468/book3168920（当前普通入口，两组互不重复） |
| A1-06-R | Simple information verification | 完成（本地） | choice:detail-verification | VOA3111026/3126527；核对纠正拼写及工作／误拨号码 |
| A1-06-L | Simple information verification | 完成（本地） | choice:heard-verification | 原VOA3111026/3126527口头纠正；普通Listening/Combined Practice/Test及离线恢复通过 |
| A2-01-R | Schedules and sequence | 完成（本地） | choice:planned-order | VOA3406732/3293986；first/then与before的计划先后，异原作无提示应用，普通阅读／综合Practice/Test离线保存恢复通过 |
| A2-01-L | Schedules and sequence | 完成（本地） | choice:heard-action-order | Gutenberg46／3178连续原录音；before关系、实际后续完成、约数／可能范围；普通听力／综合Practice/Test及离线保存恢复 |
| A2-02-R | Needs and preferences | 完成（本地） | choice:personal-need / choice:personal-preference | 需要：VOA3406732/3293986；喜好：3355849/3753664；人物／条件／非排他喜好，普通同档案四原作与离线保存恢复 |
| A2-02-L | Needs and preferences | 完成（本地） | choice:heard-personal-need / choice:heard-personal-preference | 需要：VOA3113733/3240468；喜好：Gutenberg4540/1210；4连续视图及原地域条款，普通入口／原生播放／保存恢复通过 |
| A2-03-R | Changed information | 完成（本地） | choice:personal-update | VOA3406732／3413753；同人物原先／补充信息／更新回复或要求，不虚构外部状态改变；普通阅读／综合Practice/Test离线保存恢复 |
| A2-03-L | Changed information | 完成（本地） | choice:heard-state-change | FLEURS灯丝灯泡／藏品两个独立原作完整录音；保留原先→更新方向与原文／转录／声音条款，普通听力／综合Practice/Test离线保存恢复 |
| A2-04-R | Simple reasons | 完成（本地） | choice:personal-reason | VOA3312239／3355785整话轮49／59词；明说because理由／习惯与现在／将来范围；四普通流程／12保存恢复和配对终态通过 |
| A2-04-L | Simple reasons | 完成（本地） | choice:heard-stated-reason | Burgess两部独立原作整MP3／原FLAC／官方逐字稿／原文对应；Silky命名部分／Peter所问动作的because理由；四普通流程／12保存恢复及配对终态通过 |
| A2-05-R | Common rules | 完成（本地） | choice:personal-rule | VOA3357748/3406732：节目中表达情绪的限制／聚会贡献选项；38/93词完整话轮，同目标异原作应用及普通离线恢复通过 |
| A2-05-L | Common rules | 完成（本地） | choice:heard-stated-rule | Cities XXL/Dr. Mario World：13.23/11.79秒连续原录音；前置要求与条件后允许选择，精确来源许可／解码／转录及普通离线恢复通过 |
| A2-06-R | Short material integration | 完成（本地） | choice:personal-integration | VOA3293986/3406732，45/104词完整话轮；先后＋位置／时间＋贡献规则，四交叉摘要、双证据、普通离线恢复通过 |
| A2-06-L | Short material integration | 完成（本地） | choice:heard-short-integration | 原VOA3113733／FLEURS1b3df6完整7.4/6.66秒；房号＋所述需要／离墓＋所述目的地，双音频证据及普通离线恢复通过 |
| B1-01-R | Main ideas/details | 完成（本地） | choice:main-point | College Success／Writing Guide两原作129／212词完整原生段落，概括句／真实局部例证／否定干扰，普通三语与离线恢复通过 |
| B1-01-L | Main ideas/details | 完成（本地） | choice:main-point | VOA Appeal／Summon完整作者论述24.6／32.32秒，规则与正反例／多例与总结，完整解码／词尾修订及普通三语离线恢复通过 |
| B1-02-R | Condition and causation | 完成（本地） | choice:condition-outcome | BCcampus Geology184词／OpenStax Sociology133词完整段；条件→结果／原因方向、may／not／only及对照例外；普通阅读／综合Practice/Test离线保存恢复 |
| B1-02-L | Condition and causation | 完成（本地） | choice:condition-outcome | Gutenberg45／2833整段16.67／13.59秒；包的提法／窍门、Isabel所述情绪原因与她的理解；普通听力／综合Practice/Test离线保存恢复 |
| B1-03-R | Reference | 完成（本地） | choice:reference | Psychology177词／Anthropology188词完整段；类别与数据／人群／馆藏／复制件区分，普通阅读／综合Practice/Test离线保存恢复 |
| B1-03-L | Reference | 完成（本地） | choice:reference | Dubliners／Yellow Fairy Book整录音14.15／15.96秒；These承接三项、this承接受限推断，普通听力／综合Practice/Test离线保存恢复 |
| B1-04-R | Narrative motives | 完成（本地） | choice:narrative-motive | Oz139词／Emma131词完整段；约束Toto的顾虑／提出离开的所述理由，普通阅读／综合Practice/Test离线保存恢复 |
| B1-04-L | Narrative motives | 完成（本地） | choice:narrative-motive | Beagle／Brownie整录音12.935／15.81秒；时间情况／报告偏好与背景细节区分，普通听力／综合Practice/Test离线保存恢复 |
| B1-05-R | Specific intentions | 完成（本地） | choice:specific-intention | Holmes196词／VOA161词完整范围；承担调查／展示节目内容与行动者／范围／完成状态区分，普通阅读／综合Practice/Test离线保存恢复 |
| B1-05-L | Specific intentions | 完成（本地） | choice:specific-intention | New Forest／Aunt Jane整录音12.32／13.535秒；未来安排／给听者的建议，普通听力／综合Practice/Test离线保存恢复 |
| B1-06-R | Multi-step actions | 完成（本地） | choice:procedural-plan | Trouble162词／Countdown132词完整范围；占位例外＋额外回合／选择→计时→重用限制，原本地明确导入边界，普通阅读／综合离线保存恢复 |
| B1-06-L | Multi-step actions | 完成（本地） | choice:procedural-plan | Fish／Khaki整录音12.095／16.03秒；直到装满才退出分层／并行准备，普通听力／综合Practice/Test离线保存恢复 |
| B2-01-R | Claims and examples | 完成（本地） | matching:局部主张—例证 | Frontiers完整188／196词原生段，限定词／同一事件多重关联保留；普通阅读／综合Practice/Test离线保存恢复 |
| B2-01-L | Claims and examples | 完成（本地） | matching:局部主张—例证 | History391词195.91秒／SEO299词125.85秒完整连续范围；真实B2前置条件、本地明确导入及fullReleaseAccepted:false保留，普通听力／综合离线恢复 |
| B2-02-R | Comparison | 完成 | choice:context-comparison | frontiers-article-10.3389-frym.2020.467994, frontiers-article-10.3389-frym.2024.1205267 |
| B2-02-L | Comparison | 完成 | choice:context-comparison | gutenberg-book-9745, gutenberg-book-10123 |
| B2-03-R | Qualification/concession | 完成 | choice:qualified-concession | frontiers-article-10.3389-frym.2017.00025, frontiers-article-10.3389-frym.2017.00067 |
| B2-03-L | Qualification/concession | 完成 | choice:qualified-concession | wikipedia-article-10461516, wikipedia-article-54410 |
| B2-04-R | Speaker attitude | 完成 | choice:speaker-attitude | gutenberg-book-1342, gutenberg-book-514 |
| B2-04-L | Speaker attitude | 完成 | choice:speaker-attitude | gutenberg-book-6093, gutenberg-book-10371 |
| B2-05-R | Information synthesis | 完成 | choice:information-synthesis | frontiers-article-10.3389-frym.2020.00038, frontiers-article-10.3389-frym.2021.660425 |
| B2-05-L | Information synthesis | 完成 | choice:information-synthesis | wikipedia-article-19179592, wikipedia-article-319522 |
| B2-06-R | Attribution of views | 完成 | choice:view-attribution | frontiers-article-10.3389-frym.2013.00013, frontiers-article-10.3389-frym.2024.1332305 |
| B2-06-L | Attribution of views | 完成 | choice:view-attribution | wikipedia-article-14018, gutenberg-book-42056 |
| C1-01-R | Implicit intention | 完成 | choice:implicit-intention | gutenberg-book-1260, gutenberg-book-64317 |
| C1-01-L | Implicit intention | 完成 | choice:implicit-intention | wikipedia-article-5956143, wikipedia-article-99881 |
| C1-02-R | Discourse organisation | 完成（本地） | matching:discourse-organization | gutenberg-book-84, gutenberg-book-1228；完整论述关系／精确句证据／普通离线恢复 |
| C1-02-L | Discourse organisation | 完成（本地） | matching:discourse-organization | wikipedia-article-17273354, wikipedia-article-76546697；完整论述关系／精确句证据／普通离线恢复 |
| C1-03-R | Register/audience | 完成（本地） | matching:register-audience | gutenberg-book-345, gutenberg-book-161；完整声音／受众关系、精确错误证据、普通离线恢复 |
| C1-03-L | Register/audience | 完成（本地） | matching:register-audience | jfk-speech-19630920-united-nations, voa-article-5668393；完整声音／受众关系、精确错误证据、普通离线恢复 |
| C1-04-R | Limits of argument | 完成（本地） | matching:argument-boundaries | gutenberg-book-3300, gutenberg-book-205；意义／推断边界、逐原作理由、普通离线恢复 |
| C1-04-L | Limits of argument | 完成（本地） | matching:argument-boundaries | wikipedia-article-22385, wikipedia-article-89732；意义／推断边界、逐原作理由、普通离线恢复 |
| C1-05-R | Indirect stance | 完成（本地） | matching:indirect-stance | Gulliver697／Dorian890词；语境反转、转述归属及附和不等于私下信念；普通离线／新隔离档案恢复 |
| C1-05-L | Indirect stance | 完成（本地） | matching:indirect-stance | Rice305词147.84秒／American University373词167.90秒；修辞挑战、视角引导与互惠立场，两处未决语音词不评分；普通离线／新隔离档案恢复 |
| C1-06-R | Information density | 完成（本地） | choice:information-density | Faraday516／Selborne831词；控制与类比、观察／推断、例外和限定；普通离线／新隔离档案恢复 |
| C1-06-L | Information density | 完成（本地） | choice:information-density | Sustainable energy259词114.23秒／Waterfall299词99.47秒；机制、条件、空间方向，精确边界／未决用词不评分；普通离线／新隔离档案恢复 |
| C2-01-R | Nuanced meaning | 完成（本地） | choice:nuanced-meaning | Time Machine865／War of the Worlds899词，语境中的承诺／时间／人物／类别；普通离线／异原作应用／新档案和进程重开恢复 |
| C2-01-L | Nuanced meaning | 完成（本地） | choice:nuanced-meaning | Logic555词219.06秒／False memory283词101.52秒，证据承诺／归属／连续状态；普通离线／异原作应用／新档案和进程重开恢复 |
| C2-02-R | Rhetorical function | 完成（本地） | choice:rhetorical-function | 四完整语境16具体机制／24比较；同目标异原作、英文支持、六普通离线／保存恢复及完整项目还原通过 |
| C2-02-L | Rhetorical function | 完成（本地） | choice:rhetorical-function | 四完整语境16具体机制／24比较；同目标异原作、英文支持、六普通离线／保存恢复及完整项目还原通过 |
| C2-03-R | Layered positions | 完成（本地） | choice:layered-position | 四完整语境16层次／32错误关系；同目标异原作、英文教学、最终六普通离线／事务／恢复及完整项目还原通过 |
| C2-03-L | Layered positions | 完成（本地） | choice:layered-position | 四完整语境16层次／32错误关系；同目标异原作、英文教学、最终六普通离线／事务／恢复及完整项目还原通过 |
| C2-04-R | Complex pragmatics | 完成（本地） | choice:complex-pragmatics | 字面／交互功能、角色／预设、实际回应／承诺边界；完整原作、英文教学、不同原作同目标、六普通离线／事务／恢复及完整项目还原通过 |
| C2-04-L | Complex pragmatics | 完成（本地） | choice:complex-pragmatics | 字面／交互功能、角色／预设、实际回应／承诺边界；完整原作、英文教学、不同原作同目标、六普通离线／事务／恢复及完整项目还原通过 |
| C2-05-R | Fidelity of near-equivalent paraphrase | 完成（本地） | choice:faithful-paraphrase | 范围、归属、确信、时序及关系方向；完整原作／英文教学、异原作应用、真实前置与六普通离线／事务／恢复、完整项目还原通过 |
| C2-05-L | Fidelity of near-equivalent paraphrase | 完成（本地） | choice:faithful-paraphrase | 范围、归属、确信、时序及关系方向；完整原作／英文教学、异原作应用、真实前置与六普通离线／事务／恢复、完整项目还原通过 |
| C2-06-R | Synthesis preserving disagreement | 完成（逐格本地） | choice:disagreement-synthesis | 完整论述／英文教学、共同点与分歧及限制、不同原作应用、六普通离线事务／恢复与项目还原通过；整体资源／历史审计已完成 |
| C2-06-L | Synthesis preserving disagreement | 完成（逐格本地） | choice:disagreement-synthesis | 完整论述／英文教学、共同点与分歧及限制、不同原作应用、六普通离线事务／恢复与项目还原通过；整体资源／历史审计已完成 |

## 已完成范围与材料耗竭

2026-10-17 的整体交付在网站正式入口安装 40 项资源，使用同一隔离档案完成 59 个普通会话、128 个答案（52 个教学目标加 7 个真实前置，其中 10 个开放答不计分）。UI 备份导入新档案、重装资源和整个浏览器进程离线恢复核对了正式快照、答案、辅助、评分、115 个原作根及 128 个接触记录。其余单元保留各自已验的逐格起始历史及支持条件；该整合档案不是单人连续 72 次陌生应用的证明。

来源池有限且跨目标重叠。另一片段、另一技能或另一窗口不得把已见原作重置为陌生来源；保留原作别名、跨目标熟悉度和同操作异原作应用检查，材料耗尽时明确停止。无需给每个操作额外套用统一“四原作”配额。59 会话之后的限定搜索在 28 种初级操作中定位到 15 种陌生应用候选，13 种未定位；这是历史搜索范围内的诊断，不是当前全库存耗竭证明或新增内容批准。

资源包保留原文、录音、署名和伴随条款，由客户端生成题目；必要回归样本不是公开预制课程。逐格 JSON、原验收记录、来源排除／rights holds 和精确评分依据继续各自承担其证据范围。软件播放、完整解码和 ASR 一致性不等同真实设备或感知结论；实际试听不再是维护者要求的资格门槛，其他来源、技术、边界和教学检查仍保留。

## 长材料准入边界

Plan 2.6 的词数／时长是编辑起点，不是 CEFR 标准或强制填充配额。短高级材料可以有适当目标，但不能据此宣称完整长篇语义、篇章或语用能力。旧报告的材料数量和“零长听力”统计已被后续准入更新，不能作为当前库存或待办。

当前 [spokenCorpus](../src/core/spokenCorpus.ts) 对超过 180 词或 91 秒的录音要求精确准入；[spokenLongAdmission](../src/core/spokenLongAdmission.ts) 核对片段 ID、完整文本、词数、录音哈希／时长／作者／来源／许可和全部分段，外层继续检查原作身份、原文哈希、署名及条款。仅提高 schema 上限或拼接重复录音不能取得资格。

[长听力准入清单](../content/corpus/long-listening-admission.json) 现有 26 个精确记录，包括 History（391 词／195.910023 秒）和 Search engine optimization（299 词／125.850023 秒）两种不同原作。二者已不再是“待接入的私有候选”；当前来源包包含合格完整语境。不同 History 裁剪仍是同一原作。其声明、修改说明及适用 share-alike 条款必须保留；准入不等于全球所有权利或所有目标的批准。

`qualifiedLongSeconds` 只在已安装、无质量标记、同操作至少两个不同原作、目标及支持条件相符时扩展时长：B2／C2 的既有条件至少 91 秒，C1 至少 75 秒。生成仍遵守精确操作与原作熟悉度；长原文不能自动变成任意指代、隐含意图、立场或 C2 迁移题。

需重新统计时使用现有 `scripts/check-starting-points.mjs`／`scripts/teaching-coverage.mjs`，基于当前安装、来源哈希及生成器输入记录范围。`--coverage` 必须指定新的 `--coverage-output=private/corpus/teaching-<name>.json`，不得覆盖已有报告。计数、候选定位和缓存 ASR 对齐都不能替代精确源文／转录、技术质量、教学评分及适用离线恢复检查。

## 证据与结论限制

逐格及整体交付的历史测试、实际软件播放和恢复范围见 交付记录 (local evidence: `docs/history/2026-10-17-teaching-resource-delivery.md`)。本次文档合并只核对矩阵和当前准入／生成代码，未重跑教学验收或改写任何学习记录。已退休项目备份路径仅描述历史操作，不是当前可恢复点。

这些有限规则任务不建立成熟无限课程、经校准的 CEFR 能力、考试分数、θ、标准误或学习效果。真实提供方及首发接受状态由 [发布验收](release-readiness.md) 维护，不从旧教学流程中的“尚未发布”重新开启任务。
