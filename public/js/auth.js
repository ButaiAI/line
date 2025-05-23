// 認証関連のJavaScript機能

const API_BASE_URL = window.location.origin;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
  initializeAuth();
});

function initializeAuth() {
  // URLパラメータから origin を取得
  const urlParams = new URLSearchParams(window.location.search);
  const origin = urlParams.get('origin') || 'main';
  
  // hidden input に origin を設定
  const originInput = document.getElementById('origin');
  if (originInput) {
    originInput.value = origin;
  }
  
  // LINE ログインボタンの設定
  setupLineLogin();
  
  // 手動ログインフォームの設定
  setupManualLogin();
  
  // エラーメッセージのクリア
  clearErrorMessage();
}

function setupLineLogin() {
  const lineLoginBtn = document.querySelector('.line-login-btn');
  if (lineLoginBtn) {
    lineLoginBtn.addEventListener('click', function(e) {
      e.preventDefault();
      startLineLogin();
    });
  }
}

function setupManualLogin() {
  const testLoginForm = document.getElementById('testLoginForm');
  if (testLoginForm) {
    testLoginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      manualLogin();
    });
  }
  
  // Enterキーでの送信対応
  const inputs = document.querySelectorAll('#testLoginForm input');
  inputs.forEach(input => {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        manualLogin();
      }
    });
  });
}

async function startLineLogin() {
  try {
    showMessage('LINEログインを開始しています...', 'info');
    
    // LINE認証URLを取得
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.authUrl) {
      // LINE認証ページにリダイレクト
      window.location.href = data.authUrl;
    } else {
      throw new Error(data.error || 'LINE認証URLの取得に失敗しました');
    }
    
  } catch (error) {
    console.error('LINE認証エラー:', error);
    showMessage('LINE認証の開始に失敗しました: ' + error.message, 'error');
  }
}

async function manualLogin() {
  const email = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value?.trim();
  
  if (!email || !password) {
    showMessage('メールアドレスとパスワードを入力してください', 'error');
    return;
  }
  
  try {
    showMessage('ログイン中...', 'info');
    
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password,
        testMode: true\n      })\n    });\n    \n    const data = await response.json();\n    \n    if (data.success && data.token) {\n      // JWTトークンを保存\n      localStorage.setItem('authToken', data.token);\n      localStorage.setItem('userData', JSON.stringify(data.user));\n      \n      showMessage('ログインに成功しました', 'success');\n      \n      // リダイレクト処理\n      const origin = document.getElementById('origin')?.value || 'main';\n      redirectAfterLogin(origin, data.user);\n      \n    } else {\n      throw new Error(data.error || 'ログインに失敗しました');\n    }\n    \n  } catch (error) {\n    console.error('ログインエラー:', error);\n    showMessage('ログインに失敗しました: ' + error.message, 'error');\n  }\n}\n\nfunction redirectAfterLogin(origin, user) {\n  let redirectUrl;\n  \n  if (user.role === 'admin') {\n    // 管理者は管理画面へ\n    redirectUrl = '/admin';\n  } else {\n    // 一般ユーザーはoriginに応じてリダイレクト\n    switch (origin) {\n      case 'oricon':\n        redirectUrl = '/main?tab=oricon';\n        break;\n      case 'history':\n        redirectUrl = '/main?tab=history';\n        break;\n      default:\n        redirectUrl = '/main';\n    }\n  }\n  \n  // 少し遅延してからリダイレクト（成功メッセージを見せるため）\n  setTimeout(() => {\n    window.location.href = redirectUrl;\n  }, 1000);\n}\n\nfunction showMessage(message, type = 'info') {\n  const messageArea = document.getElementById('messageArea');\n  if (messageArea) {\n    messageArea.textContent = message;\n    messageArea.className = `message-area ${type}`;\n    messageArea.style.display = 'block';\n    \n    // エラーメッセージ以外は自動で消去\n    if (type !== 'error') {\n      setTimeout(() => {\n        clearErrorMessage();\n      }, 5000);\n    }\n  }\n}\n\nfunction clearErrorMessage() {\n  const messageArea = document.getElementById('messageArea');\n  if (messageArea) {\n    messageArea.style.display = 'none';\n    messageArea.textContent = '';\n    messageArea.className = 'message-area';\n  }\n}\n\n// 認証状態の確認\nfunction isAuthenticated() {\n  const token = localStorage.getItem('authToken');\n  return !!token;\n}\n\n// ユーザー情報の取得\nfunction getCurrentUser() {\n  const userDataStr = localStorage.getItem('userData');\n  return userDataStr ? JSON.parse(userDataStr) : null;\n}\n\n// ログアウト処理\nfunction logout() {\n  localStorage.removeItem('authToken');\n  localStorage.removeItem('userData');\n  window.location.href = '/';\n}\n\n// APIリクエスト用の認証ヘッダー取得\nfunction getAuthHeaders() {\n  const token = localStorage.getItem('authToken');\n  return {\n    'Content-Type': 'application/json',\n    'Authorization': token ? `Bearer ${token}` : ''\n  };\n}\n\n// 認証が必要なAPIリクエストのヘルパー\nasync function authenticatedFetch(url, options = {}) {\n  const headers = {\n    ...getAuthHeaders(),\n    ...options.headers\n  };\n  \n  const response = await fetch(url, {\n    ...options,\n    headers\n  });\n  \n  // 401エラーの場合はログインページにリダイレクト\n  if (response.status === 401) {\n    logout();\n    return;\n  }\n  \n  return response;\n}\n\n// グローバルに公開する関数\nwindow.manualLogin = manualLogin;\nwindow.logout = logout;\nwindow.isAuthenticated = isAuthenticated;\nwindow.getCurrentUser = getCurrentUser;\nwindow.authenticatedFetch = authenticatedFetch;"