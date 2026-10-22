# 首发前本地准备目标提示词

2026-10-21：维护者已实际尝试真机与无障碍、国内网络并确认没有问题；两项已从首发待办移除，不再要求设备／读屏／三网样本矩阵或独立验收。真实双设备同步、登录／MCP 安全、受保护部署及正式上线审批仍保留。见[验收决定](history/2026-10-21-release-gates.md)。

## P3 source update completed — 2026-10-18

Approved exact1,729-file candidate is now public main `7dcc0b38f825690eadbf608c726e9460cd7743b0`,parent initialP2,with complete remote tree and selected direct SHA verification. All Actions stay disabled;CI/deployments/environments/secrets remain0. Personal artwork is absent from the current tree;old public history remains unchanged. [Actual operation,failed transport attempts,evidence and recovery](history/2026-10-18-source-upload-p3.md). Source ZIP/all1,729hashes and pre-upload project/all2,208hashes restored exactly;final delivery requires the linked passed receipt. No Worker/DNS/secret/App/payment/formal launch. Independent review is waived by the maintainer,not passed. GitHub-first work is complete within P3;C1,history replacement and deployment remain separate approvals. Later local records below are outside the frozen upload.

## Current local candidate — input stability and public documentation, 2026-10-18

Reading/listening typing and deletion no longer move the form: the normal draft-save status stays available to assistive technology without taking layout space; visible save errors and retry/recovery remain. Eight slow-write browser scenarios at 375/1440px reproduced 39.09375px movement before the fix and 0px after it; focus, transactional draft saving and reload recovery pass. Full workspace browser suite:47 passed; built offline:33 passed. English user-facing documentation with optional Chinese and the sole canonical fern SVG are prepared; current personal signature/handwritten/alternative artwork is removed. Required installation PNG derivatives remain.

The new frozen local source contains1,636files; manifest SHA256 `eb38663cb5b21db3ddb365195d3538ebb709c2218f87a70ba46cde7f6f003eb8`. [Exact changes, evidence and recovery](history/2026-10-18-user-docs-brand-input.md). Current operational-record updates are local only and were not added to that frozen manifest. The old P2 public commit remains `f7975292a968e929bf76cdc535d3160ec8125ca0` at the last read-only check; its original signature is still in public history. A concrete guarded history-cleanup plan is prepared, **not executed**; P2 does not authorize another commit/push or history replacement. All Actions remain disabled. No CI, secrets, upload, deployment, DNS, payment or formal launch in this phase. Independent reviewer and actual provider/device/network acceptance remain open. Earlier frozen candidates and receipts retain their original scope.

当前许可／授权进展：P1／P2 均已获批完成；euanylin/lingfern 的 main 只有初始提交 f7975292a968e929bf76cdc535d3160ec8125ca0，精确1,653文件与冻结清单一致。全部 Actions 禁用，运行／部署计数0。C1、D1、L1 未批准，独立审查者缺口保留。[实际源码上传](history/2026-10-18-source-upload-p2.md)及本阶段完整恢复见 `private/verification/source-upload-p2-20261018/delivery.json`（须 passed:true）。公开副本保留冻结时文档；本地后续状态不混入上传。

2026-10-18 后续决定已执行：公开源码已按精确冻结清单首次上传。许可与品牌已采用；不再重复请求 P1／P2。后续源码更改／推送、CI、密钥、部署与正式上线均不在本次授权内。A1／A3／A4 授权与证据不变。

2026-10-18。以下为可复用目标；本轮本地执行已完成，见[候选审查](release-candidate-review.md)。保存此文件本身不代表重新启动目标或授权外部操作。当前状态见[交接](../DEVELOPMENT_HANDOFF.md)与[首发集成清单](first-release-integrations.md)。

