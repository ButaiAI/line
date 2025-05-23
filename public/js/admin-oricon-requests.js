class AdminOriconRequests {
    constructor() {
        this.oriconRequests = [];
        this.users = [];
        this.currentView = 'list';
        this.currentSortColumn = 'created_at';
        this.currentSortDirection = 'desc';
        this.currentCalendarDate = new Date();
        this.initializeRequests();
    }

    async initializeRequests() {
        if (!await this.checkAuthentication()) {
            return;
        }
        
        await this.loadRequests();
        this.setupEventListeners();
        this.setupFilters();
        this.updateMonthDisplay();
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
            
            const [oriconRes, usersRes] = await Promise.all([
                fetch('/api/admin/oricon-requests', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            this.oriconRequests = await oriconRes.json();
            this.users = await usersRes.json();

            this.loadFilterOptions();
            this.renderRequests();
            this.updateResultsCount();
        } catch (error) {
            console.error('リクエスト取得エラー:', error);
            this.showError('リクエストの取得に失敗しました');
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.textContent.includes('リスト') ? 'list' : 'calendar';
                this.switchView(view);
            });
        });

        // Sortable column headers
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.sortTable(column);
            });
        });

        // Filter inputs - apply on change
        ['dateFilter', 'userFilter', 'statusFilter'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.applyFilters();
                });
            }
        });
    }

    setupFilters() {
        // Auto-apply filters on value change
        ['dateFilter', 'userFilter', 'statusFilter'].forEach(id => {
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
    }

    switchView(view) {
        this.currentView = view;
        
        document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
        document.getElementById('calendarViewBtn').classList.toggle('active', view === 'calendar');
        
        document.getElementById('listView').classList.toggle('hidden', view !== 'list');
        document.getElementById('calendarView').classList.toggle('hidden', view !== 'calendar');

        if (view === 'calendar') {
            this.renderCalendar();
        } else {
            this.renderRequests();
        }
    }

    renderRequests() {
        if (this.currentView === 'list') {
            this.renderOriconRequests();
        }
    }

    renderOriconRequests() {
        const tbody = document.getElementById('oriconTableBody');
        if (!tbody) return;

        const filteredRequests = this.applyCurrentFilters(this.oriconRequests);
        const sortedRequests = this.applySorting(filteredRequests);
        
        if (sortedRequests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">条件に一致する申請がありません</td></tr>';
            return;
        }

        tbody.innerHTML = sortedRequests.map(request => `
            <tr data-id="${request.id}" data-rental-date="${request.rental_date}" data-created-at="${request.created_at}" data-user="${request.user_id}" data-status="${request.status}">
                <td>${request.id}</td>
                <td>${this.formatDate(request.rental_date)}</td>
                <td>${this.formatDate(request.return_date)}</td>
                <td>${request.user_name || 'Unknown'}</td>
                <td>${request.quantity || 0}個</td>
                <td>
                    <span class="status-badge status-${request.status}">
                        ${this.getStatusText(request.status)}
                    </span>
                </td>
                <td>${this.formatDate(request.created_at)}</td>
                <td class="actions">
                    ${request.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="adminOriconRequests.updateRequestStatus(${request.id}, 'approved')">
                            承認
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="adminOriconRequests.updateRequestStatus(${request.id}, 'rejected')">
                            拒否
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-info" onclick="adminOriconRequests.viewRequestDetails(${request.id})">
                        詳細
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="adminOriconRequests.deleteRequest(${request.id})">
                        削除
                    </button>
                </td>
            </tr>
        `).join('');
    }

    applyCurrentFilters(requests) {
        const dateFilter = document.getElementById('dateFilter')?.value;
        const userFilter = document.getElementById('userFilter')?.value;
        const statusFilter = document.getElementById('statusFilter')?.value;

        return requests.filter(request => {
            // Date filter
            let dateMatch = true;
            if (dateFilter) {
                dateMatch = request.rental_date === dateFilter;
            }

            // Other filters
            const userMatch = !userFilter || String(request.user_id) === userFilter;
            const statusMatch = !statusFilter || request.status === statusFilter;

            return dateMatch && userMatch && statusMatch;
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
        this.updateResultsCount();
        
        if (this.currentView === 'calendar') {
            this.renderCalendar();
        }
    }

    clearFilters() {
        document.getElementById('dateFilter').value = '';
        document.getElementById('userFilter').value = '';
        document.getElementById('statusFilter').value = '';
        
        this.renderRequests();
        this.updateResultsCount();
        
        if (this.currentView === 'calendar') {
            this.renderCalendar();
        }
        
        console.log('フィルターをクリアしました');
    }

    updateResultsCount() {
        const filteredRequests = this.applyCurrentFilters(this.oriconRequests);
        const total = this.oriconRequests.length;
        const showing = filteredRequests.length;
        
        const countElement = document.getElementById('resultsCount');
        if (countElement) {
            if (showing === total) {
                countElement.textContent = `オリコン申請: ${total}件`;
            } else {
                countElement.textContent = `オリコン申請: ${showing}件 (全${total}件中)`;
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

    // Calendar functionality
    updateMonthDisplay() {
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        const currentMonthElement = document.getElementById('currentMonth');
        if (currentMonthElement) {
            currentMonthElement.textContent = 
                `${this.currentCalendarDate.getFullYear()}年${monthNames[this.currentCalendarDate.getMonth()]}`;
        }
    }

    prevMonth() {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
        this.updateMonthDisplay();
        this.renderCalendar();
    }

    nextMonth() {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
        this.updateMonthDisplay();
        this.renderCalendar();
    }

    renderCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        if (!calendarGrid) return;
        
        calendarGrid.innerHTML = '';
        
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        
        // 前月の日付
        for (let i = 0; i < startDayOfWeek; i++) {
            const date = new Date(year, month, 1 - (startDayOfWeek - i));
            const dayElement = this.createCalendarDay(date, true);
            calendarGrid.appendChild(dayElement);
        }
        
        // 当月の日付
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const dayElement = this.createCalendarDay(date, false);
            calendarGrid.appendChild(dayElement);
        }
        
        // 次月の日付
        const remainingDays = 42 - (startDayOfWeek + lastDay.getDate());
        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(year, month + 1, day);
            const dayElement = this.createCalendarDay(date, true);
            calendarGrid.appendChild(dayElement);
        }
    }

    createCalendarDay(date, isOtherMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day ${isOtherMonth ? 'other-month' : ''}`;
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = date.getDate();
        dayElement.appendChild(dayNumber);
        
        if (!isOtherMonth) {
            const dateKey = date.toISOString().split('T')[0];
            const dayRentals = this.getRentalsByDate(dateKey);
            
            if (dayRentals.length > 0) {
                dayElement.classList.add('has-rentals');
                
                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'calendar-items';
                
                // 最大3件まで表示
                let count = 0;
                dayRentals.forEach(rental => {
                    if (count >= 3) return;
                    
                    const itemElement = document.createElement('div');
                    itemElement.className = 'calendar-item';
                    itemElement.innerHTML = `
                        <span>${(rental.user_name || 'Unknown').substr(0, 4)}</span>
                        <span class="calendar-item-count">${rental.quantity}個</span>
                    `;
                    itemsContainer.appendChild(itemElement);
                    count++;
                });
                
                if (dayRentals.length > 3) {
                    const moreElement = document.createElement('div');
                    moreElement.className = 'text-xs text-right text-gray-500 mt-1';
                    moreElement.textContent = `+${dayRentals.length - 3}件`;
                    itemsContainer.appendChild(moreElement);
                }
                
                // 合計数
                const totalElement = document.createElement('div');
                totalElement.className = 'text-xs font-bold text-right text-gray-700 mt-1';
                const totalCount = dayRentals.reduce((sum, rental) => sum + parseInt(rental.quantity || 0), 0);
                totalElement.textContent = `合計: ${totalCount}個`;
                itemsContainer.appendChild(totalElement);
                
                dayElement.appendChild(itemsContainer);
                
                // クリックで詳細表示
                dayElement.onclick = () => {
                    this.showDateDetails(dateKey, dayRentals);
                };
            }
        }
        
        return dayElement;
    }

    getRentalsByDate(dateStr) {
        const filteredRequests = this.applyCurrentFilters(this.oriconRequests);
        return filteredRequests.filter(request => request.rental_date === dateStr);
    }

    showDateDetails(dateStr, rentals) {
        const date = new Date(dateStr);
        const formattedDate = date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        
        const detailsContent = document.getElementById('detailsContent');
        detailsContent.innerHTML = `
            <h4 class="text-lg font-bold mb-4">${formattedDate}のオリコンレンタル申請</h4>
            <div class="mb-4">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ユーザー</th>
                            <th>数量</th>
                            <th>ステータス</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rentals.map(rental => `
                            <tr>
                                <td>${rental.user_name || 'Unknown'}</td>
                                <td>${rental.quantity}個</td>
                                <td>
                                    <span class="status-badge status-${rental.status}">
                                        ${this.getStatusText(rental.status)}
                                    </span>
                                </td>
                                <td>
                                    <button onclick="adminOriconRequests.viewRequestDetails(${rental.id})" class="btn btn-sm btn-info">
                                        詳細
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-4">
                <h5 class="font-bold mb-2">合計</h5>
                <div class="text-2xl text-green-600 font-bold">${rentals.reduce((sum, rental) => sum + parseInt(rental.quantity), 0)}個</div>
            </div>
        `;
        
        this.openDetailsModal();
    }

    async updateRequestStatus(requestId, status) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/oricon-requests/${requestId}`, {
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

    viewRequestDetails(requestId) {
        const request = this.oriconRequests.find(r => r.id === requestId);
        
        if (!request) return;

        const detailsContent = document.getElementById('detailsContent');
        detailsContent.innerHTML = `
            <h4 class="text-lg font-bold mb-4">オリコンレンタル申請 #${request.id}</h4>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <div class="text-sm text-gray-500">受取日</div>
                    <div class="font-medium">${this.formatDate(request.rental_date)}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">返却予定日</div>
                    <div class="font-medium">${this.formatDate(request.return_date)}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">ユーザー</div>
                    <div class="font-medium">${request.user_name || 'Unknown'}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">数量</div>
                    <div class="font-medium">${request.quantity}個</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">ステータス</div>
                    <div class="font-medium">
                        <span class="status-badge status-${request.status}">
                            ${this.getStatusText(request.status)}
                        </span>
                    </div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">申請日</div>
                    <div class="font-medium">${this.formatDate(request.created_at)}</div>
                </div>
            </div>
            ${request.notes ? `
                <div class="mb-4">
                    <div class="text-sm text-gray-500">備考</div>
                    <div class="font-medium">${request.notes}</div>
                </div>
            ` : ''}
        `;
        
        this.openDetailsModal();
    }

    async deleteRequest(requestId) {
        if (!confirm(`申請 #${requestId} を削除してもよろしいですか？この操作は元に戻せません。`)) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/oricon-requests/${requestId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                this.showSuccess('申請を削除しました');
                await this.loadRequests();
            } else {
                throw new Error('削除に失敗しました');
            }
        } catch (error) {
            console.error('削除エラー:', error);
            this.showError('削除でエラーが発生しました');
        }
    }

    openDetailsModal() {
        document.getElementById('detailsModal').classList.add('visible');
    }

    closeDetailsModal() {
        document.getElementById('detailsModal').classList.remove('visible');
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP');
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

let adminOriconRequests;

// Global functions for HTML onclick handlers
function switchView(view) {
    adminOriconRequests.switchView(view);
}

function applyFilters() {
    adminOriconRequests.applyFilters();
}

function clearFilters() {
    adminOriconRequests.clearFilters();
}

function refreshData() {
    adminOriconRequests.refreshData();
}

function prevMonth() {
    adminOriconRequests.prevMonth();
}

function nextMonth() {
    adminOriconRequests.nextMonth();
}

function closeDetailsModal() {
    adminOriconRequests.closeDetailsModal();
}

function logout() {
    adminOriconRequests.logout();
}

document.addEventListener('DOMContentLoaded', () => {
    adminOriconRequests = new AdminOriconRequests();
});