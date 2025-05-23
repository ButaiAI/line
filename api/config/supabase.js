import { createClient } from '@supabase/supabase-js';

/**
 * Supabaseクライアント設定
 * 環境変数からSupabase URLとService Keyを取得してクライアントを作成
 */

// 環境変数の存在チェック
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('Error: SUPABASE_URL environment variable is not set');
  throw new Error('SUPABASE_URL environment variable is required');
}

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_KEY environment variable is not set');
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}

// Supabaseクライアントの作成（管理者権限）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 一般ユーザー用のSupabaseクライアント（匿名キー使用）
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
export const supabase = supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Supabase接続テスト
 * @returns {Promise<boolean>} 接続成功時true、失敗時false
 */
export async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error.message);
      return false;
    }
    
    console.log('Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
}

/**
 * ユーザー関連のデータベース操作
 */
export const userOperations = {
  /**
   * LINE IDでユーザーを検索
   * @param {string} lineId - LINE ID
   * @returns {Promise<Object|null>} ユーザーデータまたはnull
   */
  async findByLineId(lineId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('line_id', lineId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error finding user by LINE ID:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error in findByLineId:', error);
      throw error;
    }
  },

  /**
   * 新規ユーザーを作成
   * @param {Object} userData - ユーザーデータ
   * @returns {Promise<Object>} 作成されたユーザーデータ
   */
  async create(userData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert([{
          line_id: userData.lineId,
          user_name: userData.userName,
          status: userData.status || 'active',
          role: userData.role || 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating user:', error);
        throw error;
      }
      
      console.log('User created successfully:', data.id);
      return data;
    } catch (error) {
      console.error('Error in create user:', error);
      throw error;
    }
  },

  /**
   * ユーザー情報を更新
   * @param {string} lineId - LINE ID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Object>} 更新されたユーザーデータ
   */
  async updateByLineId(lineId, updateData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('line_id', lineId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating user:', error);
        throw error;
      }
      
      console.log('User updated successfully:', data.id);
      return data;
    } catch (error) {
      console.error('Error in updateByLineId:', error);
      throw error;
    }
  },

  /**
   * ユーザーを取得または作成
   * @param {Object} userData - ユーザーデータ
   * @returns {Promise<Object>} ユーザーデータ
   */
  async findOrCreate(userData) {
    try {
      // 既存ユーザーを検索
      let user = await this.findByLineId(userData.lineId);
      
      if (user) {
        // 既存ユーザーが見つかった場合、必要に応じて情報を更新
        if (user.user_name !== userData.userName) {
          user = await this.updateByLineId(userData.lineId, {
            user_name: userData.userName
          });
        }
        console.log('Existing user found and updated if needed:', user.id);
      } else {
        // 新規ユーザーを作成
        user = await this.create(userData);
        console.log('New user created:', user.id);
      }
      
      return user;
    } catch (error) {
      console.error('Error in findOrCreate:', error);
      throw error;
    }
  }
};

/**
 * 野菜関連のデータベース操作
 */
export const vegetableOperations = {
  /**
   * 全ての野菜を取得
   * @returns {Promise<Array>} 野菜リスト
   */
  async getAll() {
    try {
      const { data, error } = await supabaseAdmin
        .from('vegetables')
        .select('*')
        .eq('status', 'active')
        .order('name');
      
      if (error) {
        console.error('Error fetching vegetables:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getAll vegetables:', error);
      throw error;
    }
  }
};

/**
 * 集荷申請関連のデータベース操作
 */
export const harvestRequestOperations = {
  /**
   * ユーザーの集荷申請を取得
   * @param {string} userId - ユーザーID
   * @returns {Promise<Array>} 集荷申請リスト
   */
  async getByUser(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('harvest_requests')
        .select(`
          *,
          vegetables (name, unit)
        `)
        .eq('user_id', userId)
        .order('delivery_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching user harvest requests:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getByUser harvest requests:', error);
      throw error;
    }
  }
};

// 既存のクラスベースのサービスを維持（後方互換性のため）
class SupabaseService {
  constructor() {
    this.client = supabaseAdmin;
  }

