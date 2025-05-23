import { userOperations } from '../config/supabase.js';
import { generateToken } from '../utils/auth.js';
import { handleCors } from '../utils/cors.js';

/**
 * テスト用ログイン機能
 * POST /api/auth/login
 * 
 * LINE IDとユーザー名でシンプルなログインを行う
 * 開発・テスト環境での利用を想定
 */

export default async function handler(req, res) {
  try {
    // CORS処理
    if (handleCors(req, res)) {
      return;
    }
    
    console.log(`Login request: ${req.method} from ${req.headers.origin}`);
    
    // POST以外は許可しない
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only POST is supported.'
      });
    }
    
    // リクエストボディの検証
    const { lineId, userName } = req.body;
    
    if (!lineId) {
      return res.status(400).json({
        success: false,
        error: 'lineId is required'
      });
    }
    
    if (!userName) {
      return res.status(400).json({
        success: false,
        error: 'userName is required'
      });
    }
    
    // 入力値の検証
    if (typeof lineId !== 'string' || lineId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'lineId must be a non-empty string'
      });
    }
    
    if (typeof userName !== 'string' || userName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userName must be a non-empty string'
      });
    }
    
    // LINE IDの長さ制限（一般的には30文字程度）
    if (lineId.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'lineId is too long'
      });
    }
    
    // ユーザー名の長さ制限
    if (userName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'userName is too long'
      });
    }
    
    console.log('Test login attempt:', { lineId, userName });
    
    // Supabaseでユーザーを検索または作成
    let user;
    try {
      user = await userOperations.findOrCreate({
        lineId: lineId.trim(),
        userName: userName.trim(),
        status: 'active',
        role: 'user' // デフォルトはuser、管理者は手動で設定
      });
    } catch (dbError) {
      console.error('Database error during user creation/retrieval:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database error occurred',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }
    
    if (!user) {
      console.error('Failed to create or retrieve user');
      return res.status(500).json({
        success: false,
        error: 'Failed to create or retrieve user'
      });
    }
    
    // ユーザーがアクティブかチェック
    if (user.status !== 'active') {
      console.warn(`Login attempt by inactive user: ${user.id}`);
      return res.status(403).json({
        success: false,
        error: 'User account is not active. Please contact an administrator.'
      });
    }
    
    // JWTトークンを生成
    let token;
    try {
      token = generateToken(user);
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate authentication token'
      });
    }
    
    // レスポンス用のユーザー情報（機密情報を除く）
    const responseUser = {
      id: user.id,
      lineId: user.line_id,
      userName: user.user_name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
    
    console.log(`Login successful for user: ${user.id} (${user.user_name})`);
    
    // 成功レスポンス
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: responseUser,
      token: token,
      expiresIn: '24h',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Unexpected error in login handler:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * テスト用のヘルパー関数
 * 開発環境でのユーザー作成を支援
 */
export async function createTestUser(lineId, userName, role = 'user') {
  try {
    console.log('Creating test user:', { lineId, userName, role });
    
    const user = await userOperations.create({
      lineId,
      userName,
      role,
      status: 'active'
    });
    
    console.log('Test user created:', user.id);
    return user;
    
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}

/**
 * テスト用の管理者ユーザー作成
 */
export async function createTestAdmin(lineId, userName) {
  return createTestUser(lineId, userName, 'admin');
}

/**
 * ログイン状態の検証用エンドポイント（開発用）
 */
export async function verifyLogin(req, res) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'No authorization header'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const user = await verifyToken(token);
    
    return res.status(200).json({
      success: true,
      user: user,
      message: 'Token is valid'
    });
    
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message
    });
  }
}

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.createTestUser = createTestUser;
  module.exports.createTestAdmin = createTestAdmin;
  module.exports.verifyLogin = verifyLogin;
}