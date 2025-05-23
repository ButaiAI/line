// メイン画面のJavaScript機能

const API_BASE_URL = window.location.origin;
let currentUser = null;
let vegetables = [];

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
  initializeMainPage();
});

async function initializeMainPage() {
  try {
    // 認証チェック
    if (!isAuthenticated()) {
      window.location.href = '/';
      return;
    }
    
    currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '/';
      return;
    }
    
    // ユーザー名表示
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
      userNameElement.textContent = currentUser.name || currentUser.user_name || 'ユーザー';
    }
    
    // タブ切り替えの設定
    setupTabs();
    
    // ログアウトボタンの設定
    setupLogout();
    
    // フォーム送信の設定
    setupForms();
    
    // URLパラメータからタブを設定
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get('tab') || 'harvest';
    switchTab(activeTab);
    
    // 初期データを読み込み
    await loadInitialData();
    
    // 日付の最小値を今日に設定
    const today = new Date().toISOString().split('T')[0];
    const deliveryDateInput = document.getElementById('deliveryDate');
    if (deliveryDateInput) {
      deliveryDateInput.min = today;
    }
    
  } catch (error) {
    console.error('初期化エラー:', error);
    showMessage('ページの初期化に失敗しました', 'error');
  }
}

async function loadInitialData() {
  try {
    // 野菜品目一覧を取得
    await loadVegetables();
    
    // 申請履歴を読み込み
    await loadHarvestHistory();
    
    // オリコン履歴を読み込み
    await loadOriconHistory();
    
  } catch (error) {
    console.error('データ読み込みエラー:', error);
    showMessage('データの読み込みに失敗しました', 'error');
  }
}

function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // すべてのタブボタンとコンテンツを非アクティブにする
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // 指定されたタブをアクティブにする
  const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
  const targetContent = document.getElementById(`${tabName}Tab`);
  
  if (targetButton && targetContent) {
    targetButton.classList.add('active');
    targetContent.classList.add('active');
  }
  
  // タブ切り替え時の追加処理
  switch (tabName) {
    case 'history':
      loadHarvestHistory();
      break;
    case 'oricon':
      loadOriconHistory();
      break;
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (confirm('ログアウトしますか？')) {
        logout();
      }
    });
  }
}

function setupForms() {
  // 集荷申請フォーム
  const harvestForm = document.getElementById('harvestForm');
  if (harvestForm) {
    harvestForm.addEventListener('submit', function(e) {
      e.preventDefault();
      submitHarvestRequest();
    });
  }
  
  // オリコン貸出フォーム
  const oriconForm = document.getElementById('oriconForm');
  if (oriconForm) {
    oriconForm.addEventListener('submit', function(e) {
      e.preventDefault();
      submitOriconRequest();
    });
  }
}

async function loadVegetables() {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/vegetables/list`);
    if (!response) return;
    
    const data = await response.json();
    
    if (data.success) {
      vegetables = data.data;
      populateVegetableSelect();
    } else {
      throw new Error(data.error || '野菜品目の取得に失敗しました');
    }
    
  } catch (error) {
    console.error('野菜品目取得エラー:', error);
    showMessage('野菜品目の読み込みに失敗しました', 'error');
  }
}

function populateVegetableSelect() {
  const select = document.getElementById('vegetableItem');
  if (!select) return;
  
  // 既存のオプションをクリア（最初のオプションは残す）
  while (select.children.length > 1) {
    select.removeChild(select.lastChild);
  }
  
  // 野菜品目を追加
  vegetables.forEach(vegetable => {
    const option = document.createElement('option');
    option.value = vegetable.item_name;
    option.textContent = vegetable.item_name;
    select.appendChild(option);
  });
}

async function submitHarvestRequest() {
  try {
    const form = document.getElementById('harvestForm');
    const formData = new FormData(form);
    
    const requestData = {
      vegetable_item: formData.get('vegetableItem'),
      delivery_date: formData.get('deliveryDate'),
      time_slot: formData.get('timeSlot'),
      quantity: parseFloat(formData.get('quantity')),
      location: formData.get('location'),
      contact_phone: formData.get('contactPhone'),
      notes: formData.get('notes') || null
    };
    
    // バリデーション
    if (!requestData.vegetable_item || !requestData.delivery_date || !requestData.time_slot || 
        !requestData.quantity || !requestData.location || !requestData.contact_phone) {
      showMessage('必須項目を入力してください', 'error');
      return;
    }
    
    // 電話番号の簡単なバリデーション
    const phoneRegex = /^[0-9\-\s\(\)]+$/;
    if (!phoneRegex.test(requestData.contact_phone)) {
      showMessage('正しい電話番号を入力してください', 'error');
      return;
    }
    
    // 集荷希望日が今日以降かチェック
    const today = new Date();
    const harvestDate = new Date(requestData.delivery_date);
    if (harvestDate < today.setHours(0, 0, 0, 0)) {
      showMessage('集荷希望日は今日以降の日付を選択してください', 'error');
      return;
    }
    
    // 送信ボタンを無効化
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '申請中...';
    
    const response = await authenticatedFetch(`${API_BASE_URL}/api/harvest/submit`, {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
    
    if (!response) return;
    
    const data = await response.json();
    
    if (data.success) {
      showMessage('集荷申請を登録しました', 'success');
      form.reset();
      // 履歴を更新
      await loadHarvestHistory();
    } else {
      throw new Error(data.error || '申請の登録に失敗しました');
    }
    
  } catch (error) {
    console.error('集荷申請エラー:', error);
    showMessage('申請の登録に失敗しました: ' + error.message, 'error');
  } finally {
    // 送信ボタンを元に戻す
    const submitBtn = document.querySelector('#harvestForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '申請する';
    }
  }
}

async function submitOriconRequest() {
  try {
    const form = document.getElementById('oriconForm');
    const formData = new FormData(form);
    
    const requestData = {
      pickup_date: formData.get('pickupDate'),
      quantity: parseInt(formData.get('oriconQuantity')),
      notes: formData.get('notes') || null
    };
    
    // バリデーション
    if (!requestData.pickup_date || !requestData.quantity) {
      showMessage('必須項目を入力してください', 'error');
      return;
    }
    
    const response = await authenticatedFetch(`${API_BASE_URL}/api/oricon/submit`, {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
    
    if (!response) return;
    
    const data = await response.json();
    
    if (data.success) {
      showMessage('オリコン貸出申請を登録しました', 'success');
      form.reset();
      // 履歴を更新
      await loadOriconHistory();
    } else {
      throw new Error(data.error || '申請の登録に失敗しました');
    }
    
  } catch (error) {
    console.error('オリコン申請エラー:', error);
    showMessage('申請の登録に失敗しました: ' + error.message, 'error');
  }
}

async function loadHarvestHistory() {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/harvest/list`);
    if (!response) return;
    
    const data = await response.json();
    
    if (data.success) {
      displayHarvestHistory(data.data);
    } else {
      throw new Error(data.error || '申請履歴の取得に失敗しました');
    }
    
  } catch (error) {
    console.error('申請履歴取得エラー:', error);
    const historyList = document.getElementById('historyList');
    if (historyList) {
      historyList.innerHTML = '<div class="error">申請履歴の読み込みに失敗しました</div>';
    }
  }
}

