import { supabaseAdmin } from '../../lib/supabase.js';
import { verifyAuth } from '../../lib/auth.js';
import { handleCors } from '../../lib/cors.js';

function validateItemName(item_name) {
  if (!item_name || typeof item_name !== 'string') {
    return 'Item name is required and must be a string';
  }

  const trimmed = item_name.trim();
  
  if (trimmed.length < 2 || trimmed.length > 50) {
    return 'Item name must be between 2 and 50 characters';
  }

  const validChars = /^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\-]+$/;
  if (!validChars.test(trimmed)) {
    return 'Item name contains invalid characters';
  }

  return null;
}

export default async function handler(req, res) {
  if (!handleCors(req, res)) return;

  console.log(`[${new Date().toISOString()}] ${req.method} /api/vegetables/create - Start`);
  console.log('Request body:', req.body);

  if (req.method !== 'POST') {
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

    const { item_name } = req.body;

    const validationError = validateItemName(item_name);
    if (validationError) {
      console.log('Validation error:', validationError);
      return res.status(400).json({
        success: false,
        error: validationError,
        code: 'VALIDATION_ERROR'
      });
    }

    const trimmedName = item_name.trim();

    const { data: existingVegetable, error: duplicateCheckError } = await supabaseAdmin
      .from('vegetable_master')
      .select('id, item_name')
      .ilike('item_name', trimmedName)
      .eq('active', true)
      .single();

    if (existingVegetable) {
      console.log('Duplicate vegetable found:', existingVegetable);
      return res.status(409).json({
        success: false,
        error: 'A vegetable with this name already exists',
        code: 'DUPLICATE_VEGETABLE'
      });
    }

    const { data: newVegetable, error: insertError } = await supabaseAdmin
      .from('vegetable_master')
      .insert({
        item_name: trimmedName,
        active: true,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create vegetable',
        code: 'INSERT_FAILED'
      });
    }

    console.log('Vegetable created successfully:', newVegetable);
    return res.status(201).json({
      success: true,
      message: 'Vegetable created successfully',
      data: newVegetable
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