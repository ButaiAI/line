class OriconRental {
    constructor() {
        this.userId = null;
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        this.setupDateInputs();
        await this.loadHistory();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || !user.id) {
            window.location.href = '/';
            return;
        }
        
        this.userId = user.id;
    }

    setupDateInputs() {
        // 現在の日付+1日を最小値に設定
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('pickupDate').min = this.formatDateISO(tomorrow);
        document.getElementById('returnDate').min = this.formatDateISO(tomorrow);
        
        // 受け取り日が変更されたら返却日の最小値を更新
        document.getElementById('pickupDate').addEventListener('change', (e) => {
            const pickupDate = new Date(e.target.value);
            if (pickupDate) {
                const minReturnDate = new Date(pickupDate);
                minReturnDate.setDate(minReturnDate.getDate() + 1);
                document.getElementById('returnDate').min = this.formatDateISO(minReturnDate);
            }
        });
    }

    async loadHistory() {
        this.showLoading();
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/oricon-requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const rentals = await response.json();
                this.displayHistory(rentals);
            } else {
                throw new Error('履歴の読み込みに失敗しました');
            }
        } catch (error) {
            console.error('履歴読み込みエラー:', error);
            document.getElementById('historyContainer').innerHTML = 
                '<div style="text-align: center; padding: 20px; color: #999;">履歴の読み込みに失敗しました。</div>';
        } finally {
            this.hideLoading();
        }
    }

    displayHistory(rentals) {
        const historyContainer = document.getElementById('historyContainer');
        
        if (!rentals || rentals.length === 0) {
            historyContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">申請履歴はありません</div>';
            return;
        }
        
        let html = '';
        
        // 日付順に並べ替え（新しい順）
        rentals.sort((a, b) => new Date(b.rental_date) - new Date(a.rental_date));
        
        rentals.forEach(rental => {
            const pickupDate = new Date(rental.rental_date);
            const returnDate = rental.return_date ? new Date(rental.return_date) : null;
            const formattedPickupDate = `${pickupDate.getFullYear()}年${pickupDate.getMonth() + 1}月${pickupDate.getDate()}日`;
            const formattedReturnDate = returnDate ? 
                `${returnDate.getFullYear()}年${returnDate.getMonth() + 1}月${returnDate.getDate()}日` : '未設定';
            
            html += `
                <div class="history-item">
                    <div class="history-date">受取日: ${formattedPickupDate}</div>
                    <div class="history-date" style="font-size: 28px; margin-top: 4px;">返却日: ${formattedReturnDate}</div>
                    <div class="history-details">
                        <div class="history-quantity">${rental.quantity}個</div>
                        <div class="history-status status-${rental.status}">
                            ${this.getStatusText(rental.status)}
                        </div>
                    </div>
                </div>
            `;
        });
        
        historyContainer.innerHTML = html;
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

    async submitApplication() {
        // フォームバリデーション
        if (!this.validateForm()) {
            return;
        }
        
        // フォームを無効化
        document.getElementById('submitBtn').disabled = true;
        
        // ローディング表示
        this.showLoading();
        
        try {
            // 日付と数量を取得
            const pickupDate = document.getElementById('pickupDate').value;
            const returnDate = document.getElementById('returnDate').value;
            const quantity = parseInt(document.getElementById('quantity').value);
            
            // 申請データを作成
            const requestData = {
                rental_date: pickupDate,
                return_date: returnDate,
                quantity: quantity
            };
            
            // サーバーに送信
            const token = localStorage.getItem('token');
            const response = await fetch('/api/oricon-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestData)
            });
            
            if (response.ok) {
                // 成功メッセージを表示
                this.showSuccessModal();
                
                // フォームをリセット
                document.getElementById('pickupDate').value = '';
                document.getElementById('returnDate').value = '';
                document.getElementById('quantity').value = '1';
                
                // 履歴を再読み込み
                await this.loadHistory();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '申請の送信に失敗しました');
            }
        } catch (error) {
            console.error('申請送信エラー:', error);
            this.showAlert('申請の送信に失敗しました: ' + error.message);
        } finally {
            this.hideLoading();
            // ボタンを有効化
            document.getElementById('submitBtn').disabled = false;
        }
    }

    validateForm() {
        let isValid = true;
        
        // 受け取り日のバリデーション
        const pickupDate = document.getElementById('pickupDate').value;
        const pickupDateError = document.getElementById('pickupDateError');
        
        if (!pickupDate) {
            pickupDateError.textContent = '受け取り希望日を選択してください';
            isValid = false;
        } else {
            // 今日の日付と比較
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const selectedDate = new Date(pickupDate);
            
            if (selectedDate < tomorrow) {
                pickupDateError.textContent = '受け取り日は明日以降を選択してください';
                isValid = false;
            } else {
                pickupDateError.textContent = '';
            }
        }
        
        // 返却日のバリデーション
        const returnDate = document.getElementById('returnDate').value;
        const returnDateError = document.getElementById('returnDateError');
        
        if (!returnDate) {
            returnDateError.textContent = '返却予定日を選択してください';
            isValid = false;
        } else if (pickupDate && returnDate) {
            const pickupDateObj = new Date(pickupDate);
            const returnDateObj = new Date(returnDate);
            
            if (returnDateObj <= pickupDateObj) {
                returnDateError.textContent = '返却日は受け取り日の翌日以降を選択してください';
                isValid = false;
            } else {
                returnDateError.textContent = '';
            }
        } else {
            returnDateError.textContent = '';
        }
        
        // 数量のバリデーション
        const quantity = document.getElementById('quantity').value;
        const quantityError = document.getElementById('quantityError');
        
        if (!quantity) {
            quantityError.textContent = '数量を入力してください';
            isValid = false;
        } else if (parseInt(quantity) < 1) {
            quantityError.textContent = '数量は1以上を入力してください';
            isValid = false;
        } else if (parseInt(quantity) > 100) {
            quantityError.textContent = '数量は最大100個までです';
            isValid = false;
        } else {
            quantityError.textContent = '';
        }
        
        return isValid;
    }

    // 日付をISO形式にフォーマット（YYYY-MM-DD）
    formatDateISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 成功モーダルを表示
    showSuccessModal() {
        document.getElementById('successModal').classList.add('visible');
    }

    // 成功モーダルを閉じる
    closeSuccessModal() {
        document.getElementById('successModal').classList.remove('visible');
    }

    // ローディングを表示
    showLoading() {
        document.getElementById('loadingOverlay').classList.add('visible');
    }

    // ローディングを非表示
    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('visible');
    }

    // 前のページに戻る
    goBack() {
        window.history.back();
    }

    // アラート関数（大きめのアラート）
    showAlert(message) {
        // 既存のアラートがあれば削除
        const existingAlert = document.getElementById('customAlert');
        if (existingAlert) {
            document.body.removeChild(existingAlert);
        }
        
        // アラート要素を作成
        const alertDiv = document.createElement('div');
        alertDiv.id = 'customAlert';
        alertDiv.className = 'notification';
        alertDiv.textContent = message;
        
        // OKボタンを追加
        const okButton = document.createElement('div');
        okButton.textContent = 'OK';
        okButton.className = 'close-button';
        okButton.onclick = () => document.body.removeChild(alertDiv);
        alertDiv.appendChild(okButton);
        
        // 5秒後に自動的に閉じる
        setTimeout(() => {
            if (document.body.contains(alertDiv)) {
                document.body.removeChild(alertDiv);
            }
        }, 5000);
        
        // ボディに追加
        document.body.appendChild(alertDiv);
    }
}

// グローバル関数（HTMLから呼び出されるため）
let oriconRental;

function submitApplication() {
    oriconRental.submitApplication();
}

function closeSuccessModal() {
    oriconRental.closeSuccessModal();
}

function goBack() {
    oriconRental.goBack();
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    oriconRental = new OriconRental();
});