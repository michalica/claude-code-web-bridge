---
description: Start the Web Bridge server to view Claude Code messages in your browser
---

# Start Web Bridge Server

Start the web bridge server that exposes all Claude Code messages to a local web interface.

## Instructions

1. Open a **new terminal** (not this Claude Code session)
2. Run the start script:

```bash
~/.claude/plugins/web-bridge/start.sh
```

3. Open **http://localhost:6567** in your browser

## What You'll See

The web interface shows all Claude Code events in real-time:
- **UserPromptSubmit** - Your prompts before Claude processes them
- **PreToolUse** - Tools about to be executed (Bash, Write, Edit, etc.)
- **PostToolUse** - Tool results after execution
- **Stop** - When Claude finishes responding
- **Notification** - Notifications from Claude
- **SessionStart/End** - Session lifecycle events

## Custom Port

```bash
PORT=3000 ~/.claude/plugins/web-bridge/start.sh
```

The server runs independently from Claude Code, so keep it running in a separate terminal.