  async getUserByLineId(lineId) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('line_id', lineId);
    
    if (error) throw error;
    return data;
  }

  async getUserById(userId) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getAllUsers() {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async createUser(userData) {
    const { data, error } = await this.client
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateUserStatus(userId, status) {
    const { data, error } = await this.client
      .from('users')
      .update({ status })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getVegetableItems() {
    const { data, error } = await this.client
      .from('vegetable_master')
      .select('*')
      .order('item_name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  async createVegetableItem(itemName) {
    const { data, error } = await this.client
      .from('vegetable_master')
      .insert({
        item_name: itemName,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateVegetableItem(id, itemName) {
    const { data, error } = await this.client
      .from('vegetable_master')
      .update({ item_name: itemName })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteVegetableItem(id) {
    const { error } = await this.client
      .from('vegetable_master')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }

  async getAllHarvestRequests() {
    try {
      const { data: requests, error: requestsError } = await this.client
        .from('harvest_requests')
        .select('*')
        .order('delivery_date', { ascending: false })
        .limit(1000);
      
      if (requestsError) throw requestsError;
      if (!Array.isArray(requests)) return [];

      const { data: users, error: usersError } = await this.client
        .from('users')
        .select('id, user_name');
      
      if (usersError) {
        console.error('ユーザー情報結合エラー:', usersError);
        return requests;
      }

      const userMap = users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      return requests.map(request => ({
        ...request,
        user_name: userMap[request.user_id]?.user_name || '不明'
      }));
    } catch (error) {
      console.error('集荷情報取得エラー:', error);
      return [];
    }
  }

  async getHarvestRequestsByUser(userId) {
    const { data, error } = await this.client
      .from('harvest_requests')
      .select('*')
      .eq('user_id', userId)
      .order('delivery_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  async createHarvestRequest(requestData) {
    if (!requestData.created_at) {
      requestData.created_at = new Date().toISOString();
    }

    const { data, error } = await this.client
      .from('harvest_requests')
      .insert(requestData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateHarvestRequest(id, updateData) {
    const { data, error } = await this.client
      .from('harvest_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteHarvestRequest(id) {
    const { error } = await this.client
      .from('harvest_requests')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }

  // Additional methods from original file...
  async getAllOriconRentals() {
    try {
      const { data: rentals, error: rentalsError } = await this.client
        .from('oricon_rentals')
        .select('*')
        .order('pickup_date', { ascending: false })
        .limit(1000);
      
      if (rentalsError) throw rentalsError;
      if (!Array.isArray(rentals)) return [];

      const { data: users, error: usersError } = await this.client
        .from('users')
        .select('id, user_name');
      
      if (usersError) {
        console.error('ユーザー情報結合エラー:', usersError);
        return rentals;
      }

      const userMap = users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      return rentals.map(rental => ({
        ...rental,
        user_name: userMap[rental.user_id]?.user_name || '不明'
      }));
    } catch (error) {
      console.error('オリコンレンタル情報取得エラー:', error);
      return [];
    }
  }

  async getOriconRentalsByUser(userId) {
    const { data, error } = await this.client
      .from('oricon_rentals')
      .select('*')
      .eq('user_id', userId)
      .order('pickup_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  async createOriconRental(rentalData) {
    if (!rentalData.created_at) {
      rentalData.created_at = new Date().toISOString();
    }

    const { data, error } = await this.client
      .from('oricon_rentals')
      .insert(rentalData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteOriconRental(id) {
    const { error } = await this.client
      .from('oricon_rentals')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }
}

const supabaseService = new SupabaseService();

// デバッグ用：接続テストを実行
if (process.env.NODE_ENV !== 'production') {
  testSupabaseConnection().catch(console.error);
}

// 新しいES6 exports
export default supabaseAdmin;
export { supabaseService, SupabaseService };

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    supabaseAdmin,
    supabase,
    supabaseService,
    SupabaseService,
    userOperations,
    vegetableOperations,
    harvestRequestOperations
  };
}