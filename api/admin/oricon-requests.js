const { createResponse, verifyAuth } = require('../utils/response');
const { SupabaseService } = require('../config/supabase');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return await getOriconRequests(req, res);
  } else if (req.method === 'PUT') {
    return await updateOriconRequest(req, res);
  } else if (req.method === 'DELETE') {
    return await deleteOriconRequest(req, res);
  } else {
    return createResponse(res, { error: 'Method not allowed' }, 405);
  }
};

// GET - すべてのオリコン申請を取得（管理者用）
async function getOriconRequests(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user || user.role !== 'admin') {
      return createResponse(res, { error: 'Forbidden' }, 403);
    }

    const supabase = new SupabaseService();
    const requests = await supabase.getAllOriconRequests();
    
    return createResponse(res, requests);
  } catch (error) {
    console.error('Get admin oricon requests error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}

// PUT - オリコン申請のステータスを更新（管理者用）
async function updateOriconRequest(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user || user.role !== 'admin') {
      return createResponse(res, { error: 'Forbidden' }, 403);
    }

    const requestId = req.url.split('/').pop();
    const { status } = req.body;

    if (!status) {
      return createResponse(res, { 
        error: 'Missing required field: status' 
      }, 400);
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return createResponse(res, { 
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      }, 400);
    }

    const supabase = new SupabaseService();
    
    // 申請の存在確認
    const existingRequest = await supabase.getOriconRequestById(requestId);
    if (!existingRequest) {
      return createResponse(res, { error: 'Request not found' }, 404);
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    const updatedRequest = await supabase.updateOriconRequest(requestId, updateData);
    
    return createResponse(res, { 
      success: true, 
      request: updatedRequest 
    });
  } catch (error) {
    console.error('Update admin oricon request error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}

// DELETE - オリコン申請を削除（管理者用）
async function deleteOriconRequest(req, res) {
  try {
    const { user } = await verifyAuth(req);
    if (!user || user.role !== 'admin') {
      return createResponse(res, { error: 'Forbidden' }, 403);
    }

    const requestId = req.url.split('/').pop();

    const supabase = new SupabaseService();
    
    // 申請の存在確認
    const existingRequest = await supabase.getOriconRequestById(requestId);
    if (!existingRequest) {
      return createResponse(res, { error: 'Request not found' }, 404);
    }

    await supabase.deleteOriconRequest(requestId);
    
    return createResponse(res, { success: true });
  } catch (error) {
    console.error('Delete admin oricon request error:', error);
    return createResponse(res, { error: 'Internal server error' }, 500);
  }
}