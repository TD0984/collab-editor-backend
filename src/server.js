import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const HEARTBEAT_INTERVAL_MS = 30000;

export function createCollabServer({ server, onOp, onJoin }) {
  const wss = new WebSocketServer({ server });
  const clients = new Map();
  const rooms = new Map();

  function joinRoom(docId, clientId) {
    if (!rooms.has(docId)) rooms.set(docId, new Set());
    rooms.get(docId).add(clientId);
  }

  function leaveRoom(docId, clientId) {
    const room = rooms.get(docId);
    if (!room) return;
    room.delete(clientId);
    if (room.size === 0) rooms.delete(docId);
  }

  function broadcast(docId, message, { excludeClientId } = {}) {
    const room = rooms.get(docId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const clientId of room) {
      if (clientId === excludeClientId) continue;
      const client = clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  function send(clientId, message) {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  function sendError(clientId, message, details) {
    send(clientId, { type: 'error', message, details });
  }

  wss.on('connection', (ws) => {
    const clientId = randomUUID();
    clients.set(clientId, { ws, docId: null, isAlive: true });

    ws.on('pong', () => {
      const c = clients.get(clientId);
      if (c) c.isAlive = true;
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return sendError(clientId, 'Invalid JSON');
      }
      if (typeof msg.type !== 'string') {
        return sendError(clientId, 'Missing message type');
      }

      switch (msg.type) {
        case 'join': {
          const { docId } = msg;
          if (typeof docId !== 'string' || !docId) {
            return sendError(clientId, 'join requires a docId');
          }
          const client = clients.get(clientId);
          client.docId = docId;
          joinRoom(docId, clientId);
          onJoin?.({ clientId, docId, send, broadcast });
          break;
        }

        case 'op': {
          const client = clients.get(clientId);
          if (!client || !client.docId) {
            return sendError(clientId, 'Must join a document before sending ops');
          }
          onOp?.({ clientId, docId: client.docId, op: msg.op, send, broadcast });
          break;
        }

        default:
          sendError(clientId, `Unknown message type: ${msg.type}`);
      }
    });

    ws.on('close', () => {
      const client = clients.get(clientId);
      if (client?.docId) leaveRoom(client.docId, clientId);
      clients.delete(clientId);
    });

    ws.on('error', () => {});
  });

  const heartbeat = setInterval(() => {
    for (const [clientId, client] of clients) {
      if (!client.isAlive) {
        client.ws.terminate();
        if (client.docId) leaveRoom(client.docId, clientId);
        clients.delete(clientId);
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  return { wss, clients, rooms, broadcast, send };
}