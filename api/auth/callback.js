import { userOperations } from '../config/supabase.js';
import { generateToken } from '../utils/auth.js';
import { handleCors } from '../utils/cors.js';
import { exchangeCodeForToken, getLineProfile } from '../utils/line.js';

/**
 * LINE OAuth2認証コールバック処理
 * POST /api/auth/callback
 * 
 * LINE認証サーバーからのコールバックを処理し、
 * ユーザー情報を取得してJWTトークンを発行する
 */

export default async function handler(req, res) {
  try {
    // CORS処理
    if (handleCors(req, res)) {
      return;
    }
    
    console.log(`OAuth callback request: ${req.method} from ${req.headers.origin}`);
    
    // POST以外は許可しない
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only POST is supported.'
      });
    }
    
    // リクエストボディの検証
    const { code, state } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }
    
    // stateの検証（オプション - セキュリティ強化のため）
    if (state && typeof state !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid state parameter'
      });
    }
    
    console.log('Processing LINE OAuth callback with code:', code.substring(0, 10) + '...');
    
    // Step 1: 認証コードをアクセストークンに交換
    let tokenResponse;
    try {
      tokenResponse = await exchangeCodeForToken(code, state);
    } catch (tokenError) {
      console.error('Token exchange failed:', tokenError);
      return res.status(400).json({
        success: false,
        error: 'Failed to exchange authorization code for access token',
        details: process.env.NODE_ENV === 'development' ? tokenError.message : undefined
      });
    }
    
    if (!tokenResponse || !tokenResponse.access_token) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token response from LINE'
      });
    }
    
    // Step 2: LINEプロフィール情報を取得
    let profileResponse;
    try {
      profileResponse = await getLineProfile(tokenResponse.access_token);
    } catch (profileError) {
      console.error('Profile fetch failed:', profileError);
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch LINE profile',
        details: process.env.NODE_ENV === 'development' ? profileError.message : undefined
      });
    }
    
    if (!profileResponse || !profileResponse.userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile response from LINE'
      });
    }
    
    console.log('LINE profile obtained for user:', profileResponse.userId);
    
    // Step 3: ユーザーをデータベースで検索または作成
    let user;
    try {
      // 既存ユーザーを検索
      user = await userOperations.findByLineId(profileResponse.userId);
      
      if (user) {
        // 既存ユーザーの場合、プロフィール情報を更新
        console.log('Existing user found, updating profile...');
        user = await userOperations.updateByLineId(profileResponse.userId, {
          user_name: profileResponse.displayName,
          last_login: new Date().toISOString()
        });
      } else {
        // 新規ユーザーの場合、作成
        console.log('Creating new user...');
        user = await userOperations.create({
          lineId: profileResponse.userId,
          userName: profileResponse.displayName,
          status: 'active',
          role: 'user' // デフォルトはuser、管理者は手動で設定
        });
      }
    } catch (dbError) {
      console.error('Database error during user processing:', dbError);
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
        error: 'Failed to process user information'
      });
    }
    
    // Step 4: ユーザーのステータスチェック
    if (user.status !== 'active') {
      console.warn(`OAuth login attempt by inactive user: ${user.id}`);
      return res.status(403).json({
        success: false,
        error: 'User account is not active. Please contact an administrator.'
      });
    }
    
    // Step 5: JWTトークンを生成
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
    
    // Step 6: レスポンス用のユーザー情報を準備（機密情報を除く）
    const responseUser = {
      id: user.id,
      lineId: user.line_id,
      userName: user.user_name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login
    };
    
    console.log(`OAuth login successful for user: ${user.id} (${user.user_name})`);
    
    // Step 7: 成功レスポンス
    return res.status(200).json({
      success: true,
      message: 'LINE OAuth login successful',
      user: responseUser,
      token: token,
      expiresIn: '24h',
      lineProfile: {
        userId: profileResponse.userId,
        displayName: profileResponse.displayName,
        pictureUrl: profileResponse.pictureUrl,
        statusMessage: profileResponse.statusMessage
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Unexpected error in OAuth callback handler:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred during OAuth processing',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * セキュリティのためのヘルパー関数
 * StateパラメータのJWT形式での検証（将来の拡張用）
 */
export function validateState(state, expectedPattern = null) {
  try {
    if (!state || typeof state !== 'string') {
      return false;
    }
    
    // 基本的な形式チェック
    if (state.length < 8 || state.length > 128) {
      return false;
    }
    
    // 期待されるパターンがある場合のチェック
    if (expectedPattern && !state.match(expectedPattern)) {
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('State validation error:', error);
    return false;
  }
}

/**
 * LINE認証情報のサニタイゼーション
 */
export function sanitizeLineProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }
  
  return {
    userId: String(profile.userId || '').trim(),
    displayName: String(profile.displayName || '').trim().substring(0, 100),
    pictureUrl: String(profile.pictureUrl || '').trim(),
    statusMessage: String(profile.statusMessage || '').trim().substring(0, 500)
  };
}

/**
 * OAuth ログ用のヘルパー関数
 */
export function logOAuthAttempt(profile, success, error = null) {
  const logData = {
    userId: profile?.userId,
    displayName: profile?.displayName,
    success: success,
    timestamp: new Date().toISOString(),
    error: error ? error.message : null
  };
  
  console.log('OAuth Login Attempt:', JSON.stringify(logData));
}

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.validateState = validateState;
  module.exports.sanitizeLineProfile = sanitizeLineProfile;
  module.exports.logOAuthAttempt = logOAuthAttempt;
}