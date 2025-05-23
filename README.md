# 野菜集荷管理システム

Google Apps Script (GAS) から Vercel + Supabase への移行版野菜集荷管理システムです。

## 📋 プロジェクト概要

このシステムは農家や野菜生産者向けの集荷申請管理システムで、LINE連携による簡単な操作と管理者ダッシュボードを提供します。

### 主要機能
- 🔐 LINE OAuth2認証
- 📱 集荷申請の登録・管理
- 👥 ユーザー管理
- 🥬 野菜品目マスタ管理
- 📊 管理者ダッシュボード
- 📢 お知らせ・リマインダー機能
- 📦 オリコン貸出管理

## 🛠 技術スタック

- **Runtime**: Node.js 18.x
- **Platform**: Vercel Functions (サーバーレス)
- **Database**: Supabase PostgreSQL
- **Authentication**: JWT + LINE OAuth2
- **Frontend**: Vanilla JavaScript + HTML/CSS

## 📁 プロジェクト構造

```
vegetable-harvest-system/
├── package.json
├── vercel.json
├── .env.example
├── README.md
├── api/
│   ├── config/
│   │   └── supabase.js
│   ├── utils/
│   │   ├── auth.js (JWT認証ヘルパー)
│   │   ├── cors.js (CORS処理)
│   │   └── line.js (LINE API ヘルパー)
│   ├── auth/
│   │   ├── login.js (テスト用ログイン)
│   │   └── callback.js (LINE OAuth2コールバック)
│   ├── harvest/
│   │   ├── submit.js (集荷申請登録)
│   │   ├── list.js (申請一覧取得)
│   │   └── update.js (申請更新・削除)
│   ├── vegetables/
│   │   ├── list.js (野菜品目一覧)
│   │   ├── create.js (品目追加)
│   │   ├── update.js (品目更新)
│   │   └── delete.js (品目削除)
│   ├── users/
│   │   ├── list.js (ユーザー一覧)
│   │   ├── create.js (ユーザー作成)
│   │   └── update.js (ユーザー更新)
│   ├── admin/
│   │   ├── dashboard.js (管理ダッシュボードAPI)
│   │   ├── announcements.js (お知らせ管理)
│   │   └── reminders.js (リマインダー機能)
│   └── webhook/
│       └── line.js (LINE Webhook処理)
└── public/
    ├── index.html (ログイン画面)
    ├── main.html (メイン申請画面)
    ├── callback.html (認証後処理)
    ├── css/
    │   └── style.css
    └── admin/
        ├── index.html (管理ダッシュボード)
        ├── users.html (ユーザー管理)
        ├── requests.html (申請管理)
        └── announcements.html (お知らせ管理)
```

## ⚙️ 環境セットアップ

### 1. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成し、以下の環境変数を設定してください：

```bash
cp .env.example .env
```

#### Supabase設定
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
```

#### LINE API設定
```env
LINE_CHANNEL_ID=your_channel_id
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_access_token
LINE_REDIRECT_URI=https://your-domain.vercel.app/callback
```

#### その他の設定
```env
JWT_SECRET=your_jwt_secret_key_here
BASE_URL=https://your-domain.vercel.app
```

### 2. データベースセットアップ

Supabaseで以下のテーブルを作成してください：

```sql
-- ユーザーテーブル
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_id VARCHAR(255) UNIQUE NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 野菜マスタテーブル
CREATE TABLE vegetable_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 集荷申請テーブル
CREATE TABLE harvest_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    vegetable_item VARCHAR(255) NOT NULL,
    delivery_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- オリコン貸出テーブル
CREATE TABLE oricon_rentals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    pickup_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- お知らせテーブル
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    recipients JSONB
);
```

## 🚀 ローカル開発

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ローカル開発サーバーの起動

```bash
npm run dev
```

ローカルサーバーが `http://localhost:3000` で起動します。

### 3. 開発時のテスト

- フロントエンド: `http://localhost:3000`
- API エンドポイント: `http://localhost:3000/api/*`
- 管理画面: `http://localhost:3000/admin`

## 🚢 デプロイ

### Vercelへのデプロイ

```bash
# プレビューデプロイ
npm run deploy-preview

# 本番デプロイ
npm run deploy
```

### 環境変数の設定

Vercelダッシュボードで環境変数を設定するか、Vercel CLIを使用：

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
# ... 他の環境変数も同様に設定
```

## 📊 API仕様

### 認証エンドポイント
- `POST /api/auth/login` - テスト用ログイン
- `GET /api/auth/callback` - LINE OAuth2コールバック

### 集荷管理エンドポイント
- `POST /api/harvest/submit` - 集荷申請登録
- `GET /api/harvest/list` - 申請一覧取得
- `PUT /api/harvest/update` - 申請更新
- `DELETE /api/harvest/delete` - 申請削除

### 野菜管理エンドポイント
- `GET /api/vegetables/list` - 野菜品目一覧
- `POST /api/vegetables/create` - 品目追加
- `PUT /api/vegetables/update` - 品目更新
- `DELETE /api/vegetables/delete` - 品目削除

### ユーザー管理エンドポイント
- `GET /api/users/list` - ユーザー一覧
- `POST /api/users/create` - ユーザー作成
- `PUT /api/users/update` - ユーザー更新

### 管理機能エンドポイント
- `GET /api/admin/dashboard` - ダッシュボードデータ
- `POST /api/admin/announcements` - お知らせ配信
- `POST /api/admin/reminders` - リマインダー送信

### Webhook
- `POST /api/webhook/line` - LINE Webhook処理

## 🔒 セキュリティ

- JWTトークンによる認証
- LINE Webhook署名検証
- CORS設定
- 環境変数による機密情報管理
- SQL Injection対策（Supabaseクライアント使用）

## 🐛 トラブルシューティング

### よくある問題

1. **LINE認証が失敗する**
   - LINE_CHANNEL_IDとLINE_CHANNEL_SECRETが正しく設定されているか確認
   - LINE_REDIRECT_URIがLINE Developersコンソールの設定と一致しているか確認

2. **Supabaseへの接続が失敗する**
   - SUPABASE_URLとSUPABASE_SERVICE_KEYが正しく設定されているか確認
   - Supabaseプロジェクトが有効かつアクセス可能か確認

3. **API呼び出しでCORSエラーが発生する**
   - vercel.jsonのheaders設定を確認
   - フロントエンドのリクエストヘッダーを確認

4. **デプロイ後に環境変数が読み込まれない**
   - Vercelダッシュボードで環境変数が正しく設定されているか確認
   - 本番環境用の環境変数が設定されているか確認

### ログ確認

```bash
# Vercelの関数ログを確認
vercel logs

# ローカル開発時のログ
npm run dev
```

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. このREADMEのトラブルシューティングセクション
2. 環境変数の設定
3. Supabaseとの接続状態
4. LINE APIの設定

## 📄 ライセンス

MIT License