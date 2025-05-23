const { createResponse, verifyAuth } = require('../../utils/response');
const { SupabaseService } = require('../../config/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return createResponse(res, 405, { error: 'Method not allowed' });
    }

    try {
        const user = await verifyAuth(req);
        if (!user || user.role !== 'admin') {
            return createResponse(res, 403, { error: 'Admin access required' });
        }

        const { month, format = 'csv' } = req.query;
        
        if (!month) {
            return createResponse(res, 400, { error: 'Month parameter is required (YYYY-MM format)' });
        }

        const supabase = new SupabaseService();
        
        // Parse month and get date range
        const [year, monthNum] = month.split('-');
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0); // Last day of month
        
        // Get harvest requests for the month
        const harvestRequests = await supabase.getHarvestRequestsByDateRange(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        // Get oricon requests for the month
        const oriconRequests = await supabase.getOriconRequestsByDateRange(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        if (format === 'csv') {
            const csvContent = generateCSVReport(harvestRequests, oriconRequests, month);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="calendar-report-${month}.csv"`);
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
            
            return res.status(200).send(csvContent);
        } else if (format === 'pdf') {
            // For PDF generation, we'd need a PDF library like puppeteer or pdfkit
            // For now, return an error indicating PDF is not yet supported
            return createResponse(res, 400, { error: 'PDF format is not yet supported. Please use CSV format.' });
        } else {
            return createResponse(res, 400, { error: 'Invalid format. Supported formats: csv, pdf' });
        }

    } catch (error) {
        console.error('Calendar report generation error:', error);
        return createResponse(res, 500, { error: 'Failed to generate calendar report' });
    }
};

function generateCSVReport(harvestRequests, oriconRequests, month) {
    const headers = [
        'タイプ',
        '日付', 
        'ユーザー名',
        '野菜/アイテム',
        '数量',
        'ステータス',
        '備考'
    ];

    const rows = [];
    
    // Add harvest requests
    harvestRequests.forEach(request => {
        rows.push([
            '収穫申請',
            request.harvest_date || '-',
            request.user_name || 'Unknown',
            request.vegetable_name || 'Unknown',
            request.quantity || 0,
            getStatusText(request.status),
            request.notes || ''
        ]);
    });

    // Add oricon requests
    oriconRequests.forEach(request => {
        rows.push([
            'オリコンレンタル',
            request.rental_date || '-',
            request.user_name || 'Unknown',
            `オリコン (返却予定: ${request.return_date || '-'})`,
            request.quantity || 0,
            getStatusText(request.status),
            request.notes || ''
        ]);
    });

    // Sort by date
    rows.sort((a, b) => {
        const dateA = new Date(a[1]);
        const dateB = new Date(b[1]);
        return dateA - dateB;
    });

    // Create CSV content
    const csvRows = [headers, ...rows];
    return csvRows.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

function getStatusText(status) {
    const statusTexts = {
        'pending': '申請中',
        'approved': '承認済み',
        'rejected': '拒否',
        'completed': '完了'
    };
    return statusTexts[status] || status;
}