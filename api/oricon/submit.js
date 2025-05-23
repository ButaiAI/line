const { withCors } = require('../utils/cors');
const { requireAuth } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pickup_date, quantity, notes } = req.body;
  
  if (!pickup_date || !quantity) {
    return res.status(400).json({ 
      error: '受取希望日と数量は必須項目です' 
    });
  }

  if (quantity <= 0) {
    return res.status(400).json({ 
      error: '数量は1以上である必要があります' 
    });
  }

  const pickupDateObj = new Date(pickup_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (pickupDateObj < today) {
    return res.status(400).json({ 
      error: '受取希望日は今日以降の日付を指定してください' 
    });
  }

  try {
    const rentalData = {
      user_id: req.user.id,
      pickup_date,
      quantity: parseInt(quantity),
      notes: notes || null,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const result = await supabaseService.createOriconRental(rentalData);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'オリコン貸出申請が正常に登録されました'
    });
    
  } catch (error) {
    console.error('オリコン貸出申請登録エラー:', error);
    res.status(500).json({ 
      error: 'オリコン貸出申請の登録中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = withCors(requireAuth(handler));