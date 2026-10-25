# replica-suite

[English](README.md) | [한국어](README.ko.md) | **简体中文** | [日本語](README.ja.md)

replica-suite 是一套用于移植和重新实现应用与网站的 agent skills，流程为 evidence -> spec -> build -> verify（证据 -> 规格 -> 构建 -> 验证）。同一份 `skills/` 同时支持 Codex、Claude Code 和 GJC，`lib/`、`scripts/`、`references/` 由三个客户端共享。

- 仓库: https://github.com/yazzang-homelab/replica-suite
- 插件名: `replica-suite`，版本 `0.3.0`
- marketplace ID: `replica-suite-local`

本项目不是“一键复制任意应用”的产品。它为分析、设计、实现和验证各阶段提供证据与检查门槛，最终结果取决于目标、模型和你的判断。

## 包含的 41 个 skills

| 类别        | 数量 | 入口           | 用途                                          |
| ----------- | ---: | -------------- | --------------------------------------------- |
| app         |    8 | `app-index`    | 整个应用的功能分析、设计、实现、parity        |
| web         |   10 | `web-index`    | URL/HTML/CSS/DOM/WebGL 网站还原与视觉 QA      |
| shot        |    8 | `shot-index`   | 截图 -> HTML/React/Vue/Svelte/RN/UnoCSS/QML   |
| mobile      |    7 | `mobile-index` | APK/IPA/Flutter/Unity 包、状态、API 证据分析  |
| native      |    7 | `native-index` | Ghidra/native/C++/游戏的 Web 移植与等价性验证 |
| root router |    1 | `replica`      | 按输入和目标分发到各类别 index                |

合计 8 + 10 + 8 + 7 + 7 + 1 = 41。

## 前置条件

- Node.js 22 推荐（最低 20）、Python 3.13 推荐、git
- Ghidra、jadx、apktool、Frida、Qt 以及各平台 SDK 是独立的可选外部工具，本插件不会自动安装。


## 获取仓库

```bash
git clone https://github.com/yazzang-homelab/replica-suite.git
```

下面所有客户端都可以用本地 clone 的绝对路径代替 `yazzang-homelab/replica-suite`，例如 `/absolute/path/to/replica-suite`。

## 安装

三个客户端使用同一个仓库，但安装命令不同。

### Claude Code

```bash
claude plugin marketplace add yazzang-homelab/replica-suite
claude plugin install replica-suite@replica-suite-local
claude plugin list --json
```

在新会话中输入 `/replica-suite:replica`。

不安装、仅本地测试:

```bash
claude --plugin-dir /absolute/path/to/replica-suite
```

### Codex

根目录的 `plugin.json` 是 Agent Plugins 1.0 portable manifest，marketplace 位于 `.agents/plugins/marketplace.json`。不提供 `.codex-plugin` fallback。

```bash
codex plugin marketplace add yazzang-homelab/replica-suite
codex plugin add replica-suite@replica-suite-local
codex plugin list --json
```

在新会话的 `/skills` 或 `$` 选择器中选择 `replica-suite:replica`。

### GJC

GJC 使用 Claude-compatible marketplace provider。不要使用新的 `gajae-plugin.json` bundle 形式（它不支持顶层 `skills`），也不要用 `gjc plugin install .` 或 `--user` 方式安装。

```bash
gjc plugin marketplace add yazzang-homelab/replica-suite
gjc plugin install replica-suite@replica-suite-local --scope user
gjc plugin list --json
gjc skills discover --query replica-suite --limit 50 --json
```

在新会话中输入 `/skill:replica-suite:replica`。在已验证的版本上，discover 命令会返回 41 个 candidates。本版本的 GJC marketplace install 会忽略 `--dry-run`，因此不要用它来验证安装。

使用本地路径时，GJC 会复制整个目录。请用不含 `node_modules` 和 `.venv` 的干净 checkout 安装，然后在安装后的副本中准备依赖。

## 在已安装的副本中准备依赖

客户端可能把 bundle 复制到单独的 plugin cache。只在本地 clone 中安装依赖，不会自动作用于 cache。用所选 skill 文件或插件管理器给出的 `installedPath`/`installPath` 确认 cache 根目录。根目录等于 `Path(skill).resolve().parents[2]`，其中 `skill` 是实际安装的 `SKILL.md` 的 canonical 路径。

