# 野菜収穫管理システム セットアップガイド

## 概要

野菜収穫管理システムの開発環境セットアップ手順を説明します。本システムはVercel + Supabase + LINE Botを使用したモダンなWebアプリケーションです。

## 前提条件

### 必要なツール

以下のツールがインストールされている必要があります：

- **Node.js** (v18.0.0以上)
- **npm** (v8.0.0以上)
- **Git**

### 必要なアカウント

以下のサービスアカウントが必要です：

- **GitHub** アカウント
- **Vercel** アカウント
- **Supabase** アカウント
- **LINE Developers** アカウント

## 1. プロジェクトのクローン

```bash
git clone <リポジトリURL>
cd vegetable-harvest-system
```

## 2. 依存関係のインストール

```bash
npm install
```

## 3. Supabaseプロジェクトの設定

### 3.1 Supabaseプロジェクト作成

1. [Supabase](https://app.supabase.com/)にログイン
2. 「New Project」をクリック
3. プロジェクト名: `vegetable-harvest-system`
4. データベースパスワードを設定
5. リージョンを選択（日本の場合：Northeast Asia (Tokyo)）

### 3.2 データベーススキーマの作成

Supabaseダッシュボードで以下のSQLを実行：

```sql
-- ユーザーテーブル
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  picture_url TEXT,
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- 野菜品目テーブル
CREATE TABLE vegetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 集荷申請テーブル
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pickup_date DATE NOT NULL,
  time_slot VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 申請野菜詳細テーブル
CREATE TABLE request_vegetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  vegetable_id UUID REFERENCES vegetables(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- お知らせテーブル
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  target_users VARCHAR(50) DEFAULT 'all',
  published BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS（Row Level Security）の有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vegetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_vegetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- サンプルデータの挿入
INSERT INTO vegetables (name, category, unit) VALUES
('トマト', '果菜類', 'kg'),
('キュウリ', '果菜類', 'kg'),
('ナス', '果菜類', 'kg'),
('レタス', '葉菜類', 'kg'),
('キャベツ', '葉菜類', 'kg'),
('白菜', '葉菜類', 'kg'),
('大根', '根菜類', 'kg'),
('人参', '根菜類', 'kg'),
('じゃがいも', '根菜類', 'kg');
```

### 3.3 API設定の取得

1. Supabaseダッシュボードの「Settings」→「API」
2. 以下の値をメモ：
   - Project URL
   - anon public key
   - service_role key（秘密鍵）

## 4. LINE Bot設定

### 4.1 LINE Developersプロジェクト作成

1. [LINE Developers](https://developers.line.biz/)にログイン
2. 「プロバイダー」を作成
3. 「Messaging API」チャネルを作成
4. チャネル名: `野菜収穫管理Bot`

### 4.2 LINE Bot設定

1. 「Messaging API設定」タブ
2. 以下の値をメモ：
   - Channel ID
   - Channel Secret
   - Channel Access Token

3. Webhook設定：
   - Webhook URL: `https://your-domain.vercel.app/api/line/webhook`
   - 「Webhookの利用」を有効化

## 5. 環境変数の設定

### 5.1 開発環境設定ファイル作成

プロジェクトルートに `.env.local` ファイルを作成：

```env
# 環境設定
NODE_ENV=development

# Supabase設定
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# LINE Bot設定
LINE_CHANNEL_ID=your-channel-id
LINE_CHANNEL_SECRET=your-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-access-token

# JWT設定
JWT_SECRET=your-jwt-secret-key-minimum-32-characters

# ログ設定
LOG_DIR=./logs
LOG_LEVEL=debug

# CORS設定
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.vercel.app
```

### 5.2 JWT秘密鍵の生成

安全なJWT秘密鍵を生成：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 6. 開発サーバーの起動

### 6.1 ローカル開発サーバー

```bash
# 開発サーバーを起動
npm run dev

# または静的ファイルサーバーの場合
npx serve public
```

### 6.2 Vercel CLI（推奨）

```bash
# Vercel CLIのインストール
npm install -g vercel

# ローカル開発環境の起動
vercel dev
```

## 7. 動作確認

### 7.1 基本動作確認

1. ブラウザで `http://localhost:3000` にアクセス
2. ログイン画面が表示されることを確認
3. テストログインを実行
4. メイン画面が表示されることを確認

### 7.2 API動作確認

統合テストページで各APIの動作を確認：

```
http://localhost:3000/tests/integration-test.html
```

## 8. LINE Bot動作確認

### 8.1 ngrokを使用したローカルテスト

```bash
# ngrokのインストール（未インストールの場合）
npm install -g ngrok

# ローカルサーバーを外部公開
ngrok http 3000
```

### 8.2 Webhook URLの更新

1. ngrokで生成されたHTTPS URLをコピー
2. LINE DevelopersでWebhook URL設定：
   `https://your-ngrok-url.ngrok.io/api/line/webhook`
3. 「接続確認」で動作確認

## 9. 管理者ユーザーの設定

### 9.1 管理者権限の付与

1. LINE Botで一度ログイン
2. Supabaseダッシュボードでusersテーブルを確認
3. 該当ユーザーの `role` を `admin` に変更

```sql
UPDATE users SET role = 'admin' WHERE line_user_id = 'your-line-user-id';
```

### 9.2 管理ダッシュボードの確認

```
http://localhost:3000/admin/dashboard.html
```

## 10. トラブルシューティング

### よくある問題

#### CORS エラー
- `.env.local` の `ALLOWED_ORIGINS` を確認
- ブラウザの開発者ツールでエラー詳細を確認

#### Supabase接続エラー
- プロジェクトURLとAPIキーを再確認
- RLS設定を確認

#### LINE Bot応答なし
- Webhook URLが正しく設定されているか確認
- Channel Access Tokenの有効性を確認

### ログの確認

```bash
# APIアクセスログ
tail -f logs/combined.log

# エラーログ
tail -f logs/error.log
```

## 11. 次のステップ

開発環境が正常に動作することを確認したら：

1. [デプロイガイド](./DEPLOYMENT.md)を参照して本番環境を構築
2. [API仕様書](./API.md)を参照してAPI詳細を確認
3. [トラブルシューティングガイド](./TROUBLESHOOTING.md)を参照して問題解決方法を確認

## サポート

セットアップで問題が発生した場合は、以下を確認してください：

1. 各サービスのステータスページ
2. 開発者ツールのコンソールエラー
3. サーバーログファイル

さらなるサポートが必要な場合は、開発チームにお問い合わせください。