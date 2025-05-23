class AdminDashboard {
    constructor() {
        this.stats = {
            totalUsers: 0,
            pendingRequests: 0,
            totalVegetables: 0,
            todayRequests: 0
        };
        this.initializeDashboard();
    }

    async initializeDashboard() {
        if (!await this.checkAuthentication()) {
            return;
        }
        
        await this.loadDashboardStats();
        this.setupEventListeners();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || user.role !== 'admin') {
            window.location.href = '/';
            return false;
        }
        
        try {
            const response = await fetch('/api/auth/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('認証失敗');
            }
            
            return true;
        } catch (error) {
            console.error('認証エラー:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
            return false;
        }
    }

    async loadDashboardStats() {
        try {
            const token = localStorage.getItem('token');
            
            const [usersRes, requestsRes, vegetablesRes] = await Promise.all([
                fetch('/api/admin/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/harvest-requests', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/vegetables', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const users = await usersRes.json();
            const requests = await requestsRes.json();
            const vegetables = await vegetablesRes.json();

            this.stats.totalUsers = users.length;
            this.stats.totalVegetables = vegetables.length;
            this.stats.pendingRequests = requests.filter(r => r.status === 'pending').length;
            
            const today = new Date().toISOString().split('T')[0];
            this.stats.todayRequests = requests.filter(r => 
                r.created_at && r.created_at.startsWith(today)
            ).length;

            this.updateStatsDisplay();
        } catch (error) {
            console.error('統計データ取得エラー:', error);
            this.showError('統計データの取得に失敗しました');
        }
    }

    updateStatsDisplay() {
        document.getElementById('totalUsers').textContent = this.stats.totalUsers;
        document.getElementById('activeUsers').textContent = this.stats.totalUsers; // For now, assume all users are active
        document.getElementById('pendingRequests').textContent = this.stats.pendingRequests;
        document.getElementById('totalVegetables').textContent = this.stats.totalVegetables;
        document.getElementById('todayRequests').textContent = this.stats.todayRequests;
        
        this.loadRecentData();
    }

    setupEventListeners() {
        document.getElementById('logout-btn')?.addEventListener('click', this.logout);
        
        document.getElementById('calendarReportBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showCalendarReportModal();
        });

        document.getElementById('reminderBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showReminderModal();
        });
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    showAnnouncementModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>お知らせ送信</h3>
                <form id="announcementForm">
                    <div class="form-group">
                        <label for="announcementTitle">タイトル:</label>
                        <input type="text" id="announcementTitle" required>
                    </div>
                    <div class="form-group">
                        <label for="announcementMessage">メッセージ:</label>
                        <textarea id="announcementMessage" rows="4" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="sendToLine" checked>
                            LINEでも送信する
                        </label>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">送信</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">キャンセル</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        modal.querySelector('.close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('announcementForm').onsubmit = async (e) => {
            e.preventDefault();
            await this.sendAnnouncement();
            modal.remove();
        };
    }

    async sendAnnouncement() {
        try {
            const title = document.getElementById('announcementTitle').value;
            const message = document.getElementById('announcementMessage').value;
            const sendToLine = document.getElementById('sendToLine').checked;
            const token = localStorage.getItem('token');

            const response = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    message,
                    send_to_line: sendToLine
                })
            });

            if (response.ok) {
                this.showSuccess('お知らせを送信しました');
            } else {
                throw new Error('送信に失敗しました');
            }
        } catch (error) {
            console.error('お知らせ送信エラー:', error);
            this.showError('お知らせの送信に失敗しました');
        }
    }

    showReminderModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>リマインダー設定</h3>
                <form id="reminderForm">
                    <div class="form-group">
                        <label for="reminderMessage">メッセージ:</label>
                        <textarea id="reminderMessage" rows="3" placeholder="野菜の収穫申請をお忘れなく！" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="reminderDate">送信日時:</label>
                        <input type="datetime-local" id="reminderDate" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">設定</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">キャンセル</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        const now = new Date();
        now.setHours(now.getHours() + 1);
        document.getElementById('reminderDate').value = now.toISOString().slice(0, 16);

        modal.querySelector('.close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('reminderForm').onsubmit = async (e) => {
            e.preventDefault();
            await this.setReminder();
            modal.remove();
        };
    }

    async setReminder() {
        try {
            const message = document.getElementById('reminderMessage').value;
            const scheduledAt = document.getElementById('reminderDate').value;
            const token = localStorage.getItem('token');

            const response = await fetch('/api/admin/reminders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message,
                    scheduled_at: scheduledAt
                })
            });

            if (response.ok) {
                this.showSuccess('リマインダーを設定しました');
            } else {
                throw new Error('設定に失敗しました');
            }
        } catch (error) {
            console.error('リマインダー設定エラー:', error);
            this.showError('リマインダーの設定に失敗しました');
        }
    }

    async loadRecentData() {
        try {
            const token = localStorage.getItem('token');
            
            const [requestsRes, announcementsRes] = await Promise.all([
                fetch('/api/admin/harvest-requests?limit=5', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/announcements?limit=3', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (requestsRes.ok && announcementsRes.ok) {
                const recentRequests = await requestsRes.json();
                const recentAnnouncements = await announcementsRes.json();
                
                this.renderRecentRequests(recentRequests.slice(0, 5));
                this.renderRecentAnnouncements(recentAnnouncements.slice(0, 3));
            }
        } catch (error) {
            console.error('最近のデータ取得エラー:', error);
        }
    }

    renderRecentRequests(requests) {
        const list = document.getElementById('recentRequestsList');
        if (!list) return;

        if (requests.length === 0) {
            list.innerHTML = '<li class="empty-state">最近の申請はありません</li>';
            return;
        }

        list.innerHTML = requests.map(request => `
            <li class="list-item">
                <div class="item-header">
                    <span class="item-title">${request.vegetable_name || '不明な野菜'}</span>
                    <span class="item-badge">${request.quantity || 0}</span>
                </div>
                <div class="item-details">
                    <span>${request.user_name || '不明なユーザー'}</span>
                    <span>${this.formatDate(request.harvest_date)}</span>
                </div>
            </li>
        `).join('');
    }

    renderRecentAnnouncements(announcements) {
        const list = document.getElementById('recentAnnouncementsList');
        if (!list) return;

        if (announcements.length === 0) {
            list.innerHTML = '<li class="empty-state">最近のお知らせはありません</li>';
            return;
        }

        list.innerHTML = announcements.map(announcement => `
            <li class="list-item">
                <div class="item-header">
                    <span class="item-title">${announcement.title || '(タイトルなし)'}</span>
                    <span class="item-badge">${announcement.sent_to_line ? 'LINE送信済み' : 'システムのみ'}</span>
                </div>
                <div class="item-details">
                    <span>${this.truncateText(announcement.message || '', 40)}</span>
                    <span>${this.formatDate(announcement.created_at)}</span>
                </div>
            </li>
        `).join('');
    }

    showCalendarReportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>カレンダー帳票生成</h3>
                <form id="calendarReportForm">
                    <div class="form-group">
                        <label for="reportMonth">対象月:</label>
                        <input type="month" id="reportMonth" required>
                    </div>
                    <div class="form-group">
                        <label for="reportFormat">出力形式:</label>
                        <select id="reportFormat" required>
                            <option value="csv">CSV形式</option>
                            <option value="pdf">PDF形式</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">生成・ダウンロード</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">キャンセル</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        // Set default month to current month
        const now = new Date();
        document.getElementById('reportMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        modal.querySelector('.close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('calendarReportForm').onsubmit = async (e) => {
            e.preventDefault();
            await this.generateCalendarReport();
            modal.remove();
        };
    }

    async generateCalendarReport() {
        try {
            const month = document.getElementById('reportMonth').value;
            const format = document.getElementById('reportFormat').value;
            const token = localStorage.getItem('token');

            const response = await fetch(`/api/admin/reports/calendar?month=${month}&format=${format}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `calendar-report-${month}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showSuccess('カレンダー帳票を生成しました');
            } else {
                throw new Error('帳票生成に失敗しました');
            }
        } catch (error) {
            console.error('カレンダー帳票生成エラー:', error);
            this.showError('カレンダー帳票の生成に失敗しました');
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP');
    }

    async exportReport() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/export/report', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `harvest-report-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showSuccess('レポートをダウンロードしました');
            } else {
                throw new Error('エクスポートに失敗しました');
            }
        } catch (error) {
            console.error('レポートエクスポートエラー:', error);
            this.showError('レポートのエクスポートに失敗しました');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '1000',
            backgroundColor: type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});