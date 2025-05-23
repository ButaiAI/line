import jwt from 'jsonwebtoken';

/**
 * JWT認証関連のヘルパー関数
 * JWT トークンの生成、検証、解析機能を提供
 */

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// 環境変数チェック
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('Warning: JWT_SECRET environment variable not set in production');
}

/**
 * JWTトークンを生成する
 * @param {Object} user - ユーザー情報
 * @param {string} user.id - ユーザーID
 * @param {string} user.line_id - LINE ID
 * @param {string} user.user_name - ユーザー名
 * @param {string} user.role - ユーザーロール (user, admin)
 * @param {string} user.status - ユーザーステータス (active, inactive)
 * @returns {string} JWTトークン
 */
export function generateToken(user) {
  try {
    console.log('Generating JWT token for user:', user.id);
    
    // ペイロードの準備
    const payload = {
      id: user.id,
      lineId: user.line_id,
      userName: user.user_name,
      role: user.role || 'user',
      status: user.status || 'active',
      iat: Math.floor(Date.now() / 1000), // issued at time
    };
    
    // JWTトークンの生成
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'vegetable-harvest-system',
      audience: 'harvest-users'
    });
    
    console.log('JWT token generated successfully for user:', user.id);
    return token;
    
  } catch (error) {
    console.error('Error generating JWT token:', error);
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * JWTトークンを検証する
 * @param {string} token - 検証するJWTトークン
 * @returns {Promise<Object>} デコードされたユーザー情報
 * @throws {Error} トークンが無効な場合
 */
export async function verifyToken(token) {
  try {
    console.log('Verifying JWT token...');
    
    if (!token) {
      throw new Error('Token is required');
    }
    
    // Bearer トークンの場合、Bearer プレフィックスを削除
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }
    
    // JWTトークンの検証
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'vegetable-harvest-system',
      audience: 'harvest-users'
    });
    
    console.log('JWT token verified successfully for user:', decoded.id);
    return decoded;
    
  } catch (error) {
    console.error('JWT token verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Token not active');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

/**
 * リクエストからJWTトークンを抽出して検証する
 * @param {Object} req - Express リクエストオブジェクト
 * @returns {Promise<Object>} 検証されたユーザー情報
 * @throws {Error} トークンが無効または見つからない場合
 */
export async function extractUserFromRequest(req) {
  try {
    // Authorization ヘッダーからトークンを取得
    let token = req.headers.authorization;
    
    if (!token) {
      // クエリパラメータからトークンを取得（フォールバック）
      token = req.query.token;
    }
    
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    const user = await verifyToken(token);
    return user;
    
  } catch (error) {
    console.error('Error extracting user from request:', error.message);
    throw error;
  }
}

/**
 * JWTトークンからユーザー情報を抽出する（検証なし）
 * @param {string} token - JWTトークン
 * @returns {Object|null} デコードされたペイロード（検証なし）
 */
export function extractUserFromToken(token) {
  try {
    if (!token) {
      return null;
    }
    
    // Bearer トークンの場合、Bearer プレフィックスを削除
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }
    
    // 検証なしでデコード（ペイロード部分のみ）
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      console.warn('Failed to decode JWT token');
      return null;
    }
    
    return decoded;
    
  } catch (error) {
    console.error('Error extracting user from token:', error);
    return null;
  }
}

/**
 * JWTトークンの有効期限をチェックする
 * @param {string} token - チェックするJWTトークン
 * @returns {boolean} 有効期限が切れている場合true
 */
export function isTokenExpired(token) {
  try {
    const decoded = extractUserFromToken(token);
    
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    // 現在時刻と有効期限を比較（秒単位）
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = decoded.exp < currentTime;
    
    if (isExpired) {
      console.log('Token has expired:', new Date(decoded.exp * 1000));
    }
    
    return isExpired;
    
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // エラーの場合は期限切れとして扱う
  }
}

/**
 * JWTトークンの有効期限までの時間を取得する
 * @param {string} token - チェックするJWTトークン
 * @returns {number} 有効期限までの秒数（期限切れの場合は負の値）
 */
export function getTokenTimeToExpiry(token) {
  try {
    const decoded = extractUserFromToken(token);
    
    if (!decoded || !decoded.exp) {
      return 0;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp - currentTime;
    
  } catch (error) {
    console.error('Error getting token time to expiry:', error);
    return 0;
  }
}

/**
 * ユーザーのロールをチェックする
 * @param {Object} user - ユーザー情報
 * @param {string|Array} requiredRoles - 必要なロール（文字列または配列）
 * @returns {boolean} ユーザーが必要なロールを持っている場合true
 */
export function hasRole(user, requiredRoles) {
  try {
    if (!user || !user.role) {
      return false;
    }
    
    // requiredRoles が文字列の場合は配列に変換
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    // ユーザーのロールが必要なロールに含まれているかチェック
    return roles.includes(user.role);
    
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
}

/**
 * ユーザーのステータスをチェックする
 * @param {Object} user - ユーザー情報
 * @returns {boolean} ユーザーがアクティブな場合true
 */
export function isUserActive(user) {
  try {
    return user && user.status === 'active';
  } catch (error) {
    console.error('Error checking user status:', error);
    return false;
  }
}

/**
 * 認証ミドルウェア
 * Express ルートで使用する認証チェック関数
 * @param {Array} requiredRoles - 必要なロール（オプション）
 * @returns {Function} Express ミドルウェア関数
 */
export function requireAuth(requiredRoles = null) {
  return async (req, res, next) => {
    try {
      // トークンを検証してユーザー情報を取得
      const user = await extractUserFromRequest(req);
      
      // ユーザーがアクティブかチェック
      if (!isUserActive(user)) {
        return res.status(403).json({
          success: false,
          error: 'User account is not active'
        });
      }
      
      // ロールチェック（指定されている場合）
      if (requiredRoles && !hasRole(user, requiredRoles)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
      
      // リクエストオブジェクトにユーザー情報を追加
      req.user = user;
      next();
      
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(401).json({
        success: false,
        error: error.message || 'Authentication failed'
      });
    }
  };
}

/**
 * トークンリフレッシュの判定
 * @param {string} token - チェックするJWTトークン
 * @returns {boolean} リフレッシュが必要な場合true
 */
export function shouldRefreshToken(token) {
  try {
    const timeToExpiry = getTokenTimeToExpiry(token);
    // 有効期限の1時間前になったらリフレッシュを推奨
    const refreshThreshold = 60 * 60; // 1時間（秒）
    
    return timeToExpiry > 0 && timeToExpiry < refreshThreshold;
    
  } catch (error) {
    console.error('Error checking if token should be refreshed:', error);
    return false;
  }
}

// 後方互換性のための関数（既存のコードで使用）
export function authenticateUser(req) {
  return extractUserFromRequest(req);
}

export function requireAdmin(handler) {
  return async (req, res) => {
    try {
      const user = await extractUserFromRequest(req);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      
      req.user = user;
      return handler(req, res);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error.message || 'Authentication failed'
      });
    }
  };
}

// デバッグ用：JWT設定情報を出力
if (process.env.NODE_ENV !== 'production') {
  console.log('JWT Configuration:');
  console.log('- Secret length:', JWT_SECRET.length);
  console.log('- Expires in:', JWT_EXPIRES_IN);
  console.log('- Environment:', process.env.NODE_ENV);
}

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateToken,
    verifyToken,
    extractUserFromRequest,
    extractUserFromToken,
    isTokenExpired,
    getTokenTimeToExpiry,
    hasRole,
    isUserActive,
    requireAuth,
    shouldRefreshToken,
    authenticateUser,
    requireAdmin
  };
}