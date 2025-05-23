# 野菜収穫管理システム トラブルシューティングガイド

## 概要

野菜収穫管理システムで発生する可能性のある問題とその解決方法について説明します。

## 基本的な確認事項

問題が発生した場合、まず以下を確認してください：

### 1. サービス状況の確認

- **Vercel**: https://www.vercelstatus.com/
- **Supabase**: https://status.supabase.com/
- **LINE Developers**: https://developers.line.biz/ja/news/

### 2. ログの確認

```bash
# Vercelログ
vercel logs --follow

# ローカルログ（開発環境）
tail -f logs/combined.log
tail -f logs/error.log
```

### 3. ブラウザ開発者ツール

- コンソールエラーの確認
- ネットワークタブでAPI応答の確認
- アプリケーションタブでローカルストレージの確認

## 一般的な問題と解決方法

### 認証関連の問題

#### 問題: ログインできない

**症状**
- LINE認証後にエラーが表示される
- 認証コールバックでエラーが発生する

**原因と解決方法**

1. **LINE Bot設定の確認**
   ```bash
   # 環境変数の確認
   echo $LINE_CHANNEL_ID
   echo $LINE_CHANNEL_SECRET
   echo $LINE_CHANNEL_ACCESS_TOKEN
   ```

2. **Webhook URLの確認**
   - LINE Developers Consoleで正しいURLが設定されているか
   - HTTPSが使用されているか
   - URLの末尾に余分な文字がないか

3. **JWT秘密鍵の確認**
   ```bash
   # JWT秘密鍵の長さを確認（32文字以上必要）
   echo ${#JWT_SECRET}
   ```

#### 問題: 認証トークンが無効

**症状**
- API呼び出し時に401エラー
- "Unauthorized"メッセージ

**解決方法**
1. ローカルストレージのトークンをクリア
2. 再ログイン
3. JWTの有効期限設定を確認

### API関連の問題

#### 問題: API応答が遅い・タイムアウト

**症状**
- API呼び出しが30秒でタイムアウト
- 応答が非常に遅い

**解決方法**

1. **データベースクエリの最適化**
   ```sql
   -- 遅いクエリの特定
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC;
   ```

2. **インデックスの追加**
   ```sql
   -- よく使用される検索条件にインデックスを追加
   CREATE INDEX idx_requests_user_date ON requests(user_id, pickup_date);
   CREATE INDEX idx_requests_status ON requests(status);
   ```

3. **Vercel関数の設定確認**
   ```json
   {
     "functions": {
       "api/**/*.js": {
         "maxDuration": 30
       }
     }
   }
   ```

#### 問題: CORS エラー

**症状**
- ブラウザコンソールにCORSエラー
- API呼び出しがブロックされる

**解決方法**

1. **環境変数の確認**
   ```env
   ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.vercel.app
   ```

2. **CORSヘルパーの確認**
   ```javascript
   // api/utils/cors.js の設定を確認
   const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
   ```

### データベース関連の問題

#### 問題: Supabase接続エラー

**症状**
- "Failed to connect to database"エラー
- API でデータベースエラー

**解決方法**

1. **接続設定の確認**
   ```bash
   # Supabase設定の確認
   echo $SUPABASE_URL
   echo $SUPABASE_ANON_KEY
   ```

2. **RLS ポリシーの確認**
   ```sql
   -- RLSポリシー一覧の確認
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
   FROM pg_policies;
   ```

3. **データベース容量の確認**
   - Supabaseダッシュボードでストレージ使用量を確認
   - 必要に応じてプランアップグレード

#### 問題: データの不整合

**症状**
- 集荷申請に関連する野菜データが表示されない
- ユーザー情報が正しく取得できない

**解決方法**

1. **外部キー制約の確認**
   ```sql
   -- 制約の確認
   SELECT conname, conrelid::regclass, confrelid::regclass
   FROM pg_constraint
   WHERE contype = 'f';
   ```

2. **データの整合性チェック**
   ```sql
   -- 孤立データの確認
   SELECT r.id, r.user_id
   FROM requests r
   LEFT JOIN users u ON r.user_id = u.id
   WHERE u.id IS NULL;
   ```

### LINE Bot関連の問題

#### 問題: LINE Botが応答しない

**症状**
- メッセージを送信してもBotからの応答がない
- Webhook応答エラー

**解決方法**

1. **Webhook URL の確認**
   ```bash
   # Webhook URLのテスト
   curl -X POST https://your-domain.vercel.app/api/line/webhook \
     -H "Content-Type: application/json" \
     -d '{"events":[],"destination":"test"}'
   ```

2. **LINE設定の確認**
   - Channel Access Tokenの有効性
   - Webhook URLの設定
   - 応答メッセージの設定

3. **ログの確認**
   ```bash
   # LINE Webhookログの確認
   grep "line_webhook" logs/combined.log
   ```

#### 問題: LINE認証が完了しない

**症状**
- LINE認証画面から戻らない
- 認証後のリダイレクトが失敗

**解決方法**

