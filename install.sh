#!/bin/bash

# Claude Code Web Bridge - Install
# Install once, works for ALL Claude Code sessions automatically

set -e

INSTALL_DIR="$HOME/.claude/web-bridge"
SETTINGS_FILE="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Claude Code Web Bridge - Install                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. You have: $(node -v)"
    exit 1
fi
echo "✓ Node.js $(node -v)"

# 2. Check if already installed
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠ Already installed at $INSTALL_DIR"
    read -p "  Reinstall? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
    rm -rf "$INSTALL_DIR"
fi

# 3. Copy files
echo "📁 Installing to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/hooks/scripts/send_event.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/server.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/public" "$INSTALL_DIR/"

# 4. Install dependencies
echo "📥 Installing dependencies..."
cd "$INSTALL_DIR"
npm install --silent 2>/dev/null || npm install

# 5. Create scripts
cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$HOME/.claude/web-bridge"
node server.js
EOF
chmod +x "$INSTALL_DIR/start.sh"

cp "$SCRIPT_DIR/enable.sh" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/disable.sh" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/enable.sh" "$INSTALL_DIR/disable.sh"

# 6. Backup and update settings.json
mkdir -p "$HOME/.claude"
if [ -f "$SETTINGS_FILE" ]; then
    cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup"
    echo "✓ Backed up settings to $SETTINGS_FILE.backup"
fi

echo "⚙️  Adding hooks to settings..."

node << 'NODEJS'
const fs = require('fs');
const os = require('os');
const path = require('path');

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const scriptPath = path.join(os.homedir(), '.claude', 'web-bridge', 'send_event.js');

let settings = {};
try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (e) {}

const hook = {
    type: "command",
    command: `node "${scriptPath}"`,
    timeout: 5
};

const hooksConfig = {
    SessionStart: [{ hooks: [hook] }],
    SessionEnd: [{ hooks: [hook] }],
    UserPromptSubmit: [{ hooks: [hook] }],
    PreToolUse: [{ matcher: "*", hooks: [hook] }],
    PostToolUse: [{ matcher: "*", hooks: [hook] }],
    Stop: [{ hooks: [hook] }],
    Notification: [{ hooks: [hook] }]
};

settings.hooks = settings.hooks || {};

for (const [event, config] of Object.entries(hooksConfig)) {
    settings.hooks[event] = settings.hooks[event] || [];
    const exists = settings.hooks[event].some(h =>
        h.hooks?.some(hh => hh.command?.includes('web-bridge'))
    );
    if (!exists) {
        settings.hooks[event].push(...config);
    }
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
NODEJS

echo
echo "✅ Installed!"
echo
echo "════════════════════════════════════════════════════════════"
echo
echo "  START SERVER:  ~/.claude/web-bridge/start.sh"
echo "  OPEN BROWSER:  http://localhost:6567"
echo "  DISABLE:       ~/.claude/web-bridge/disable.sh"
echo "  ENABLE:        ~/.claude/web-bridge/enable.sh"
echo
echo "════════════════════════════════════════════════════════════"
echo
echo "Now just use 'claude' normally - all events stream to the web UI!"
echo