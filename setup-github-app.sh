# Setup script for Milestone 3

echo "📦 Installing dependencies for code analysis..."

cd functions-worker

# Core dependencies
pnpm add simple-git @octokit/rest
pnpm add @babel/parser @babel/traverse @babel/types

# Type definitions
pnpm add -D @types/babel__traverse @types/babel__core

echo "✅ Dependencies installed!"
echo ""
echo "Next: Create directory structure"
echo "  mkdir -p src/services"
echo "  mkdir -p src/analyzers"
echo "  mkdir -p src/utils"



#!/bin/bash
# setup-github-app.sh
# Quick setup script for GitHub App configuration

echo "🚀 GitHub App Setup Helper"
echo ""

# Check if .env files exist
if [ ! -f "functions-worker/.env" ]; then
    echo "📝 Creating functions-worker/.env template..."
    cat > functions-worker/.env.example << 'EOF'
# GitHub App Configuration (REQUIRED for GitHub App)
GITHUB_APP_ID=
GITHUB_APP_INSTALLATION_ID=
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-key.pem

# OR use Personal Access Token (alternative)
# GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Disable mock mode to use real GitHub API
MOCK_GITHUB=false
EOF
    cp functions-worker/.env.example functions-worker/.env
    echo "✅ Created functions-worker/.env"
fi

if [ ! -f "functions-api/.env" ]; then
    echo "📝 Creating functions-api/.env template..."
    cat > functions-api/.env.example << 'EOF'
# Webhook Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
GITHUB_WEBHOOK_SECRET=dev-secret
EOF
    cp functions-api/.env.example functions-api/.env
    echo "✅ Created functions-api/.env"
fi

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Create GitHub App at: https://github.com/settings/apps"
echo "2. Download private key (.pem file)"
echo "3. Copy private key:"
echo "   cp ~/Downloads/your-app.*.private-key.pem ./functions-worker/github-app-key.pem"
echo ""
echo "4. Edit functions-worker/.env and add:"
echo "   - GITHUB_APP_ID (from GitHub App settings)"
echo "   - GITHUB_APP_INSTALLATION_ID (from installation URL)"
echo ""
echo "5. Edit functions-api/.env and add:"
echo "   - GITHUB_WEBHOOK_SECRET (same as GitHub App webhook secret)"
echo ""
echo "6. Install dependencies:"
echo "   cd functions-worker && pnpm add @octokit/auth-app && pnpm install"
echo ""
echo "7. Build and test:"
echo "   cd functions-worker && pnpm run build"
echo "   firebase emulators:start"
echo ""
echo "8. Setup ngrok:"
echo "   npm install -g ngrok"
echo "   ngrok http 5001"
echo ""

echo "📚 Full guide: See docs/github-app-setup.md"
echo ""