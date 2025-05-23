const { withCors } = require('../utils/cors');
const { requireAdmin } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status } = req.query;
  
  try {
    let users = await supabaseService.getAllUsers();
    
    // ステータスでフィルタリング
    if (status) {
      users = users.filter(user => user.status === status);
    }
    
    // パスワードなどの機密情報を除外
    const safeUsers = users.map(user => ({
      id: user.id,
      line_id: user.line_id,
      user_name: user.user_name,
      email: user.email,
      status: user.status,
      role: user.role || 'user',
      created_at: user.created_at,
      last_login: user.last_login
    }));
    
    res.status(200).json({
      success: true,
      data: safeUsers,
      count: safeUsers.length
    });
    
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    res.status(500).json({ 
      error: 'ユーザー一覧の取得中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = withCors(requireAdmin(handler));