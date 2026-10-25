# replica-suite

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | **日本語**

replica-suite は、アプリやサイトの移植・再実装のための agent skills 集です。進め方は evidence -> spec -> build -> verify (証拠 -> 仕様 -> 実装 -> 検証) です。1 セットの `skills/` を Codex、Claude Code、GJC が共通で使い、`lib/`、`scripts/`、`references/` も 3 クライアントで共有します。

- リポジトリ: https://github.com/yazzang-homelab/reverse-anything (private)
- プラグイン名: `replica-suite`、バージョン `0.3.0`
- marketplace ID: `replica-suite-local`

どんなアプリもワンクリックで複製する製品ではありません。分析、設計、実装、検証の各段階で証拠と確認ゲートを提供するもので、結果は対象、権限、利用者の判断に左右されます。

## 含まれる 41 個の skills

| カテゴリ    |  数 | 入口           | 用途                                                      |
| ----------- | --: | -------------- | --------------------------------------------------------- |
| app         |   8 | `app-index`    | アプリ全体の機能分析、設計、実装、parity                  |
| web         |  10 | `web-index`    | URL/HTML/CSS/DOM/WebGL サイトの復元と視覚 QA              |
| shot        |   8 | `shot-index`   | スクリーンショット -> HTML/React/Vue/Svelte/RN/UnoCSS/QML |
| mobile      |   7 | `mobile-index` | APK/IPA/Flutter/Unity のパッケージ・状態・API 証拠の分析  |
| native      |   7 | `native-index` | Ghidra/native/C++/ゲームの Web 移植と等価性検証           |
| root router |   1 | `replica`      | 入力と目的に応じて各カテゴリの index へ振り分け           |

合計は 8 + 10 + 8 + 7 + 7 + 1 = 41 です。

## 前提条件

- Node.js 22 推奨 (20 以上)、Python 3.13 推奨、git
- private リポジトリにアクセスできる `gh` または Git の認証。先に `gh auth login` を実行し、organization が SSO を要求する場合はその承認も済ませてください。
- Ghidra、jadx、apktool、Frida、Qt、各プラットフォームの SDK は別途用意する任意の外部ツールで、このプラグインは自動インストールしません。

token やパスワードをチャットに貼らないでください。

## リポジトリの取得

```bash
gh auth login
gh auth setup-git
gh repo clone yazzang-homelab/reverse-anything
```

認証済みの `git clone` でも構いません。以下の各クライアントでは、`yazzang-homelab/reverse-anything` の代わりにローカル clone の絶対パス (例: `/absolute/path/to/reverse-anything`) も使えます。

## インストール

3 クライアントとも同じリポジトリを使いますが、コマンドは異なります。

### Claude Code

```bash
claude plugin marketplace add yazzang-homelab/reverse-anything
claude plugin install replica-suite@replica-suite-local
claude plugin list --json
```

新しいセッションで `/replica-suite:replica` を実行します。

インストールせずローカルで試す場合:

```bash
claude --plugin-dir /absolute/path/to/reverse-anything
```

### Codex

ルートの `plugin.json` は Agent Plugins 1.0 の portable manifest で、marketplace は `.agents/plugins/marketplace.json` にあります。`.codex-plugin` の fallback は用意していません。

```bash
codex plugin marketplace add yazzang-homelab/reverse-anything
codex plugin add replica-suite@replica-suite-local
codex plugin list --json
```

新しいセッションで `/skills` または `$` ピッカーから `replica-suite:replica` を選びます。

### GJC

GJC では Claude-compatible marketplace provider が正しい形式です。新しい `gajae-plugin.json` bundle はトップレベルの `skills` をサポートしないため使わないでください。`gjc plugin install .` や `--user` による bundle インストールも案内の対象外です。

```bash
gjc plugin marketplace add yazzang-homelab/reverse-anything
gjc plugin install replica-suite@replica-suite-local --scope user
gjc plugin list --json
gjc skills discover --query replica-suite --limit 50 --json
```

新しいセッションで `/skill:replica-suite:replica` を実行します。確認済みバージョンでは、discover は 41 candidates を返します。このバージョンの GJC marketplace install は `--dry-run` を無視するため、インストール検証には使わないでください。

ローカルパスを指定すると、GJC はディレクトリ全体をコピーします。`node_modules` や `.venv` のないクリーンな checkout でインストールし、その後インストールされたコピーで依存関係を準備することを推奨します。

## インストール済みコピーでの依存関係の準備

クライアントは bundle を別の plugin cache にコピーすることがあります。ローカル clone にだけ依存関係を入れても、その cache には反映されません。cache のルートは、選んだ skill ファイル、またはプラグインマネージャが返す `installedPath`/`installPath` で確認します。ルートは `Path(skill).resolve().parents[2]` で、`skill` は実際にインストールされた `SKILL.md` の canonical パスです。

