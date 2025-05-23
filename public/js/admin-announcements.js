class AdminAnnouncements {
    constructor() {
        this.announcements = [];
        this.reminders = [];
        this.users = [];
        this.currentTab = 'announcements';
        this.initializeAnnouncements();
    }

    async initializeAnnouncements() {
        if (!await this.checkAuthentication()) {
            return;
        }
        
        await this.loadData();
        this.setupEventListeners();
        this.setDefaultReminderDate();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || user.role !== 'admin') {
            window.location.href = '/';
            return false;
        }
        
        return true;
    }

    async loadData() {
        try {
            const token = localStorage.getItem('token');
            
            const [announcementsRes, remindersRes, usersRes] = await Promise.all([
                fetch('/api/admin/announcements', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/reminders', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            this.announcements = await announcementsRes.json();
            this.reminders = await remindersRes.json();
            this.users = await usersRes.json();

            this.loadUsers();
            this.renderCurrentTab();
        } catch (error) {
            console.error('データ取得エラー:', error);
            this.showError('データの取得に失敗しました');
        }
    }

    setupEventListeners() {
        document.getElementById('logout-btn')?.addEventListener('click', this.logout);
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Recipients radio buttons
        document.querySelectorAll('input[name="recipients"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleUserSelection(e.target.value === 'selected');
            });
        });

        // Form submissions
        document.getElementById('announcementForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitAnnouncement();
        });

        document.getElementById('reminderForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitReminder();
        });
    }

    loadUsers() {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;

        const activeUsers = this.users.filter(user => user.status === 'active');
        
        if (activeUsers.length === 0) {
            usersList.innerHTML = '<p style="color: #666; font-size: 0.9rem;">アクティブなユーザーがありません</p>';
            return;
        }

        usersList.innerHTML = activeUsers.map(user => `
            <div class="user-option">
                <input type="checkbox" id="user-${user.id}" name="selectedUsers" value="${user.id}">
                <label for="user-${user.id}">${user.display_name || user.name || 'Unknown'}</label>
            </div>
        `).join('');
    }

    toggleUserSelection(show) {
        const container = document.getElementById('userSelectContainer');
        if (container) {
            container.classList.toggle('hidden', !show);
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tab}Tab`);
        });

        this.renderCurrentTab();
    }

    renderCurrentTab() {
        if (this.currentTab === 'announcements') {
            this.renderAnnouncements();
        } else if (this.currentTab === 'reminders') {
            this.renderReminders();
        }
    }

    renderAnnouncements() {
        const tbody = document.getElementById('announcementsTableBody');
        if (!tbody) return;

        if (this.announcements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">お知らせがありません</td></tr>';
            return;
        }

        tbody.innerHTML = this.announcements.map(announcement => `
            <tr>
                <td>${this.formatDateTime(announcement.created_at)}</td>
                <td>${announcement.title}</td>
                <td class="message-cell">${this.truncateText(announcement.message, 40)}</td>
                <td>
                    <span class="status-badge ${announcement.sent_to_line ? 'status-sent' : 'status-not-sent'}">
                        ${announcement.sent_to_line ? 'LINE送信済み' : 'LINE未送信'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-sm btn-info" onclick="adminAnnouncements.viewAnnouncementDetails(${announcement.id})">
                        詳細
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="adminAnnouncements.editAnnouncement(${announcement.id})">
                        編集
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminAnnouncements.deleteAnnouncement(${announcement.id})">
                        削除
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderReminders() {
        const tbody = document.getElementById('remindersTableBody');
        if (!tbody) return;

        if (this.reminders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">リマインダーがありません</td></tr>';
            return;
        }

        tbody.innerHTML = this.reminders.map(reminder => `
            <tr>
                <td class="message-cell">${this.truncateText(reminder.message, 40)}</td>
                <td>${this.formatDateTime(reminder.scheduled_at)}</td>
                <td>
                    <span class="status-badge status-${reminder.status}">
                        ${this.getReminderStatusText(reminder.status)}
                    </span>
                </td>
                <td>${this.formatDateTime(reminder.created_at)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-info" onclick="adminAnnouncements.viewReminderDetails(${reminder.id})">
                        詳細
                    </button>
                    ${reminder.status === 'pending' ? `
                        <button class="btn btn-sm btn-primary" onclick="adminAnnouncements.editReminder(${reminder.id})">
                            編集
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="adminAnnouncements.cancelReminder(${reminder.id})">
                            キャンセル
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger" onclick="adminAnnouncements.deleteReminder(${reminder.id})">
                        削除
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async submitAnnouncement() {
        try {
            const title = document.getElementById('announcementTitle').value;
            const content = document.getElementById('announcementContent').value;
            const recipients = document.querySelector('input[name="recipients"]:checked').value;
            const sendToLine = document.getElementById('sendToLine').checked;
            
            let selectedUsers = [];
            if (recipients === 'selected') {
                const checkboxes = document.querySelectorAll('input[name="selectedUsers"]:checked');
                if (checkboxes.length === 0) {
                    this.showError('送信先のユーザーを選択してください');
                    return;
                }
                selectedUsers = Array.from(checkboxes).map(cb => cb.value);
            }

            if (!confirm('お知らせを送信してよろしいですか？')) {
                return;
            }

            const submitBtn = document.getElementById('submitAnnouncementBtn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '送信中...';
            
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    message: content,
                    recipients,
                    selected_users: selectedUsers,
                    send_to_line: sendToLine
                })
            });

            if (response.ok) {
                this.showSuccess('お知らせを送信しました');
                document.getElementById('announcementForm').reset();
                document.getElementById('recipients-all').checked = true;
                document.getElementById('sendToLine').checked = true;
                this.toggleUserSelection(false);
                await this.loadData();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'お知らせ送信に失敗しました');
            }
        } catch (error) {
            console.error('お知らせ送信エラー:', error);
            this.showError(error.message || 'お知らせの送信に失敗しました');
        } finally {
            const submitBtn = document.getElementById('submitAnnouncementBtn');
            submitBtn.disabled = false;
            submitBtn.textContent = '送信';
        }
    }

    async submitReminder() {
        try {
            const message = document.getElementById('reminderMessage').value;
            const scheduledAt = document.getElementById('reminderDate').value;
            
            if (!message.trim()) {
                this.showError('メッセージを入力してください');
                return;
            }
            
            if (!scheduledAt) {
                this.showError('送信日時を選択してください');
                return;
            }

            const submitBtn = document.getElementById('submitReminderBtn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '設定中...';
            
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
                document.getElementById('reminderForm').reset();
                this.setDefaultReminderDate();
                await this.loadData();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'リマインダー設定に失敗しました');
            }
        } catch (error) {
            console.error('リマインダー設定エラー:', error);
            this.showError(error.message || 'リマインダーの設定に失敗しました');
        } finally {
            const submitBtn = document.getElementById('submitReminderBtn');
            submitBtn.disabled = false;
            submitBtn.textContent = '設定';
        }
    }

    setDefaultReminderDate() {
        const reminderDateInput = document.getElementById('reminderDate');
        if (reminderDateInput) {
            const now = new Date();
            now.setHours(now.getHours() + 1);
            reminderDateInput.value = now.toISOString().slice(0, 16);
        }
    }

    // Modal and action methods for viewing/editing
    viewAnnouncementDetails(announcementId) {
        const announcement = this.announcements.find(a => a.id === announcementId);
        if (!announcement) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>お知らせ詳細</h3>
                <div class="detail-content">
                    <div class="detail-row">
                        <label>タイトル:</label>
                        <span>${announcement.title}</span>
                    </div>
                    <div class="detail-row">
                        <label>メッセージ:</label>
                        <div class="message-content">${announcement.message}</div>
                    </div>
                    <div class="detail-row">
                        <label>LINE送信:</label>
                        <span class="status-badge ${announcement.sent_to_line ? 'status-sent' : 'status-not-sent'}">
                            ${announcement.sent_to_line ? '送信済み' : '未送信'}
                        </span>
                    </div>
                    <div class="detail-row">
                        <label>作成日時:</label>
                        <span>${this.formatDateTime(announcement.created_at)}</span>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">閉じる</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        modal.querySelector('.close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    editAnnouncement(announcementId) {
        // Placeholder for edit functionality
        this.showError('編集機能は今後実装予定です');
    }

    async deleteAnnouncement(announcementId) {
        if (!confirm('このお知らせを削除しますか？')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/announcements/${announcementId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.showSuccess('お知らせを削除しました');
                await this.loadData();
            } else {
                throw new Error('お知らせ削除に失敗しました');
            }
        } catch (error) {
            console.error('お知らせ削除エラー:', error);
            this.showError('お知らせの削除に失敗しました');
        }
    }

    viewReminderDetails(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (!reminder) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>リマインダー詳細</h3>
                <div class="detail-content">
                    <div class="detail-row">
                        <label>メッセージ:</label>
                        <div class="message-content">${reminder.message}</div>
                    </div>
                    <div class="detail-row">
                        <label>送信予定日時:</label>
                        <span>${this.formatDateTime(reminder.scheduled_at)}</span>
                    </div>
                    <div class="detail-row">
                        <label>ステータス:</label>
                        <span class="status-badge status-${reminder.status}">
                            ${this.getReminderStatusText(reminder.status)}
                        </span>
                    </div>
                    <div class="detail-row">
                        <label>作成日時:</label>
                        <span>${this.formatDateTime(reminder.created_at)}</span>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">閉じる</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        modal.querySelector('.close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    editReminder(reminderId) {
        // Placeholder for edit functionality
        this.showError('編集機能は今後実装予定です');
    }

    async cancelReminder(reminderId) {
        if (!confirm('このリマインダーをキャンセルしますか？')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/reminders/${reminderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'cancelled' })
            });

            if (response.ok) {
                this.showSuccess('リマインダーをキャンセルしました');
                await this.loadData();
            } else {
                throw new Error('リマインダーキャンセルに失敗しました');
            }
        } catch (error) {
            console.error('リマインダーキャンセルエラー:', error);
            this.showError('リマインダーのキャンセルに失敗しました');
        }
    }

    async deleteReminder(reminderId) {
        if (!confirm('このリマインダーを削除しますか？')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/reminders/${reminderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.showSuccess('リマインダーを削除しました');
                await this.loadData();
            } else {
                throw new Error('リマインダー削除に失敗しました');
            }
        } catch (error) {
            console.error('リマインダー削除エラー:', error);
            this.showError('リマインダーの削除に失敗しました');
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('ja-JP');
    }

    getReminderStatusText(status) {
        const statusTexts = {
            'pending': '送信待ち',
            'sent': '送信済み',
            'cancelled': 'キャンセル'
        };
        return statusTexts[status] || status;
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

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
            zIndex: '1001',
            maxWidth: '400px',
            backgroundColor: type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'slideIn 0.3s ease-out'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
}

let adminAnnouncements;

document.addEventListener('DOMContentLoaded', () => {
    adminAnnouncements = new AdminAnnouncements();
});