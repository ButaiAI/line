const { withCors } = require('../utils/cors');
const { requireAdmin } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');
const { sendLineMessage } = require('../utils/line');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, target_date, custom_message } = req.body;
  
  if (!type || !target_date) {
    return res.status(400).json({ 
      error: 'リマインダータイプと対象日付は必須項目です' 
    });
  }

  const validTypes = ['harvest', 'oricon', 'custom'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ 
      error: '無効なリマインダータイプです。harvest, oricon, custom のいずれかを指定してください' 
    });
  }

  if (type === 'custom' && !custom_message) {
    return res.status(400).json({ 
      error: 'カスタムリマインダーにはメッセージが必要です' 
    });
  }

  try {
    let targetUsers = [];
    let reminderMessage = '';
    let reminderTitle = '';
    
    if (type === 'harvest') {
      // 指定日の集荷予定者にリマインダー
      const harvestRequests = await supabaseService.getAllHarvestRequests();
      const targetRequests = harvestRequests.filter(req => 
        req.delivery_date === target_date && 
        (req.status === 'approved' || req.status === 'pending')
      );
      
      if (targetRequests.length === 0) {
        return res.status(404).json({ 
          error: '指定日に集荷予定の申請がありません'
        });
      }
      
      // ユーザーIDを収集
      const userIds = [...new Set(targetRequests.map(req => req.user_id))];
      const allUsers = await supabaseService.getAllUsers();
      targetUsers = allUsers.filter(user => 
        userIds.includes(user.id) && user.status === 'active' && user.line_id
      );
      
      reminderTitle = '集荷予定のお知らせ';
      reminderMessage = `${target_date}に集荷予定の申請があります。\n準備をお願いいたします。`;
      
    } else if (type === 'oricon') {
      // 指定日のオリコン受取予定者にリマインダー
      const oriconRentals = await supabaseService.getAllOriconRentals();
      const targetRentals = oriconRentals.filter(rental => 
        rental.pickup_date === target_date && 
        (rental.status === 'approved' || rental.status === 'pending')
      );
      
      if (targetRentals.length === 0) {
        return res.status(404).json({ 
          error: '指定日にオリコン受取予定の申請がありません'
        });
      }
      
      // ユーザーIDを収集
      const userIds = [...new Set(targetRentals.map(rental => rental.user_id))];
      const allUsers = await supabaseService.getAllUsers();
      targetUsers = allUsers.filter(user => 
        userIds.includes(user.id) && user.status === 'active' && user.line_id
      );
      
      reminderTitle = 'オリコン受取予定のお知らせ';
      reminderMessage = `${target_date}にオリコン受取予定の申請があります。\nお忘れなくお越しください。`;
      
    } else if (type === 'custom') {
      // 全アクティブユーザーにカスタムメッセージ
      const allUsers = await supabaseService.getAllUsers();
      targetUsers = allUsers.filter(user => user.status === 'active' && user.line_id);
      
      reminderTitle = 'お知らせ';
      reminderMessage = custom_message.trim();
    }
    
    if (targetUsers.length === 0) {
      return res.status(404).json({ 
        error: 'リマインダー送信対象のユーザーがいません'
      });
    }
    
    // リマインダーをお知らせとして保存
    const notificationData = {
      title: reminderTitle,
      message: reminderMessage,
      recipients: type === 'custom' ? 'all' : `${type}_${target_date}`,
      sent_at: new Date().toISOString()
    };
    
    const savedNotification = await supabaseService.createNotification(notificationData);
    
    // LINEメッセージ送信
    let sentCount = 0;
    let failedCount = 0;
    
    const lineMessage = `⏰ ${reminderTitle}\n\n${reminderMessage}`;
    
    for (const user of targetUsers) {
      try {
        await sendLineMessage(user.line_id, lineMessage);
        sentCount++;
        // APIレート制限を避けるための小さな遅延
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (lineError) {
        console.error(`LINEリマインダー送信失敗 (${user.line_id}):`, lineError);
        failedCount++;
      }
    }
    
    res.status(200).json({
      success: true,
      data: savedNotification,
      reminder_delivery: {
        type: type,
        target_date: target_date,
        sent: sentCount,
        failed: failedCount,
        total: targetUsers.length
      },
      message: `リマインツーが${sentCount}件送信されました`
    });
    
  } catch (error) {
    console.error('リマインダー送信エラー:', error);
    res.status(500).json({ 
      error: 'リマインダーの送信中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = withCors(requireAdmin(handler));