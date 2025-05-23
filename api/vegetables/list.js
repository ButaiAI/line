import { supabaseAdmin } from '../../lib/supabase.js';
import { handleCors } from '../../lib/cors.js';

export default async function handler(req, res) {
  if (!handleCors(req, res)) return;

  console.log(`[${new Date().toISOString()}] ${req.method} /api/vegetables/list - Start`);

  if (req.method !== 'GET') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    console.log('Fetching active vegetables from database');

    const { data: vegetables, error } = await supabaseAdmin
      .from('vegetable_master')
      .select('id, item_name, created_at, updated_at')
      .eq('active', true)
      .order('item_name', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch vegetables',
        code: 'DATABASE_ERROR'
      });
    }

    console.log(`Retrieved ${vegetables?.length || 0} vegetables`);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    return res.status(200).json({
      success: true,
      data: vegetables || [],
      count: vegetables?.length || 0
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