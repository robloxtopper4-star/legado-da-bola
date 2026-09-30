import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomPlayerState {
  role: 'host' | 'guest';
  playerName: string;
  clubId: string;
  squadMode: 'original' | 'custom';
  customSquad: any | null;
  ready: boolean;
  connected: boolean;
}

interface MultiplayerRoom {
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  createdAt: number;
  host: RoomPlayerState;
  guest: RoomPlayerState | null;
  hostWs: WebSocket | null;
  guestWs: WebSocket | null;
}

const rooms = new Map<string, MultiplayerRoom>();
const socketRoomMap = new Map<WebSocket, { code: string; role: 'host' | 'guest' }>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!rooms.has(code)) {
      return code;
    }
  }
  return 'F' + Math.floor(1000 + Math.random() * 9000).toString();
}

function serializeRoom(room: MultiplayerRoom) {
  return {
    code: room.code,
    status: room.status,
    host: room.host,
    guest: room.guest
  };
}

function sendJson(ws: WebSocket | null, payload: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoomState(room: MultiplayerRoom, extraEvent?: any) {
  const statePayload = {
    type: 'room_state',
    room: serializeRoom(room)
  };
  sendJson(room.hostWs, statePayload);
  sendJson(room.guestWs, statePayload);

  if (extraEvent) {
    sendJson(room.hostWs, extraEvent);
    sendJson(room.guestWs, extraEvent);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // REST check for room code validity
  app.get('/api/rooms/:code', (req, res) => {
    const code = (req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ valid: false, message: 'Sala não encontrada.' });
      return;
    }
    res.json({
      valid: true,
      room: serializeRoom(room)
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'create_room') {
          const code = generateRoomCode();
          const hostState: RoomPlayerState = {
            role: 'host',
            playerName: (msg.playerName || 'Jogador 1').trim() || 'Jogador 1',
            clubId: msg.clubId || 'flamengo',
            squadMode: msg.squadMode === 'custom' ? 'custom' : 'original',
            customSquad: msg.customSquad || null,
            ready: false,
            connected: true
          };

          const newRoom: MultiplayerRoom = {
            code,
            status: 'lobby',
            createdAt: Date.now(),
            host: hostState,
            guest: null,
            hostWs: ws,
            guestWs: null
          };

          rooms.set(code, newRoom);
          socketRoomMap.set(ws, { code, role: 'host' });

          sendJson(ws, {
            type: 'room_joined',
            role: 'host',
            room: serializeRoom(newRoom)
          });
          return;
        }

        if (msg.type === 'join_room') {
          const code = String(msg.code || '')
            .trim()
            .toUpperCase();
          const room = rooms.get(code);

          if (!room) {
            sendJson(ws, {
              type: 'room_error',
              message: `Código "${code}" inválido ou sala não encontrada. Verifique o código e tente novamente.`
            });
            return;
          }

          if (
            room.guest &&
            room.guest.connected &&
            room.guestWs &&
            room.guestWs !== ws &&
            room.guestWs.readyState === WebSocket.OPEN
          ) {
            sendJson(ws, {
              type: 'room_error',
              message: `A sala ${code} já está cheia (2/2 jogadores conectados).`
            });
            return;
          }

          const defaultGuestClub =
            room.host.clubId === 'flamengo' ? 'real_madrid' : 'flamengo';

          const guestState: RoomPlayerState = {
            role: 'guest',
            playerName: (msg.playerName || 'Jogador 2').trim() || 'Jogador 2',
            clubId: msg.clubId || defaultGuestClub,
            squadMode: msg.squadMode === 'custom' ? 'custom' : 'original',
            customSquad: msg.customSquad || null,
            ready: false,
            connected: true
          };

          room.guest = guestState;
          room.guestWs = ws;
          // Reset host ready when a new guest joins so both can review teams before starting
          room.host.ready = false;
          room.status = 'lobby';
          socketRoomMap.set(ws, { code, role: 'guest' });

          sendJson(ws, {
            type: 'room_joined',
            role: 'guest',
            room: serializeRoom(room)
          });

          broadcastRoomState(room, {
            type: 'player_joined_notice',
            playerName: guestState.playerName
          });
          return;
        }

        const mapping = socketRoomMap.get(ws);
        if (!mapping) return;
        const room = rooms.get(mapping.code);
        if (!room) return;

        if (msg.type === 'update_lobby') {
          const target = mapping.role === 'host' ? room.host : room.guest;
          if (!target) return;

          if (typeof msg.playerName === 'string' && msg.playerName.trim()) {
            target.playerName = msg.playerName.trim();
          }
          if (typeof msg.clubId === 'string') {
            target.clubId = msg.clubId;
          }
          if (msg.squadMode === 'original' || msg.squadMode === 'custom') {
            target.squadMode = msg.squadMode;
          }
          if (msg.customSquad !== undefined) {
            target.customSquad = msg.customSquad;
          }
          if (typeof msg.ready === 'boolean') {
            target.ready = msg.ready;
          }

          broadcastRoomState(room);
          return;
        }

        if (msg.type === 'start_match') {
          if (!room.guest || !room.host.ready || !room.guest.ready) {
            sendJson(ws, {
              type: 'room_error',
              message: 'A partida só pode começar quando os 2 jogadores confirmarem que estão prontos!'
            });
            return;
          }
          room.status = 'playing';
          broadcastRoomState(room, {
            type: 'match_started',
            room: serializeRoom(room)
          });
          return;
        }

        if (msg.type === 'return_to_lobby') {
          room.status = 'lobby';
          room.host.ready = false;
          if (room.guest) room.guest.ready = false;
          broadcastRoomState(room, {
            type: 'returned_to_lobby',
            room: serializeRoom(room)
          });
          return;
        }

        // High-frequency real-time gameplay messages:
        // Host -> Guest (Authoritative state sync & events)
        if (mapping.role === 'host') {
          if (
            msg.type === 'mp_state_sync' ||
            msg.type === 'mp_match_event' ||
            msg.type === 'mp_match_end'
          ) {
            if (msg.type === 'mp_match_end') {
              room.status = 'ended';
            }
            sendJson(room.guestWs, msg);
          }
          return;
        }

        // Guest -> Host (Real-time player controls & actions)
        if (mapping.role === 'guest') {
          if (
            msg.type === 'mp_guest_input' ||
            msg.type === 'mp_guest_action' ||
            msg.type === 'mp_match_end'
          ) {
            sendJson(room.hostWs, msg);
          }
          return;
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    });

    ws.on('close', () => {
      const mapping = socketRoomMap.get(ws);
      if (!mapping) return;
      socketRoomMap.delete(ws);

      const room = rooms.get(mapping.code);
      if (!room) return;

      if (mapping.role === 'host') {
        room.host.connected = false;
        room.hostWs = null;
        sendJson(room.guestWs, {
          type: 'opponent_disconnected',
          message: 'O Jogador 1 (criador da sala) desconectou.'
        });
        rooms.delete(mapping.code);
      } else {
        if (room.guest) {
          room.guest.connected = false;
        }
        room.guestWs = null;
        room.guest = null;
        room.host.ready = false;
        room.status = 'lobby';
        broadcastRoomState(room, {
          type: 'opponent_disconnected',
          message: 'O Jogador 2 saiu da sala.'
        });
      }
    });
  });

  // Clean up stale rooms older than 4 hours
  setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms.entries()) {
      if (now - r.createdAt > 4 * 60 * 60 * 1000) {
        rooms.delete(code);
      }
    }
  }, 15 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server + Real-Time Multiplayer WebSocket running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
