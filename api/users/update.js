const { withCors } = require('../utils/cors');
const { requireAuth } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');

async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { user_name, email, role, status } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'ユーザーIDが必要です' });
  }

  try {
    // 既存ユーザーの取得
    const existingUser = await supabaseService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: '指定されたユーザーが見つかりません' });
    }

    // 権限チェック: 自分のプロフィールまたは管理者のみ更新可能
    const isOwnProfile = req.user.id === id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }

    // 更新データの準備
    const updateData = {};
    
    if (user_name !== undefined) {
      if (user_name.trim().length === 0) {
        return res.status(400).json({ error: 'ユーザー名は必須です' });
      }
      if (user_name.trim().length > 100) {
        return res.status(400).json({ error: 'ユーザー名は100文字以下で入力してください' });
      }
      updateData.user_name = user_name.trim();
    }

    if (email !== undefined) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: '有効なメールアドレスを入力してください' });
      }
      
      // メールアドレスの重複チェック（自分以外）
      if (email) {
        const allUsers = await supabaseService.getAllUsers();
        const emailExists = allUsers.find(user => user.email === email && user.id !== id);
        if (emailExists) {
          return res.status(409).json({ error: '同じメールアドレスのユーザーが既に存在します' });
        }
      }
      
      updateData.email = email ? email.trim() : null;
    }

    // 管理者のみロールとステータスを変更可能
    if (isAdmin) {
      if (role !== undefined) {
        const validRoles = ['user', 'admin'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: '無効なロールです。user または admin を指定してください' });
        }
        updateData.role = role;
      }

      if (status !== undefined) {
        const validStatuses = ['active', 'inactive'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: '無効なステータスです。active または inactive を指定してください' });
        }
        updateData.status = status;
      }
    } else {
      // 一般ユーザーがロールやステータスを変更しようとした場合
      if (role !== undefined || status !== undefined) {
        return res.status(403).json({ error: 'ロールとステータスの変更には管理者権限が必要です' });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '更新するデータがありません' });
    }

    // 直接Supabaseクライアントを使用してユーザー情報を更新
    const { supabaseAdmin } = require('../config/supabase');
    const { data: result, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // レスポンスから機密情報を除外
    const safeResult = {
      id: result.id,
      line_id: result.line_id,
      user_name: result.user_name,
      email: result.email,
      role: result.role,
      status: result.status,
      created_at: result.created_at,
      last_login: result.last_login
    };
    
    res.status(200).json({
      success: true,
      data: safeResult,
      message: 'ユーザー情報が正常に更新されました'
    });
    
  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    res.status(500).json({ 
      error: 'ユーザー情報の更新中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = withCors(requireAuth(handler));