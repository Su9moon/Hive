# T-000497：离线隔离演练包；真实升级 BLOCKED

源基线固定为 `65c4fda4403884f2864ef754b90899c0e87528d0`，其中 PR20 业务候选为 `0afa0654799e18d1d0b5c3b8c8fb1cdd03c5187a`。只新增脚本、静态检查和说明；不改业务或 T496 工具。本包不是 Live 安装工单，不授权部署、merge 或真实原位切换。PR20/PR22 保持 Draft；PCP FIXED 组织和角色基线保持不变，CB 角色不动。

用户现场基线（用户提供，本轮未重新观测）：Chrome Dev 159.0.8130.0；原加载目录名字虽为旧 SHA，release 声明 sourceSha 为 `d2e8d1bf2d6cc9f20d9076e3cdb380fae6fc6e43`，release 24/24、核心 dist 6/6、key/Host/InstanceID MATCH，版本 0.5.1。Kernel 有 2 active Browser Leases；SQLite schemaV30/health、一致性 online backup 和独立恢复均 PASS。备份位置和真实 Profile 内容不进入 Git。本轮不读这些现场数据，不将用户现场 PASS 当成本包 Chrome UAT PASS。

## 官方依据与尚未证实的边界

严格离线：本轮未联网抓取官方页面。下面是官方文档定位与已有 API 语义的依据，须在后续获准的联网审阅中核对更新；它们不能证明 Dev 159 的路径替换实现。

| 官方文档 | 可依据的语义 / 不可外推的结论 |
| --- | --- |
| [Manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key) | 公钥用于保持开发扩展 ID。静态 SHA256 前 16 字节映射 a–p 得到同 ID；仍需两次实际加载后读 runtime.id。 |
| [Hello World / Load unpacked](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) | 开发者模式可选择解包目录；编辑后 Reload 扩展。Reload 不是选择新目录的已证明操作；不能声称点 Reload 就从 A 切到 B。 |
| [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) | local 是持久存储，移除扩展会清除它；同 ID 不等于另一路径替换一定保留数据。session 为内存态，扩展 reload/update/disable 或浏览器重启时会清除，不能作为恢复依据。 |
| [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) 与上面的 reload 教程 | 真实宿主 tab 的旧注入脚本不能假设随扩展 reload 被替换；需 reload host tab 并独立验证。模拟件没有 content script，此项本轮 NOT_RUN。 |

**Dev 159 未证实**：Load unpacked B 遇到已加载的同 ID A 时，是否拒绝 duplicate ID、是否替换现有记录、是否仍指向 A、local 是否保留以及能否回切 A。文档 API 语义不能替代实测。不得移除/重装原扩展；不得在正在使用的 Profile 强行加载候选。duplicate ID、路径显示不明确、DevTools 仍绑定旧 worker 或 local 丢失均立即 BLOCKED，不尝试猜测性绕过。

## 防误触脚本

`scripts/chrome-dev-same-id-rehearsal.ps1` 默认仅准备；`-Launch` 才请求启动。用户明确提供 Chrome Dev binary 和当前 **User Data 根**（若误填 Default，脚本也不会以它为目标）。只查询路径元数据和 binary 版本，不解析任何 Profile 文件。拒绝 UNC、reparse 祖先、临时目录与受保护目录重叠以及非 Dev 159 binary。没有目标 Profile 参数；只在系统 temp 下创建随机新目录、空 `isolated-user-data` 和 A/B 两份独立模拟件。创建失败留下的部分目录不复用，不自动清理。

脚本只从仓库 manifest 读取公开 key，不复制业务代码。两份扩展仅 manifest/worker，只有 storage 权限；无 Native Host、tabs、host permissions、content scripts、token 或自动网络请求。SHA256 计算应为 `kheifdlffdfcgmapmbbahdgkpccckmbn`，不匹配即终止。无需任何 Hive Admin/Browser Token。未执行任何 Trial、注册表、Host、Kernel、SQLite 或 CB 操作。

在可信本地磁盘运行，无并发目录篡改。启动前由操作者断网；Chrome 的禁同步/后台网络参数并不构成网络沙箱。不要登录或同步。不得自行追加 Chrome 参数或替换脚本生成的路径；没有自动调试端口，也不接入现有浏览器。只关闭新隔离窗口，不通过脚本停止任何现有进程。

```powershell
# Windows PowerShell 5.1+；两个输入由用户自行选择，不使用文档内置个人路径。
.\scripts\chrome-dev-same-id-rehearsal.ps1 -ChromeDevBinary '<Chrome Dev chrome.exe 绝对路径>' -CurrentProfileRoot '<当前 User Data 根绝对路径>'
# 上一次仅准备的目录不复用；此调用另建全新目录。
.\scripts\chrome-dev-same-id-rehearsal.ps1 -ChromeDevBinary '<同上>' -CurrentProfileRoot '<同上>' -Launch
```

preparation.json 只证明生成清单和哈希，Chrome UAT 永远初始化 NOT_RUN，readiness 永远 BLOCKED。LAUNCH_REQUESTED 不代表浏览器已正确启动；脚本不能自动判定 UI 路径替换，不提供生产切换命令。

## Windows 手工 UAT（尚未执行）

