# 野菜収穫管理システム API仕様書

## 概要

野菜収穫管理システムのREST API仕様です。すべてのAPIエンドポイントは `/api` パスで始まります。

## 認証

### LINE OAuth2認証

システムはLINE OAuth2を使用してユーザー認証を行います。

#### 認証フロー

1. ユーザーがLINEログインボタンをクリック
2. LINE認証ページにリダイレクト
3. 認証成功後、コールバックURLに認証コードが送信
4. コールバック処理でJWTトークンを生成
5. 以降のAPI呼び出しでJWTトークンを使用

#### JWT認証

認証が必要なエンドポイントでは、Authorizationヘッダーにベアラートークンを含める必要があります。

```http
Authorization: Bearer <JWT_TOKEN>
```

## エラーレスポンス

すべてのエラーレスポンスは以下の形式で返されます：

```json
{
  "success": false,
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### エラーコード

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| `VALIDATION_ERROR` | 400 | リクエストデータの検証エラー |
| `UNAUTHORIZED` | 401 | 認証が必要 |
| `FORBIDDEN` | 403 | アクセス権限なし |
| `NOT_FOUND` | 404 | リソースが見つからない |
| `CONFLICT` | 409 | データの競合 |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

## エンドポイント

### 認証関連

#### POST /api/auth/login-test
開発環境用のテストログイン

**リクエスト:**
```json
{
  "userId": "test_user_123",
  "displayName": "テストユーザー"
}
```

**レスポンス:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "test_user_123",
    "displayName": "テストユーザー",
    "role": "user"
  }
}
```

#### GET /api/auth/callback
LINE OAuth2コールバック処理

**クエリパラメータ:**
- `code`: LINE認証コード
- `state`: CSRF保護用トークン

**レスポンス:**
コールバックページにリダイレクト

### 集荷申請関連

#### POST /api/requests
集荷申請の登録

**認証:** 必要

**リクエスト:**
```json
{
  "pickupDate": "2024-01-15",
  "timeSlot": "morning",
  "vegetables": [
    {
      "vegetableId": "veg_001",
      "quantity": 10,
      "unit": "kg"
    }
  ],
  "notes": "特記事項があれば"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "req_12345",
    "pickupDate": "2024-01-15",
    "timeSlot": "morning",
    "status": "pending",
    "vegetables": [...],
    "notes": "特記事項があれば",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /api/requests
集荷申請一覧の取得

**認証:** 必要

**クエリパラメータ:**
- `page`: ページ番号 (デフォルト: 1)
- `limit`: 取得件数 (デフォルト: 20, 最大: 100)
- `status`: ステータスフィルター (`pending`, `confirmed`, `completed`, `cancelled`)
- `from`: 開始日 (YYYY-MM-DD)
- `to`: 終了日 (YYYY-MM-DD)

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "requests": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### GET /api/requests/:id
特定の集荷申請の詳細取得

**認証:** 必要

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "req_12345",
    "pickupDate": "2024-01-15",
    "timeSlot": "morning",
    "status": "pending",
    "vegetables": [...],
    "notes": "特記事項があれば",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT /api/requests/:id
集荷申請の更新

**認証:** 必要

**リクエスト:**
```json
{
  "pickupDate": "2024-01-16",
  "timeSlot": "afternoon",
  "vegetables": [...],
  "notes": "更新された特記事項"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "req_12345",
    "pickupDate": "2024-01-16",
    "timeSlot": "afternoon",
    "status": "pending",
    "vegetables": [...],
    "notes": "更新された特記事項",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

#### DELETE /api/requests/:id
集荷申請の削除

**認証:** 必要

**レスポンス:**
```json
{
  "success": true,
  "message": "集荷申請を削除しました"
}
```

### 野菜品目関連

#### GET /api/vegetables
野菜品目一覧の取得

**認証:** 不要

**クエリパラメータ:**
- `category`: カテゴリフィルター
- `active`: アクティブフラグ (true/false)

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "id": "veg_001",
      "name": "トマト",
      "category": "果菜類",
      "unit": "kg",
      "active": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/vegetables
野菜品目の追加（管理者のみ）

**認証:** 必要（管理者権限）

**リクエスト:**
```json
{
  "name": "新しい野菜",
  "category": "果菜類",
  "unit": "kg"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "veg_002",
    "name": "新しい野菜",
    "category": "果菜類",
    "unit": "kg",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT /api/vegetables/:id
野菜品目の更新（管理者のみ）

**認証:** 必要（管理者権限）

**リクエスト:**
```json
{
  "name": "更新された野菜名",
  "category": "葉菜類",
  "unit": "束",
  "active": false
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "veg_002",
    "name": "更新された野菜名",
    "category": "葉菜類",
    "unit": "束",
    "active": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  }
}
```

#### DELETE /api/vegetables/:id
野菜品目の削除（管理者のみ）

**認証:** 必要（管理者権限）

**レスポンス:**
```json
{
  "success": true,
  "message": "野菜品目を削除しました"
}
```

### LINE Webhook

#### POST /api/line/webhook
LINE Botのメッセージ受信

**リクエスト:**
LINE Bot SDKが規定するWebhookイベント形式

**レスポンス:**
```json
{
  "success": true
}
```

### 管理ダッシュボード関連

#### GET /api/admin/dashboard
管理ダッシュボードデータの取得（管理者のみ）

**認証:** 必要（管理者権限）

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "totalRequests": 1250,
    "todayRequests": 25,
    "pendingRequests": 15,
    "totalUsers": 150,
    "activeUsers": 120,
    "recentRequests": [...],
    "requestsByDate": [...]
  }
}
```

