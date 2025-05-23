import { supabaseAdmin } from '../../lib/supabase.js';
import { verifyAuth } from '../../lib/auth.js';
import { handleCors } from '../../lib/cors.js';

export default async function handler(req, res) {
  if (!handleCors(req, res)) return;

  console.log(`[${new Date().toISOString()}] ${req.method} /api/vegetables/delete - Start`);
  console.log('Request query:', req.query);

  if (req.method !== 'DELETE') {
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

    if (user.role !== 'admin') {
      console.log('Admin access denied:', { userId: user.id, role: user.role });
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_ACCESS_DENIED'
      });
    }

    console.log('Admin authenticated:', { id: user.id, name: user.name });

    const { id } = req.query;
    const vegetableId = parseInt(id, 10);

    if (!vegetableId || isNaN(vegetableId)) {
      console.log('Invalid vegetable ID:', id);
      return res.status(400).json({
        success: false,
        error: 'Invalid vegetable ID',
        code: 'INVALID_VEGETABLE_ID'
      });
    }

    const { data: existingVegetable, error: fetchError } = await supabaseAdmin
      .from('vegetable_master')
      .select('*')
      .eq('id', vegetableId)
      .eq('active', true)
      .single();

    if (fetchError || !existingVegetable) {
      console.log('Vegetable not found:', { vegetableId, error: fetchError });
      return res.status(404).json({
        success: false,
        error: 'Vegetable not found',
        code: 'VEGETABLE_NOT_FOUND'
      });
    }

    console.log('Checking for harvest requests using this vegetable:', existingVegetable.item_name);

    const { data: harvestRequests, error: harvestCheckError } = await supabaseAdmin
      .from('harvest_requests')
      .select('id, vegetable_item')
      .eq('vegetable_item', existingVegetable.item_name)
      .neq('status', 'deleted');

    if (harvestCheckError) {
      console.error('Error checking harvest requests:', harvestCheckError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check harvest requests',
        code: 'HARVEST_CHECK_FAILED'
      });
    }

    if (harvestRequests && harvestRequests.length > 0) {
      console.log('Vegetable is in use by harvest requests:', harvestRequests.length);
      return res.status(409).json({
        success: false,
        error: 'Cannot delete vegetable: it is being used in harvest requests',
        code: 'VEGETABLE_IN_USE',
        details: {
          requestCount: harvestRequests.length
        }
      });
    }

    console.log('Performing logical deletion of vegetable:', vegetableId);

    const { data: deletedVegetable, error: deleteError } = await supabaseAdmin
      .from('vegetable_master')
      .update({
        active: false,
        deleted_at: new Date().toISOString()
      })
      .eq('id', vegetableId)
      .select('*')
      .single();

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete vegetable',
        code: 'DELETE_FAILED'
      });
    }

    console.log('Vegetable deleted successfully:', deletedVegetable);
    return res.status(200).json({
      success: true,
      message: 'Vegetable deleted successfully',
      data: {
        id: vegetableId,
        item_name: deletedVegetable.item_name,
        status: 'deleted'
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}