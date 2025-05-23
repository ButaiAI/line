const { createResponse, verifyAuth } = require('./utils/response');
const { SupabaseService } = require('./config/supabase');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return await getHarvestRequests(req, res);
  } else if (req.method === 'POST') {
    return await createHarvestRequest(req, res);
  } else if (req.method === 'PUT') {
    return await updateHarvestRequest(req, res);
  } else if (req.method === 'DELETE') {
    return await deleteHarvestRequest(req, res);
  } else {
    return createResponse(res, { error: 'Method not allowed' }, 405);
  }
};

// GET - ユーザーの収穫申請を取得
async function getHarvestRequests(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user) {
      return createResponse(res, { error: 'Unauthorized' }, 401);
    }

    const supabase = new SupabaseService();
    const requests = await supabase.getUserHarvestRequests(user.id);
    
    return createResponse(res, requests);
  } catch (error) {
    console.error('Get harvest requests error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}

// POST - 新しい収穫申請を作成
async function createHarvestRequest(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user) {
      return createResponse(res, { error: 'Unauthorized' }, 401);
    }

    const { vegetable_name, harvest_date, quantity } = req.body;

    if (!vegetable_name || !harvest_date || !quantity) {
      return createResponse(res, { 
        error: 'Missing required fields: vegetable_name, harvest_date, quantity' 
      }, 400);
    }

    if (quantity <= 0) {
      return createResponse(res, { error: 'Quantity must be greater than 0' }, 400);
    }

    const supabase = new SupabaseService();
    
    // 野菜品目の存在確認
    const vegetable = await supabase.getVegetableByName(vegetable_name);
    if (!vegetable) {
      return createResponse(res, { error: 'Invalid vegetable name' }, 400);
    }

    const requestData = {
      user_id: user.id,
      vegetable_name,
      harvest_date,
      quantity: parseInt(quantity),
      status: 'pending'
    };

    const newRequest = await supabase.createHarvestRequest(requestData);
    
    return createResponse(res, { 
      success: true, 
      request: newRequest 
    }, 201);
  } catch (error) {
    console.error('Create harvest request error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}

// PUT - 収穫申請を更新
async function updateHarvestRequest(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user) {
      return createResponse(res, { error: 'Unauthorized' }, 401);
    }

    const requestId = req.url.split('/').pop();
    const { harvest_date, quantity } = req.body;

    if (!harvest_date || !quantity) {
      return createResponse(res, { 
        error: 'Missing required fields: harvest_date, quantity' 
      }, 400);
    }

    if (quantity <= 0) {
      return createResponse(res, { error: 'Quantity must be greater than 0' }, 400);
    }

    const supabase = new SupabaseService();
    
    // 申請の存在確認と所有者チェック
    const existingRequest = await supabase.getHarvestRequestById(requestId);
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
      harvest_date,
      quantity: parseInt(quantity),
      updated_at: new Date().toISOString()
    };

    const updatedRequest = await supabase.updateHarvestRequest(requestId, updateData);
    
    return createResponse(res, { 
      success: true, 
      request: updatedRequest 
    });
  } catch (error) {
    console.error('Update harvest request error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}

// DELETE - 収穫申請を削除
async function deleteHarvestRequest(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user) {
      return createResponse(res, { error: 'Unauthorized' }, 401);
    }

    const requestId = req.url.split('/').pop();

    const supabase = new SupabaseService();
    
    // 申請の存在確認と所有者チェック
    const existingRequest = await supabase.getHarvestRequestById(requestId);
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

    await supabase.deleteHarvestRequest(requestId);
    
    return createResponse(res, { success: true });
  } catch (error) {
    console.error('Delete harvest request error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}