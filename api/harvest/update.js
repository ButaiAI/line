import { supabaseAdmin } from '../../lib/supabase.js';
import { verifyAuth } from '../../lib/auth.js';
import { handleCors } from '../../lib/cors.js';

export default async function handler(req, res) {
  if (!handleCors(req, res)) return;

  console.log(`[${new Date().toISOString()}] ${req.method} /api/harvest/update - Start`);
  console.log('Request body:', req.body);
  console.log('Request query:', req.query);

  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const user = await verifyAuth(req);
    if (!user) {
      console.log('Authentication failed');
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    console.log('Authenticated user:', { id: user.id, name: user.name, role: user.role });

    const { id } = req.query;
    const requestId = parseInt(id, 10);

    if (!requestId || isNaN(requestId)) {
      console.log('Invalid request ID:', id);
      return res.status(400).json({
        success: false,
        error: 'Invalid request ID',
        code: 'INVALID_REQUEST_ID'
      });
    }

    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from('harvest_requests')
      .select('*')
      .eq('id', requestId)
      .neq('status', 'deleted')
      .single();

    if (fetchError || !existingRequest) {
      console.log('Request not found:', { requestId, error: fetchError });
      return res.status(404).json({
        success: false,
        error: 'Harvest request not found',
        code: 'REQUEST_NOT_FOUND'
      });
    }

    if (existingRequest.user_id !== user.id && user.role !== 'admin') {
      console.log('Access denied:', { 
        requestUserId: existingRequest.user_id, 
        currentUserId: user.id, 
        userRole: user.role 
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only modify your own requests.',
        code: 'ACCESS_DENIED'
      });
    }

    if (existingRequest.status !== 'pending' && user.role !== 'admin') {
      console.log('Status modification denied:', { 
        currentStatus: existingRequest.status,
        userRole: user.role 
      });
      return res.status(400).json({
        success: false,
        error: 'Only pending requests can be modified',
        code: 'STATUS_MODIFICATION_DENIED'
      });
    }

    if (req.method === 'DELETE') {
      console.log('Processing DELETE request for request ID:', requestId);

      const { error: deleteError } = await supabaseAdmin
        .from('harvest_requests')
        .update({ 
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return res.status(500).json({
          success: false,
          error: 'Failed to delete harvest request',
          code: 'DELETE_FAILED'
        });
      }

      console.log('Request deleted successfully:', requestId);
      return res.status(200).json({
        success: true,
        message: 'Harvest request deleted successfully',
        data: {
          id: requestId,
          status: 'deleted'
        }
      });
    }

    if (req.method === 'PUT') {
      console.log('Processing PUT request for request ID:', requestId);

      const { vegetable_item, delivery_date, quantity, notes, status } = req.body;

      const updates = {};
      let hasUpdates = false;

      if (vegetable_item !== undefined && vegetable_item !== null) {
        if (typeof vegetable_item !== 'string' || vegetable_item.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Vegetable item must be a non-empty string',
            code: 'INVALID_VEGETABLE_ITEM'
          });
        }

        const { data: vegetable, error: vegetableError } = await supabaseAdmin
          .from('vegetable_master')
          .select('id, item_name')
          .eq('item_name', vegetable_item.trim())
          .single();

        if (vegetableError || !vegetable) {
          console.log('Vegetable not found:', vegetable_item);
          return res.status(400).json({
            success: false,
            error: 'Vegetable not found in master list',
            code: 'VEGETABLE_NOT_FOUND'
          });
        }

        updates.vegetable_item = vegetable_item.trim();
        hasUpdates = true;
      }

      if (delivery_date !== undefined && delivery_date !== null) {
        if (typeof delivery_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) {
          return res.status(400).json({
            success: false,
            error: 'Delivery date must be in YYYY-MM-DD format',
            code: 'INVALID_DELIVERY_DATE'
          });
        }

        const deliveryDateObj = new Date(delivery_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deliveryDateObj.setHours(0, 0, 0, 0);

        if (deliveryDateObj < today) {
          return res.status(400).json({
            success: false,
            error: 'Delivery date cannot be in the past',
            code: 'PAST_DELIVERY_DATE'
          });
        }

        updates.delivery_date = delivery_date;
        hasUpdates = true;
      }

      if (quantity !== undefined && quantity !== null) {
        const quantityNum = parseFloat(quantity);
        if (isNaN(quantityNum) || quantityNum <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Quantity must be a positive number',
            code: 'INVALID_QUANTITY'
          });
        }

        updates.quantity = quantityNum;
        hasUpdates = true;
      }

      if (notes !== undefined && notes !== null) {
        updates.notes = notes;
        hasUpdates = true;
      }

      if (status !== undefined && status !== null && user.role === 'admin') {
        const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
        if (validStatuses.includes(status)) {
          updates.status = status;
          hasUpdates = true;
        }
      }

      if (!hasUpdates) {
        return res.status(400).json({
          success: false,
          error: 'No valid updates provided',
          code: 'NO_UPDATES'
        });
      }

      if (updates.vegetable_item || updates.delivery_date) {
        const checkVegetable = updates.vegetable_item || existingRequest.vegetable_item;
        const checkDate = updates.delivery_date || existingRequest.delivery_date;

        const { data: duplicateRequest, error: duplicateError } = await supabaseAdmin
          .from('harvest_requests')
          .select('id')
          .eq('user_id', existingRequest.user_id)
          .eq('vegetable_item', checkVegetable)
          .eq('delivery_date', checkDate)
          .neq('status', 'deleted')
          .neq('id', requestId)
          .single();

        if (duplicateRequest) {
          return res.status(400).json({
            success: false,
            error: 'Duplicate request: A request for this vegetable on this date already exists',
            code: 'DUPLICATE_REQUEST'
          });
        }
      }

      updates.updated_at = new Date().toISOString();

      const { data: updatedRequest, error: updateError } = await supabaseAdmin
        .from('harvest_requests')
        .update(updates)
        .eq('id', requestId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update harvest request',
          code: 'UPDATE_FAILED'
        });
      }

      console.log('Request updated successfully:', updatedRequest);
      return res.status(200).json({
        success: true,
        message: 'Harvest request updated successfully',
        data: updatedRequest
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}