class AdminVegetables {
    constructor() {
        this.vegetables = [];
        this.initializeVegetables();
    }

    async initializeVegetables() {
        if (!await this.checkAuthentication()) {
            return;
        }
        
        await this.loadVegetables();
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

    async loadVegetables() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/vegetables', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.vegetables = await response.json();
                this.renderVegetables();
            } else {
                throw new Error('野菜品目の取得に失敗しました');
            }
        } catch (error) {
            console.error('野菜品目取得エラー:', error);
            this.showError('野菜品目の取得に失敗しました');
        }
    }

    setupEventListeners() {
        document.getElementById('logout-btn')?.addEventListener('click', this.logout);
        
        document.getElementById('addVegetableBtn')?.addEventListener('click', () => {
            this.showAddModal();
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Modal click outside to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Add form
        document.getElementById('addVegetableForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addVegetable();
        });

        // Edit form
        document.getElementById('editVegetableForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateVegetable();
        });

        // Delete button
        document.getElementById('deleteVegetableBtn')?.addEventListener('click', async () => {
            await this.deleteVegetable();
        });
    }

    renderVegetables() {
        const grid = document.getElementById('vegetableGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (!grid) return;

        if (this.vegetables.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        grid.innerHTML = this.vegetables.map(vegetable => `
            <div class="vegetable-card" data-id="${vegetable.id}" data-name="${vegetable.item_name}">
                <div class="vegetable-name">${vegetable.item_name}</div>
                <div class="vegetable-date">${this.formatDate(vegetable.created_at)}</div>
            </div>
        `).join('');

        // Add click handlers to vegetable cards
        document.querySelectorAll('.vegetable-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                const name = card.dataset.name;
                this.showEditModal(id, name);
            });
        });
    }

    showAddModal() {
        document.getElementById('newVegetableName').value = '';
        this.showModal('addVegetableModal');
    }

    showEditModal(id, name) {
        document.getElementById('editVegetableId').value = id;
        document.getElementById('editVegetableName').value = name;
        this.showModal('editVegetableModal');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async addVegetable() {
        try {
            const name = document.getElementById('newVegetableName').value.trim();
            if (!name) {
                this.showError('品目名を入力してください');
                return;
            }

            const submitBtn = document.getElementById('addVegetableSubmitBtn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '追加中...';

            const token = localStorage.getItem('token');
            const response = await fetch('/api/vegetables', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ item_name: name })
            });

            if (response.ok) {
                this.showSuccess('野菜品目を追加しました');
                await this.loadVegetables();
                this.closeModal('addVegetableModal');
            } else {
                const error = await response.json();
                throw new Error(error.error || '野菜品目の追加に失敗しました');
            }
        } catch (error) {
            console.error('野菜品目追加エラー:', error);
            this.showError(error.message || '野菜品目の追加に失敗しました');
        } finally {
            const submitBtn = document.getElementById('addVegetableSubmitBtn');
            submitBtn.disabled = false;
            submitBtn.textContent = '追加';
        }
    }

    async updateVegetable() {
        try {
            const id = document.getElementById('editVegetableId').value;
            const name = document.getElementById('editVegetableName').value.trim();
            
            if (!id || !name) {
                this.showError('品目名を入力してください');
                return;
            }

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/vegetables/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ item_name: name })
            });

            if (response.ok) {
                this.showSuccess('野菜品目を更新しました');
                await this.loadVegetables();
                this.closeModal('editVegetableModal');
            } else {
                const error = await response.json();
                throw new Error(error.error || '野菜品目の更新に失敗しました');
            }
        } catch (error) {
            console.error('野菜品目更新エラー:', error);
            this.showError(error.message || '野菜品目の更新に失敗しました');
        }
    }

    async deleteVegetable() {
        const id = document.getElementById('editVegetableId').value;
        const name = document.getElementById('editVegetableName').value;
        
        if (!id) {
            this.showError('削除する品目が選択されていません');
            return;
        }

        if (!confirm(`「${name}」を削除してもよろしいですか？\nこの操作は元に戻せません。`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/vegetables/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.showSuccess('野菜品目を削除しました');
                await this.loadVegetables();
                this.closeModal('editVegetableModal');
            } else {
                const error = await response.json();
                throw new Error(error.error || '野菜品目の削除に失敗しました');
            }
        } catch (error) {
            console.error('野菜品目削除エラー:', error);
            this.showError(error.message || '野菜品目の削除に失敗しました');
        }
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP');
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

        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
                style.remove();
            }, 300);
        }, 3000);
    }
}

// Global functions for modal handling (keeping compatibility)
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

let adminVegetables;

document.addEventListener('DOMContentLoaded', () => {
    adminVegetables = new AdminVegetables();
});