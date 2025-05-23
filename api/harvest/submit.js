import { supabaseAdmin } from '../config/supabase.js';
import { extractUserFromRequest } from '../utils/auth.js';
import { handleCors } from '../utils/cors.js';

/**
 * 集荷申請登録API
 * POST /api/harvest/submit
 * 
 * 野菜の集荷申請を登録する
 * JWT認証必須、入力バリデーション、重複チェック実装
 */

export default async function handler(req, res) {
  try {
    // CORS処理
    if (handleCors(req, res)) {
      return;
    }
    
    console.log(`Harvest submit request: ${req.method} from ${req.headers.origin}`);
    
    // POST以外は許可しない
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only POST is supported.',
        code: 'METHOD_NOT_ALLOWED'
      });
    }
    
    // JWT認証
    let user;
    try {
      user = await extractUserFromRequest(req);
    } catch (authError) {
      console.error('Authentication failed:', authError.message);
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // ユーザーがアクティブかチェック
    if (user.status !== 'active') {
      console.warn(`Inactive user attempted to submit harvest request: ${user.id}`);
      return res.status(403).json({
        success: false,
        error: 'User account is not active',
        code: 'USER_INACTIVE'
      });
    }
    
    console.log(`Processing harvest request submission for user: ${user.id} (${user.userName})`);
    
    // リクエストボディの検証
    const { vegetable_item, delivery_date, quantity } = req.body;
    
    // 必須フィールドのチェック
    if (!vegetable_item) {
      return res.status(400).json({
        success: false,
        error: 'vegetable_item is required',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (!delivery_date) {
      return res.status(400).json({
        success: false,
        error: 'delivery_date is required',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (quantity === undefined || quantity === null) {
      return res.status(400).json({
        success: false,
        error: 'quantity is required',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // データ型と形式のバリデーション
    if (typeof vegetable_item !== 'string' || vegetable_item.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'vegetable_item must be a non-empty string',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (vegetable_item.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'vegetable_item must be 50 characters or less',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // 日付のバリデーション
    const deliveryDateObj = new Date(delivery_date);
    if (isNaN(deliveryDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'delivery_date must be a valid date',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // 未来日のみ許可
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deliveryDateObj.setHours(0, 0, 0, 0);
    
    if (deliveryDateObj < today) {
      return res.status(400).json({
        success: false,
        error: 'delivery_date must be today or in the future',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // 数量のバリデーション
    const quantityNum = Number(quantity);
    if (!Number.isInteger(quantityNum) || quantityNum < 1 || quantityNum > 9999) {
      return res.status(400).json({
        success: false,
        error: 'quantity must be an integer between 1 and 9999',
        code: 'VALIDATION_ERROR'
      });
    }
    
    console.log('Validation passed:', { vegetable_item, delivery_date, quantity: quantityNum });
    
    // 野菜品目の存在確認（vegetable_masterテーブルとの照合）
    try {
      const { data: vegetable, error: vegetableError } = await supabaseAdmin
        .from('vegetable_master')
        .select('id, item_name')
        .eq('item_name', vegetable_item.trim())
        .single();
      
      if (vegetableError && vegetableError.code !== 'PGRST116') {
        console.error('Error checking vegetable master:', vegetableError);
        return res.status(500).json({
          success: false,
          error: 'Failed to validate vegetable item',
          code: 'DATABASE_ERROR'
        });
      }
      
      if (!vegetable) {
        return res.status(400).json({
          success: false,
          error: 'Invalid vegetable item. Please select from registered vegetables.',
          code: 'INVALID_VEGETABLE'
        });
      }
      
      console.log('Vegetable validated:', vegetable.item_name);
    } catch (error) {
      console.error('Vegetable validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to validate vegetable item',
        code: 'DATABASE_ERROR'
      });
    }
    
    // 重複申請チェック（同一ユーザー・同一日・同一品目）
    try {
      const { data: existingRequest, error: duplicateError } = await supabaseAdmin
        .from('harvest_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('vegetable_item', vegetable_item.trim())
        .eq('delivery_date', delivery_date)
        .neq('status', 'deleted')
        .single();
      
      if (duplicateError && duplicateError.code !== 'PGRST116') {
        console.error('Error checking for duplicate requests:', duplicateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to check for duplicate requests',
          code: 'DATABASE_ERROR'
        });
      }
      
      if (existingRequest) {
        return res.status(409).json({
          success: false,
          error: 'A request for this vegetable item on this date already exists',
          code: 'DUPLICATE_REQUEST'
        });
      }
    } catch (error) {
      console.error('Duplicate check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check for duplicate requests',
        code: 'DATABASE_ERROR'
      });
    }
    
    // harvest_requestsテーブルに申請を保存
    try {
      const requestData = {
        user_id: user.id,
        vegetable_item: vegetable_item.trim(),
        delivery_date: delivery_date,
        quantity: quantityNum,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: newRequest, error: insertError } = await supabaseAdmin
        .from('harvest_requests')
        .insert([requestData])
        .select()
        .single();
      
      if (insertError) {
        console.error('Error inserting harvest request:', insertError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create harvest request',
          code: 'DATABASE_ERROR',
          details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
        });
      }
      
      console.log(`Harvest request created successfully: ID ${newRequest.id}`);
      
      // 成功レスポンス
      return res.status(201).json({
        success: true,
        message: 'Harvest request submitted successfully',
        data: {
          id: newRequest.id,
          user_id: newRequest.user_id,
          vegetable_item: newRequest.vegetable_item,
          delivery_date: newRequest.delivery_date,
          quantity: newRequest.quantity,
          status: newRequest.status,
          created_at: newRequest.created_at,
          updated_at: newRequest.updated_at
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Database insertion error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create harvest request',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
  } catch (error) {
    console.error('Unexpected error in harvest submit handler:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 日付の妥当性をチェックするヘルパー関数
 * @param {string} dateString - 検証する日付文字列
 * @returns {boolean} 有効な日付の場合true
 */
export function isValidDate(dateString) {
  try {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  } catch (error) {
    return false;
  }
}

/**
 * 日付が未来日かチェックするヘルパー関数
 * @param {string} dateString - 検証する日付文字列
 * @returns {boolean} 今日以降の日付の場合true
 */
export function isFutureOrToday(dateString) {
  try {
    const date = new Date(dateString);
    const today = new Date();
    
    // 時間を0にして日付のみで比較
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    return date >= today;
  } catch (error) {
    return false;
  }
}

/**
 * 野菜品目の妥当性をチェックするヘルパー関数
 * @param {string} vegetableItem - 検証する野菜品目名
 * @returns {Promise<boolean>} 有効な野菜品目の場合true
 */
export async function isValidVegetable(vegetableItem) {
  try {
    const { data, error } = await supabaseAdmin
      .from('vegetable_master')
      .select('id')
      .eq('item_name', vegetableItem)
      .single();
    
    return !error && data;
  } catch (error) {
    console.error('Error validating vegetable:', error);
    return false;
  }
}

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.isValidDate = isValidDate;
  module.exports.isFutureOrToday = isFutureOrToday;
  module.exports.isValidVegetable = isValidVegetable;
}