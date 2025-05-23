import { supabaseAdmin } from '../config/supabase.js';
import { extractUserFromRequest } from '../utils/auth.js';
import { handleCors } from '../utils/cors.js';

/**
 * 集荷申請一覧取得API
 * GET /api/harvest/list
 * 
 * 集荷申請の一覧を取得する
 * JWT認証必須、権限ベースアクセス制御、フィルタリング・ページネーション対応
 */

export default async function handler(req, res) {
  try {
    // CORS処理
    if (handleCors(req, res)) {
      return;
    }
    
    console.log(`Harvest list request: ${req.method} from ${req.headers.origin}`);
    
    // GET以外は許可しない
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only GET is supported.',
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
      console.warn(`Inactive user attempted to access harvest list: ${user.id}`);
      return res.status(403).json({
        success: false,
        error: 'User account is not active',
        code: 'USER_INACTIVE'
      });
    }
    
    console.log(`Processing harvest list request for user: ${user.id} (${user.userName})`);
    
    // クエリパラメータの取得
    const {
      user_id,
      start_date,
      end_date,
      status,
      limit = '50',
      offset = '0'
    } = req.query;
    
    // パラメータのバリデーション
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({
        success: false,
        error: 'limit must be a number between 1 and 1000',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'offset must be a non-negative number',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // 日付フィルターのバリデーション
    if (start_date && isNaN(new Date(start_date).getTime())) {
      return res.status(400).json({
        success: false,
        error: 'start_date must be a valid date',
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (end_date && isNaN(new Date(end_date).getTime())) {
      return res.status(400).json({
        success: false,
        error: 'end_date must be a valid date',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // ステータスフィルターのバリデーション
    const validStatuses = ['pending', 'approved', 'rejected', 'deleted'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${validStatuses.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }
    
    // アクセス権限のチェック
    let targetUserId = user.id; // デフォルトは自分の申請
    
    if (user_id) {
      const requestedUserId = parseInt(user_id, 10);
      
      if (isNaN(requestedUserId)) {
        return res.status(400).json({
          success: false,
          error: 'user_id must be a valid number',
          code: 'VALIDATION_ERROR'
        });
      }
      
      // 他人の申請を見るには管理者権限が必要
      if (requestedUserId !== user.id && user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view your own requests.',
          code: 'ACCESS_DENIED'
        });
      }
      
      targetUserId = requestedUserId;
    }
    
    console.log('Query parameters validated:', {
      targetUserId,
      start_date,
      end_date,
      status,
      limit: limitNum,
      offset: offsetNum
    });
    
    // 申請一覧の取得
    try {
      let query = supabaseAdmin.from('harvest_requests').select(`
        id,
        user_id,
        vegetable_item,
        delivery_date,
        quantity,
        status,
        created_at,
        updated_at
      `);
      
      // 管理者でない場合は自分の申請のみに限定
      if (user.role !== 'admin' || user_id) {
        query = query.eq('user_id', targetUserId);
      }
      
      // 削除済みは表示しない（管理者の特別な要求がない限り）
      if (status !== 'deleted') {
        query = query.neq('status', 'deleted');
      }
      
      // フィルタリング
      if (start_date) {
        query = query.gte('delivery_date', start_date);
      }
      
      if (end_date) {
        query = query.lte('delivery_date', end_date);
      }
      
      if (status) {
        query = query.eq('status', status);
      }
      
      // 並び替え（delivery_date降順）
      query = query.order('delivery_date', { ascending: false });
      
      // ページネーション
      query = query.range(offsetNum, offsetNum + limitNum - 1);
      
      const { data: requests, error: queryError } = await query;
      
      if (queryError) {
        console.error('Error fetching harvest requests:', queryError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch harvest requests',
          code: 'DATABASE_ERROR',
          details: process.env.NODE_ENV === 'development' ? queryError.message : undefined
        });
      }
      
      // 総件数の取得（ページネーション用）
      let countQuery = supabaseAdmin.from('harvest_requests').select('id', { count: 'exact', head: true });
      
      // 同じフィルタリング条件を適用
      if (user.role !== 'admin' || user_id) {
        countQuery = countQuery.eq('user_id', targetUserId);
      }
      
      if (status !== 'deleted') {
        countQuery = countQuery.neq('status', 'deleted');
      }
      
      if (start_date) {
        countQuery = countQuery.gte('delivery_date', start_date);
      }
      
      if (end_date) {
        countQuery = countQuery.lte('delivery_date', end_date);
      }
      
      if (status) {
        countQuery = countQuery.eq('status', status);
      }
      
      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.warn('Error getting count:', countError);
      }
      
      // 管理者の場合はユーザー名も取得
      let enrichedRequests = requests || [];
      
      if (user.role === 'admin' && !user_id && enrichedRequests.length > 0) {
        try {
          const userIds = [...new Set(enrichedRequests.map(r => r.user_id))];
          
          const { data: users, error: usersError } = await supabaseAdmin
            .from('users')
            .select('id, user_name')
            .in('id', userIds);
          
          if (!usersError && users) {
            const userMap = users.reduce((acc, user) => {
              acc[user.id] = user.user_name;
              return acc;
            }, {});
            
            enrichedRequests = enrichedRequests.map(request => ({
              ...request,
              user_name: userMap[request.user_id] || 'Unknown User'
            }));
          }
        } catch (enrichError) {
          console.warn('Error enriching requests with user names:', enrichError);
        }
      }
      
      console.log(`Retrieved ${enrichedRequests.length} harvest requests (total: ${count || 'unknown'})`);
      
      // 成功レスポンス
      return res.status(200).json({
        success: true,
        data: enrichedRequests,
        pagination: {
          total: count || 0,
          limit: limitNum,
          offset: offsetNum,
          has_more: (count || 0) > offsetNum + limitNum
        },
        filters: {
          user_id: targetUserId !== user.id ? targetUserId : undefined,
          start_date,
          end_date,
          status
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Database query error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch harvest requests',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
  } catch (error) {
    console.error('Unexpected error in harvest list handler:', error);
    
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
 * 日付範囲の妥当性をチェックするヘルパー関数
 * @param {string} startDate - 開始日
 * @param {string} endDate - 終了日
 * @returns {boolean} 妥当な範囲の場合true
 */
export function isValidDateRange(startDate, endDate) {
  try {
    if (!startDate || !endDate) {
      return true; // 片方だけでもOK
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return start <= end;
  } catch (error) {
    return false;
  }
}

/**
 * ページネーション情報を生成するヘルパー関数
 * @param {number} total - 総件数
 * @param {number} limit - 1ページあたりの件数
 * @param {number} offset - オフセット
 * @returns {Object} ページネーション情報
 */
export function createPaginationInfo(total, limit, offset) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    limit,
    offset,
    current_page: currentPage,
    total_pages: totalPages,
    has_previous: offset > 0,
    has_next: offset + limit < total
  };
}

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.isValidDateRange = isValidDateRange;
  module.exports.createPaginationInfo = createPaginationInfo;
}