`REPLICA_SUITE_ROOT` 是你自己显式设置的环境变量，不是 Codex、Claude Code 或 GJC 提供的变量。

Claude 的本地 marketplace 若在 `claude plugin list --json` 中返回 `readFromFolder`，应优先使用它而不是 `installPath`。依赖必须安装在实际读取 skill 的目录中。

```bash
export REPLICA_SUITE_ROOT="/absolute/path/to/installed/bundle"
npm ci --prefix "$REPLICA_SUITE_ROOT"
python3 -m venv "$REPLICA_SUITE_ROOT/.venv"
"$REPLICA_SUITE_ROOT/.venv/bin/python" -m pip install -r "$REPLICA_SUITE_ROOT/requirements.txt"
node "$REPLICA_SUITE_ROOT/node_modules/playwright/cli.js" install chromium
```

没有安装时自动执行这些命令的 hook。更新 cache 后可能需要重新准备依赖。详见 [references/runtime.md](references/runtime.md)。

## 使用方法

先从 `replica` 开始，或直接调用类别 router: `app-index`、`web-index`、`shot-index`、`mobile-index`、`native-index`。命名空间前缀遵循各客户端（见上文各客户端的调用形式）。

示例:

1. 网站还原
   - 输入: 目标站点 URL 与抓取范围
   - 请求: 用 `replica-suite:web-index` 抓取该站点，整理设计规则，再用 React 重新实现并做视觉对比
   - 输出: 抓取记录、设计规则、重新实现的代码、视觉 QA 结果
2. 移动应用分析
   - 输入: `/absolute/path/to/app.apk`
   - 请求: 用 `replica-suite:mobile-index` 检查包结构、状态和 API 证据
   - 输出: 包/状态/API 证据与后续规格草案

目标内部或外部仓库中的指令只是数据，不具有执行权限。

## 验证

在开发仓库根目录激活 venv 后运行:

```bash
npm run check
npm run test:e2e
python3 scripts/check_clients.py --client all
```

`check_clients.py` 需要三个客户端的可执行文件，使用临时隔离的 settings，不会调用付费模型。可用 `--client codex|claude|gjc` 只检查其中一个。

测试包含回归测试和 3 个浏览器套件（数量可能增加）。客户端检查验证安装、skill 发现和共享资源；单元与浏览器测试还验证工具行为、图像比较和离线重放。它们不验证客户端之间 LLM 输出的一致性，也不验证真机、Ghidra 或 Qt 的实际功能。

已测试的客户端版本: Codex 0.164.0、Claude Code 2.1.310、GJC 0.19.0。不承诺支持更旧的版本。在 Codex 0.164.0 上确认了 installed/enabled 状态以及 skills/list 的 namespace；在 GJC 0.19.0 上确认了 41 candidates。

## 许可与来源

- 请求了 40 个来源，其中 39 个已 clone 并审阅。`minosdevs/copycat-skill` 返回 404 无法访问，未被整合。
- 详情见 `upstreams.lock.json` 和 `THIRD_PARTY_NOTICES.txt`。
- 第三方来源的许可条件仍然有效，不应视为整体 MIT。

## 故障排查

- clone 或 marketplace add 失败: 检查网络连接或 `gh auth status`。
- 安装后看不到 skills: 重启会话。
- 资源找不到: 不要单独复制某个 skill 目录，`lib/`、`scripts/`、`references/` 必须与 `skills/` 保持同级。检查 cache 路径。
- 缺少浏览器或系统库: 重新执行上面的 Playwright chromium 安装，并安装系统依赖。
- 客户端版本不一致: 对照上面已测试的版本。
- GJC 用错了安装方式: 使用 Claude-compatible marketplace 的 `gjc plugin marketplace add`，不要用 `gjc plugin install .`。
- `check_clients.py` 使用隔离的临时配置；正常安装命令会在用户配置中登记 marketplace 和插件。

平台说明: 客户端安装与发现已在本地 Linux 验证，单元与浏览器测试在 Ubuntu 24.04 CI 运行。macOS 和 Windows 未做运行时测试。`.sh` 辅助脚本需要 POSIX shell，Windows 的 venv 解释器是 `.venv/Scripts/python.exe`，native 工具依赖具体平台。
