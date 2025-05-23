const { createResponse, verifyAuth } = require('./utils/response');
const { SupabaseService } = require('./config/supabase');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return await getOriconRequests(req, res);
  } else if (req.method === 'POST') {
    return await createOriconRequest(req, res);
  } else if (req.method === 'PUT') {
    return await updateOriconRequest(req, res);
  } else if (req.method === 'DELETE') {
    return await deleteOriconRequest(req, res);
  } else {
    return createResponse(res, { error: 'Method not allowed' }, 405);
  }
};

// GET - ユーザーのオリコン申請を取得
async function getOriconRequests(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user) {
      return createResponse(res, { error: 'Unauthorized' }, 401);
    }

    const supabase = new SupabaseService();
    const requests = await supabase.getUserOriconRequests(user.id);
    
    return createResponse(res, requests);
  } catch (error) {
    console.error('Get oricon requests error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}

// POST - 新しいオリコン申請を作成
async function createOriconRequest(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user) {
      return createResponse(res, { error: 'Unauthorized' }, 401);
    }

    const { rental_date, return_date, quantity } = req.body;

    if (!rental_date || !return_date || !quantity) {
      return createResponse(res, { 
        error: 'Missing required fields: rental_date, return_date, quantity' 
      }, 400);
    }

    if (quantity <= 0) {
      return createResponse(res, { error: 'Quantity must be greater than 0' }, 400);
    }

    // 日付の妥当性チェック
    const rentalDateObj = new Date(rental_date);
    const returnDateObj = new Date(return_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // 今日の終わり

    if (rentalDateObj <= today) {
      return createResponse(res, { error: 'Rental date must be in the future' }, 400);
    }

    if (returnDateObj <= rentalDateObj) {
      return createResponse(res, { error: 'Return date must be after rental date' }, 400);
    }

    const supabase = new SupabaseService();

    const requestData = {
      user_id: user.id,
      rental_date,
      return_date,
      quantity: parseInt(quantity),
      status: 'pending'
    };

    const newRequest = await supabase.createOriconRequest(requestData);
    
    return createResponse(res, { 
      success: true, 
      request: newRequest 
    }, 201);
  } catch (error) {
    console.error('Create oricon request error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}

// PUT - オリコン申請を更新
async function updateOriconRequest(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user) {
      return createResponse(res, { error: 'Unauthorized' }, 401);
    }

    const requestId = req.url.split('/').pop();
    const { rental_date, return_date, quantity } = req.body;

    if (!rental_date || !return_date || !quantity) {
      return createResponse(res, { 
        error: 'Missing required fields: rental_date, return_date, quantity' 
      }, 400);
    }

    if (quantity <= 0) {
      return createResponse(res, { error: 'Quantity must be greater than 0' }, 400);
    }

    // 日付の妥当性チェック
    const rentalDateObj = new Date(rental_date);
    const returnDateObj = new Date(return_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (rentalDateObj <= today) {
      return createResponse(res, { error: 'Rental date must be in the future' }, 400);
    }

    if (returnDateObj <= rentalDateObj) {
      return createResponse(res, { error: 'Return date must be after rental date' }, 400);
    }

    const supabase = new SupabaseService();
    
    // 申請の存在確認と所有者チェック
    const existingRequest = await supabase.getOriconRequestById(requestId);
    if (!existingRequest) {
      return createResponse(res, { error: 'Request not found' }, 404);
    }

    if (existingRequest.user_id !== user.id) {
      return createResponse(res, { error: 'Forbidden' }, 403);
    }

    // pending状態の申請のみ編集可能
    if (existingRequest.status !== 'pending') {
      return createResponse(res, { 
        error: 'Cannot edit non-pending requests' 
      }, 400);
    }

    const updateData = {
      rental_date,
      return_date,
      quantity: parseInt(quantity),
      updated_at: new Date().toISOString()
    };

    const updatedRequest = await supabase.updateOriconRequest(requestId, updateData);
    
    return createResponse(res, { 
      success: true, 
      request: updatedRequest 
    });
  } catch (error) {
    console.error('Update oricon request error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}

// DELETE - オリコン申請を削除
async function deleteOriconRequest(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user) {
      return createResponse(res, { error: 'Unauthorized' }, 401);
    }

    const requestId = req.url.split('/').pop();

    const supabase = new SupabaseService();
    
    // 申請の存在確認と所有者チェック
    const existingRequest = await supabase.getOriconRequestById(requestId);
    if (!existingRequest) {
      return createResponse(res, { error: 'Request not found' }, 404);
    }

    if (existingRequest.user_id !== user.id) {
      return createResponse(res, { error: 'Forbidden' }, 403);
    }

    // pending状態の申請のみ削除可能
    if (existingRequest.status !== 'pending') {
      return createResponse(res, { 
        error: 'Cannot delete non-pending requests' 
      }, 400);
    }

    await supabase.deleteOriconRequest(requestId);
    
    return createResponse(res, { success: true });
  } catch (error) {
    console.error('Delete oricon request error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}