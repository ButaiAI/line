const { withCors } = require('../utils/cors');
const { requireAuth } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');

async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: '申請IDが必要です' });
  }

  try {
    // 既存の申請を取得して権限チェック
    const existingRentals = await supabaseService.getOriconRentalsByUser(req.user.id);
    const targetRental = existingRentals.find(r => r.id === id);
    
    if (!targetRental && req.user.role !== 'admin') {
      return res.status(404).json({ error: '申請が見つからないか、アクセス権限がありません' });
    }
    
    await supabaseService.deleteOriconRental(id);
    
    res.status(200).json({
      success: true,
      message: 'オリコン貸出申請が正常に削除されました'
    });
    
  } catch (error) {
    console.error('オリコン貸出申請削除エラー:', error);
    res.status(500).json({ 
      error: 'オリコン貸出申請の削除中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = withCors(requireAuth(handler));