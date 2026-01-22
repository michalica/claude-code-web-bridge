# Claude Code Web Bridge

View and control Claude Code sessions from a real-time web interface.

**Install once → works for all sessions → approve/deny tools from the browser.**

## Install

```bash
git clone https://github.com/your-username/claude-code-web-bridge
cd claude-code-web-bridge
./install.sh
```

## Usage

```bash
# 1. Start the server (keep running)
~/.claude/web-bridge/start.sh

# 2. Open browser
open http://localhost:6567

# 3. Use Claude normally (in a NEW terminal)
claude
```

## Toggle On/Off

```bash
~/.claude/web-bridge/disable.sh   # turn off hooks
~/.claude/web-bridge/enable.sh    # turn on hooks
```

## Features

- **Real-time event streaming** via WebSocket
- **Permission control** - Approve/Deny tool usage from the browser
- **Session tracking** - See all active Claude sessions with tabs
- **Browser notifications** when permission is needed
- **Export** events as JSON
- **30s timeout** - Auto-approves if no response (configurable)

---

## API Reference

Base URL: `http://localhost:6567`

### Events

#### `POST /api/events`
Receive events from Claude Code hooks.

**Request body:**
```json
{
  "hook_event_name": "PreToolUse",
  "session_id": "abc-123",
  "tool_name": "Bash",
  "tool_input": { "command": "ls -la" }
}
```

**Response:**
```json
{ "success": true, "id": 1 }
```

---

#### `GET /api/messages`
Get recent events.

**Query params:**
- `limit` (optional): Number of messages (default: 100)

**Response:**
```json
[
  {
    "id": 1,
    "timestamp": "2026-01-22T14:30:00.000Z",
    "hook_event_name": "PreToolUse",
    "session_id": "abc-123",
    "tool_name": "Bash",
    "tool_input": { "command": "ls -la" }
  }
]
```

---

#### `DELETE /api/messages`
Clear all messages.

**Response:**
```json
{ "success": true }
```

---

### Sessions

#### `GET /api/sessions`
Get active Claude Code sessions.

**Response:**
```json
[
  {
    "id": "abc-123",
    "startedAt": "2026-01-22T14:30:00.000Z",
    "cwd": "/Users/you/project",
    "lastActivity": "2026-01-22T14:35:00.000Z",
    "eventCount": 42
  }
]
```

---

### Permissions

#### `GET /api/permission/:eventId`
Hook polls this endpoint waiting for permission decision.

**Query params:**
- `timeout` (optional): Max wait time in ms (default: 30000)

**Response:**
```json
{ "decision": "allow" }
// or
{ "decision": "deny", "reason": "Blocked by user" }
```

---

#### `POST /api/permission/:eventId`
Submit permission decision from UI.

**Request body:**
```json
{
  "decision": "allow"
}
// or
{
  "decision": "deny",
  "reason": "Not allowed"
}
```

**Response:**
```json
{ "success": true }
```

---

### Responses (Context Injection)

#### `POST /api/respond`
Send response back to Claude Code (for UserPromptSubmit/SessionStart hooks).

**Request body:**
```json
{
  "session_id": "abc-123",
  "action": "inject_context",
  "response": "Additional context to inject..."
}
// or
{
  "session_id": "abc-123",
  "action": "block",
  "response": "Reason for blocking"
}
```

**Response:**
```json
{ "success": true }
```

---

#### `GET /api/pending-response/:session_id`
Hook polls for pending response.

**Query params:**
- `timeout` (optional): Max wait time in ms (default: 100)

**Response:**
```json
{ "action": "continue" }
// or
{ "action": "inject_context", "response": "..." }
// or
{ "action": "block", "response": "reason" }
```

---

### Stats

#### `GET /api/stats`
Get server statistics.

**Response:**
```json
{
  "totalMessages": 150,
  "activeSessions": 2,
  "pendingPermissions": 1,
  "eventCounts": {
    "PreToolUse": 50,
    "PostToolUse": 48,
    "UserPromptSubmit": 30
  },
  "connectedClients": 1
}
```

---

### WebSocket

Connect to `ws://localhost:6567` for real-time events.

**Message types received:**

```javascript
// Initial state
{ "type": "init", "messages": [...], "sessions": [...], "pendingPermissions": [1,2,3] }

// New event
{ "type": "event", "event": { "id": 1, "hook_event_name": "PostToolUse", ... } }

// Permission request (PreToolUse)
{ "type": "permission_request", "event": { "id": 1, "tool_name": "Bash", ... } }

// Permission decided
{ "type": "permission_decided", "eventId": 1, "decision": "allow" }

// Session start
{ "type": "session_start", "session": { "id": "abc-123", ... } }

// Session end
{ "type": "session_end", "sessionId": "abc-123" }

// Messages cleared
{ "type": "clear" }
```

---

## Hook Events

| Event | Description | Can Respond? |
|-------|-------------|--------------|
| `SessionStart` | Session started | Yes - inject context |
| `SessionEnd` | Session ended | No |
| `UserPromptSubmit` | User sent a message | Yes - inject/block |
| `PreToolUse` | Tool about to execute | Yes - allow/deny |
| `PostToolUse` | Tool finished | No |
| `Stop` | Claude finished responding | No |
| `Notification` | System notification | No |

---

## Hook Output Format

The hook script outputs JSON to Claude Code. For `PreToolUse` events, Claude Code expects the `hookSpecificOutput` format:

**Allow a tool:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Approved via web interface"
  }
}
```

**Deny a tool:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Blocked by user"
  }
}
```

**Note:** The `PreToolUse` hook timeout is set to 35 seconds (30s permission wait + 5s buffer) to allow time for user approval via the web UI.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `6567` | Server port |
| `CLAUDE_WEB_BRIDGE_URL` | `http://localhost:6567` | Server URL (for hook script) |
| `CLAUDE_WEB_BRIDGE_PERMISSION_TIMEOUT` | `30000` | Permission timeout in ms |

---

## Uninstall

```bash
~/.claude/web-bridge/disable.sh
rm -rf ~/.claude/web-bridge
```

## Requirements

- Node.js 18+
- Claude Code CLI

## License

MIT
