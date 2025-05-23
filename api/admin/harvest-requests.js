import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken } from '../middleware/auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const user = await verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (req.method === 'GET') {
      const { data: requests, error } = await supabaseAdmin
        .from('harvest_requests')
        .select(`
          *,
          users!inner(name),
          vegetables!inner(name)
        `)
        .order('delivery_date', { ascending: true });

      if (error) {
        console.error('Error fetching harvest requests:', error);
        return res.status(500).json({ error: 'Failed to fetch harvest requests' });
      }

      // Transform the data to include user and vegetable names
      const transformedRequests = requests.map(request => ({
        ...request,
        user_name: request.users.name,
        vegetable_item: request.vegetables.name
      }));

      return res.status(200).json(transformedRequests);
    }

    if (req.method === 'PUT') {
      const { id } = req.query;
      const { status, admin_notes } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Request ID is required' });
      }

      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const { data, error } = await supabaseAdmin
        .from('harvest_requests')
        .update({
          status,
          admin_notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating harvest request:', error);
        return res.status(500).json({ error: 'Failed to update harvest request' });
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}