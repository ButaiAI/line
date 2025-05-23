class VegetableCalendar {
    constructor() {
        this.currentDate = new Date();
        this.harvestData = {};
        this.activeInput = null;
        this.vegetableList = [];
        this.isSubmitting = false;
        this.requestsData = [];
        this.currentDetailsDate = null;
        this.selectedDateKey = null;
        this.currentInputValue = '';
        this.editingRequest = null;
        this.userId = null;
        
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        await this.loadVegetableItems();
        await this.loadRequestsData();
        this.updateMonthDisplay();
        this.renderCalendar();
        this.setupEventListeners();
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

    setupEventListeners() {
        // キーボード入力のリスナーを設定
        document.addEventListener('keydown', (event) => {
            // 数量入力パネルが表示されている場合のみ処理
            if (document.getElementById('quickInputPanel').classList.contains('active')) {
                // 数字キーの処理 (0-9)
                if (event.key >= '0' && event.key <= '9') {
                    this.inputNumber(event.key);
                    event.preventDefault();
                } 
                // バックスペースキーの処理
                else if (event.key === 'Backspace') {
                    this.backspace();
                    event.preventDefault();
                } 
                // Enterキーの処理
                else if (event.key === 'Enter') {
                    this.confirmInput();
                    event.preventDefault();
                } 
                // Escapeキーの処理
                else if (event.key === 'Escape') {
                    this.closeQuickInput();
                    event.preventDefault();
                }
            }
        });
    }

    // カスタムアラート関数
    showLargeAlert(message) {
        // 既存のカスタムアラートがあれば削除
        const existingAlert = document.getElementById('customLargeAlert');
        if (existingAlert) {
            document.body.removeChild(existingAlert);
        }
        
        // カスタムアラート要素を作成
        const alertDiv = document.createElement('div');
        alertDiv.id = 'customLargeAlert';
        alertDiv.className = 'notification';
        alertDiv.textContent = message;
        
        // 閉じるボタンを追加
        const closeButton = document.createElement('div');
        closeButton.textContent = 'OK';
        closeButton.className = 'close-button';
        closeButton.onclick = () => document.body.removeChild(alertDiv);
        alertDiv.appendChild(closeButton);
        
        // 3秒後に自動的に閉じる
        setTimeout(() => {
            if (document.body.contains(alertDiv)) {
                document.body.removeChild(alertDiv);
            }
        }, 3000);
        
        document.body.appendChild(alertDiv);
    }

    // 野菜品目の読み込み
    async loadVegetableItems() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/vegetables', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                this.vegetableList = await response.json();
                this.updateVegetableSelectPanel();
            } else {
                throw new Error('野菜品目の取得に失敗しました');
            }
        } catch (error) {
            console.error('野菜品目読み込みエラー:', error);
            this.showLargeAlert('野菜品目の読み込みに失敗しました');
        }
    }

    // 野菜品目選択パネルを更新
    updateVegetableSelectPanel() {
        const container = document.getElementById('vegetableGrid');
        container.innerHTML = '';
        
        this.vegetableList.forEach(item => {
            const vegetableItem = document.createElement('div');
            vegetableItem.className = 'vegetable-item';
            vegetableItem.textContent = item.item_name;
            vegetableItem.onclick = () => this.selectVegetable(item.item_name);
            
            container.appendChild(vegetableItem);
        });
    }

    // 月の表示を更新
    updateMonthDisplay() {
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        document.getElementById('currentMonth').textContent = 
            `${this.currentDate.getFullYear()}年${monthNames[this.currentDate.getMonth()]}`;
    }

    // 月を変更
    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderCalendar();
        this.updateMonthDisplay();
    }

    // 野菜品目選択パネルを開く
    openVegetableSelectPanel() {
        document.getElementById('vegetableSelectPanel').classList.add('active');
    }

    // 野菜品目選択パネルを閉じる
    closeVegetablePanel() {
        document.getElementById('vegetableSelectPanel').classList.remove('active');
    }

    // 品目選択
    selectVegetable(vegetableName) {
        this.closeVegetablePanel();
        this.openQuickInput();
        
        // 選択された日付と品目を記憶
        this.activeInput = {
            date: this.selectedDateKey,
            vegetable: vegetableName
        };
        
        // 選択された品目と日付に既存の入力があれば表示
        if (this.harvestData[vegetableName] && this.harvestData[vegetableName][this.selectedDateKey]) {
            this.currentInputValue = this.harvestData[vegetableName][this.selectedDateKey].toString();
            document.getElementById('inputDisplay').value = this.currentInputValue;
        } else {
            this.currentInputValue = '';
            document.getElementById('inputDisplay').value = '';
        }
    }

    // カレンダーをレンダリング
    renderCalendar() {
        const calendarBody = document.getElementById('calendarBody');
        calendarBody.innerHTML = '';
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        
        // 申請データを日付ごとにグループ化
        const requestsByDate = {};
        this.requestsData.forEach(request => {
            if (!requestsByDate[request.date]) {
                requestsByDate[request.date] = [];
            }
            request.items.forEach(item => {
                requestsByDate[request.date].push({
                    id: request.id,
                    name: item.name,
                    quantity: item.quantity,
                    originalRequest: request
                });
            });
        });
        
        // 前月の日付
        for (let i = 0; i < startDayOfWeek; i++) {
            const date = new Date(year, month, 1 - (startDayOfWeek - i));
            const dayElement = this.createDayElement(date, true, requestsByDate);
            calendarBody.appendChild(dayElement);
        }
        
        // 当月の日付
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const dayElement = this.createDayElement(date, false, requestsByDate);
            calendarBody.appendChild(dayElement);
        }
        
        // 次月の日付
        const remainingDays = 42 - (startDayOfWeek + lastDay.getDate());
        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(year, month + 1, day);
            const dayElement = this.createDayElement(date, true, requestsByDate);
            calendarBody.appendChild(dayElement);
        }
    }

    // 日付要素を作成
    createDayElement(date, isOtherMonth, requestsByDate) {
        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day ${isOtherMonth ? 'other-month' : ''}`;
        dayElement.dataset.date = date.toISOString().split('T')[0];
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        
        dayElement.appendChild(dayNumber);
        
        // 当月の日付のみ
        if (!isOtherMonth) {
            const dateKey = date.toISOString().split('T')[0];
            
            // 申請データがあれば表示
            if (requestsByDate[dateKey] && requestsByDate[dateKey].length > 0) {
                const dayQuantities = document.createElement('div');
                dayQuantities.className = 'day-quantities';
                
                // 品目が1つだけの場合はそのまま表示
                if (requestsByDate[dateKey].length === 1) {
                    const item = requestsByDate[dateKey][0];
                    const quantityDiv = document.createElement('div');
                    quantityDiv.className = 'day-quantity existing';
                    quantityDiv.innerHTML = `<span>${item.name.substr(0, 2)}</span><span>${item.quantity}</span>`;
                    dayQuantities.appendChild(quantityDiv);
                } 
                // 品目が複数ある場合は「1品目 + クリックで詳細」を表示
                else {
                    const firstItem = requestsByDate[dateKey][0];
                    const quantityDiv = document.createElement('div');
                    quantityDiv.className = 'day-quantity existing';
                    quantityDiv.innerHTML = `<span>${firstItem.name.substr(0, 2)}</span><span>${firstItem.quantity}</span>`;
                    dayQuantities.appendChild(quantityDiv);
                    
                    // 「+N」表示を追加
                    const moreIndicator = document.createElement('div');
                    moreIndicator.className = 'more-indicator';
                    moreIndicator.textContent = `+${requestsByDate[dateKey].length - 1}品目`;
                    dayQuantities.appendChild(moreIndicator);
                }
                
                dayElement.appendChild(dayQuantities);
                dayElement.classList.add('has-requests');
                
                // クリックで詳細モーダルを開く
                dayElement.onclick = () => {
                    this.showDetailsModal(dateKey, requestsByDate[dateKey]);
                };
            }
            else {
                // 申請中の品目があれば表示
                let hasPendingItems = false;
                const pendingItems = [];
                
                // すべての品目をチェック
                for (const vegetable in this.harvestData) {
                    if (this.harvestData[vegetable][dateKey]) {
                        pendingItems.push({
                            name: vegetable,
                            quantity: this.harvestData[vegetable][dateKey]
                        });
                        hasPendingItems = true;
                    }
                }
                
                if (hasPendingItems) {
                    const dayQuantities = document.createElement('div');
                    dayQuantities.className = 'day-quantities';
                    
                    // 最初の1つだけ表示
                    const firstItem = pendingItems[0];
                    const quantityDiv = document.createElement('div');
                    quantityDiv.className = 'day-quantity pending';
                    quantityDiv.innerHTML = `<span>${firstItem.name.substr(0, 2)}</span><span>${firstItem.quantity}</span>`;
                    dayQuantities.appendChild(quantityDiv);
                    
                    // 申請中の品目が複数あれば「+N」表示
                    if (pendingItems.length > 1) {
                        const moreIndicator = document.createElement('div');
                        moreIndicator.className = 'more-indicator';
                        moreIndicator.textContent = `+${pendingItems.length - 1}品目`;
                        dayQuantities.appendChild(moreIndicator);
                    }
                    
                    dayElement.appendChild(dayQuantities);
                    dayElement.classList.add('selected');
                }
                
                // 品目選択のためのクリックイベント
                dayElement.onclick = () => {
                    this.selectedDateKey = dateKey;
                    this.openVegetableSelectPanel();
                };
            }
        }
        
        return dayElement;
    }

    // 詳細モーダルを表示
    showDetailsModal(dateKey, items) {
        this.currentDetailsDate = dateKey;
        
        // 日付の表示
        const dateObj = new Date(dateKey);
        const formattedDate = dateObj.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        document.getElementById('detailsDate').textContent = formattedDate;
        
        // 品目一覧を表示
        const itemsContainer = document.getElementById('detailsItems');
        itemsContainer.innerHTML = '';
        
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'details-item';
            itemElement.innerHTML = `
                <div class="details-item-info">
                    <div class="details-item-name">${item.name}</div>
                    <div class="details-item-quantity">${item.quantity}個</div>
                </div>
                <div class="details-item-actions">
                    <button class="edit-btn" onclick="calendar.editRequest('${item.id}', '${item.name}', '${dateKey}', ${item.quantity})">編集</button>
                    <button class="delete-btn" onclick="calendar.deleteRequest('${item.id}')">削除</button>
                </div>
            `;
            itemsContainer.appendChild(itemElement);
        });
        
        // モーダルを表示
        document.getElementById('detailsModal').classList.add('active');
    }

    // 詳細モーダルを閉じる
    closeDetailsModal() {
        document.getElementById('detailsModal').classList.remove('active');
        this.currentDetailsDate = null;
    }

    // 編集モーダルを開く
    editRequest(requestId, vegetableName, currentDate, currentQuantity) {
        this.editingRequest = {
            id: requestId,
            vegetable: vegetableName,
            originalDate: currentDate,
            originalQuantity: currentQuantity
        };
        
        // フォームに現在の値を設定
        document.getElementById('editDate').value = currentDate;
        document.getElementById('editQuantity').value = currentQuantity;
        
        // 詳細モーダルを閉じて編集モーダルを開く
        this.closeDetailsModal();
        document.getElementById('editModal').classList.add('active');
    }

    // 編集モーダルを閉じる
    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        this.editingRequest = null;
    }

    // 編集を保存
    async saveEdit() {
        if (!this.editingRequest) return;
        
        const newDate = document.getElementById('editDate').value;
        const newQuantity = parseInt(document.getElementById('editQuantity').value);
        
        if (!newDate || !newQuantity || newQuantity <= 0) {
            this.showLargeAlert('正しい日付と数量を入力してください');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/harvest-requests/${this.editingRequest.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    harvest_date: newDate,
                    quantity: newQuantity
                })
            });
            
            if (response.ok) {
                this.showLargeAlert('申請を更新しました');
                this.closeEditModal();
                await this.loadRequestsData();
            } else {
                throw new Error('更新に失敗しました');
            }
        } catch (error) {
            console.error('更新エラー:', error);
            this.showLargeAlert('更新でエラーが発生しました');
        }
    }

    // 申請を削除
    async deleteRequest(requestId) {
        if (!confirm('この申請を削除してもよろしいですか？')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/harvest-requests/${requestId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                this.showLargeAlert('申請を削除しました');
                this.closeDetailsModal();
                await this.loadRequestsData();
            } else {
                throw new Error('削除に失敗しました');
            }
        } catch (error) {
            console.error('削除エラー:', error);
            this.showLargeAlert('削除でエラーが発生しました');
        }
    }

    // 申請データを読み込み
    async loadRequestsData() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/harvest-requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const rawData = await response.json();
                
                // 申請データを整形
                const tempRequestsData = [];
                const groupedByDate = {};
                
                // 日付ごとにグループ化
                rawData.forEach(item => {
                    const dateKey = item.harvest_date;
                    if (!groupedByDate[dateKey]) {
                        groupedByDate[dateKey] = {
                            id: item.id,
                            date: dateKey,
                            items: []
                        };
                    }
                    
                    groupedByDate[dateKey].items.push({
                        id: item.id,
                        name: item.vegetable_name || item.vegetable_item, // Support both field names
                        quantity: item.quantity
                    });
                });
                
                // 配列に変換
                for (const dateKey in groupedByDate) {
                    tempRequestsData.push(groupedByDate[dateKey]);
                }
                
                this.requestsData = tempRequestsData;
                this.updateSummary();
                this.renderCalendar();
            } else {
                throw new Error('申請データの取得に失敗しました');
            }
        } catch (error) {
            console.error('申請データ読み込みエラー:', error);
            this.showLargeAlert('申請データの読み込みに失敗しました');
        }
    }

    // サマリー更新
    updateSummary() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const total = this.requestsData.length;
        
        // 明日以降の申請の最も早い日付を取得
        const futureRequests = this.requestsData
            .filter(r => new Date(r.date) >= tomorrow)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const nextShipDate = futureRequests.length > 0 
            ? new Date(futureRequests[0].date).toLocaleDateString('ja-JP', {
                month: 'numeric',
                day: 'numeric'
            })
            : '-';
        
        document.getElementById('nextShipDate').textContent = nextShipDate;
        document.getElementById('totalRequests').textContent = total;
    }

    // クイック入力パネルを開く
    openQuickInput() {
        document.getElementById('quickInputPanel').classList.add('active');
    }

    // 数字入力
    inputNumber(num) {
        this.currentInputValue += num;
        document.getElementById('inputDisplay').value = this.currentInputValue;
    }

    // クリア
    clearInput() {
        this.currentInputValue = '';
        document.getElementById('inputDisplay').value = '';
    }

    // バックスペース
    backspace() {
        this.currentInputValue = this.currentInputValue.slice(0, -1);
        document.getElementById('inputDisplay').value = this.currentInputValue;
    }

    // クイック入力
    quickFill(value) {
        this.currentInputValue = value.toString();
        document.getElementById('inputDisplay').value = this.currentInputValue;
    }

    // 確定ボタン処理
    confirmInput() {
        if (this.activeInput) {
            // 入力値を保存
            this.saveInputValue(this.activeInput, this.currentInputValue);
            this.closeQuickInput();
            // カレンダーを再描画
            this.renderCalendar();
        }
    }

    // 入力パネルを閉じる
    closeQuickInput() {
        document.getElementById('quickInputPanel').classList.remove('active');
        this.activeInput = null;
        this.currentInputValue = '';
    }

    // 入力値を保存
    saveInputValue(input, value) {
        if (!input.vegetable || !input.date) return;
        
        const dateKey = input.date;
        const vegetable = input.vegetable;
        
        if (!this.harvestData[vegetable]) {
            this.harvestData[vegetable] = {};
        }
        
        if (value) {
            // 数値に変換
            const numberValue = parseInt(value);
            this.harvestData[vegetable][dateKey] = numberValue;
        } else {
            // 値がなければ削除
            delete this.harvestData[vegetable][dateKey];
        }
    }

    // 一括申請
    async submitAll() {
        if (this.isSubmitting) return;
        
        const requests = [];
        
        for (const vegetable in this.harvestData) {
            for (const date in this.harvestData[vegetable]) {
                const quantity = this.harvestData[vegetable][date];
                if (quantity > 0) {
                    requests.push({
                        vegetable_name: vegetable,
                        harvest_date: date,
                        quantity: quantity
                    });
                }
            }
        }
        
        if (requests.length === 0) {
            this.showLargeAlert('申請データがありません');
            return;
        }
        
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.textContent;
        
        this.isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = '送信中...';
        
        try {
            await this.submitBulkRequests(requests);
            this.showLargeAlert(`${requests.length}件の申請が完了しました`);
            this.harvestData = {};
            await this.loadRequestsData();
        } catch (error) {
            this.showLargeAlert('申請に失敗しました');
            console.error(error);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            this.isSubmitting = false;
        }
    }
    
    // 一括申請の実行
    async submitBulkRequests(requests) {
        const token = localStorage.getItem('token');
        let successCount = 0;
        let errorCount = 0;
        
        for (const request of requests) {
            try {
                const response = await fetch('/api/harvest-requests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(request)
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error("申請エラー:", error);
                errorCount++;
            }
        }
        
        if (errorCount > 0) {
            throw new Error(`${errorCount}件の申請に失敗しました`);
        }
    }

    // ログアウト
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// グローバル関数（HTMLから呼び出されるため）
let calendar;

function changeMonth(delta) {
    calendar.changeMonth(delta);
}

function openVegetableSelectPanel() {
    calendar.openVegetableSelectPanel();
}

function closeVegetablePanel() {
    calendar.closeVegetablePanel();
}

function openQuickInput() {
    calendar.openQuickInput();
}

function closeQuickInput() {
    calendar.closeQuickInput();
}

function inputNumber(num) {
    calendar.inputNumber(num);
}

function clearInput() {
    calendar.clearInput();
}

function backspace() {
    calendar.backspace();
}

function quickFill(value) {
    calendar.quickFill(value);
}

function confirmInput() {
    calendar.confirmInput();
}

function closeDetailsModal() {
    calendar.closeDetailsModal();
}

function closeEditModal() {
    calendar.closeEditModal();
}

function saveEdit() {
    calendar.saveEdit();
}

function submitAll() {
    calendar.submitAll();
}

function logout() {
    calendar.logout();
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    calendar = new VegetableCalendar();
});