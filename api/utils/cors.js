/**
 * CORS（Cross-Origin Resource Sharing）処理ヘルパー関数
 * ブラウザからのクロスオリジンリクエストを適切に処理
 */

// CORS設定
const CORS_CONFIG = {
  // 許可するオリジン（本番環境では特定のドメインに限定することを推奨）
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['*'],
  
  // 許可するHTTPメソッド
  allowedMethods: [
    'GET',
    'POST', 
    'PUT',
    'DELETE',
    'PATCH',
    'OPTIONS'
  ],
  
  // 許可するヘッダー
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-HTTP-Method-Override',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma'
  ],
  
  // 認証情報を含むリクエストを許可するか
  credentials: process.env.CORS_CREDENTIALS === 'true',
  
  // プリフライトリクエストのキャッシュ時間（秒）
  maxAge: 86400 // 24時間
};

/**
 * 基本的なCORSヘッダーを設定する
 * @param {Object} req - Express リクエストオブジェクト
 * @param {Object} res - Express レスポンスオブジェクト
 */
export function setCorsHeaders(req, res) {
  try {
    const origin = req.headers.origin;
    
    // オリジンチェック
    if (CORS_CONFIG.allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && CORS_CONFIG.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      console.warn('CORS: Origin not allowed:', origin);
    }
    
    // 許可するメソッド
    res.setHeader(
      'Access-Control-Allow-Methods', 
      CORS_CONFIG.allowedMethods.join(', ')
    );
    
    // 許可するヘッダー
    res.setHeader(
      'Access-Control-Allow-Headers', 
      CORS_CONFIG.allowedHeaders.join(', ')
    );
    
    // 認証情報を含むリクエストの許可
    if (CORS_CONFIG.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // プリフライトリクエストのキャッシュ時間
    res.setHeader('Access-Control-Max-Age', CORS_CONFIG.maxAge.toString());
    
    // セキュリティヘッダーの追加
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    console.log('CORS headers set for origin:', origin || 'unknown');
    
  } catch (error) {
    console.error('Error setting CORS headers:', error);
  }
}

/**
 * CORS処理を行い、OPTIONSリクエストの場合は即座にレスポンスを返す
 * @param {Object} req - Express リクエストオブジェクト
 * @param {Object} res - Express レスポンスオブジェクト
 * @returns {boolean} OPTIONSリクエストの場合true
 */
export function handleCors(req, res) {
  try {
    console.log(`CORS: Handling ${req.method} request from origin:`, req.headers.origin);
    
    // CORSヘッダーを設定
    setCorsHeaders(req, res);
    
    // OPTIONSリクエスト（プリフライト）の処理
    if (req.method === 'OPTIONS') {
      console.log('CORS: Handling preflight OPTIONS request');
      res.status(200).end();
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error handling CORS:', error);
    res.status(500).json({
      success: false,
      error: 'CORS processing failed'
    });
    return true;
  }
}

/**
 * CORS処理を含むAPIハンドラーラッパー
 * @param {Function} handler - 元のAPIハンドラー関数
 * @returns {Function} CORS処理を含むラップされたハンドラー
 */
export function withCors(handler) {
  return async (req, res) => {
    try {
      // CORS処理
      const isOptionsRequest = handleCors(req, res);
      
      // OPTIONSリクエストの場合はここで終了
      if (isOptionsRequest) {
        return;
      }
      
      // 元のハンドラーを実行
      await handler(req, res);
      
    } catch (error) {
      console.error('API Error in CORS wrapper:', error);
      
      // CORSヘッダーが設定されていない場合は設定
      if (!res.headersSent) {
        setCorsHeaders(req, res);
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
      }
    }
  };
}

/**
 * 特定のオリジンのみを許可するCORS設定を作成
 * @param {Array|string} allowedOrigins - 許可するオリジンの配列または文字列
 * @returns {Function} カスタムCORSハンドラー
 */
export function createCorsHandler(allowedOrigins) {
  const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
  
  return (req, res) => {
    const origin = req.headers.origin;
    
    if (origin && origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', CORS_CONFIG.allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', CORS_CONFIG.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', CORS_CONFIG.maxAge.toString());
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return true;
    }
    
    return false;
  };
}

/**
 * セキュリティヘッダーを設定
 * @param {Object} res - Express レスポンスオブジェクト
 */
export function setSecurityHeaders(res) {
  try {
    // XSS攻撃防止
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // MIME タイプスニッフィング防止
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // クリックジャッキング防止
    res.setHeader('X-Frame-Options', 'DENY');
    
    // リファラー情報の制限
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // HTTPS強制（本番環境のみ）
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    console.log('Security headers set');
    
  } catch (error) {
    console.error('Error setting security headers:', error);
  }
}

/**
 * レスポンスヘッダーをログ出力（デバッグ用）
 * @param {Object} res - Express レスポンスオブジェクト
 */
export function logResponseHeaders(res) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Response headers:', res.getHeaders());
  }
}

/**
 * APIレスポンス用の標準的なCORS設定
 * @param {Object} req - Express リクエストオブジェクト
 * @param {Object} res - Express レスポンスオブジェクト
 * @returns {boolean} OPTIONSリクエストの場合true
 */
export function apiCors(req, res) {
  // CORSヘッダー設定
  setCorsHeaders(req, res);
  
  // セキュリティヘッダー設定
  setSecurityHeaders(res);
  
  // デバッグ用ログ
  if (process.env.NODE_ENV === 'development') {
    logResponseHeaders(res);
  }
  
  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

// デバッグ用：CORS設定を出力
if (process.env.NODE_ENV !== 'production') {
  console.log('CORS Configuration:');
  console.log('- Allowed Origins:', CORS_CONFIG.allowedOrigins);
  console.log('- Allowed Methods:', CORS_CONFIG.allowedMethods);
  console.log('- Credentials:', CORS_CONFIG.credentials);
  console.log('- Max Age:', CORS_CONFIG.maxAge);
}

// 既存のCORSヘッダー（後方互換性のため）
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400'
};

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setCorsHeaders,
    handleCors,
    withCors,
    createCorsHandler,
    setSecurityHeaders,
    logResponseHeaders,
    apiCors,
    corsHeaders,
    CORS_CONFIG
  };
}