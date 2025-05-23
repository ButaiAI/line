# 野菜収穫管理システム デプロイガイド

## 概要

野菜収穫管理システムをVercel + Supabaseを使用して本番環境にデプロイする手順を説明します。

## 前提条件

### 必要なアカウント・設定

- [セットアップガイド](./SETUP.md)の手順が完了していること
- GitHubリポジトリが準備されていること
- Vercelアカウントに登録済みであること
- Supabaseプロジェクトが稼働中であること
- LINE Bot設定が完了していること

### 必要なツール

- **Vercel CLI** (v28.0.0以上)
- **Git**

## 1. 本番環境設定の準備

### 1.1 環境変数の整理

本番環境用の環境変数を整理：

```env
# 本番環境設定
NODE_ENV=production

# Supabase設定（本番）
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_KEY=your-production-service-role-key

# LINE Bot設定（本番）
LINE_CHANNEL_ID=your-production-channel-id
LINE_CHANNEL_SECRET=your-production-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-production-access-token

# JWT設定（本番用に新しい秘密鍵を生成）
JWT_SECRET=your-production-jwt-secret-64-characters-minimum

# ログ設定
LOG_DIR=/tmp/logs
LOG_LEVEL=info

# CORS設定（本番ドメインを設定）
ALLOWED_ORIGINS=https://your-production-domain.vercel.app
```

### 1.2 本番用Supabaseプロジェクト設定

開発環境とは別の本番用Supabaseプロジェクトを作成することを推奨：

1. 新しいSupabaseプロジェクトを作成
2. 本番用データベーススキーマを適用
3. RLS（Row Level Security）ポリシーを設定
4. バックアップ設定を有効化

### 1.3 本番用LINE Bot設定

開発環境とは別の本番用LINE Botを作成することを推奨：

1. 新しいLINE Messaging APIチャネルを作成
2. 本番ドメイン用のWebhook URLを設定
3. 友達追加時の応答メッセージを設定

## 2. Vercelプロジェクト設定

### 2.1 Vercel CLIのインストール・ログイン

```bash
# Vercel CLIインストール
npm install -g vercel

# Vercelにログイン
vercel login
```

### 2.2 プロジェクトの初期化

```bash
# プロジェクトディレクトリで実行
vercel

# 初回実行時の質問に回答：
# ? Set up and deploy "~/path/to/vegetable-harvest-system"? Y
# ? Which scope do you want to deploy to? (your-team)
# ? Link to existing project? N
# ? What's your project's name? vegetable-harvest-system
# ? In which directory is your code located? ./
```

### 2.3 プロジェクト設定ファイル

`vercel.json` の設定を確認・調整：

```json
{
  "version": 2,
  "name": "vegetable-harvest-system",
  "builds": [
    {
      "src": "public/**/*",
      "use": "@vercel/static"
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*\\.(css|js|ico|png|jpg|jpeg|gif|svg))",
      "dest": "/public/$1"
    },
    {
      "src": "/admin/(.*)",
      "dest": "/public/admin/$1"
    },
    {
      "src": "/tests/(.*)",
      "dest": "/public/tests/$1"
    },
    {
      "src": "/",
      "dest": "/public/index.html"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

## 3. 環境変数の設定

### 3.1 Vercelダッシュボードでの設定

1. [Vercelダッシュボード](https://vercel.com/dashboard)にアクセス
2. プロジェクトを選択
3. 「Settings」→「Environment Variables」
4. 以下の環境変数を追加：

| 変数名 | 値 | 環境 |
|--------|----|----|
| `NODE_ENV` | `production` | Production |
| `SUPABASE_URL` | 本番SupabaseプロジェクトURL | Production |
| `SUPABASE_ANON_KEY` | 本番Supabase匿名キー | Production |
| `SUPABASE_SERVICE_KEY` | 本番Supabaseサービスキー | Production |
| `LINE_CHANNEL_ID` | 本番LINE Channel ID | Production |
| `LINE_CHANNEL_SECRET` | 本番LINE Channel Secret | Production |
| `LINE_CHANNEL_ACCESS_TOKEN` | 本番LINE Access Token | Production |
| `JWT_SECRET` | 本番用JWT秘密鍵 | Production |
| `LOG_LEVEL` | `info` | Production |
| `ALLOWED_ORIGINS` | 本番ドメイン | Production |

### 3.2 CLIでの環境変数設定

```bash
# 本番環境の環境変数を設定
vercel env add NODE_ENV production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
# ... 他の環境変数も同様に設定
```

## 4. デプロイの実行

### 4.1 自動デプロイスクリプトの使用

```bash
# デプロイスクリプトを実行
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# プロンプトで「2. 本番環境」を選択
```

### 4.2 手動デプロイ

```bash
# 本番環境へのデプロイ
vercel --prod

