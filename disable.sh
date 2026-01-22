#!/bin/bash
# Disable web-bridge hooks (keeps files installed)

node << 'NODEJS'
const fs = require('fs');
const os = require('os');
const path = require('path');

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

let settings = {};
try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (e) {
    console.log('No settings file found');
    process.exit(0);
}

if (!settings.hooks) {
    console.log('No hooks configured');
    process.exit(0);
}

let removed = 0;
for (const event of Object.keys(settings.hooks)) {
    const before = settings.hooks[event].length;
    settings.hooks[event] = settings.hooks[event].filter(h =>
        !h.hooks?.some(hh => hh.command?.includes('web-bridge'))
    );
    removed += before - settings.hooks[event].length;
    if (settings.hooks[event].length === 0) {
        delete settings.hooks[event];
    }
}

if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log(`✓ Web Bridge disabled (removed ${removed} hooks)`);
console.log('  Run ~/.claude/web-bridge/enable.sh to re-enable');
NODEJS
