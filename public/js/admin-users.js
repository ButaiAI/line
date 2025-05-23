class AdminUsers {
    constructor() {
        this.users = [];
        this.filteredUsers = [];
        this.currentSortColumn = 'created_at';
        this.currentSortDirection = 'desc';
        this.editingUserId = null;
        this.pendingConfirmAction = null;
        this.searchTimeout = null;
        
        this.initializeUsers();
    }

    async initializeUsers() {
        if (!await this.checkAuthentication()) {
            return;
        }
        
        await this.loadUsers();
        this.setupEventListeners();
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

    async loadUsers() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.users = await response.json();
                this.applyFiltersAndSort();
                this.renderUsers();
                this.updateUserCount();
            } else {
                throw new Error('ユーザーデータの取得に失敗しました');
            }
        } catch (error) {
            console.error('ユーザー読み込みエラー:', error);
            this.showError('ユーザーデータの読み込みに失敗しました');
        }
    }

    setupEventListeners() {
        // Search input with debouncing
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, 300);
        });

        // Sort functionality
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.handleSort(column);
            });
        });

        // Form submission
        document.getElementById('userForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });

        // Modal close on outside click
        document.getElementById('userModal').addEventListener('click', (e) => {
            if (e.target.id === 'userModal') {
                this.closeUserModal();
            }
        });

        document.getElementById('confirmDialog').addEventListener('click', (e) => {
            if (e.target.id === 'confirmDialog') {
                this.closeConfirmDialog();
            }
        });
    }

    handleSearch(query) {
        this.searchQuery = query.toLowerCase().trim();
        this.applyFiltersAndSort();
        this.renderUsers();
        this.updateUserCount();
    }

    handleSort(column) {
        if (this.currentSortColumn === column) {
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSortColumn = column;
            this.currentSortDirection = 'asc';
        }

        this.updateSortIndicators();
        this.applyFiltersAndSort();
        this.renderUsers();
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

    applyFiltersAndSort() {
        // Apply search filter
        this.filteredUsers = this.users.filter(user => {
            if (!this.searchQuery) return true;
            
            const name = (user.name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const displayName = (user.display_name || '').toLowerCase();
            
            return name.includes(this.searchQuery) || 
                   email.includes(this.searchQuery) || 
                   displayName.includes(this.searchQuery);
        });

        // Apply sorting
        this.filteredUsers.sort((a, b) => {
            let aValue, bValue;

            switch (this.currentSortColumn) {
                case 'id':
                    aValue = parseInt(a.id) || 0;
                    bValue = parseInt(b.id) || 0;
                    break;
                case 'name':
                    aValue = (a.name || '').toLowerCase();
                    bValue = (b.name || '').toLowerCase();
                    break;
                case 'email':
                    aValue = (a.email || '').toLowerCase();
                    bValue = (b.email || '').toLowerCase();
                    break;
                case 'role':
                    aValue = a.role || '';
                    bValue = b.role || '';
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

    renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        
        if (this.filteredUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <div class="empty-state-text">ユーザーが見つかりません</div>
                        <div class="empty-state-subtext">検索条件を変更するか、新しいユーザーを作成してください</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredUsers.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${this.escapeHtml(user.name || '-')}</td>
                <td>${this.escapeHtml(user.email || '-')}</td>
                <td>
                    <span class="role-badge role-${user.role}">
                        ${this.getRoleText(user.role)}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${user.status || 'active'}">
                        ${this.getStatusText(user.status)}
                    </span>
                </td>
                <td>${this.formatDate(user.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-sm btn-edit" onclick="adminUsers.showEditUserModal(${user.id})">
                            編集
                        </button>
                        <button class="btn-sm btn-delete" onclick="adminUsers.confirmDeleteUser(${user.id})">
                            削除
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateUserCount() {
        const countElement = document.getElementById('userCount');
        if (countElement) {
            const total = this.users.length;
            const showing = this.filteredUsers.length;
            
            if (showing === total) {
                countElement.textContent = `ユーザー: ${total}件`;
            } else {
                countElement.textContent = `ユーザー: ${showing}件 (全${total}件中)`;
            }
        }
    }

    showCreateUserModal() {
        this.editingUserId = null;
        document.getElementById('modalTitle').textContent = '新規ユーザー作成';
        document.getElementById('passwordGroup').style.display = 'block';
        document.getElementById('userPassword').required = true;
        this.resetForm();
        document.getElementById('userModal').classList.add('active');
    }

    showEditUserModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        this.editingUserId = userId;
        document.getElementById('modalTitle').textContent = 'ユーザー編集';
        document.getElementById('passwordGroup').style.display = 'none';
        document.getElementById('userPassword').required = false;
        
        // Populate form
        document.getElementById('userName').value = user.name || '';
        document.getElementById('userEmail').value = user.email || '';
        document.getElementById('userRole').value = user.role || '';
        document.getElementById('userStatus').value = user.status || 'active';
        document.getElementById('userDisplayName').value = user.display_name || '';
        
        this.clearErrors();
        document.getElementById('userModal').classList.add('active');
    }

    closeUserModal() {
        document.getElementById('userModal').classList.remove('active');
        this.resetForm();
        this.editingUserId = null;
    }

    resetForm() {
        document.getElementById('userForm').reset();
        this.clearErrors();
    }

    clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    }

    validateForm() {
        this.clearErrors();
        let isValid = true;

        const name = document.getElementById('userName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;
        const status = document.getElementById('userStatus').value;

        // Name validation
        if (!name) {
            document.getElementById('userNameError').textContent = 'ユーザー名は必須です';
            isValid = false;
        } else if (name.length < 2) {
            document.getElementById('userNameError').textContent = 'ユーザー名は2文字以上で入力してください';
            isValid = false;
        }

        // Email validation
        if (!email) {
            document.getElementById('userEmailError').textContent = 'メールアドレスは必須です';
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            document.getElementById('userEmailError').textContent = '正しいメールアドレスを入力してください';
            isValid = false;
        }

        // Password validation (only for new users)
        if (!this.editingUserId) {
            if (!password) {
                document.getElementById('userPasswordError').textContent = 'パスワードは必須です';
                isValid = false;
            } else if (password.length < 6) {
                document.getElementById('userPasswordError').textContent = 'パスワードは6文字以上で入力してください';
                isValid = false;
            }
        }

        // Role validation
        if (!role) {
            document.getElementById('userRoleError').textContent = '権限を選択してください';
            isValid = false;
        }

        // Status validation
        if (!status) {
            document.getElementById('userStatusError').textContent = 'ステータスを選択してください';
            isValid = false;
        }

        return isValid;
    }

    async saveUser() {
        if (!this.validateForm()) {
            return;
        }

        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        try {
            const userData = {
                name: document.getElementById('userName').value.trim(),
                email: document.getElementById('userEmail').value.trim(),
                role: document.getElementById('userRole').value,
                status: document.getElementById('userStatus').value,
                display_name: document.getElementById('userDisplayName').value.trim() || null
            };

            if (!this.editingUserId) {
                userData.password = document.getElementById('userPassword').value;
            }

            const token = localStorage.getItem('token');
            const url = this.editingUserId 
                ? `/api/admin/users/${this.editingUserId}`
                : '/api/admin/users';
            
            const method = this.editingUserId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                this.showSuccess(this.editingUserId ? 'ユーザーを更新しました' : 'ユーザーを作成しました');
                this.closeUserModal();
                await this.loadUsers();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'ユーザーの保存に失敗しました');
            }
        } catch (error) {
            console.error('ユーザー保存エラー:', error);
            this.showError(error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    confirmDeleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('confirmTitle').textContent = 'ユーザー削除の確認';
        document.getElementById('confirmMessage').textContent = 
            `ユーザー「${user.name}」を削除してもよろしいですか？この操作は元に戻せません。`;
        
        this.pendingConfirmAction = () => this.deleteUser(userId);
        document.getElementById('confirmDialog').classList.add('active');
    }

    closeConfirmDialog() {
        document.getElementById('confirmDialog').classList.remove('active');
        this.pendingConfirmAction = null;
    }

    confirmAction() {
        if (this.pendingConfirmAction) {
            this.pendingConfirmAction();
            this.closeConfirmDialog();
        }
    }

    async deleteUser(userId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.showSuccess('ユーザーを削除しました');
                await this.loadUsers();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'ユーザーの削除に失敗しました');
            }
        } catch (error) {
            console.error('ユーザー削除エラー:', error);
            this.showError(error.message);
        }
    }

    async refreshUsers() {
        const refreshBtn = document.getElementById('refreshBtn');
        const refreshIcon = document.getElementById('refreshIcon');
        const loadingSpinner = document.getElementById('loadingSpinner');
        
        if (refreshIcon && loadingSpinner) {
            refreshIcon.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');
        }
        refreshBtn.disabled = true;
        
        try {
            await this.loadUsers();
            this.showSuccess('ユーザーデータを更新しました');
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

    // Utility methods
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP');
    }

    getRoleText(role) {
        const roleTexts = {
            'admin': '管理者',
            'user': '一般ユーザー'
        };
        return roleTexts[role] || role;
    }

    getStatusText(status) {
        const statusTexts = {
            'active': '有効',
            'inactive': '無効'
        };
        return statusTexts[status] || '有効';
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
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

// Global instance
let adminUsers;

// Global functions for HTML onclick handlers
function showCreateUserModal() {
    adminUsers.showCreateUserModal();
}

function closeUserModal() {
    adminUsers.closeUserModal();
}

function saveUser() {
    adminUsers.saveUser();
}

function closeConfirmDialog() {
    adminUsers.closeConfirmDialog();
}

function confirmAction() {
    adminUsers.confirmAction();
}

function refreshUsers() {
    adminUsers.refreshUsers();
}

function logout() {
    adminUsers.logout();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    adminUsers = new AdminUsers();
});