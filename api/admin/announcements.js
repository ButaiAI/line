const { withCors } = require('../utils/cors');
const { requireAdmin } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');
const { sendLineMessage } = require('../utils/line');

async function handler(req, res) {
  if (req.method === 'GET') {
    // お知らせ一覧取得
    try {
      const notifications = await supabaseService.getNotifications();
      
      res.status(200).json({
        success: true,
        data: notifications || [],
        count: notifications ? notifications.length : 0
      });
      
    } catch (error) {
      console.error('お知らせ一覧取得エラー:', error);
      res.status(500).json({ 
        error: 'お知らせ一覧の取得中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
  } else if (req.method === 'POST') {
    // お知らせ作成・送信
    const { title, message, recipients, send_line } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ 
        error: 'タイトルとメッセージは必須項目です' 
      });
    }

    if (title.length > 100) {
      return res.status(400).json({ 
        error: 'タイトルは100文字以下で入力してください' 
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({ 
        error: 'メッセージは1000文字以下で入力してください' 
      });
    }

    try {
      // お知らせをデータベースに保存
      const notificationData = {
        title: title.trim(),
        message: message.trim(),
        recipients: recipients || 'all',
        sent_at: new Date().toISOString()
      };

      const savedNotification = await supabaseService.createNotification(notificationData);
      
      // LINEメッセージ送信が有効な場合
      if (send_line) {
        try {
          // 対象ユーザーを取得
          const users = await supabaseService.getAllUsers();
          const activeUsers = users.filter(user => user.status === 'active' && user.line_id);
          
          let sentCount = 0;
          let failedCount = 0;
          
          // LINEメッセージを作成
          const lineMessage = `📢 ${title}\n\n${message}`;
          
          // 各ユーザーにLINEメッセージを送信
          for (const user of activeUsers) {
            try {
              await sendLineMessage(user.line_id, lineMessage);
              sentCount++;
              // APIレート制限を避けるための小さな遅延
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (lineError) {
              console.error(`LINEメッセージ送信失敗 (${user.line_id}):`, lineError);
              failedCount++;
            }
          }
          
          res.status(201).json({
            success: true,
            data: savedNotification,
            line_delivery: {
              sent: sentCount,
              failed: failedCount,
              total: activeUsers.length
            },
            message: `お知らせが作成され、LINEメッセージが${sentCount}件送信されました`
          });
          
        } catch (lineError) {
          console.error('LINEメッセージ送信エラー:', lineError);
          res.status(201).json({
            success: true,
            data: savedNotification,
            warning: 'LINEメッセージの送信に失敗しましたが、お知らせは保存されました',
            message: 'お知らせが作成されました（LINE送信エラー）'
          });
        }
      } else {
        // LINE送信なしの場合
        res.status(201).json({
          success: true,
          data: savedNotification,
          message: 'お知らせが正常に作成されました'
        });
      }
      
    } catch (error) {
      console.error('お知らせ作成エラー:', error);
      res.status(500).json({ 
        error: 'お知らせの作成中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

module.exports = withCors(requireAdmin(handler));