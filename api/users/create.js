const { withCors } = require('../utils/cors');
const { requireAdmin } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { line_id, user_name, email, role, status } = req.body;
  
  if (!line_id || !user_name) {
    return res.status(400).json({ 
      error: 'LINE ID とユーザー名は必須項目です' 
    });
  }

  if (user_name.trim().length > 100) {
    return res.status(400).json({ 
      error: 'ユーザー名は100文字以下で入力してください' 
    });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ 
      error: '有効なメールアドレスを入力してください' 
    });
  }

  try {
    // 既存のLINE IDチェック
    const existingUsers = await supabaseService.getUserByLineId(line_id);
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ 
        error: '同じLINE IDのユーザーが既に存在します' 
      });
    }

    // メールアドレスの重複チェック
    if (email) {
      const allUsers = await supabaseService.getAllUsers();
      const emailExists = allUsers.find(user => user.email === email);
      if (emailExists) {
        return res.status(409).json({ 
          error: '同じメールアドレスのユーザーが既に存在します' 
        });
      }
    }

    const userData = {
      line_id: line_id.trim(),
      user_name: user_name.trim(),
      email: email ? email.trim() : null,
      role: role || 'user',
      status: status || 'active',
      created_at: new Date().toISOString()
    };

    // 有効なロールかチェック
    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(userData.role)) {
      return res.status(400).json({ 
        error: '無効なロールです。user または admin を指定してください' 
      });
    }

    // 有効なステータスかチェック
    const validStatuses = ['active', 'inactive'];
    if (!validStatuses.includes(userData.status)) {
      return res.status(400).json({ 
        error: '無効なステータスです。active または inactive を指定してください' 
      });
    }

    const result = await supabaseService.createUser(userData);
    
    // レスポンスから機密情報を除外
    const safeResult = {
      id: result.id,
      line_id: result.line_id,
      user_name: result.user_name,
      email: result.email,
      role: result.role,
      status: result.status,
      created_at: result.created_at
    };
    
    res.status(201).json({
      success: true,
      data: safeResult,
      message: 'ユーザーが正常に作成されました'
    });
    
  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    res.status(500).json({ 
      error: 'ユーザーの作成中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = withCors(requireAdmin(handler));