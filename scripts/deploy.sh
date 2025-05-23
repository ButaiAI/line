#!/bin/bash

set -e

echo "🚀 野菜収穫管理システム デプロイスクリプト"
echo "================================================="

PROJECT_NAME="vegetable-harvest-system"
BUILD_DIR="./build"
API_DIR="./api"

check_requirements() {
    echo "📋 必要なツールの確認中..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js がインストールされていません"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm がインストールされていません"
        exit 1
    fi
    
    if ! command -v vercel &> /dev/null; then
        echo "❌ Vercel CLI がインストールされていません"
        echo "   npm install -g vercel でインストールしてください"
        exit 1
    fi
    
    echo "✅ 必要なツールが揃っています"
}

check_environment() {
    echo "🔧 環境変数の確認中..."
    
    if [ ! -f ".env.local" ] && [ ! -f ".env.production" ]; then
        echo "❌ 環境設定ファイルが見つかりません"
        echo "   .env.local または .env.production を作成してください"
        exit 1
    fi
    
    required_vars=(
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_KEY"
        "LINE_CHANNEL_ID"
        "LINE_CHANNEL_SECRET"
        "LINE_CHANNEL_ACCESS_TOKEN"
        "JWT_SECRET"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo "❌ 以下の環境変数が設定されていません:"
        printf '   %s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    echo "✅ 環境変数が正しく設定されています"
}

install_dependencies() {
    echo "📦 依存関係のインストール中..."
    
    if [ -f "package.json" ]; then
        npm ci
        echo "✅ 依存関係をインストールしました"
    else
        echo "⚠️  package.json が見つかりません。依存関係のインストールをスキップします"
    fi
}

run_tests() {
    echo "🧪 テストの実行中..."
    
    if [ -f "package.json" ] && npm run test --if-present; then
        echo "✅ テストが成功しました"
    else
        echo "⚠️  テストスクリプトが見つからないか、テストに失敗しました"
        read -p "デプロイを続行しますか？ (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

build_project() {
    echo "🔨 プロジェクトのビルド中..."
    
    if [ -f "package.json" ] && npm run build --if-present; then
        echo "✅ ビルドが成功しました"
    else
        echo "⚠️  ビルドスクリプトが見つかりません"
    fi
}

setup_vercel() {
    echo "⚙️  Vercelの設定中..."
    
    if [ ! -f "vercel.json" ]; then
        echo "📝 vercel.json を作成中..."
        cat > vercel.json << EOF
{
  "version": 2,
  "name": "${PROJECT_NAME}",
  "builds": [
    {
      "src": "public/**/*",
      "use": "@vercel/static"
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/\$1"
    },
    {
      "src": "/(.*)",
      "dest": "/public/\$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  }
}
EOF
        echo "✅ vercel.json を作成しました"
    fi
}

deploy_to_vercel() {
    echo "🚀 Vercelへのデプロイ中..."
    
    if [ "$1" = "production" ]; then
        vercel --prod --yes
        echo "🎉 本番環境へのデプロイが完了しました！"
    else
        vercel --yes
        echo "🎉 プレビュー環境へのデプロイが完了しました！"
    fi
}

setup_database() {
    echo "🗄️  データベースの設定確認中..."
    
    if [ -f "database/schema.sql" ]; then
        echo "📝 データベーススキーマが見つかりました"
        echo "   Supabaseダッシュボードで手動でスキーマを適用してください："
        echo "   https://app.supabase.com/"
    else
        echo "⚠️  データベーススキーマファイルが見つかりません"
    fi
}

show_post_deploy_info() {
    echo ""
    echo "🎉 デプロイが完了しました！"
    echo "================================"
    echo ""
    echo "📋 デプロイ後の確認事項："
    echo "  1. Vercelダッシュボードでデプロイ状況を確認"
    echo "  2. 環境変数がすべて正しく設定されているか確認"
    echo "  3. Supabaseダッシュボードでデータベース設定を確認"
    echo "  4. LINE DevelopersコンソールでWebhook URLを更新"
    echo "  5. 統合テストページでシステム動作を確認"
    echo ""
    echo "🔗 役に立つリンク："
    echo "  - Vercel Dashboard: https://vercel.com/dashboard"
    echo "  - Supabase Dashboard: https://app.supabase.com/"
    echo "  - LINE Developers: https://developers.line.biz/"
    echo ""
    echo "📞 問題が発生した場合は docs/TROUBLESHOOTING.md を参照してください"
}

main() {
    echo "デプロイタイプを選択してください:"
    echo "1. プレビュー (開発環境)"
    echo "2. 本番環境"
    read -p "選択 (1-2): " deploy_type
    
    case $deploy_type in
        1)
            DEPLOY_ENV="preview"
            ;;
        2)
            DEPLOY_ENV="production"
            ;;
        *)
            echo "❌ 無効な選択です"
            exit 1
            ;;
    esac
    
    echo ""
    echo "🚀 ${DEPLOY_ENV} 環境へのデプロイを開始します..."
    echo ""
    
    check_requirements
    check_environment
    install_dependencies
    run_tests
    build_project
    setup_vercel
    setup_database
    
    deploy_to_vercel "$DEPLOY_ENV"
    
    show_post_deploy_info
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi