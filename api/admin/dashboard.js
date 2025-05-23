const { withCors } = require('../utils/cors');
const { requireAdmin } = require('../utils/auth');
const { supabaseService } = require('../config/supabase');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 並行で各種データを取得
    const [users, vegetables, harvestRequests, oriconRentals, notifications] = await Promise.all([
      supabaseService.getAllUsers(),
      supabaseService.getVegetableItems(),
      supabaseService.getAllHarvestRequests(),
      supabaseService.getAllOriconRentals(),
      supabaseService.getNotifications()
    ]);

    // ユーザー統計
    const userStats = {
      total: users.length,
      active: users.filter(user => user.status === 'active').length,
      inactive: users.filter(user => user.status === 'inactive').length,
      admins: users.filter(user => user.role === 'admin').length
    };

    // 集荷申請統計
    const harvestStats = {
      total: harvestRequests.length,
      pending: harvestRequests.filter(req => req.status === 'pending').length,
      approved: harvestRequests.filter(req => req.status === 'approved').length,
      rejected: harvestRequests.filter(req => req.status === 'rejected').length,
      completed: harvestRequests.filter(req => req.status === 'completed').length
    };

    // オリコン貸出統計
    const oriconStats = {
      total: oriconRentals.length,
      pending: oriconRentals.filter(rental => rental.status === 'pending').length,
      approved: oriconRentals.filter(rental => rental.status === 'approved').length,
      completed: oriconRentals.filter(rental => rental.status === 'completed').length
    };

    // 最近のアクティビティ（直近7日間）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentActivity = {
      newUsers: users.filter(user => new Date(user.created_at) >= sevenDaysAgo).length,
      newHarvestRequests: harvestRequests.filter(req => new Date(req.created_at) >= sevenDaysAgo).length,
      newOriconRentals: oriconRentals.filter(rental => new Date(rental.created_at) >= sevenDaysAgo).length
    };

    // 今日の集荷予定
    const today = new Date().toISOString().split('T')[0];
    const todayHarvests = harvestRequests.filter(req => 
      req.delivery_date === today && (req.status === 'approved' || req.status === 'pending')
    );

    // 今日のオリコン受取予定
    const todayPickups = oriconRentals.filter(rental => 
      rental.pickup_date === today && (rental.status === 'approved' || rental.status === 'pending')
    );

    // 野菜品目別統計
    const vegetableStats = vegetables.map(vegetable => {
      const requestCount = harvestRequests.filter(req => req.vegetable_item === vegetable.item_name).length;
      const totalQuantity = harvestRequests
        .filter(req => req.vegetable_item === vegetable.item_name)
        .reduce((sum, req) => sum + (req.quantity || 0), 0);
      
      return {
        item_name: vegetable.item_name,
        request_count: requestCount,
        total_quantity: totalQuantity
      };
    }).sort((a, b) => b.request_count - a.request_count); // リクエスト数でソート

    const dashboardData = {
      summary: {
        users: userStats,
        harvest: harvestStats,
        oricon: oriconStats,
        vegetables: vegetables.length,
        notifications: notifications.length
      },
      recentActivity,
      todaySchedule: {
        harvests: todayHarvests.map(req => ({
          id: req.id,
          user_name: req.user_name,
          vegetable_item: req.vegetable_item,
          quantity: req.quantity,
          status: req.status
        })),
        pickups: todayPickups.map(pickup => ({
          id: pickup.id,
          user_name: pickup.user_name,
          quantity: pickup.quantity,
          status: pickup.status
        }))
      },
      vegetableStats: vegetableStats.slice(0, 10), // 上位10品目
      lastUpdated: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('ダッシュボードデータ取得エラー:', error);
    res.status(500).json({ 
      error: 'ダッシュボードデータの取得中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = withCors(requireAdmin(handler));