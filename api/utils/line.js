import crypto from 'crypto';

/**
 * LINE API関連のヘルパー関数
 * メッセージ送信、OAuth認証、Webhook署名検証などの機能を提供
 */

// LINE API設定の取得と検証
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_REDIRECT_URI = process.env.LINE_REDIRECT_URI;
const BASE_URL = process.env.BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';

// 環境変数の存在チェック
if (!LINE_CHANNEL_ID) {
  console.error('Error: LINE_CHANNEL_ID environment variable is not set');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LINE_CHANNEL_ID environment variable is required');
  }
}

if (!LINE_CHANNEL_SECRET) {
  console.error('Error: LINE_CHANNEL_SECRET environment variable is not set');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LINE_CHANNEL_SECRET environment variable is required');
  }
}

if (!LINE_CHANNEL_ACCESS_TOKEN) {
  console.error('Error: LINE_CHANNEL_ACCESS_TOKEN environment variable is not set');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN environment variable is required');
  }
}

/**
 * LINE OAuth認証URLを生成する
 * @param {string} customState - カスタムステート（オプション）
 * @returns {Object} 認証URLとステート情報
 */
export function generateLineAuthUrl(customState = null) {
  try {
    const state = customState || crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LINE_CHANNEL_ID,
      redirect_uri: LINE_REDIRECT_URI,
      state: state,
      scope: 'profile openid'
    });
    
    const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    
    console.log('Generated LINE auth URL with state:', state);
    
    return {
      url: authUrl,
      state: state
    };
    
  } catch (error) {
    console.error('Error generating LINE auth URL:', error);
    throw new Error('Failed to generate LINE authentication URL');
  }
}

/**
 * 認証コードをアクセストークンに交換する
 * @param {string} code - 認証コード
 * @param {string} state - ステート（セキュリティ検証用）
 * @returns {Promise<Object>} トークン情報
 */
export async function exchangeCodeForToken(code, state) {
  try {
    console.log('Exchanging authorization code for access token...');
    
    if (!code) {
      throw new Error('Authorization code is required');
    }
    
    const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: LINE_REDIRECT_URI,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE token exchange failed:', response.status, errorText);
      throw new Error(`Failed to exchange code for token: ${response.status}`);
    }
    
    const tokenData = await response.json();
    console.log('Successfully exchanged code for access token');
    
    return tokenData;
    
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw error;
  }
}

/**
 * LINEプロフィール情報を取得する
 * @param {string} accessToken - LINEアクセストークン
 * @returns {Promise<Object>} プロフィール情報
 */
export async function getLineProfile(accessToken) {
  try {
    console.log('Fetching LINE profile information...');
    
    if (!accessToken) {
      throw new Error('Access token is required');
    }
    
    const response = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE profile fetch failed:', response.status, errorText);
      throw new Error(`Failed to get LINE profile: ${response.status}`);
    }
    
    const profile = await response.json();
    console.log('Successfully fetched LINE profile for user:', profile.userId);
    
    return profile;
    
  } catch (error) {
    console.error('Error fetching LINE profile:', error);
    throw error;
  }
}

/**
 * LINEテキストメッセージを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @param {string} message - 送信するメッセージ
 * @returns {Promise<Object>} 送信結果
 */
