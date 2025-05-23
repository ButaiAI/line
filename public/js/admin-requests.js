class AdminRequests {
    constructor() {
        this.harvestRequests = [];
        this.oriconRequests = [];
        this.users = [];
        this.vegetables = [];
        this.currentFilter = 'all';
        this.currentTab = 'harvest';
        this.currentSortColumn = 'created_at';
        this.currentSortDirection = 'desc';
        this.currentSearchQuery = '';
        this.initializeRequests();
    }

    async initializeRequests() {
        if (!await this.checkAuthentication()) {
            return;
        }
        
        await this.loadRequests();
        this.setupEventListeners();
        this.setupFilters();
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

    async loadRequests() {
        try {
            const token = localStorage.getItem('token');
            
            const [harvestRes, oriconRes, usersRes, vegetablesRes] = await Promise.all([
                fetch('/api/admin/harvest-requests', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/oricon-requests', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/vegetables', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            this.harvestRequests = await harvestRes.json();
            this.oriconRequests = await oriconRes.json();
            this.users = await usersRes.json();
            this.vegetables = await vegetablesRes.json();

            this.loadFilterOptions();
            this.renderRequests();
        } catch (error) {
            console.error('リクエスト取得エラー:', error);
            this.showError('リクエストの取得に失敗しました');
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

        // Filter controls
        document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            this.clearFilters();
        });

        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            this.refreshData();
        });

        // Filter inputs - apply on Enter key
        ['deliveryDateFilter', 'requestDateFilter'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
        });

        // Search input with real-time search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchRequests(e.target.value);
            });
        }

        // Sortable column headers
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.sortTable(column);
            });
        });
    }

    setupFilters() {
        // Auto-apply filters on value change
        ['deliveryDateFilter', 'requestDateFilter', 'userFilter', 'vegetableFilter', 'statusFilter'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.applyFilters();
                });
            }
        });
    }

    loadFilterOptions() {
        // Load users into filter
        const userFilter = document.getElementById('userFilter');
        if (userFilter) {
            userFilter.innerHTML = '<option value="">すべて</option>';
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.display_name || user.name || 'Unknown';
                userFilter.appendChild(option);
            });
        }

        // Load vegetables into filter
        const vegetableFilter = document.getElementById('vegetableFilter');
        if (vegetableFilter) {
            vegetableFilter.innerHTML = '<option value="">すべて</option>';
            this.vegetables.forEach(vegetable => {
                const option = document.createElement('option');
                option.value = vegetable.item_name;
                option.textContent = vegetable.item_name;
                vegetableFilter.appendChild(option);
            });
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

        this.renderRequests();
    }

    renderRequests() {
        if (this.currentTab === 'harvest') {
            this.renderHarvestRequests();
        } else {
            this.renderOriconRequests();
        }
        this.updateResultsCount();
    }

    renderHarvestRequests() {
        const tbody = document.getElementById('harvestTableBody');
        if (!tbody) return;

        const filteredRequests = this.applyCurrentFilters(this.harvestRequests);
        const sortedRequests = this.applySorting(filteredRequests);
        
        if (sortedRequests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">条件に一致する申請がありません</td></tr>';
            return;
        }

        tbody.innerHTML = sortedRequests.map(request => `
            <tr data-id="${request.id}" data-harvest-date="${request.harvest_date}" data-created-at="${request.created_at}" data-user="${request.user_id}" data-vegetable="${request.vegetable_name}" data-status="${request.status}">
                <td>${request.id}</td>
                <td>${this.formatDate(request.harvest_date)}</td>
                <td>${this.formatDate(request.created_at)}</td>
                <td>${request.user_name || 'Unknown'}</td>
                <td>${request.vegetable_name || 'Unknown'}</td>
                <td>${request.quantity || 0}</td>
                <td>
                    <span class="status-badge status-${request.status}">
                        ${this.getStatusText(request.status)}
                    </span>
                </td>
                <td class="actions">
                    ${request.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="adminRequests.updateRequestStatus(${request.id}, 'approved', 'harvest')">
                            承認
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="adminRequests.updateRequestStatus(${request.id}, 'rejected', 'harvest')">
                            拒否
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-info" onclick="adminRequests.viewRequestDetails(${request.id}, 'harvest')">
                        詳細
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderOriconRequests() {
        const tbody = document.getElementById('oriconTableBody');
        if (!tbody) return;

        const filteredRequests = this.applyCurrentFilters(this.oriconRequests);
        const sortedRequests = this.applySorting(filteredRequests);
        
        if (sortedRequests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">条件に一致する申請がありません</td></tr>';
            return;
        }

        tbody.innerHTML = sortedRequests.map(request => `
            <tr data-id="${request.id}" data-rental-date="${request.rental_date}" data-return-date="${request.return_date}" data-created-at="${request.created_at}" data-user="${request.user_id}" data-status="${request.status}">
                <td>${request.id}</td>
                <td>${this.formatDate(request.rental_date)}</td>
                <td>${this.formatDate(request.return_date)}</td>
                <td>${request.user_name || 'Unknown'}</td>
                <td>${request.quantity || 0}</td>
                <td>
                    <span class="status-badge status-${request.status}">
                        ${this.getStatusText(request.status)}
                    </span>
                </td>
                <td class="actions">
                    ${request.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="adminRequests.updateRequestStatus(${request.id}, 'approved', 'oricon')">
                            承認
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="adminRequests.updateRequestStatus(${request.id}, 'rejected', 'oricon')">
                            拒否
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-info" onclick="adminRequests.viewRequestDetails(${request.id}, 'oricon')">
                        詳細
                    </button>
                </td>
            </tr>
        `).join('');
    }

    applyCurrentFilters(requests) {
        const deliveryDateFilter = document.getElementById('deliveryDateFilter')?.value;
        const requestDateFilter = document.getElementById('requestDateFilter')?.value;
        const userFilter = document.getElementById('userFilter')?.value;
        const vegetableFilter = document.getElementById('vegetableFilter')?.value;
        const statusFilter = document.getElementById('statusFilter')?.value;

        return requests.filter(request => {
            // Search filter
            let searchMatch = true;
            if (this.currentSearchQuery) {
                const searchTerm = this.currentSearchQuery.toLowerCase();
                searchMatch = (
                    (request.user_name && request.user_name.toLowerCase().includes(searchTerm)) ||
                    (request.vegetable_name && request.vegetable_name.toLowerCase().includes(searchTerm)) ||
                    request.id.toString().includes(searchTerm) ||
                    (request.notes && request.notes.toLowerCase().includes(searchTerm))
                );
            }

            // Date filters
            let deliveryDateMatch = true;
            if (deliveryDateFilter) {
                const targetDate = request.harvest_date || request.rental_date;
                deliveryDateMatch = targetDate === deliveryDateFilter;
            }

            let requestDateMatch = true;
            if (requestDateFilter) {
                if (request.created_at) {
                    const createdDate = new Date(request.created_at).toISOString().split('T')[0];
                    requestDateMatch = createdDate === requestDateFilter;
                }
            }

            // Other filters
            const userMatch = !userFilter || String(request.user_id) === userFilter;
            const vegetableMatch = !vegetableFilter || request.vegetable_name === vegetableFilter;
            const statusMatch = !statusFilter || request.status === statusFilter;

            return searchMatch && deliveryDateMatch && requestDateMatch && userMatch && vegetableMatch && statusMatch;
        });
    }

    applySorting(requests) {
        return requests.sort((a, b) => {
            let aValue, bValue;

            switch (this.currentSortColumn) {
                case 'id':
                    aValue = parseInt(a.id) || 0;
                    bValue = parseInt(b.id) || 0;
                    break;
                case 'harvest_date':
                    aValue = new Date(a.harvest_date || 0);
                    bValue = new Date(b.harvest_date || 0);
                    break;
                case 'rental_date':
                    aValue = new Date(a.rental_date || 0);
                    bValue = new Date(b.rental_date || 0);
                    break;
                case 'return_date':
                    aValue = new Date(a.return_date || 0);
                    bValue = new Date(b.return_date || 0);
                    break;
                case 'user_name':
                    aValue = (a.user_name || '').toLowerCase();
                    bValue = (b.user_name || '').toLowerCase();
                    break;
                case 'vegetable_name':
                    aValue = (a.vegetable_name || '').toLowerCase();
                    bValue = (b.vegetable_name || '').toLowerCase();
                    break;
                case 'quantity':
                    aValue = parseInt(a.quantity) || 0;
                    bValue = parseInt(b.quantity) || 0;
                    break;
                case 'status':
                    aValue = a.status || '';
                    bValue = b.status || '';
                    break;
                case 'created_at':
                default:
                    aValue = new Date(a.created_at || 0);
                    bValue = new Date(b.created_at || 0);
                    break;
            }

            if (this.currentSortDirection === 'asc') {
                if (typeof aValue === 'string') {
                    return aValue.localeCompare(bValue);
                }
                return aValue - bValue;
            } else {
                if (typeof aValue === 'string') {
                    return bValue.localeCompare(aValue);
                }
                return bValue - aValue;
            }
        });
    }

    sortTable(column) {
        if (this.currentSortColumn === column) {
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSortColumn = column;
            this.currentSortDirection = column === 'created_at' ? 'desc' : 'asc';
        }

        this.updateSortIndicators();
        this.renderRequests();
    }

    updateSortIndicators() {
        // Reset all indicators
        document.querySelectorAll('.sort-indicator').forEach(indicator => {
            indicator.textContent = '↕';
        });

        // Update current sort indicator
        const currentIndicator = document.getElementById(`sort-${this.currentSortColumn}`);
        if (currentIndicator) {
            currentIndicator.textContent = this.currentSortDirection === 'asc' ? '↑' : '↓';
        }
    }

    applyFilters() {
        console.log('フィルター適用中...');
        this.renderRequests();
    }

    clearFilters() {
        document.getElementById('deliveryDateFilter').value = '';
        document.getElementById('requestDateFilter').value = '';
        document.getElementById('userFilter').value = '';
        document.getElementById('vegetableFilter').value = '';
        document.getElementById('statusFilter').value = '';
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            this.currentSearchQuery = '';
        }
        
        this.renderRequests();
        console.log('フィルターをクリアしました');
    }

    updateResultsCount() {
        const currentRequests = this.currentTab === 'harvest' ? this.harvestRequests : this.oriconRequests;
        const filteredRequests = this.applyCurrentFilters(currentRequests);
        const total = currentRequests.length;
        const showing = filteredRequests.length;
        
        const countElement = document.getElementById('resultsCount');
        if (countElement) {
            const tabName = this.currentTab === 'harvest' ? '収穫申請' : 'オリコン申請';
            if (showing === total) {
                countElement.textContent = `${tabName}: ${total}件`;
            } else {
                countElement.textContent = `${tabName}: ${showing}件 (全${total}件中)`;
            }
        }
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        const refreshIcon = document.getElementById('refreshIcon');
        const loadingSpinner = document.getElementById('loadingSpinner');
        
        if (refreshIcon && loadingSpinner) {
            refreshIcon.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');
        }
        refreshBtn.disabled = true;
        
        try {
            await this.loadRequests();
            this.showSuccess('データを更新しました');
        } catch (error) {
            this.showError('データ更新に失敗しました');
        } finally {
            if (refreshIcon && loadingSpinner) {
                refreshIcon.classList.remove('hidden');
                loadingSpinner.classList.add('hidden');
            }
            refreshBtn.disabled = false;
        }
    }

    searchRequests(query) {
        this.currentSearchQuery = query?.trim() || '';
        this.renderRequests();
    }

    renderFilteredRequests(requests) {
        if (this.currentTab === 'harvest') {
            const tbody = document.getElementById('harvestTableBody');
            if (tbody) {
                tbody.innerHTML = requests.map(request => this.createHarvestRow(request)).join('');
            }
        } else {
            const tbody = document.getElementById('oriconTableBody');
            if (tbody) {
                tbody.innerHTML = requests.map(request => this.createOriconRow(request)).join('');
            }
        }
    }

    async updateRequestStatus(requestId, status, type) {
        try {
            const token = localStorage.getItem('token');
            const endpoint = type === 'harvest' 
                ? `/api/admin/harvest-requests/${requestId}`
                : `/api/admin/oricon-requests/${requestId}`;

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });

            if (response.ok) {
                this.showSuccess(`リクエストを${status === 'approved' ? '承認' : '拒否'}しました`);
                await this.loadRequests();
            } else {
                throw new Error('ステータス更新に失敗しました');
            }
        } catch (error) {
            console.error('ステータス更新エラー:', error);
            this.showError('ステータスの更新に失敗しました');
        }
    }

    viewRequestDetails(requestId, type) {
        const requests = type === 'harvest' ? this.harvestRequests : this.oriconRequests;
        const request = requests.find(r => r.id === requestId);
        
        if (!request) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>${type === 'harvest' ? '収穫' : 'オリコン'}リクエスト詳細</h3>
                <div class="request-details">
                    <div class="detail-row">
                        <label>ID:</label>
                        <span>${request.id}</span>
                    </div>
                    <div class="detail-row">
                        <label>申請者:</label>
                        <span>${request.user_name || 'Unknown'}</span>
                    </div>
                    ${type === 'harvest' ? `
                        <div class="detail-row">
                            <label>野菜:</label>
                            <span>${request.vegetable_name || 'Unknown'}</span>
                        </div>
                        <div class="detail-row">
                            <label>数量:</label>
                            <span>${request.quantity || 0}</span>
                        </div>
                        <div class="detail-row">
                            <label>収穫日:</label>
                            <span>${this.formatDate(request.harvest_date)}</span>
                        </div>
                    ` : `
                        <div class="detail-row">
                            <label>数量:</label>
                            <span>${request.quantity || 0}</span>
                        </div>
                        <div class="detail-row">
                            <label>レンタル日:</label>
                            <span>${this.formatDate(request.rental_date)}</span>
                        </div>
                        <div class="detail-row">
                            <label>返却日:</label>
                            <span>${this.formatDate(request.return_date)}</span>
                        </div>
                    `}
                    <div class="detail-row">
                        <label>ステータス:</label>
                        <span class="status-badge status-${request.status}">
                            ${this.getStatusText(request.status)}
                        </span>
                    </div>
                    <div class="detail-row">
                        <label>申請日時:</label>
                        <span>${this.formatDateTime(request.created_at)}</span>
                    </div>
                    ${request.notes ? `
                        <div class="detail-row">
                            <label>備考:</label>
                            <span>${request.notes}</span>
                        </div>
                    ` : ''}
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

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP');
    }

    formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('ja-JP');
    }

    getStatusText(status) {
        const statusTexts = {
            'pending': '申請中',
            'approved': '承認済み',
            'rejected': '拒否',
            'completed': '完了'
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

let adminRequests;

document.addEventListener('DOMContentLoaded', () => {
    adminRequests = new AdminRequests();
});