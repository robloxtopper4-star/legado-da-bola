import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Club2DRosterSlot {
  number: number;
  name: string;
  pos: 'GK' | 'RB' | 'CB1' | 'CB2' | 'LB' | 'CDM' | 'CM' | 'CAM' | 'RW' | 'LW' | 'ST';
}

export interface RoomPlayerInfo {
  id: string;
  role: 'host' | 'guest';
  name: string;
  clubId: string;
  squadType: 'original' | 'custom';
  customSquadName: string;
  roster: Club2DRosterSlot[];
  ready: boolean;
  connected: boolean;
  lastSeen: number;
}

export interface MultiplayerRoom {
  roomId: string;
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  createdAt: number;
  updatedAt: number;
  player1: RoomPlayerInfo;
  player2: RoomPlayerInfo | null;
  player1Team: string;
  player2Team: string | null;
  player1Ready: boolean;
  player2Ready: boolean;
  gameStarted: boolean;
  gameState: any | null;
  pendingGuestInput: any | null;
  pendingGuestActions: Array<{ id: number; payload: any }>;
  hostWs: WebSocket | null;
  guestWs: WebSocket | null;
}

const rooms = new Map<string, MultiplayerRoom>();
const socketMeta = new Map<
  WebSocket,
  { code: string; role: 'host' | 'guest'; playerId: string }
>();
let actionSeqCounter = 1;

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!rooms.has(code)) {
      return code;
    }
  }
  return 'AB' + Math.floor(100 + Math.random() * 900).toString();
}

function serializeRoom(room: MultiplayerRoom) {
  return {
    roomId: room.roomId,
    code: room.code,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    // Canonical fields requested by specification
    player1: room.player1,
    player2: room.player2,
    player1Team: room.player1.clubId,
    player2Team: room.player2 ? room.player2.clubId : null,
    player1Ready: room.player1.ready,
    player2Ready: room.player2 ? room.player2.ready : false,
    gameStarted: room.gameStarted,
    gameState: room.gameState,
    // Aliases for UI convenience
    host: room.player1,
    guest: room.player2
  };
}

function sendWs(ws: WebSocket | null, payload: Record<string, unknown>) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('WS send error:', err);
    }
  }
}

function broadcastRoom(room: MultiplayerRoom, extraMessage?: Record<string, unknown>) {
  room.updatedAt = Date.now();
  room.player1Team = room.player1.clubId;
  room.player2Team = room.player2 ? room.player2.clubId : null;
  room.player1Ready = room.player1.ready;
  room.player2Ready = room.player2 ? room.player2.ready : false;
  room.gameStarted = room.status === 'playing';

  const serialized = serializeRoom(room);
  const stateMsg = {
    type: 'room_state',
    room: serialized
  };

  sendWs(room.hostWs, stateMsg);
  sendWs(room.guestWs, stateMsg);

  if (extraMessage) {
    sendWs(room.hostWs, extraMessage);
    sendWs(room.guestWs, extraMessage);
  }
}

