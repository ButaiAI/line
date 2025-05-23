import { supabaseAdmin } from '../../lib/supabase.js';
import { 
  verifyLineSignature, 
  sendTextMessage, 
  sendHarvestLink,
  sendHistoryLink,
  sendAdminDashboardLink,
  sendHelpMessage,
  sendWelcomeMessage,
  sendDefaultMessage
} from '../utils/line.js';

/**
 * LINE Webhook処理
 * LINE Platformからのイベントを受信・処理する
 */

const ADMIN_LINE_IDS = process.env.ADMIN_LINE_IDS ? process.env.ADMIN_LINE_IDS.split(',') : [];

/**
 * LINEイベントを処理する
 * @param {Object} event - LINEイベント
 */
async function handleLineEvent(event) {
  const { type, source, message, postback } = event;
  const userId = source.userId;

  console.log(`Processing LINE event: ${type} from user: ${userId}`);

  try {
    switch (type) {
      case 'message':
        if (message.type === 'text') {
          await handleTextMessage(userId, message.text);
        }
        break;

      case 'follow':
        await handleFollowEvent(userId);
        break;

      case 'unfollow':
        await handleUnfollowEvent(userId);
        break;

      case 'postback':
        await handlePostbackEvent(userId, postback.data);
        break;

      default:
        console.log(`Unhandled event type: ${type}`);
    }
  } catch (error) {
    console.error(`Error handling LINE event:`, error);
  }
}

/**
 * テキストメッセージを処理する
 * @param {string} userId - LINE User ID
 * @param {string} text - メッセージテキスト
 */
async function handleTextMessage(userId, text) {
  console.log(`Processing text message from ${userId}: ${text}`);

  const normalizedText = text.trim().toLowerCase();

  // ユーザー情報を取得または作成
  const user = await getOrCreateUser(userId);
  if (!user) {
    console.error('Failed to get or create user:', userId);
    return;
  }

  // コマンド認識
  if (isSubmissionCommand(normalizedText)) {
    await sendHarvestLink(userId, user);
  } else if (isHistoryCommand(normalizedText)) {
    await sendHistoryLink(userId, user);
  } else if (isAdminCommand(normalizedText)) {
    if (isAdminUser(user)) {
      await sendAdminDashboardLink(userId, user);
    } else {
      await sendTextMessage(userId, '申し訳ございませんが、管理者権限が必要です。');
    }
  } else if (isHelpCommand(normalizedText)) {
    await sendHelpMessage(userId);
  } else {
    await sendDefaultMessage(userId);
  }
}

/**
 * フォローイベントを処理する
 * @param {string} userId - LINE User ID
 */
async function handleFollowEvent(userId) {
  console.log(`Processing follow event from ${userId}`);

  try {
    // LINEプロフィール情報を取得
    const profile = await getLineProfile(userId);
    if (!profile) {
      console.error('Failed to get LINE profile for user:', userId);
      return;
    }

    // ユーザーを登録
    const user = await getOrCreateUser(userId, profile);
    if (user) {
      await sendWelcomeMessage(userId, profile.displayName);
    }
  } catch (error) {
    console.error('Error handling follow event:', error);
    await sendWelcomeMessage(userId, 'お客様');
  }
}

/**
 * アンフォロー（ブロック）イベントを処理する
 * @param {string} userId - LINE User ID
 */
async function handleUnfollowEvent(userId) {
  console.log(`Processing unfollow event from ${userId}`);

  try {
    // ユーザーのステータスを更新
    await supabaseAdmin
      .from('users')
      .update({
        status: 'blocked',
        blocked_at: new Date().toISOString()
      })
      .eq('line_id', userId);

    console.log(`User ${userId} has been marked as blocked`);
  } catch (error) {
    console.error('Error handling unfollow event:', error);
  }
}

/**
 * ポストバックイベントを処理する
 * @param {string} userId - LINE User ID
 * @param {string} data - ポストバックデータ
 */
