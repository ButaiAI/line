// LINE OAuth2 コールバック処理

document.addEventListener('DOMContentLoaded', function() {
  handleLineCallback();
});

async function handleLineCallback() {
  try {
    // URLパラメータから認証コードを取得
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    // エラーチェック
    if (error) {
      throw new Error(`LINE認証エラー: ${error} - ${errorDescription || ''}`);
    }
    
    if (!code) {
      throw new Error('認証コードが取得できませんでした');
    }
    
    // STATE パラメータの検証
    const savedState = localStorage.getItem('lineLoginState');
    if (savedState && state !== savedState) {
      throw new Error('認証リクエストの検証に失敗しました');
    }
    
    showMessage('LINE認証を処理しています...', 'info');
    
    // サーバーに認証コードを送信
    const response = await fetch('/api/auth/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: code,
        state: state
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.token) {
      // 認証成功
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));
      
      // STATE パラメータをクリア
      localStorage.removeItem('lineLoginState');
      
      showMessage('認証に成功しました。メインページに移動します...', 'success');
      
      // メインページにリダイレクト
      setTimeout(() => {
        const user = data.user;
        let redirectUrl = '/main';
        
        if (user.role === 'admin') {
          redirectUrl = '/admin';
        }
        
        window.location.href = redirectUrl;
      }, 2000);
      
    } else {
      throw new Error(data.error || '認証に失敗しました');
    }
    
  } catch (error) {
    console.error('LINE認証コールバックエラー:', error);
    showMessage('認証に失敗しました: ' + error.message, 'error');
    
    // STATE パラメータをクリア
    localStorage.removeItem('lineLoginState');
    
    // エラー時は5秒後にログイン画面に戻る
    setTimeout(() => {
      window.location.href = '/';
    }, 5000);
  }
}

function showMessage(message, type = 'info') {
  const messageArea = document.getElementById('messageArea');
  if (messageArea) {
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
    messageArea.style.display = 'block';
  }
}