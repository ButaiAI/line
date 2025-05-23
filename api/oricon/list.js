const { withCors } = require('../utils/cors');
const { requireAuth } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, admin_view } = req.query;
  
  try {
    let rentals;
    
    // 管理者ビューの場合（admin_view=true かつ管理者権限）
    if (admin_view === 'true') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      // 管理者：全ての申請を取得（ユーザー名含む）
      rentals = await supabaseService.getAllOriconRentals();
    } 
    // 特定ユーザーの申請を取得
    else if (user_id) {
      // 自分の申請または管理者のみアクセス可能
      if (req.user.id !== user_id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      rentals = await supabaseService.getOriconRentalsByUser(user_id);
    } 
    // 自分の申請のみ取得（デフォルト）
    else {
      rentals = await supabaseService.getOriconRentalsByUser(req.user.id);
    }
    
    res.status(200).json({
      success: true,
      data: rentals || [],
      count: rentals ? rentals.length : 0
    });
    
  } catch (error) {
    console.error('オリコン貸出申請一覧取得エラー:', error);
    res.status(500).json({ 
      error: 'オリコン貸出申請一覧の取得中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = withCors(requireAuth(handler));