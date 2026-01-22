#!/usr/bin/env node
/**
 * Claude Code Web Bridge - Hook Script
 * Sends all events to the local web server
 * Handles permission decisions for PreToolUse events
 */

const http = require('http');

const SERVER_URL = process.env.CLAUDE_WEB_BRIDGE_URL || 'http://localhost:6567';
const PERMISSION_TIMEOUT = parseInt(process.env.CLAUDE_WEB_BRIDGE_PERMISSION_TIMEOUT) || 30000; // 30s default

function sendEvent(data) {
  return new Promise((resolve) => {
    const url = new URL('/api/events', SERVER_URL);
    const postData = JSON.stringify(data);

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 2000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(postData);
    req.end();
  });
}

function waitForPermission(eventId, timeout) {
  return new Promise((resolve) => {
    const url = new URL(`/api/permission/${eventId}?timeout=${timeout}`, SERVER_URL);

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: timeout + 1000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function checkForResponse(sessionId) {
  return new Promise((resolve) => {
    const url = new URL(`/api/pending-response/${sessionId}?timeout=100`, SERVER_URL);

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 1000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  // Send event to web bridge and get the event ID
  const result = await sendEvent(data);
  const eventId = result?.id;

  const eventName = data.hook_event_name || '';
  const sessionId = data.session_id || '';

  // Handle PreToolUse - wait for permission decision
  if (eventName === 'PreToolUse' && eventId) {
    const response = await waitForPermission(eventId, PERMISSION_TIMEOUT);

    if (response?.decision === 'allow') {
      // Explicitly allow - skip terminal prompt
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: 'Approved via web interface'
        }
      }));
    } else if (response?.decision === 'deny') {
      // Deny the tool
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: response.reason || 'Blocked by web interface'
        }
      }));
    } else {
      // Timeout or no response - allow by default
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: 'Auto-approved (timeout)'
        }
      }));
    }
  }
  // Handle responses for UserPromptSubmit (can inject context or block)
  else if (eventName === 'UserPromptSubmit' && sessionId) {
    const response = await checkForResponse(sessionId);
    if (response?.action === 'inject_context' && response.response) {
      console.log(response.response);
    } else if (response?.action === 'block') {
      console.log(JSON.stringify({
        decision: 'block',
        reason: response.response || 'Blocked by web interface'
      }));
    }
  }
  // Handle SessionStart context injection
  else if (eventName === 'SessionStart' && sessionId) {
    const response = await checkForResponse(sessionId);
    if (response?.response) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: response.response
        }
      }));
    }
  }

  process.exit(0);
}

main();