#### GET /api/admin/users
ユーザー一覧の取得（管理者のみ）

**認証:** 必要（管理者権限）

**クエリパラメータ:**
- `page`: ページ番号
- `limit`: 取得件数
- `search`: 検索キーワード
- `role`: 役割フィルター

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### PUT /api/admin/users/:id
ユーザー情報の更新（管理者のみ）

**認証:** 必要（管理者権限）

**リクエスト:**
```json
{
  "role": "admin",
  "status": "active"
}
```

#### GET /api/admin/announcements
お知らせ一覧の取得（管理者のみ）

**認証:** 必要（管理者権限）

#### POST /api/admin/announcements
お知らせの作成（管理者のみ）

**認証:** 必要（管理者権限）

**リクエスト:**
```json
{
  "title": "お知らせタイトル",
  "content": "お知らせ内容",
  "type": "info",
  "targetUsers": "all"
}
```

#### PUT /api/admin/announcements/:id
お知らせの更新（管理者のみ）

**認証:** 必要（管理者権限）

#### DELETE /api/admin/announcements/:id
お知らせの削除（管理者のみ）

**認証:** 必要（管理者権限）

## データモデル

### 集荷申請 (Request)

```typescript
interface Request {
  id: string;
  userId: string;
  pickupDate: string; // YYYY-MM-DD
  timeSlot: 'morning' | 'afternoon' | 'evening';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  vegetables: Vegetable[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 野菜品目 (Vegetable)

```typescript
interface Vegetable {
  id: string;
  name: string;
  category: string;
  unit: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### ユーザー (User)

```typescript
interface User {
  id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}
```

### お知らせ (Announcement)

```typescript
interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'urgent';
  targetUsers: 'all' | 'admin' | 'user';
  published: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

## レート制限

API呼び出しには以下のレート制限が適用されます：

- 認証済みユーザー: 100リクエスト/分
- 未認証ユーザー: 20リクエスト/分
- 管理者: 200リクエスト/分

制限に達した場合、HTTPステータス429が返されます。

## バージョニング

現在のAPIバージョンは `v1` です。将来的にAPIの破壊的変更が必要な場合は、新しいバージョンが作成されます。

## サポート

APIに関する質問やサポートが必要な場合は、開発チームにお問い合わせください。