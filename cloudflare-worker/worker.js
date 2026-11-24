// Cloudflare Worker - WebRTC signaling server for CS 1.6 multiplayer
// Maintains room state in memory (single instance, suitable for small groups)

const rooms = new Map(); // roomId -> Map<WebSocket, {id, name}>

function createRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
}

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const [ws, clientInfo] of room.entries()) {
    if (ws !== excludeWs && ws.readyState === 1) { // 1 = OPEN
      ws.send(data);
    }
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({ status: 'ok', rooms: rooms.size }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // WebSocket upgrade
    if (url.pathname.startsWith('/ws/')) {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        // HTTP probe - return 200
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      const roomId = url.pathname.split('/').filter(Boolean)[1] || 'default';

      // Create WebSocket pair
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
              console.log(`Client ${message.clientId} joined room ${roomId}`);

              broadcastToRoom(roomId, {
                type: 'peer-joined',
                clientId: message.clientId,
                name: message.name
              }, server);

              const peers = [];
              for (const [, ci] of room.entries()) {
                if (ci.id !== message.clientId) {
                  peers.push({ id: ci.id, name: ci.name });
                }
              }
              server.send(JSON.stringify({ type: 'peers', peers }));
              break;

            case 'offer':
            case 'answer':
            case 'ice-candidate':
              const targetWs = findClientById(roomId, message.targetId);
              if (targetWs && targetWs.readyState === 1) {
                targetWs.send(JSON.stringify({
                  type: message.type,
                  fromId: message.fromId,
                  data: message.data
                }));
              }
              break;

            case 'leave':
              handleLeave(server, roomId, message.clientId);
              break;

            default:
              console.log(`Unknown message type: ${message.type}`);
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      });

      server.addEventListener('close', () => {
        if (clientInfo) {
          handleLeave(server, roomId, clientInfo.id);
        }
      });

      server.addEventListener('error', (err) => {
        console.error('WebSocket error:', err);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // Serve static files - redirect to GitHub Pages for game
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
};

function handleLeave(ws, roomId, clientId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.delete(ws);
  console.log(`Client ${clientId} left room ${roomId}`);
  broadcastToRoom(roomId, { type: 'peer-left', clientId });
  if (room.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted (empty)`);
  }
}