证据保存在脚本随机根下的本地私有记录中；发布前去除个人路径、截图中的账号和设备信息。不要采集真实 Profile。每一行记录独立 UTC 时间、观察者、版本、操作、前/后状态与去敏截图编号；不能只填统一 PASS。准备清单不能充当 UI 后证据。

1. 启动前记录 preparation.json 哈希、A/B manifest 与 worker 哈希、计算 ID、隔离目录为空的观察。先在获准 Windows 上检查 PowerShell 解析及参数拒绝行为：相对路径、错误版本、受保护根包含 temp、reparse 输入必须拒绝且没有 Chrome 启动；再做正常准备。这里的检查未在 Linux 代跑。
2. `-Launch` 后只看新窗口的 `chrome://version`：Profile Path 必须位于本次随机 `isolated-user-data`，Command Line 的 user-data-dir 必须一致，版本必须 159 Dev。任何不一致立刻停止，不加载扩展；保持 BLOCKED。记录独立截图。此时不得打开真实用户窗口操作。
3. 新窗口 `chrome://extensions` 开发者模式，Load unpacked 选择本次 A。记录 UI 名称 A、完整源路径（本地保密）、ID 与错误列表。打开 A service worker DevTools，执行 `await inspectRehearsal()`，必须为 A/预期 ID，local 初始没有 rehearsalMarker。保存写入前结果。
4. 执行 `await writeRehearsal('mock-<本次随机串>')`，再次独立执行 `await inspectRehearsal()`，保存 local/session 写入后结果。只写模拟串，绝不输入真实 token。
5. 先做 A 的 Reload 对照：操作前保存 A 路径和 marker；点击其 Reload，重新打开当前 worker 控制台读 inspectRehearsal。记录仍为 A 路径、local 实际值、session 实际值；不将 session 丢失视为 local 丢失。不要重复写 marker。Reload 不作为路径切换成功证据。
6. 路径切换试验：保存 A 操作前截图/读数，Load unpacked 选择本次 B；**不得点击 Remove**。若 duplicate ID 拒绝或无法确认路径，记录原始错误和 A 后状态，停止并判 BLOCKED。仅当 UI 明确指向 B、只有一条该 ID、重新打开的当前 worker 报 B/同 ID，才读 local，逐字比较原 marker。保存 B 独立后证据，session 单独记录，不要求保留。若出现两条同 ID、路径不明、marker 缺失或错误，停止；不自动降级到移除重装。
7. 仅当第 6 步通过，保存 B 前状态，Load unpacked 选择 A 回切。再次验证唯一同 ID、UI A 路径、worker A、原 local marker，保存后证据。任何拒绝、歧义或数据丢失都判 BLOCKED。不修改文件制造另一种切换方式，不重新写 marker 掩盖丢失。
8. 全部通过也只说明 **本次 Dev 159 / 模拟件 / 此路径替换方式**观察通过，不证明 Hive 业务、Native Host 或真实升级通过。关闭隔离窗口；本包没有删除或回收命令，保留私有证据供审阅。

UAT 必填状态：binary/profile 隔离 NOT_RUN；A 加载 NOT_RUN；A 写前/写后 NOT_RUN；A Reload 路径/local/session NOT_RUN；A→B 唯一 ID/路径/local/session NOT_RUN；B→A 同项 NOT_RUN；真实 content script NOT_RUN。遇到未支持操作填写 BLOCKED/原始错误，不伪造 PASS。

## 真实升级最终门禁与 ACK

即使模拟演练通过，也需要独立批准的维护窗口、2 Slot / 2 Lease / 3 Conversation 完整快照及所有者核对、全部事件/attempt 在回滚期间不丢失的可验证兼容与回放方案、cutover 前最终一致性 SQLite 备份和恢复证据（已有历史恢复 PASS 不替代最终备份）、实际候选兼容验证及授权。Source SHA 原历史目录完整保留、不覆盖；注册表 Host、InstanceID、pipe、所有 Slot/Lease/Conversation 与 DB 必须保留。没有经隔离 Chrome 证实的安全 same-ID 新路径替换则 **BLOCKED**。不得因为有备份就允许丢弃回滚期间新增事件或 attempt。

ACK：本轮只交付可审查离线工具和说明；没有执行 Chrome、部署、原位切换、merge、PR 发布或安装指令。证据分支/本地提交/发布由 bridge 处理，本代理未 add/commit/切分支。Windows PowerShell 实际执行和 Chrome 手工 UAT 为 NOT_RUN，因此总体任务验收未完成、真实升级 BLOCKED。

本轮结果包：本 README、`scripts/chrome-dev-same-id-rehearsal.ps1`、`tests/chrome_dev_same_id_static_test.py`。`python3 tests/chrome_dev_same_id_static_test.py`：3/3 PASS（公开 key ID、模拟件源码权限/行为、防护源码存在性）。这些是源码静态断言，不是 PowerShell 语法解析或路径防护运行证明。Node、PowerShell 和 Windows Chrome 不在本环境；PowerShell 解析/拒绝测试/准备执行与 Windows Chrome UAT 均 NOT_RUN。无必要的业务运行测试，因为没有改动业务代码。未生成虚构浏览器证据或真实候选包。
