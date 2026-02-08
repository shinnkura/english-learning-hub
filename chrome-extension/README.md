# English Learning Hub - Chrome Extension

英語学習をサポートするChrome拡張機能です。

## 機能

### 1. スタディタイマー ✅
- 右下に固定表示されるタイマー
- カウントダウン形式で学習時間を管理
- タイマー終了時に通知
- 学習ログをNeon DBに自動保存
- キーボードショートカット対応

### 2. 単語記録 + Anki連携 ✅
- ダブルクリックまたは右クリックで単語検索
- 辞書・翻訳・画像の自動取得
- ワンクリックでAnkiにカード追加（直接AnkiConnect接続）
- 発音再生機能

### 3. 字幕オーバーレイ ✅
- SRT/VTTファイルのインポート
- YouTube/Netflix/その他動画上に字幕表示
- タイミングオフセット調整
- フォントサイズ・位置調整

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                   Chrome Extension                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 直接API呼び出し:                                       │ │
│  │ • AnkiConnect (localhost:8765) - Anki連携              │ │
│  │ • Dictionary API - 辞書検索                            │ │
│  │ • MyMemory API - 翻訳                                  │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
              ┌──────▼───────┐
              │  API Server   │
              │  (port 3001)  │
              │ • study-logs  │
              │ • captions    │
              │ • unsplash    │
              │ • cambridge   │
              └──────┬────────┘
                     │
                 Neon DB
```

## キーボードショートカット

| ショートカット | 機能 |
|---------------|------|
| Alt+Shift+T | タイマー表示/非表示 |
| Alt+Shift+S | タイマー開始 |
| Alt+Shift+C | 字幕オーバーレイ表示/非表示 |

## セットアップ

### 1. 依存関係のインストール

```bash
cd chrome-extension
npm run setup
```

これにより、拡張機能とサーバー両方の依存関係がインストールされます。

### 2. 環境変数の設定

`server/.env`ファイルを作成:

```bash
cp server/.env.example server/.env
```

`.env`を編集して以下を設定:

```env
# Database (必須)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Unsplash API (オプション - 未設定時はプレースホルダー画像を使用)
UNSPLASH_ACCESS_KEY=your_unsplash_access_key

# Server
PORT=3001
```

### 3. 開発モード

```bash
npm run dev
```

これにより以下が同時に起動します:
- Chrome拡張機能のビルド（watchモード）
- APIサーバー（ポート3001）

### 4. Chrome拡張機能のロード

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `chrome-extension/dist` フォルダを選択

### 5. Ankiの設定

1. Ankiデスクトップアプリをインストール
2. AnkiConnectアドオンをインストール（コード: `2055492159`）
3. Ankiを再起動
4. 拡張機能使用時はAnkiを起動しておく

## ディレクトリ構造

```
chrome-extension/
├── manifest.json           # Chrome拡張機能マニフェスト
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── background/         # Service Worker
│   │   └── index.ts
│   ├── content/            # Content Scripts
│   │   ├── index.tsx
│   │   ├── content.css
│   │   ├── timer/
│   │   │   └── TimerOverlay.tsx
│   │   ├── word-capture/
│   │   │   └── WordPanel.tsx
│   │   └── subtitle-overlay/
│   │       └── SubtitleOverlay.tsx
│   ├── popup/              # ポップアップUI
│   │   ├── main.tsx
│   │   └── Popup.tsx
│   ├── options/            # 設定画面
│   │   ├── main.tsx
│   │   └── Options.tsx
│   ├── lib/                # 共通ライブラリ
│   │   ├── utils.ts
│   │   ├── chrome-storage.ts
│   │   ├── chrome-messaging.ts
│   │   └── api/            # APIクライアント
│   │       ├── anki-connect.ts   # 直接呼び出し
│   │       ├── dictionary.ts     # 直接呼び出し
│   │       ├── translate.ts      # 直接呼び出し
│   │       └── server.ts         # サーバー経由
│   ├── components/ui/      # UIコンポーネント
│   └── types/              # 型定義
├── server/                 # 最小限APIサーバー
│   ├── package.json
│   ├── src/
│   │   └── index.ts
│   └── .env.example
└── public/icons/           # アイコン
```

## API連携

### 直接呼び出し（サーバー不要）

| API | 用途 |
|-----|------|
| AnkiConnect (localhost:8765) | Ankiへのカード追加 |
| Dictionary API | 英単語の定義取得 |
| MyMemory API | 翻訳 |

### サーバー経由

| エンドポイント | 用途 |
|---------------|------|
| `/api/study-logs` | 学習ログ保存/取得 |
| `/api/captions/:videoId` | YouTube字幕取得 |
| `/api/unsplash` | 画像検索 |
| `/api/cambridge-dictionary` | Cambridge辞書（CORS回避） |

## 本番ビルド

```bash
# 拡張機能のビルド
npm run build

# サーバーのビルド
npm run build:server
```

## 技術スタック

### Chrome Extension
- **フレームワーク**: Vite + React + TypeScript
- **UI**: Tailwind CSS + Radix UI
- **Manifest**: V3
- **ビルドツール**: @crxjs/vite-plugin

### API Server
- **フレームワーク**: Express.js
- **DB**: Neon Serverless (PostgreSQL)
- **キャッシュ**: Keyv
- **字幕取得**: youtubei.js