1. **リダイレクトURIの確認**
   - LINE Developers Consoleの設定
   - HTTPSドメインの使用確認

2. **コールバック処理の確認**
   ```javascript
   // api/auth/callback.js のエラーハンドリング確認
   ```

### フロントエンド関連の問題

#### 問題: 画面が正しく表示されない

**症状**
- CSS スタイルが適用されない
- JavaScriptエラーが発生

**解決方法**

1. **静的ファイルの確認**
   ```bash
   # ファイルの存在確認
   ls -la public/
   ls -la public/css/
   ls -la public/js/
   ```

2. **パスの確認**
   ```html
   <!-- 相対パスの確認 -->
   <link rel="stylesheet" href="/css/style.css">
   <script src="/js/common.js"></script>
   ```

3. **キャッシュのクリア**
   - ブラウザキャッシュをクリア
   - Vercelのキャッシュをクリア

#### 問題: モバイルで表示が崩れる

**症状**
- スマートフォンでレイアウトが崩れる
- タッチ操作が効かない

**解決方法**

1. **ビューポート設定の確認**
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   ```

2. **レスポンシブデザインの確認**
   ```css
   /* メディアクエリの確認 */
   @media (max-width: 768px) {
     /* モバイル用スタイル */
   }
   ```

### デプロイ関連の問題

#### 問題: Vercelデプロイが失敗する

**症状**
- デプロイ時にビルドエラー
- 環境変数が設定されない

**解決方法**

1. **ビルドログの確認**
   ```bash
   vercel logs --follow
   ```

2. **環境変数の確認**
   ```bash
   # Vercelの環境変数一覧
   vercel env ls
   ```

3. **設定ファイルの確認**
   ```json
   // vercel.json の設定確認
   {
     "version": 2,
     "builds": [...],
     "routes": [...]
   }
   ```

#### 問題: 本番環境でのみエラーが発生

**症状**
- ローカルでは正常だが本番でエラー
- 環境固有の問題

**解決方法**

1. **環境の違いを確認**
   - Node.js バージョン
   - 環境変数の値
   - ファイルパスの違い

2. **本番ログの確認**
   ```bash
   vercel logs --follow
   ```

3. **ステージング環境での検証**
   ```bash
   # プレビューデプロイでテスト
   vercel
   ```

## パフォーマンス最適化

### データベース最適化

```sql
-- 不要なデータの削除
DELETE FROM requests WHERE created_at < NOW() - INTERVAL '1 year';

-- テーブルの最適化
VACUUM ANALYZE requests;
VACUUM ANALYZE users;
```

### API最適化

```javascript
// レスポンスキャッシュの実装
const cache = new Map();
const CACHE_TTL = 300000; // 5分

export function getCachedData(key, fetchFunction) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = fetchFunction();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

## 監視・アラート設定

### Vercel監視

```bash
# Vercelプロジェクトの監視設定
vercel monitor --project=vegetable-harvest-system
```

### Supabase監視

- ダッシュボードでCPU使用率を監視
- データベース接続数を監視
- ストレージ使用量を監視

### ログ監視

```bash
# エラーログの監視
tail -f logs/error.log | grep -i "error\|exception\|failed"

# パフォーマンス監視
grep "performance_metric" logs/combined.log | tail -10
```

## 緊急時の対応手順

### 1. システム停止時

1. **ステータス確認**
   - Vercel、Supabase、LINEのステータス確認
   - ログの確認

2. **ロールバック**
   ```bash
   # 前のバージョンに戻す
   vercel rollback
   ```

3. **緊急連絡**
   - 管理者への連絡
   - ユーザーへの告知（必要に応じて）

### 2. データ損失時

1. **バックアップからの復旧**
   - Supabaseの自動バックアップを確認
   - 手動バックアップからの復旧

2. **データ整合性の確認**
   ```sql
   -- データの整合性チェック
   SELECT COUNT(*) FROM requests;
   SELECT COUNT(*) FROM users;
   ```

### 3. セキュリティインシデント時

1. **アクセス制限**
   - 疑わしいIPアドレスをブロック
   - API レート制限を強化

2. **認証トークン無効化**
   ```bash
   # JWT秘密鍵の変更
   vercel env add JWT_SECRET production
   ```

3. **ログ分析**
   ```bash
   # 不審なアクセスの確認
   grep "security_event" logs/combined.log
   ```

## サポートリソース

### 公式ドキュメント

- **Vercel**: https://vercel.com/docs
- **Supabase**: https://supabase.com/docs
- **LINE Developers**: https://developers.line.biz/ja/docs/

### コミュニティ

- **Vercel Community**: https://github.com/vercel/vercel/discussions
- **Supabase Community**: https://github.com/supabase/supabase/discussions
- **LINE Developers Community**: https://www.line-community.me/

### 開発チーム連絡先

緊急時や重大な問題が発生した場合は、開発チームに連絡してください。

---

このトラブルシューティングガイドを定期的に更新し、新しい問題とその解決方法を追加してください。