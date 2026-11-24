// Cloudflare Worker - WebRTC signaling server for CS 1.6 multiplayer
const rooms = new Map();

function createRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const [ws, clientInfo] of room.entries()) {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(data);
  }
}

function findClientById(roomId, clientId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  for (const [ws, clientInfo] of room.entries()) {
    if (clientInfo.id === clientId) return ws;
  }
  return null;
}

function handleLeave(ws, roomId, clientId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.delete(ws);
  broadcastToRoom(roomId, { type: 'peer-left', clientId });
  if (room.size === 0) rooms.delete(roomId);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({ status: 'ok', rooms: rooms.size }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    if (url.pathname.startsWith('/ws/')) {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS } });
      }

      const roomId = url.pathname.split('/').filter(Boolean)[1] || 'default';
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();

      const room = createRoom(roomId);
      let clientInfo = null;

      server.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          switch (message.type) {
            case 'join':
              clientInfo = { id: message.clientId, name: message.name };
              room.set(server, clientInfo);
              broadcastToRoom(roomId, { type: 'peer-joined', clientId: message.clientId, name: message.name }, server);
              const peers = [];
              for (const [, ci] of room.entries()) {
                if (ci.id !== message.clientId) peers.push({ id: ci.id, name: ci.name });
              }
              server.send(JSON.stringify({ type: 'peers', peers }));
              break;
            case 'offer':
            case 'answer':
            case 'ice-candidate':
              const targetWs = findClientById(roomId, message.targetId);
              if (targetWs && targetWs.readyState === 1) {
                targetWs.send(JSON.stringify({ type: message.type, fromId: message.fromId, data: message.data }));
              }
              break;
            case 'leave':
              handleLeave(server, roomId, message.clientId);
              break;
          }
        } catch (err) {
          console.error('Error:', err);
        }
      });

      server.addEventListener('close', () => {
        if (clientInfo) handleLeave(server, roomId, clientInfo.id);
      });

      return new Response(null, { status: 101, webSocket: client, headers: CORS_HEADERS });
    }

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS } });
  }
};
