#!/bin/bash

# Deploy changes to installed web-bridge

INSTALL_DIR="$HOME/.claude/web-bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$INSTALL_DIR" ]; then
    echo "❌ Web bridge not installed. Run ./install.sh first."
    exit 1
fi

echo "Deploying to $INSTALL_DIR ..."

cp "$SCRIPT_DIR/server.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/public/index.html" "$INSTALL_DIR/public/"
cp "$SCRIPT_DIR/hooks/scripts/send_event.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/enable.sh" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/disable.sh" "$INSTALL_DIR/"

echo "✅ Deployed! Restart the server to apply changes."