async function handlePostbackEvent(userId, data) {
  console.log(`Processing postback event from ${userId}: ${data}`);

  // ポストバックデータをパース
  const params = new URLSearchParams(data);
  const action = params.get('action');

  // アクションに応じて処理
  switch (action) {
    case 'yes':
      await sendTextMessage(userId, '承知いたしました。');
      break;
    case 'no':
      await sendTextMessage(userId, 'キャンセルいたします。');
      break;
    default:
      console.log(`Unhandled postback action: ${action}`);
  }
}

/**
 * ユーザー情報を取得または作成する
 * @param {string} lineId - LINE User ID
 * @param {Object} profile - LINEプロフィール情報（オプション）
 * @returns {Object} ユーザー情報
 */
async function getOrCreateUser(lineId, profile = null) {
  try {
    // 既存ユーザーを検索
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('line_id', lineId)
      .single();

    if (existingUser && !fetchError) {
      // 既存ユーザーの最終ログイン時刻を更新
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          status: 'active'
        })
        .eq('id', existingUser.id)
        .select('*')
        .single();

      return updatedUser || existingUser;
    }

    // 新規ユーザーを作成
    if (profile) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          line_id: lineId,
          name: profile.displayName || 'LINE User',
          avatar_url: profile.pictureUrl || null,
          role: 'user',
          status: 'active',
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return null;
      }

      console.log('New user created:', newUser);
      return newUser;
    }

    return null;
  } catch (error) {
    console.error('Error getting or creating user:', error);
    return null;
  }
}

/**
 * LINEプロフィール情報を取得する（Messaging API用）
 * @param {string} userId - LINE User ID
 * @returns {Object} プロフィール情報
 */
async function getLineProfile(userId) {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    });

    if (!response.ok) {
      console.error('Failed to get LINE profile:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting LINE profile:', error);
    return null;
  }
}

/**
 * コマンド認識関数群
 */
function isSubmissionCommand(text) {
  const commands = ['納品登録', '申請', '登録', 'submit', 'application'];
  return commands.some(cmd => text.includes(cmd));
}

function isHistoryCommand(text) {
  const commands = ['確認', '履歴', '一覧', 'history', 'list', 'check'];
  return commands.some(cmd => text.includes(cmd));
}

function isAdminCommand(text) {
  const commands = ['管理', 'admin', 'かんり', 'management'];
  return commands.some(cmd => text.includes(cmd));
}

function isHelpCommand(text) {
  const commands = ['ヘルプ', 'help', '使い方', 'つかいかた', 'usage', '?', '？'];
  return commands.some(cmd => text.includes(cmd));
}

/**
 * 管理者ユーザーかどうか判定する
 * @param {Object} user - ユーザー情報
 * @returns {boolean}
 */
function isAdminUser(user) {
  // 1. roleが'admin'の場合
  if (user.role === 'admin') {
    return true;
  }

  // 2. 環境変数で指定された管理者LINE IDの場合
  if (ADMIN_LINE_IDS.includes(user.line_id)) {
    return true;
  }

  // 3. is_adminフラグがtrueの場合
  if (user.is_admin === true) {
    return true;
  }

  return false;
}

/**
 * LINE Webhook APIハンドラー
 */
export default async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} /api/webhook/line - Start`);

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // リクエストボディを取得
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-line-signature'];

    console.log('Received LINE webhook request');
    console.log('Signature:', signature);
    console.log('Body length:', body.length);

    // 署名検証
    if (!verifyLineSignature(body, signature)) {
      console.error('LINE signature verification failed');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      });
    }

    console.log('LINE signature verification successful');

    // イベントを処理
    const { events } = req.body;
    
    if (!events || !Array.isArray(events)) {
      console.log('No events found in request');
      return res.status(200).json({ success: true });
    }

    console.log(`Processing ${events.length} events`);

    // 各イベントを並列処理
    const eventPromises = events.map(event => handleLineEvent(event));
    await Promise.allSettled(eventPromises);

    console.log('All LINE events processed');

    return res.status(200).json({
      success: true,
      message: 'Events processed successfully'
    });

  } catch (error) {
    console.error('Unexpected error in LINE webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}