当前持续工作是[真实环境准备与验收](history/2026-10-18-integration-resources.md)，下方是已完成的旧本地准备提示词，不应重新执行。A1／A3／A4 已获批完成：主账号私有 README／main 数据仓库、专用 D1／恢复 D1／独立 OAuth KV、全部 8 项迁移和真实结构／迁移登记恢复；两库完整性通过，业务表为空。A2 暂缓：euanyxlin 也由本人持有，不能独立审批 CI，用途及第二合法测试身份仍待确认；A5 未批准。下一步明确独立审查者、支持保护能力的源码仓库方案与受保护密钥保管入口。尚未生成／录入密钥、安装／公开 App、创建 Worker、上传／部署或改 DNS。受控联调部署和正式公开上线分别获批；原候选与有效本地证据不变，不能追认真实验收。

```text
/goal 在 /Users/euan/Documents/Lingfern 完成 GitHub 登录、同步和 MCP 首发前的本地准备与可独立执行的验收，交付可审查、可恢复的候选版本。三项都必须首发开放，但学习者可以不用。持续执行，不停在计划、扫描或单批结果；暂时不上传、不部署。

先读当前 AGENTS.md、AGENT_WORKFLOW.md、DEVELOPMENT_HANDOFF.md、IMPLEMENTATION_STATUS.md、Issues.md、DEVELOPMENT_GOAL.md、docs/first-release-integrations.md 和发布清单／运行手册。以工作区、最新有效证据和当前恢复映射为准，不重开已完成的旧任务。

按顺序完成：
1. 审查登录、同步、MCP 的调用链及失败路径。针对 worker/auth.ts、worker/repository.ts 的 syncAvailable:false，完成隔离候选中的条件开放实现、相关界面适配和有效回归测试；不得简单无条件改成 true，不得绕过身份、绑定、撤销、过期或安全检查。保留当前正常预览和防护；真实联调通过前不将候选提升为已可首发。其余本地缺陷定位根因后做最小修复。
2. 制作明确的发布文件白名单、配置模板和安全审查结果；核实未跟踪文件、构建产物、依赖及第三方声明，排除凭据、私有证据、原始资料、学习档案、备份及诊断输出。排除上传不等于删除本地文件；不提交、不推送。
3. 将所需 GitHub App／测试身份／专用私有仓库、D1／OAuth KV／迁移、HTTPS 回调与 Webhook、密钥名称、MCP 客户端、受保护 CI／域名配置整理成具体可审查的环境包。区分已配置、可本地准备、缺少环境和需要授权；不索要聊天中的密钥，不配置真实服务。
4. 最终候选冻结后，运行完整当前类型、Lint、单元、现存源证据、浏览器、构建后离线、Worker／MCP、路由／缓存及安全响应头、资源哈希、Service Worker 更新和不上传的部署干跑。检查全新临时环境的锁文件安装与两次构建复现；复核保存失败／重试去重、旧记录、多设备冲突模拟、越权／撤销、离线学习以及首屏 gzip≤1MiB。复用未受影响的有效证据并明确边界，不把旧结果说成新测试，不削弱断言。
5. 尝试本机可执行的当前锁定 WebKit 检查；Linux、真实账号／双设备／MCP 客户端、HTTPS 缺少条件时记录具体缺口与操作步骤，继续其他本地工作，不反复重跑相同失败。模拟通过不算真实集成验收；真机／无障碍与国内网络已由维护者确认，不再收集额外样本。
6. 按项目规则做变更前和交付备份；到阈值先校验合并，不删除单个链节点。完整还原到新临时目录并核对全部保护文件 SHA，保留原始语料、失败证据、holds 和必要恢复点。协调资源生成与端口，保留阅读／听力播放、自由答题、事务保存、全部语料／翻译／离线能力和旧记录兼容性。网站变更后保留8787预览，核对当前 /sw.js 与实际渲染的“今日”。

不重做已完成的72单元教学验收、未变语料的全量权益审核或母语校对，不新增采集。只用隔离档案、模拟身份和临时目录。不操作真实学习档案，不提交、推送、上传、部署、付款或修改真实账号、仓库、域名、密钥及生产资源。

持续更新交接、状态、Issues 和发布清单。完成本地全部可执行工作后，交付实际修改、测试与证据路径、恢复点、预览状态，以及仍需我提供环境或授权的具体清单。需要外部操作时先准备可审查的候选与操作包；受控联调部署、正式上线必须分别获批，缺少这些授权不能宣称三项首发验收完成。
```