function createRoomInstance(params: {
  playerId?: string;
  name?: string;
  clubId?: string;
  squadType?: 'original' | 'custom';
  customSquadName?: string;
  roster?: Club2DRosterSlot[];
  ws?: WebSocket | null;
}): MultiplayerRoom {
  const code = generateRoomCode();
  const now = Date.now();
  const hostId = params.playerId || `p1_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const clubId = params.clubId || 'flamengo';

  const player1: RoomPlayerInfo = {
    id: hostId,
    role: 'host',
    name: (params.name || 'Jogador 1').trim() || 'Jogador 1',
    clubId,
    squadType: params.squadType === 'custom' ? 'custom' : 'original',
    customSquadName: params.customSquadName || 'Elenco Original',
    roster: Array.isArray(params.roster) ? params.roster : [],
    ready: false,
    connected: true,
    lastSeen: now
  };

  const newRoom: MultiplayerRoom = {
    roomId: code,
    code,
    status: 'lobby',
    createdAt: now,
    updatedAt: now,
    player1,
    player2: null,
    player1Team: clubId,
    player2Team: null,
    player1Ready: false,
    player2Ready: false,
    gameStarted: false,
    gameState: null,
    pendingGuestInput: null,
    pendingGuestActions: [],
    hostWs: params.ws || null,
    guestWs: null
  };

  rooms.set(code, newRoom);
  return newRoom;
}

function joinRoomInstance(
  room: MultiplayerRoom,
  params: {
    playerId?: string;
    name?: string;
    clubId?: string;
    squadType?: 'original' | 'custom';
    customSquadName?: string;
    roster?: Club2DRosterSlot[];
    ws?: WebSocket | null;
  }
): { ok: true; role: 'host' | 'guest'; rejoined: boolean } | { ok: false; message: string } {
  const now = Date.now();
  const incomingPlayerId = params.playerId || '';

  // Allow seamless reconnection if player1 or player2 is rejoining with same playerId
  if (incomingPlayerId && room.player1.id === incomingPlayerId) {
    room.player1.connected = true;
    room.player1.lastSeen = now;
    if (params.ws) room.hostWs = params.ws;
    return { ok: true, role: 'host', rejoined: true };
  }

  if (incomingPlayerId && room.player2 && room.player2.id === incomingPlayerId) {
    room.player2.connected = true;
    room.player2.lastSeen = now;
    if (params.ws) room.guestWs = params.ws;
    return { ok: true, role: 'guest', rejoined: true };
  }

  // Check if room already has an active, distinct player2 connected recently (< 25s)
  const isGuestSocketOpen =
    room.guestWs && room.guestWs.readyState === WebSocket.OPEN;
  const isGuestRecentlyActive =
    room.player2 && room.player2.connected && now - room.player2.lastSeen < 25000;

  if (room.player2 && (isGuestSocketOpen || isGuestRecentlyActive)) {
    return {
      ok: false,
      message: `A sala ${room.code} já está cheia (2/2 jogadores conectados).`
    };
  }

  const defaultGuestClub = room.player1.clubId === 'flamengo' ? 'real_madrid' : 'flamengo';
  const guestClubId = params.clubId || defaultGuestClub;
  const guestId =
    incomingPlayerId || `p2_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const player2: RoomPlayerInfo = {
    id: guestId,
    role: 'guest',
    name: (params.name || 'Jogador 2').trim() || 'Jogador 2',
    clubId: guestClubId,
    squadType: params.squadType === 'custom' ? 'custom' : 'original',
    customSquadName: params.customSquadName || 'Elenco Original',
    roster: Array.isArray(params.roster) ? params.roster : [],
    ready: false,
    connected: true,
    lastSeen: now
  };

  room.player2 = player2;
  room.player2Team = guestClubId;
  room.player2Ready = false;
  room.player1.ready = false;
  room.player1Ready = false;
  room.status = 'lobby';
  room.gameStarted = false;
  if (params.ws) {
    room.guestWs = params.ws;
  }

  return { ok: true, role: 'guest', rejoined: false };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // =========================================================================
  // REST API ENDPOINTS FOR MULTIPLAYER (WORKS ALONGSIDE WEBSOCKET)
  // =========================================================================

  // 1. Create a Room (Player 1)
  app.post('/api/mp/create', (req, res) => {
    const body = req.body || {};
    const room = createRoomInstance({
      playerId: body.playerId,
      name: body.name || body.playerName,
      clubId: body.clubId,
      squadType: body.squadType,
      customSquadName: body.customSquadName,
      roster: body.roster
    });

    res.json({
      ok: true,
      role: 'host',
      playerId: room.player1.id,
      room: serializeRoom(room)
    });
  });

  // 2. Join an existing Room by Code (Player 2)
  app.post('/api/mp/join', (req, res) => {
    const body = req.body || {};
    const code = String(body.code || '')
      .trim()
      .toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      res.status(404).json({
        ok: false,
        message: `Código "${code}" inválido ou sala não encontrada.`
      });
      return;
    }

    const result = joinRoomInstance(room, {
      playerId: body.playerId,
      name: body.name || body.playerName,
      clubId: body.clubId,
      squadType: body.squadType,
      customSquadName: body.customSquadName,
      roster: body.roster
    });

    if (result.ok === false) {
      res.status(409).json({
        ok: false,
        message: result.message
      });
      return;
    }

    broadcastRoom(room, {
      type: 'player_joined_notice',
      playerName: room.player2?.name || 'Jogador 2'
    });

    res.json({
      ok: true,
      role: result.role,
      rejoined: result.rejoined,
      playerId: result.role === 'host' ? room.player1.id : room.player2?.id,
      room: serializeRoom(room)
    });
  });

  // 3. Get Room State / Heartbeat
  app.get('/api/mp/room/:code', (req, res) => {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ ok: false, message: 'Sala não encontrada ou encerrada.' });
      return;
    }

    const playerId = String(req.query.playerId || '');
    const now = Date.now();
    if (playerId) {
      if (room.player1.id === playerId) {
        room.player1.connected = true;
        room.player1.lastSeen = now;
      } else if (room.player2 && room.player2.id === playerId) {
        room.player2.connected = true;
        room.player2.lastSeen = now;
      }
    }

    res.json({
      ok: true,
      room: serializeRoom(room)
    });
  });

  // 4. Update Lobby Selection (Team, Custom Squad, Ready Status)
  app.post('/api/mp/lobby', (req, res) => {
    const body = req.body || {};
    const code = String(body.code || '')
      .trim()
      .toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ ok: false, message: 'Sala não encontrada.' });
      return;
    }

    const role: 'host' | 'guest' =
      body.role === 'guest' || (body.playerId && room.player2?.id === body.playerId)
        ? 'guest'
        : 'host';
    const target = role === 'host' ? room.player1 : room.player2;
    if (!target) {
      res.status(400).json({ ok: false, message: 'Jogador não encontrado na sala.' });
      return;
    }

    target.lastSeen = Date.now();
    target.connected = true;
    if (typeof body.name === 'string' && body.name.trim()) {
      target.name = body.name.trim();
    }
    if (typeof body.clubId === 'string' && body.clubId.trim()) {
      target.clubId = body.clubId.trim();
    }
    if (body.squadType === 'original' || body.squadType === 'custom') {
      target.squadType = body.squadType;
    }
    if (typeof body.customSquadName === 'string') {
      target.customSquadName = body.customSquadName;
    }
    if (Array.isArray(body.roster)) {
      target.roster = body.roster;
    }
    if (typeof body.ready === 'boolean') {
      target.ready = body.ready;
    }
    if (room.status === 'ended') {
      room.status = 'lobby';
      room.gameStarted = false;
      room.gameState = null;
      room.player1.ready = false;
      if (room.player2) room.player2.ready = false;
    }

    broadcastRoom(room);
    res.json({
      ok: true,
      room: serializeRoom(room)
    });
  });

  // 5. Start Match (Requires both Player 1 and Player 2 Ready)
  app.post('/api/mp/start', (req, res) => {
    const body = req.body || {};
    const code = String(body.code || '')
      .trim()
      .toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ ok: false, message: 'Sala não encontrada.' });
      return;
    }

    if (!room.player2 || !room.player1.ready || !room.player2.ready) {
      res.status(400).json({
        ok: false,
        message: 'A partida só pode iniciar quando os dois jogadores confirmarem (Pronto)!'
      });
      return;
    }

    room.status = 'playing';
    room.gameStarted = true;
    room.gameState = null;
    room.pendingGuestActions = [];

    broadcastRoom(room, {
      type: 'match_started',
      room: serializeRoom(room)
    });

    res.json({
      ok: true,
      room: serializeRoom(room)
    });
  });

  // 6. Real-Time Match Sync Endpoint (Authoritative fallback/hybrid sync)
  app.post('/api/mp/sync', (req, res) => {
    const body = req.body || {};
    const code = String(body.code || '')
      .trim()
      .toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ ok: false, message: 'Sala não encontrada.' });
      return;
    }

    const now = Date.now();
    if (body.role === 'host') {
      room.player1.lastSeen = now;
      if (body.state) {
        room.gameState = body.state;
        // Also push to Guest via WebSocket if Guest WS is open
        sendWs(room.guestWs, {
          type: 'mp_state_sync',
          state: body.state
        });
      }
      if (body.finishedResult) {
        room.status = 'ended';
        room.gameStarted = false;
        room.gameState = {
          ...(room.gameState || {}),
          finalResult: body.finishedResult
        };
        sendWs(room.guestWs, {
          type: 'mp_match_finished',
          result: body.finishedResult
        });
      }

      const actionsToDeliver = [...room.pendingGuestActions];
      room.pendingGuestActions = [];

      res.json({
        ok: true,
        guestInput: room.pendingGuestInput,
        guestActions: actionsToDeliver,
        roomStatus: room.status
      });
      return;
    } else {
      if (room.player2) {
        room.player2.lastSeen = now;
      }
      if (body.input) {
        room.pendingGuestInput = body.input;
        sendWs(room.hostWs, {
          type: 'mp_guest_input',
          input: body.input
        });
      }
      if (Array.isArray(body.actions) && body.actions.length > 0) {
        for (const act of body.actions) {
          room.pendingGuestActions.push({ id: actionSeqCounter++, payload: act });
          sendWs(room.hostWs, {
            type: 'mp_guest_action',
            ...act
          });
        }
      }
      res.json({
        ok: true,
        state: room.gameState,
        roomStatus: room.status
      });
      return;
    }
  });

  // 7. Leave / Close Room explicitly
  app.post('/api/mp/leave', (req, res) => {
    const body = req.body || {};
    const code = String(body.code || '')
      .trim()
      .toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.json({ ok: true });
      return;
    }

    if (body.role === 'host') {
      sendWs(room.guestWs, {
        type: 'player_disconnected',
        message: 'O Jogador 1 encerrou a sala.'
      });
      rooms.delete(code);
    } else {
      room.player2 = null;
      room.player2Team = null;
      room.player2Ready = false;
      room.guestWs = null;
      room.player1.ready = false;
      room.player1Ready = false;
      room.status = 'lobby';
      room.gameStarted = false;
      broadcastRoom(room, {
        type: 'player_disconnected',
        message: 'O Jogador 2 saiu da sala.',
        room: serializeRoom(room)
      });
    }

    res.json({ ok: true });
  });

  // =========================================================================
  // WEBSOCKET SERVER (/ws)
  // =========================================================================
  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', rawData => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (!msg || typeof msg.type !== 'string') return;

        // Bind an existing HTTP-created/joined room socket
        if (msg.type === 'bind_socket') {
          const code = String(msg.code || '')
            .trim()
            .toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            sendWs(ws, {
              type: 'error_msg',
              message: `Sala ${code} não encontrada.`
            });
            return;
          }
          const role: 'host' | 'guest' = msg.role === 'guest' ? 'guest' : 'host';
          const playerId = String(msg.playerId || '');
          if (role === 'host') {
            room.hostWs = ws;
            room.player1.connected = true;
            room.player1.lastSeen = Date.now();
          } else if (room.player2) {
            room.guestWs = ws;
            room.player2.connected = true;
            room.player2.lastSeen = Date.now();
          }
          socketMeta.set(ws, { code, role, playerId });
          sendWs(ws, {
            type: 'room_state',
            room: serializeRoom(room)
          });
          return;
        }

        if (msg.type === 'create_room') {
          const room = createRoomInstance({
            playerId: msg.playerId,
            name: msg.name || msg.playerName,
            clubId: msg.clubId,
            squadType: msg.squadType,
            customSquadName: msg.customSquadName,
            roster: msg.roster,
            ws
          });
          socketMeta.set(ws, {
            code: room.code,
            role: 'host',
            playerId: room.player1.id
          });

          const serialized = serializeRoom(room);
          sendWs(ws, {
            type: 'room_created',
            role: 'host',
            playerId: room.player1.id,
            room: serialized
          });
          return;
        }

        if (msg.type === 'join_room') {
          const code = String(msg.code || '')
            .trim()
            .toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            const errPayload = {
              type: 'error_msg',
              message: `Código "${code}" inválido ou sala não encontrada.`
            };
            sendWs(ws, errPayload);
            return;
          }

          const result = joinRoomInstance(room, {
            playerId: msg.playerId,
            name: msg.name || msg.playerName,
            clubId: msg.clubId,
            squadType: msg.squadType,
            customSquadName: msg.customSquadName,
            roster: msg.roster,
            ws
          });

          if (result.ok === false) {
            sendWs(ws, {
              type: 'error_msg',
              message: result.message
            });
            return;
          }

          const assignedPlayerId =
            result.role === 'host' ? room.player1.id : room.player2?.id || '';
          socketMeta.set(ws, {
            code: room.code,
            role: result.role,
            playerId: assignedPlayerId
          });

          sendWs(ws, {
            type: 'room_joined',
            role: result.role,
            playerId: assignedPlayerId,
            room: serializeRoom(room)
          });

          broadcastRoom(room, {
            type: 'player_joined_notice',
            playerName: room.player2?.name || 'Jogador 2'
          });
          return;
        }

        const meta = socketMeta.get(ws);
        const roomCode = String(msg.code || meta?.code || '')
          .trim()
          .toUpperCase();
        const room = rooms.get(roomCode);
        if (!room) return;
        const role: 'host' | 'guest' = meta?.role || (msg.role === 'guest' ? 'guest' : 'host');

        if (msg.type === 'update_lobby') {
          const target = role === 'host' ? room.player1 : room.player2;
          if (!target) return;
          target.lastSeen = Date.now();
          target.connected = true;

          if (typeof msg.name === 'string' && msg.name.trim()) {
            target.name = msg.name.trim();
          }
          if (typeof msg.clubId === 'string' && msg.clubId.trim()) {
            target.clubId = msg.clubId.trim();
          }
          if (msg.squadType === 'original' || msg.squadType === 'custom') {
            target.squadType = msg.squadType;
          }
          if (typeof msg.customSquadName === 'string') {
            target.customSquadName = msg.customSquadName;
          }
          if (Array.isArray(msg.roster)) {
            target.roster = msg.roster;
          }
          if (typeof msg.ready === 'boolean') {
            target.ready = msg.ready;
          }
          if (room.status === 'ended') {
            room.status = 'lobby';
            room.gameStarted = false;
            room.gameState = null;
            room.player1.ready = false;
            if (room.player2) room.player2.ready = false;
          }

          broadcastRoom(room);
          return;
        }

        if (msg.type === 'start_match') {
          if (!room.player2 || !room.player1.ready || !room.player2.ready) {
            sendWs(ws, {
              type: 'error_msg',
              message: 'A partida só pode começar quando os 2 jogadores estiverem prontos!'
            });
            return;
          }
          room.status = 'playing';
          room.gameStarted = true;
          room.gameState = null;
          room.pendingGuestActions = [];

          broadcastRoom(room, {
            type: 'match_started',
            room: serializeRoom(room)
          });
          return;
        }

        if (msg.type === 'leave_room') {
          if (role === 'host') {
            sendWs(room.guestWs, {
              type: 'player_disconnected',
              message: 'O Jogador 1 encerrou a sala.'
            });
            rooms.delete(room.code);
          } else {
            room.player2 = null;
            room.player2Team = null;
            room.player2Ready = false;
            room.guestWs = null;
            room.player1.ready = false;
            room.player1Ready = false;
            room.status = 'lobby';
            room.gameStarted = false;
            broadcastRoom(room, {
              type: 'player_disconnected',
              message: 'O Jogador 2 saiu da sala.',
              room: serializeRoom(room)
            });
          }
          socketMeta.delete(ws);
          return;
        }

        // Real-time Gameplay Messages
        if (role === 'host') {
          room.player1.lastSeen = Date.now();
          if (msg.type === 'mp_state_sync' && msg.state) {
            room.gameState = msg.state;
            sendWs(room.guestWs, msg);
          } else if (msg.type === 'mp_match_finished' || msg.type === 'mp_match_end') {
            room.status = 'ended';
            room.gameStarted = false;
            if (msg.result) {
              room.gameState = {
                ...(room.gameState || {}),
                finalResult: msg.result
              };
            }
            sendWs(room.guestWs, {
              type: 'mp_match_finished',
              result: msg.result
            });
            broadcastRoom(room);
          }
          return;
        }

        if (role === 'guest') {
          if (room.player2) room.player2.lastSeen = Date.now();
          if (msg.type === 'mp_guest_input' && msg.input) {
            room.pendingGuestInput = msg.input;
            sendWs(room.hostWs, msg);
          } else if (msg.type === 'mp_guest_action') {
            room.pendingGuestActions.push({ id: actionSeqCounter++, payload: msg });
            if (room.pendingGuestActions.length > 30) {
              room.pendingGuestActions.shift();
            }
            sendWs(room.hostWs, msg);
          }
          return;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    });

    ws.on('close', () => {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      socketMeta.delete(ws);

      const room = rooms.get(meta.code);
      if (!room) return;

      // Mark socket detached, but keep room alive for automatic reconnection!
      if (meta.role === 'host' && room.hostWs === ws) {
        room.hostWs = null;
      } else if (meta.role === 'guest' && room.guestWs === ws) {
        room.guestWs = null;
      }
    });
  });

  // Clean up abandoned rooms where no player has been seen for > 15 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms.entries()) {
      const p1Idle = now - r.player1.lastSeen > 15 * 60 * 1000;
      const p2Idle = !r.player2 || now - r.player2.lastSeen > 15 * 60 * 1000;
      if (p1Idle && p2Idle) {
        rooms.delete(code);
      }
    }
  }, 60 * 1000);

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
    console.log(`Server + Real-Time Multiplayer running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