# デプロイ状況の確認
vercel ls
```

### 4.3 ドメインの設定

カスタムドメインを使用する場合：

```bash
# ドメインの追加
vercel domains add your-domain.com

# ドメインの確認
vercel domains ls
```

## 5. デプロイ後の設定

### 5.1 LINE Bot Webhook URLの更新

1. [LINE Developers Console](https://developers.line.biz/)にアクセス
2. 本番用チャネルを選択
3. 「Messaging API設定」タブ
4. Webhook URL を更新：
   ```
   https://your-production-domain.vercel.app/api/line/webhook
   ```
5. 「接続確認」を実行して動作確認

### 5.2 Supabase RLSポリシーの確認

本番データベースのRLSポリシーが正しく設定されていることを確認：

```sql
-- ユーザーテーブルのポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'users';

-- 必要に応じてポリシーを追加
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);
```

### 5.3 管理者ユーザーの設定

本番環境で管理者ユーザーを設定：

1. LINE Botで初回ログイン
2. Supabaseダッシュボードでユーザーを確認
3. 管理者権限を付与：

```sql
UPDATE users SET role = 'admin' 
WHERE line_user_id = 'your-admin-line-user-id';
```

## 6. 動作確認

### 6.1 基本動作確認

1. **フロントエンド確認**
   ```
   https://your-production-domain.vercel.app/
   ```

2. **API動作確認**
   ```
   https://your-production-domain.vercel.app/api/vegetables
   ```

3. **管理ダッシュボード確認**
   ```
   https://your-production-domain.vercel.app/admin/dashboard.html
   ```

### 6.2 統合テスト実行

統合テストページで全機能をテスト：
```
https://your-production-domain.vercel.app/tests/integration-test.html
```

### 6.3 LINE Bot動作確認

1. 本番LINE Botを友達追加
2. メッセージ送信テスト
3. 集荷申請フローテスト

## 7. 監視・メンテナンス

### 7.1 ログ監視

Vercelのファンクションログを確認：
```bash
vercel logs
```

### 7.2 エラー監視

- Vercelダッシュボードでエラー率を監視
- Supabaseダッシュボードでデータベースパフォーマンスを監視
- LINE Developers ConsoleでWebhookエラーを監視

### 7.3 パフォーマンス監視

定期的に以下を確認：
- API応答時間
- データベースクエリパフォーマンス
- LINE Bot応答時間

## 8. 継続的デプロイメント（CD）

### 8.1 GitHub連携

1. GitHubリポジトリをVercelプロジェクトに連携
2. `main` ブランチへのプッシュで自動デプロイ
3. プルリクエストでプレビューデプロイ

### 8.2 デプロイフック

特定のイベントでデプロイを実行：
```bash
# デプロイフックの作成
curl -X POST https://api.vercel.com/v1/integrations/deploy/your-hook-id
```

## 9. セキュリティ設定

### 9.1 HTTPS強制

Vercelでは自動的にHTTPSが有効化されますが、設定を確認：

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

### 9.2 セキュリティヘッダー

`vercel.json` にセキュリティヘッダーを追加：

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## 10. バックアップ・災害復旧

### 10.1 データベースバックアップ

Supabaseの自動バックアップ設定を確認：
1. Supabaseダッシュボード→「Settings」→「Database」
2. バックアップスケジュールを設定

### 10.2 設定バックアップ

- 環境変数設定をドキュメント化
- `vercel.json` をバージョン管理
- LINE Bot設定を記録

## 11. トラブルシューティング

### よくある問題

#### デプロイエラー
```bash
# ビルドログの確認
vercel logs --follow

# 環境変数の確認
vercel env ls
```

#### API エラー
- Supabase接続確認
- 環境変数の値を再確認
- CORS設定を確認

#### LINE Bot応答なし
- Webhook URLの設定確認
- SSL証明書の有効性確認
- ファンクションのタイムアウト設定確認

## 12. スケーリング

### 12.1 Vercel Proプラン

大量のアクセスが予想される場合：
- Vercel Proプランにアップグレード
- 関数の実行時間制限を延長
- 帯域制限の解除

### 12.2 Supabaseスケーリング

- データベースサイズの監視
- 必要に応じてプランアップグレード
- インデックスの最適化

## サポート

デプロイで問題が発生した場合：

1. [Vercelドキュメント](https://vercel.com/docs)を確認
2. [Supabaseドキュメント](https://supabase.com/docs)を確認
3. [トラブルシューティングガイド](./TROUBLESHOOTING.md)を参照
4. 開発チームにお問い合わせ

デプロイが完了したら、定期的な監視とメンテナンスを実施して、安定したサービス運用を維持してください。