function displayHarvestHistory(requests) {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;
  
  if (!requests || requests.length === 0) {
    historyList.innerHTML = '<div class="no-data">申請履歴がありません</div>';
    return;
  }
  
  const html = requests.map(request => `
    <div class="history-item">
      <div class="history-item-header">
        <span class="history-item-title">${request.vegetable_item}</span>
        <span class="status-badge status-${request.status}">${getStatusText(request.status)}</span>
      </div>
      <div class="history-item-details">
        <p>集荷希望日: ${formatDate(request.delivery_date)}</p>
        ${request.time_slot ? `<p>時間帯: ${formatTimeSlot(request.time_slot)}</p>` : ''}
        <p>数量: ${request.quantity}kg</p>
        ${request.location ? `<p>場所: ${request.location}</p>` : ''}
        ${request.contact_phone ? `<p>連絡先: ${request.contact_phone}</p>` : ''}
        ${request.notes ? `<p>備考: ${request.notes}</p>` : ''}
        <p class="created-at">申請日: ${formatDateTime(request.created_at)}</p>
      </div>
    </div>
  `).join('');
  
  historyList.innerHTML = html;
}

async function loadOriconHistory() {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/oricon/list`);
    if (!response) return;
    
    const data = await response.json();
    
    if (data.success) {
      displayOriconHistory(data.data);
    } else {
      throw new Error(data.error || 'オリコン履歴の取得に失敗しました');
    }
    
  } catch (error) {
    console.error('オリコン履歴取得エラー:', error);
    const oriconHistory = document.getElementById('oriconHistory');
    if (oriconHistory) {
      oriconHistory.innerHTML = '<div class="error">オリコン履歴の読み込みに失敗しました</div>';
    }
  }
}

function displayOriconHistory(rentals) {
  const oriconHistory = document.getElementById('oriconHistory');
  if (!oriconHistory) return;
  
  if (!rentals || rentals.length === 0) {
    oriconHistory.innerHTML = '<h3>最近の貸出履歴</h3><div class="no-data">貸出履歴がありません</div>';
    return;
  }
  
  const html = `
    <h3>最近の貸出履歴</h3>
    ${rentals.map(rental => `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-item-title">オリコン ${rental.quantity}個</span>
          <span class="status-badge status-${rental.status}">${getStatusText(rental.status)}</span>
        </div>
        <div class="history-item-details">
          <p>受取希望日: ${formatDate(rental.pickup_date)}</p>
          <p class="created-at">申請日: ${formatDateTime(rental.created_at)}</p>
        </div>
      </div>
    `).join('')}
  `;
  
  oriconHistory.innerHTML = html;
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待機中',
    'approved': '承認済',
    'rejected': '却下',
    'completed': '完了'
  };
  return statusMap[status] || status;
}

function formatTimeSlot(timeSlot) {
  const timeSlotMap = {
    'morning': '午前 (8:00-12:00)',
    'afternoon': '午後 (13:00-17:00)',
    'evening': '夕方 (17:00-19:00)'
  };
  return timeSlotMap[timeSlot] || timeSlot;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP');
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP');
}

function showMessage(message, type = 'info') {
  const messageArea = document.getElementById('messageArea');
  if (messageArea) {
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
    messageArea.style.display = 'block';
    
    // エラーメッセージ以外は自動で消去
    if (type !== 'error') {
      setTimeout(() => {
        messageArea.style.display = 'none';
      }, 5000);
    }
  }
}

// ユーティリティ関数をグローバルに公開
window.switchTab = switchTab;
window.submitHarvestRequest = submitHarvestRequest;
window.submitOriconRequest = submitOriconRequest;