export async function sendTextMessage(userId, message) {
  try {
    console.log(`Sending text message to LINE user: ${userId}`);
    
    if (!userId || !message) {
      throw new Error('User ID and message are required');
    }
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE message send failed:', response.status, errorText);
      throw new Error(`Failed to send LINE message: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Successfully sent text message to:', userId);
    
    return result;
    
  } catch (error) {
    console.error('Error sending text message:', error);
    throw error;
  }
}

/**
 * LINEボタンメッセージを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @param {string} text - メッセージテキスト
 * @param {string} buttonText - ボタンのラベル
 * @param {string} url - ボタンのリンク先URL
 * @returns {Promise<Object>} 送信結果
 */
export async function sendButtonMessage(userId, text, buttonText, url) {
  try {
    console.log(`Sending button message to LINE user: ${userId}`);
    
    if (!userId || !text || !buttonText || !url) {
      throw new Error('User ID, text, button text, and URL are required');
    }
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: 'template',
          altText: text,
          template: {
            type: 'buttons',
            text: text,
            actions: [{
              type: 'uri',
              label: buttonText,
              uri: url
            }]
          }
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE button message send failed:', response.status, errorText);
      throw new Error(`Failed to send button message: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Successfully sent button message to:', userId);
    
    return result;
    
  } catch (error) {
    console.error('Error sending button message:', error);
    throw error;
  }
}

/**
 * LINE Webhook署名を検証する
 * @param {string|Buffer} body - リクエストボディ
 * @param {string} signature - LINE署名
 * @returns {boolean} 署名が有効な場合true
 */
export function verifyLineSignature(body, signature) {
  try {
    if (!signature) {
      console.warn('No LINE signature provided');
      return false;
    }
    
    // ボディをBuffer/文字列から文字列に変換
    const bodyString = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
    
    // HMAC-SHA256で署名を計算
    const hash = crypto
      .createHmac('sha256', LINE_CHANNEL_SECRET)
      .update(bodyString, 'utf8')
      .digest('base64');
    
    const isValid = hash === signature;
    
    if (isValid) {
      console.log('LINE signature verification successful');
    } else {
      console.warn('LINE signature verification failed');
      console.log('Expected:', hash);
      console.log('Received:', signature);
    }
    
    return isValid;
    
  } catch (error) {
    console.error('Error verifying LINE signature:', error);
    return false;
  }
}

/**
 * 複数のユーザーにメッセージを送信する（レート制限対応）
 * @param {Array} userIds - 送信先のLINE User IDの配列
 * @param {string} message - 送信するメッセージ
 * @param {number} delay - 送信間隔（ミリ秒）
 * @returns {Promise<Array>} 送信結果の配列
 */
export async function sendBulkTextMessage(userIds, message, delay = 100) {
  try {
    console.log(`Sending bulk message to ${userIds.length} users`);
    
    const results = [];
    
    for (const userId of userIds) {
      try {
        const result = await sendTextMessage(userId, message);
        results.push({ userId, success: true, result });
        
        // レート制限対策の遅延
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error);
        results.push({ userId, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Bulk message completed: ${successCount}/${userIds.length} successful`);
    
    return results;
    
  } catch (error) {
    console.error('Error sending bulk messages:', error);
    throw error;
  }
}

/**
 * カルーセルメッセージを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @param {string} altText - 代替テキスト
 * @param {Array} columns - カルーセルのカラム配列
 * @returns {Promise<Object>} 送信結果
 */
export async function sendCarouselMessage(userId, altText, columns) {
  try {
    console.log(`Sending carousel message to LINE user: ${userId}`);
    
    if (!userId || !altText || !Array.isArray(columns) || columns.length === 0) {
      throw new Error('User ID, alt text, and columns are required');
    }
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: 'template',
          altText: altText,
          template: {
            type: 'carousel',
            columns: columns
          }
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE carousel message send failed:', response.status, errorText);
      throw new Error(`Failed to send carousel message: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Successfully sent carousel message to:', userId);
    
    return result;
    
  } catch (error) {
    console.error('Error sending carousel message:', error);
    throw error;
  }
}

/**
 * 確認メッセージ（Confirm template）を送信する
 * @param {string} userId - 送信先のLINE User ID
 * @param {string} text - 確認メッセージ
 * @param {string} yesLabel - 肯定ボタンのラベル
 * @param {string} noLabel - 否定ボタンのラベル
 * @param {string} data - ポストバックデータ
 * @returns {Promise<Object>} 送信結果
 */
export async function sendConfirmMessage(userId, text, yesLabel, noLabel, data) {
  try {
    console.log(`Sending confirm message to LINE user: ${userId}`);
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: 'template',
          altText: text,
          template: {
            type: 'confirm',
            text: text,
            actions: [
              {
                type: 'postback',
                label: yesLabel,
                data: `action=yes&${data}`
              },
              {
                type: 'postback',
                label: noLabel,
                data: `action=no&${data}`
              }
            ]
          }
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE confirm message send failed:', response.status, errorText);
      throw new Error(`Failed to send confirm message: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Successfully sent confirm message to:', userId);
    
    return result;
    
  } catch (error) {
    console.error('Error sending confirm message:', error);
    throw error;
  }
}

/**
 * ユーザートークンを生成する（JWT）
 * @param {Object} user - ユーザー情報
 * @returns {string} JWTトークン
 */
export function generateUserToken(user) {
  try {
    const jwt = require('jsonwebtoken');
    const payload = {
      userId: user.id,
      lineId: user.line_id,
      name: user.name,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30日間有効
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET);
  } catch (error) {
    console.error('Error generating user token:', error);
    throw error;
  }
}

/**
 * 集荷管理システムのリンクを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @param {Object} user - システム内のユーザー情報
 * @returns {Promise<Object>} 送信結果
 */
export async function sendHarvestLink(userId, user) {
  try {
    const token = generateUserToken(user);
    const url = `${BASE_URL}/main?token=${token}`;
    
    return await sendButtonMessage(
      userId,
      '🌱 納品申請ができます',
      '申請画面を開く',
      url
    );
    
  } catch (error) {
    console.error('Error sending harvest link:', error);
    throw error;
  }
}

/**
 * 申請履歴画面のリンクを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @param {Object} user - システム内のユーザー情報
 * @returns {Promise<Object>} 送信結果
 */
export async function sendHistoryLink(userId, user) {
  try {
    const token = generateUserToken(user);
    const url = `${BASE_URL}/history?token=${token}`;
    
    return await sendButtonMessage(
      userId,
      '📋 申請履歴を確認できます',
      '履歴を確認',
      url
    );
    
  } catch (error) {
    console.error('Error sending history link:', error);
    throw error;
  }
}

/**
 * 管理者ダッシュボードのリンクを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @param {Object} user - 管理者ユーザー情報
 * @returns {Promise<Object>} 送信結果
 */
export async function sendAdminDashboardLink(userId, user) {
  try {
    const token = generateUserToken(user);
    const url = `${BASE_URL}/admin?token=${token}`;
    
    return await sendButtonMessage(
      userId,
      '👑 管理者ダッシュボードにアクセスできます',
      '管理画面を開く',
      url
    );
    
  } catch (error) {
    console.error('Error sending admin dashboard link:', error);
    throw error;
  }
}

/**
 * ヘルプメッセージを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @returns {Promise<Object>} 送信結果
 */
export async function sendHelpMessage(userId) {
  try {
    const helpText = `🌱 野菜集荷管理システム 使い方\n\n📝 申請関連:\n「納品登録」「申請」「登録」→ 新しい申請\n\n📋 確認関連:\n「確認」「履歴」「一覧」→ 申請履歴\n\n👑 管理者機能:\n「管理」「admin」「かんり」→ 管理画面\n\n❓ ヘルプ:\n「ヘルプ」「help」「使い方」→ この説明\n\n何かご不明な点がございましたら、管理者までお問い合わせください。`;
    
    return await sendTextMessage(userId, helpText);
    
  } catch (error) {
    console.error('Error sending help message:', error);
    throw error;
  }
}

/**
 * ウェルカムメッセージを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @param {string} userName - ユーザー名
 * @returns {Promise<Object>} 送信結果
 */
export async function sendWelcomeMessage(userId, userName) {
  try {
    const welcomeText = `${userName}さん、友だち追加ありがとうございます！🌱\n\n野菜集荷管理システムへようこそ。\n\n💡 使い方:\n• 「申請」と送信すると納品申請ができます\n• 「履歴」と送信すると過去の申請を確認できます\n• 「ヘルプ」と送信すると詳しい使い方を見れます\n\nお気軽にメッセージを送ってください！`;
    
    return await sendTextMessage(userId, welcomeText);
    
  } catch (error) {
    console.error('Error sending welcome message:', error);
    throw error;
  }
}

/**
 * デフォルトメッセージを送信する
 * @param {string} userId - 送信先のLINE User ID
 * @returns {Promise<Object>} 送信結果
 */
export async function sendDefaultMessage(userId) {
  try {
    const defaultText = `申し訳ございませんが、そのメッセージは認識できませんでした。😅\n\n以下のコマンドをお試しください：\n\n📝「申請」- 納品申請\n📋「履歴」- 申請履歴\n👑「管理」- 管理画面（管理者のみ）\n❓「ヘルプ」- 使い方\n\nお困りの際は「ヘルプ」と送信してください。`;
    
    return await sendTextMessage(userId, defaultText);
    
  } catch (error) {
    console.error('Error sending default message:', error);
    throw error;
  }
}

/**
 * 野菜集荷システム用のLINEサービスクラス
 */
export class LineService {
  constructor() {
    this.accessToken = LINE_CHANNEL_ACCESS_TOKEN;
    this.channelId = LINE_CHANNEL_ID;
    this.channelSecret = LINE_CHANNEL_SECRET;
  }
  
  // テキストメッセージ送信
  async sendTextMessage(userId, message) {
    return sendTextMessage(userId, message);
  }
  
  // ボタンメッセージ送信
  async sendButtonMessage(userId, text, buttonText, url) {
    return sendButtonMessage(userId, text, buttonText, url);
  }
  
  // 署名検証
  verifySignature(body, signature) {
    return verifyLineSignature(body, signature);
  }
  
  // プロフィール取得
  async getProfile(accessToken) {
    return getLineProfile(accessToken);
  }
  
  // 一括メッセージ送信
  async sendBulkMessage(userIds, message, delay = 100) {
    return sendBulkTextMessage(userIds, message, delay);
  }
  
  // カルーセルメッセージ送信
  async sendCarousel(userId, altText, columns) {
    return sendCarouselMessage(userId, altText, columns);
  }
  
  // 確認メッセージ送信
  async sendConfirm(userId, text, yesLabel, noLabel, data) {
    return sendConfirmMessage(userId, text, yesLabel, noLabel, data);
  }
  
  // 集荷管理リンク送信
  async sendHarvestLink(userId, user) {
    return sendHarvestLink(userId, user);
  }
  
  // 履歴画面リンク送信
  async sendHistoryLink(userId, user) {
    return sendHistoryLink(userId, user);
  }
  
  // 管理者ダッシュボードリンク送信
  async sendAdminLink(userId, user) {
    return sendAdminDashboardLink(userId, user);
  }
  
  // ヘルプメッセージ送信
  async sendHelp(userId) {
    return sendHelpMessage(userId);
  }
  
  // ウェルカムメッセージ送信
  async sendWelcome(userId, userName) {
    return sendWelcomeMessage(userId, userName);
  }
  
  // デフォルトメッセージ送信
  async sendDefault(userId) {
    return sendDefaultMessage(userId);
  }
  
  // ユーザートークン生成
  generateUserToken(user) {
    return generateUserToken(user);
  }
}

// シングルトンインスタンス
export const lineService = new LineService();

// デバッグ用：LINE設定情報を出力
if (process.env.NODE_ENV !== 'production') {
  console.log('LINE Configuration:');
  console.log('- Channel ID:', LINE_CHANNEL_ID ? 'Set' : 'Not set');
  console.log('- Channel Secret:', LINE_CHANNEL_SECRET ? 'Set' : 'Not set');
  console.log('- Access Token:', LINE_CHANNEL_ACCESS_TOKEN ? 'Set' : 'Not set');
  console.log('- Redirect URI:', LINE_REDIRECT_URI);
  console.log('- Base URL:', BASE_URL);
}

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateLineAuthUrl,
    exchangeCodeForToken,
    getLineProfile,
    sendTextMessage,
    sendButtonMessage,
    verifyLineSignature,
    sendBulkTextMessage,
    sendCarouselMessage,
    sendConfirmMessage,
    generateUserToken,
    sendHarvestLink,
    sendHistoryLink,
    sendAdminDashboardLink,
    sendHelpMessage,
    sendWelcomeMessage,
    sendDefaultMessage,
    LineService,
    lineService,
    LINE_CHANNEL_ID,
    LINE_REDIRECT_URI,
    BASE_URL
  };
}