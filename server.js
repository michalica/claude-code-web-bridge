const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 6567;

const messages = [];
const sessions = new Map();
const pendingResponses = new Map();
const pendingPermissions = new Map(); // Track pending permission decisions
let messageIdCounter = 0;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.send(JSON.stringify({
    type: 'init',
    messages: messages.slice(-100),
    sessions: Array.from(sessions.values()),
    pendingPermissions: Array.from(pendingPermissions.keys())
  }));
  ws.on('close', () => console.log('Client disconnected'));
});

// Receive events from Claude Code hooks
app.post('/api/events', (req, res) => {
  const event = {
    id: ++messageIdCounter,
    timestamp: new Date().toISOString(),
    ...req.body
  };

  messages.push(event);
  if (messages.length > 1000) messages.shift();

  // Track sessions
  const sessionId = event.session_id;
  if (event.hook_event_name === 'SessionStart' && sessionId) {
    sessions.set(sessionId, {
      id: sessionId,
      startedAt: event.timestamp,
      cwd: event.cwd || event.working_directory || 'unknown',
      lastActivity: event.timestamp,
      eventCount: 1
    });
    broadcast({ type: 'session_start', session: sessions.get(sessionId) });
  } else if (event.hook_event_name === 'SessionEnd' && sessionId) {
    sessions.delete(sessionId);
    broadcast({ type: 'session_end', sessionId });
  } else if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.lastActivity = event.timestamp;
    session.eventCount++;
  }

  // Mark PreToolUse events as pending permission
  if (event.hook_event_name === 'PreToolUse') {
    event.pendingPermission = true;
    broadcast({ type: 'permission_request', event });
  } else {
    broadcast({ type: 'event', event });
  }

  const label = event.tool_name || event.prompt?.substring(0, 50) || 'Session event';
  console.log(`[${event.hook_event_name}] ${label}`);

  res.json({ success: true, id: event.id });
});

// Hook waits for permission decision
app.get('/api/permission/:eventId', async (req, res) => {
  const eventId = parseInt(req.params.eventId);
  const timeout = parseInt(req.query.timeout) || 30000;

  console.log(`[Permission] Waiting for decision on event ${eventId} (timeout: ${timeout}ms)`);

  const decision = await Promise.race([
    new Promise(resolve => pendingPermissions.set(eventId, resolve)),
    new Promise(resolve => setTimeout(() => resolve({ decision: 'allow', reason: 'timeout' }), timeout))
  ]);

  pendingPermissions.delete(eventId);

  // Update the event in messages to show it's been decided
  const event = messages.find(m => m.id === eventId);
  if (event) {
    event.pendingPermission = false;
    event.permissionDecision = decision.decision;
  }

  broadcast({ type: 'permission_decided', eventId, decision: decision.decision });
  console.log(`[Permission] Event ${eventId} decided: ${decision.decision}`);

  res.json(decision);
});

// UI submits permission decision
app.post('/api/permission/:eventId', (req, res) => {
  const eventId = parseInt(req.params.eventId);
  const { decision, reason } = req.body;

  console.log(`[Permission] Received decision for event ${eventId}: ${decision}`);

  const resolver = pendingPermissions.get(eventId);
  if (resolver) {
    resolver({ decision, reason });
    res.json({ success: true });
  } else {
    res.json({ success: false, error: 'No pending permission for this event' });
  }
});

// Send response back to Claude Code
app.post('/api/respond', (req, res) => {
  const { session_id, response, action } = req.body;

  const responseData = {
    id: ++messageIdCounter,
    timestamp: new Date().toISOString(),
    type: 'user_response',
    session_id,
    response,
    action
  };

  const resolver = pendingResponses.get(session_id);
  if (resolver) {
    resolver(responseData);
    pendingResponses.delete(session_id);
  }

  broadcast({ type: 'response_sent', data: responseData });
  res.json({ success: true });
});

// Hook polls for pending response
app.get('/api/pending-response/:session_id', async (req, res) => {
  const { session_id } = req.params;
  const timeout = parseInt(req.query.timeout) || 100;

  const response = await Promise.race([
    new Promise(resolve => pendingResponses.set(session_id, resolve)),
    new Promise(resolve => setTimeout(() => resolve(null), timeout))
  ]);

  if (response) {
    pendingResponses.delete(session_id);
    res.json(response);
  } else {
    res.json({ action: 'continue' });
  }
});

app.get('/api/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(messages.slice(-limit));
});

app.delete('/api/messages', (req, res) => {
  messages.length = 0;
  pendingPermissions.clear();
  broadcast({ type: 'clear' });
  res.json({ success: true });
});

app.get('/api/sessions', (req, res) => {
  res.json(Array.from(sessions.values()));
});

app.get('/api/stats', (req, res) => {
  const eventCounts = {};
  messages.forEach(m => {
    const event = m.hook_event_name || 'unknown';
    eventCounts[event] = (eventCounts[event] || 0) + 1;
  });
  res.json({
    totalMessages: messages.length,
    activeSessions: sessions.size,
    pendingPermissions: pendingPermissions.size,
    eventCounts,
    connectedClients: wss.clients.size
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         Claude Code Web Bridge - Running!                  ║
╠════════════════════════════════════════════════════════════╣
║  Web UI:     http://localhost:${PORT}                        ║
║  WebSocket:  ws://localhost:${PORT}                          ║
║  Permissions: Approve/Deny tool requests from the UI       ║
╚════════════════════════════════════════════════════════════╝
  `);
});