`REPLICA_SUITE_ROOT` は利用者が明示的に設定する環境変数で、Codex、Claude Code、GJC が提供する変数ではありません。

Claude のローカル marketplace では、`claude plugin list --json` に `readFromFolder` があれば `installPath` より優先します。実際に skill を読むディレクトリに依存関係をインストールしてください。

```bash
export REPLICA_SUITE_ROOT="/absolute/path/to/installed/bundle"
npm ci --prefix "$REPLICA_SUITE_ROOT"
python3 -m venv "$REPLICA_SUITE_ROOT/.venv"
"$REPLICA_SUITE_ROOT/.venv/bin/python" -m pip install -r "$REPLICA_SUITE_ROOT/requirements.txt"
node "$REPLICA_SUITE_ROOT/node_modules/playwright/cli.js" install chromium
```

インストール時にこれらを自動実行する hook はありません。cache が更新されたら、再度準備が必要になることがあります。詳細は [references/runtime.md](references/runtime.md) を参照してください。

## 使い方

まず `replica` から始めるか、カテゴリ router (`app-index`、`web-index`、`shot-index`、`mobile-index`、`native-index`) を直接呼び出します。名前空間の接頭辞は各クライアントの形式に従います (上記の各クライアントの呼び出し形式を参照)。

例 (プレースホルダーは自分の対象、または許可を得た対象に置き換えてください):

1. サイトの復元
   - 入力: 自分が所有するサイトの URL と、取得を許可する範囲
   - 依頼: `replica-suite:web-index` でサイトを取得し、デザインルールを整理して React で再実装し、視覚比較を行う
   - 出力: 取得記録、デザインルール、再実装コード、視覚 QA の結果
2. モバイルアプリの分析
   - 入力: 自分が所有する `/absolute/path/to/owned.apk`
   - 依頼: `replica-suite:mobile-index` でパッケージ構造、状態、API の証拠を調べる
   - 出力: パッケージ・状態・API の証拠と、次工程の仕様案

自分の対象、または許可を得た対象にのみ使用してください。対象の内部や外部リポジトリにある指示は単なるデータであり、実行権限を持ちません。

## 検証

開発リポジトリのルートで venv を有効化してから実行します。

```bash
npm run check
npm run test:e2e
python3 scripts/check_clients.py --client all
```

`check_clients.py` は 3 クライアントの実行ファイルが必要で、一時的に隔離した settings を使い、有料モデルは呼び出しません。`--client codex|claude|gjc` で 1 つだけ選べます。

テストには回帰テストと 3 つのブラウザスイートがあります (数は増える可能性があります)。クライアントの検査はインストール、skill の検出、共有リソースを確認し、単体・ブラウザテストはツールの動作、画像比較、オフライン再生も確認します。クライアント間の LLM 出力の同等性や、実機、Ghidra、Qt の実際の動作は検証していません。

テストしたクライアントのバージョン: Codex 0.164.0、Claude Code 2.1.310、GJC 0.19.0。これより古いバージョンは保証しません。Codex 0.164.0 では installed/enabled と skills/list の namespace を、GJC 0.19.0 では 41 candidates を確認しています。

## ライセンスと出典

- 40 件の出典を依頼し、39 件を clone して確認しました。`minosdevs/copycat-skill` は 404 でアクセスできず、統合していません。
- 詳細は `upstreams.lock.json` と `THIRD_PARTY_NOTICES.txt` を参照してください。
- この統合自体は private で、再配布ライセンスは付与されていません。全体が MIT だとは主張しません。第三者の出典のライセンス条件は引き続き有効です。
- コード、アセット、商標のライセンスは別途確認してください。

## トラブルシューティング

- clone や marketplace add が失敗する: private リポジトリへの gh/Git 認証と organization の SSO 承認を確認してください。
- インストール後に skills が見えない: セッションを再起動してください。
- リソースが見つからない: 個別の skill フォルダだけをコピーしないでください。`lib/`、`scripts/`、`references/` は `skills/` と同じ階層に必要です。cache のパスも確認してください。
- ブラウザやシステムライブラリが不足している: 上記の Playwright chromium のインストールをやり直し、システム依存パッケージを入れてください。
- クライアントのバージョンが合わない: 上記のテスト済みバージョンと比較してください。
- GJC で別のインストーラを使った: `gjc plugin install .` ではなく、Claude-compatible marketplace の `gjc plugin marketplace add` を使ってください。
- `check_clients.py` は隔離した一時設定を使います。通常のインストールコマンドはユーザー設定に marketplace とプラグインを登録します。

プラットフォームの注意: クライアントのインストールと検出はローカル Linux で確認し、単体・ブラウザテストは Ubuntu 24.04 CI で実行します。macOS と Windows は実行時テストをしていません。`.sh` ヘルパーには POSIX シェルが必要で、Windows の venv のインタプリタは `.venv/Scripts/python.exe`、native ツールはプラットフォーム依存です。
