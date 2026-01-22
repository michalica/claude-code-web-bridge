#!/bin/bash
# Enable web-bridge hooks

node << 'NODEJS'
const fs = require('fs');
const os = require('os');
const path = require('path');

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const scriptPath = path.join(os.homedir(), '.claude', 'web-bridge', 'send_event.js');

if (!fs.existsSync(scriptPath)) {
    console.log('❌ Web Bridge not installed. Run install.sh first.');
    process.exit(1);
}

let settings = {};
try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (e) {}

const fastHook = {
    type: "command",
    command: `node "${scriptPath}"`,
    timeout: 5
};

// PreToolUse needs longer timeout for permission approval (30s wait + 5s buffer)
const permissionHook = {
    type: "command",
    command: `node "${scriptPath}"`,
    timeout: 35
};

const hooksConfig = {
    SessionStart: [{ hooks: [fastHook] }],
    SessionEnd: [{ hooks: [fastHook] }],
    UserPromptSubmit: [{ hooks: [fastHook] }],
    PreToolUse: [{ matcher: "*", hooks: [permissionHook] }],
    PostToolUse: [{ matcher: "*", hooks: [fastHook] }],
    Stop: [{ hooks: [fastHook] }],
    Notification: [{ hooks: [fastHook] }]
};

settings.hooks = settings.hooks || {};

let added = 0;
for (const [event, config] of Object.entries(hooksConfig)) {
    settings.hooks[event] = settings.hooks[event] || [];
    const exists = settings.hooks[event].some(h =>
        h.hooks?.some(hh => hh.command?.includes('web-bridge'))
    );
    if (!exists) {
        settings.hooks[event].push(...config);
        added++;
    }
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log(`✓ Web Bridge enabled (${added} hooks added)`);
console.log('  Start server: ~/.claude/web-bridge/start.sh');
NODEJS