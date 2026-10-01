import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Users,
  PlusCircle,
  LogIn,
  Copy,
  Check,
  Shield,
  CheckCircle2,
  Clock,
  Play,
  Wifi,
  RotateCcw,
  Trophy,
  Edit3
} from 'lucide-react';
import { Club } from '../types';
import { INITIAL_CLUBS } from '../data/database';
import { ClubBadge } from './ClubBadge';
import {
  Interactive2DPitch,
  Pitch2DEvent,
  Pitch2DStats,
  Club2DRosterItem,
  getClub2DRoster
} from './Interactive2DPitch';
import {
  loadCustomSquads,
  convertCustomSquadTo2DRoster,
  CustomSquad
} from '../services/customRostersService';
import { soundFx } from '../utils/audio';

interface MultiplayerPlayerState {
  id?: string;
  role?: 'host' | 'guest';
  name: string;
  clubId: string;
  squadType: 'original' | 'custom';
  customSquadName: string;
  roster: Club2DRosterItem[];
  ready: boolean;
  connected?: boolean;
}

interface RoomStatePayload {
  roomId: string;
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  player1: MultiplayerPlayerState;
  player2: MultiplayerPlayerState | null;
  player1Team: string;
  player2Team: string | null;
  player1Ready: boolean;
  player2Ready: boolean;
  gameStarted: boolean;
  gameState?: any;
  host: MultiplayerPlayerState;
  guest: MultiplayerPlayerState | null;
}

interface MultiplayerModeProps {
  onBackToMenu: () => void;
  onOpenSquadEditor: () => void;
}

function getOrCreateSessionPlayerId(): string {
  try {
    const existing = sessionStorage.getItem('carreira_mp_session_player_id');
    if (existing) return existing;
    const created = `mp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('carreira_mp_session_player_id', created);
    return created;
  } catch {
    return `mp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const MultiplayerMode: React.FC<MultiplayerModeProps> = ({
  onBackToMenu,
  onOpenSquadEditor
}) => {
  const [playerId] = useState<string>(() => getOrCreateSessionPlayerId());
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('carreira_mp_player_name') || 'Jogador 1';
    } catch {
      return 'Jogador 1';
    }
  });
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [serverReachable, setServerReachable] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);

  const roleRef = useRef<'host' | 'guest' | null>(null);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const roomStateRef = useRef<RoomStatePayload | null>(null);
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  // Local Lobby Selections
  const [selectedClubId, setSelectedClubId] = useState<string>(INITIAL_CLUBS[0].id);
  const [selectedSquadOption, setSelectedSquadOption] = useState<string>('original');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [customSquads, setCustomSquads] = useState<CustomSquad[]>(() => loadCustomSquads());

  // Match state
  const [matchKey, setMatchKey] = useState<number>(1);
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [events, setEvents] = useState<Pitch2DEvent[]>([]);
  const [stats, setStats] = useState<Pitch2DStats>({
    homePossession: 50,
    awayPossession: 50,
    homeShots: 0,
    awayShots: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
    homeCorners: 0,
    awayCorners: 0,
    userGoals: 0,
    userAssists: 0,
    userPassesCompleted: 0,
    userShots: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<(msg: any) => void>>(new Set());
  const prevGuestPresentRef = useRef<boolean>(false);
  const prevRoomStatusRef = useRef<string>('lobby');

  // Buffers for hybrid HTTP + WS real-time match sync
  const latestHostStateRef = useRef<any | null>(null);
  const latestFinishedResultRef = useRef<any | null>(null);
  const latestGuestInputRef = useRef<any | null>(null);
  const pendingGuestActionsBufferRef = useRef<any[]>([]);

  useEffect(() => {
    setCustomSquads(loadCustomSquads());
  }, []);

  const showError = useCallback((msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => {
      setErrorBanner(prev => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const showInfo = useCallback((msg: string) => {
    setInfoBanner(msg);
    setTimeout(() => {
      setInfoBanner(prev => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const applyIncomingRoomState = useCallback(
    (incomingRoom: RoomStatePayload) => {
      if (!incomingRoom) return;
      const hadGuest = prevGuestPresentRef.current;
      const hasGuestNow = Boolean(incomingRoom.guest || incomingRoom.player2);
      if (!hadGuest && hasGuestNow && roleRef.current === 'host') {
        const gName = incomingRoom.guest?.name || incomingRoom.player2?.name || 'Jogador 2';
        soundFx.playCheer();
        showInfo(`🎉 ${gName} entrou na sala! Escolham seus times e confirmem.`);
      }
      prevGuestPresentRef.current = hasGuestNow;

      const prevStatus = prevRoomStatusRef.current;
      if (prevStatus !== 'playing' && incomingRoom.status === 'playing') {
        setHomeScore(0);
        setAwayScore(0);
        setEvents([]);
        latestHostStateRef.current = null;
        latestFinishedResultRef.current = null;
        pendingGuestActionsBufferRef.current = [];
        setMatchKey(k => k + 1);
        soundFx.playWhistle();
      }
      prevRoomStatusRef.current = incomingRoom.status;
      setRoomState(incomingRoom);
    },
    [showInfo]
  );

  // Connect WebSocket for ultra-low latency events (automatically paired with REST fallback)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isUnmounted) return;
          setWsConnected(true);
          setServerReachable(true);
          // Re-bind to active room if already in a room
          if (roomStateRef.current?.code && roleRef.current) {
            socket?.send(
              JSON.stringify({
                type: 'bind_socket',
                code: roomStateRef.current.code,
                role: roleRef.current,
                playerId
              })
            );
          }
        };

        socket.onmessage = event => {
          if (isUnmounted) return;
          try {
            const msg = JSON.parse(event.data);

            // Notify pitch listeners first for immediate frame update
            listenersRef.current.forEach(fn => fn(msg));

            if (msg.type === 'room_created') {
              setRole(msg.role);
              prevGuestPresentRef.current = Boolean(msg.room?.guest);
              prevRoomStatusRef.current = msg.room?.status || 'lobby';
              setRoomState(msg.room);
            } else if (msg.type === 'room_joined') {
              setRole(msg.role);
              prevGuestPresentRef.current = true;
              prevRoomStatusRef.current = msg.room?.status || 'lobby';
              setRoomState(msg.room);
            } else if (msg.type === 'room_state' && msg.room) {
              applyIncomingRoomState(msg.room);
            } else if (msg.type === 'match_started' && msg.room) {
              applyIncomingRoomState(msg.room);
            } else if (msg.type === 'mp_match_finished' && msg.result) {
              setHomeScore(msg.result.homeScore);
              setAwayScore(msg.result.awayScore);
              setEvents(msg.result.events || []);
              if (msg.result.stats) setStats(msg.result.stats);
              prevRoomStatusRef.current = 'ended';
              setRoomState(prev => (prev ? { ...prev, status: 'ended', gameStarted: false } : prev));
            } else if (msg.type === 'player_disconnected') {
              showError(msg.message || 'O outro jogador desconectou da sala.');
              if (msg.room) {
                prevGuestPresentRef.current = Boolean(msg.room.guest);
                prevRoomStatusRef.current = msg.room.status;
                setRoomState(msg.room);
              } else {
                prevRoomStatusRef.current = 'lobby';
                setRoomState(null);
                setRole(null);
              }
            } else if (msg.type === 'error_msg') {
              soundFx.playClick();
              showError(msg.message || 'Erro na sala multiplayer.');
            }
          } catch {
            // Ignore malformed JSON
          }
        };

        socket.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 2000);
        };
      } catch {
        reconnectTimer = setTimeout(connect, 2500);
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [applyIncomingRoomState, playerId, showError]);

  // Lobby Polling Heartbeat (ensures 100% real-time room state across devices even if WS upgrade is proxied)
  useEffect(() => {
    if (!roomState?.code || !role) return;
    let cancelled = false;

    const pollRoom = async () => {
      try {
        const res = await fetch(
          `/api/mp/room/${encodeURIComponent(roomState.code)}?playerId=${encodeURIComponent(playerId)}`
        );
        if (cancelled) return;
        if (res.status === 404) {
          showError('A sala foi encerrada.');
          setRoomState(null);
          setRole(null);
          return;
        }
        const data = await res.json();
        if (!cancelled && data.ok && data.room) {
          setServerReachable(true);
          applyIncomingRoomState(data.room);
          if (
            data.room.status === 'ended' &&
            data.room.gameState?.finalResult &&
            prevRoomStatusRef.current === 'ended'
          ) {
            const fin = data.room.gameState.finalResult;
            setHomeScore(fin.homeScore);
            setAwayScore(fin.awayScore);
            if (fin.events) setEvents(fin.events);
            if (fin.stats) setStats(fin.stats);
          }
        }
      } catch {
        // Ignore transient network hiccup
      }
    };

    const intervalMs = roomState.status === 'lobby' ? 750 : 1800;
    const timer = setInterval(pollRoom, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applyIncomingRoomState, playerId, role, roomState?.code, roomState?.status, showError]);

  // High-frequency Match State Sync Fallback (/api/mp/sync) while match is playing
  useEffect(() => {
    if (!roomState?.code || !role || roomState.status !== 'playing') return;
    let cancelled = false;
    let inFlight = false;

    const syncTick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        if (role === 'host') {
          const payload: Record<string, unknown> = {
            code: roomState.code,
            role: 'host',
            state: latestHostStateRef.current,
            finishedResult: latestFinishedResultRef.current
          };
          const res = await fetch('/api/mp/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!cancelled && data.ok) {
            if (data.guestInput) {
              listenersRef.current.forEach(fn =>
                fn({ type: 'mp_guest_input', input: data.guestInput })
              );
            }
            if (Array.isArray(data.guestActions) && data.guestActions.length > 0) {
              for (const item of data.guestActions) {
                if (item && item.payload) {
                  listenersRef.current.forEach(fn => fn(item.payload));
                }
              }
            }
          }
        } else {
          const actionsToFlush = [...pendingGuestActionsBufferRef.current];
          pendingGuestActionsBufferRef.current = [];
          const payload: Record<string, unknown> = {
            code: roomState.code,
            role: 'guest',
            input: latestGuestInputRef.current,
            actions: actionsToFlush
          };
          const res = await fetch('/api/mp/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!cancelled && data.ok) {
            if (data.state) {
              listenersRef.current.forEach(fn =>
                fn({ type: 'mp_state_sync', state: data.state })
              );
              if (data.state.finalResult) {
                listenersRef.current.forEach(fn =>
                  fn({ type: 'mp_match_finished', result: data.state.finalResult })
                );
              }
            }
            if (data.roomStatus === 'ended' && data.state?.finalResult) {
              const fin = data.state.finalResult;
              setHomeScore(fin.homeScore);
              setAwayScore(fin.awayScore);
              if (fin.events) setEvents(fin.events);
              if (fin.stats) setStats(fin.stats);
              prevRoomStatusRef.current = 'ended';
              setRoomState(prev =>
                prev ? { ...prev, status: 'ended', gameStarted: false } : prev
              );
            }
          }
        }
      } catch {
        // Ignore single tick failure
      } finally {
        inFlight = false;
      }
    };

    const interval = setInterval(syncTick, 55);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [role, roomState?.code, roomState?.status]);

  const sendPitchMessage = useCallback((payload: Record<string, unknown>) => {
    const code = roomStateRef.current?.code || '';
    const currentRole = roleRef.current || 'host';
    const enriched = {
      ...payload,
      code,
      role: currentRole
    };

    // Track latest state/input/actions for hybrid HTTP + WS delivery
    if (payload.type === 'mp_state_sync' && payload.state) {
      latestHostStateRef.current = payload.state;
    } else if (payload.type === 'mp_match_finished' && payload.result) {
      latestFinishedResultRef.current = payload.result;
    } else if (payload.type === 'mp_guest_input' && payload.input) {
      latestGuestInputRef.current = payload.input;
    } else if (payload.type === 'mp_guest_action') {
      pendingGuestActionsBufferRef.current.push(enriched);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(enriched));
      } catch {
        // Handled by HTTP sync
      }
    }
  }, []);

  const subscribeWsMessage = useCallback((handler: (msg: any) => void) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  const selectedClub = useMemo(
    () => INITIAL_CLUBS.find(c => c.id === selectedClubId) || INITIAL_CLUBS[0],
    [selectedClubId]
  );

  // Build resolved 11-player 2D roster for the player's current selection
  const buildLocalResolvedRoster = useCallback(
    (
      club: Club,
      squadOpt: string
    ): {
      squadType: 'original' | 'custom';
      customSquadName: string;
      roster: Club2DRosterItem[];
    } => {
      if (squadOpt === 'original') {
        return {
          squadType: 'original',
          customSquadName: 'Elenco Original',
          roster: getClub2DRoster(club)
        };
      }
      const found = customSquads.find(s => s.id === squadOpt);
      if (!found) {
        return {
          squadType: 'original',
          customSquadName: 'Elenco Original',
          roster: getClub2DRoster(club)
        };
      }
      return {
        squadType: 'custom',
        customSquadName: found.name,
        roster: convertCustomSquadTo2DRoster(found, club)
      };
    },
    [customSquads]
  );

  // 1. Create Room (Jogador 1) via Authoritative Server Endpoint + WebSocket bind
  const handleCreateRoom = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const trimmedName = playerName.trim() || 'Jogador 1';
      try {
        localStorage.setItem('carreira_mp_player_name', trimmedName);
      } catch {
        // Ignore storage error
      }
      const defaultClub = INITIAL_CLUBS[0];
      setSelectedClubId(defaultClub.id);
      setSelectedSquadOption('original');
      const resolved = buildLocalResolvedRoster(defaultClub, 'original');

      const res = await fetch('/api/mp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          name: trimmedName,
          clubId: defaultClub.id,
          squadType: resolved.squadType,
          customSquadName: resolved.customSquadName,
          roster: resolved.roster
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.room) {
        showError(data.message || 'Não foi possível criar a sala.');
        return;
      }

      setRole('host');
      roleRef.current = 'host';
      prevGuestPresentRef.current = Boolean(data.room.guest);
      prevRoomStatusRef.current = data.room.status;
      setRoomState(data.room);
      setServerReachable(true);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'bind_socket',
            code: data.room.code,
            role: 'host',
            playerId
          })
        );
      }

      soundFx.playSuccess();
      showInfo(`✅ Sala ${data.room.code} criada! Copie e envie o código para o Jogador 2.`);
    } catch {
      showError('Erro de conexão ao criar a sala. Tente novamente.');
    } finally {
      setIsBusy(false);
    }
  };

  // 2. Join Room (Jogador 2) via Authoritative Server Endpoint + WebSocket bind
  const handleJoinRoom = async () => {
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      showError('Digite o código da sala para entrar!');
      return;
    }
    if (isBusy) return;
    setIsBusy(true);
    try {
      const trimmedName =
        playerName.trim() === 'Jogador 1'
          ? 'Jogador 2'
          : playerName.trim() || 'Jogador 2';
      setPlayerName(trimmedName);
      try {
        localStorage.setItem('carreira_mp_player_name', trimmedName);
      } catch {
        // Ignore storage error
      }
      const defaultClub = INITIAL_CLUBS[4] || INITIAL_CLUBS[1];
      setSelectedClubId(defaultClub.id);
      setSelectedSquadOption('original');
      const resolved = buildLocalResolvedRoster(defaultClub, 'original');

      const res = await fetch('/api/mp/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          playerId,
          name: trimmedName,
          clubId: defaultClub.id,
          squadType: resolved.squadType,
          customSquadName: resolved.customSquadName,
          roster: resolved.roster
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.room) {
        soundFx.playClick();
        showError(data.message || `Sala "${cleanCode}" não encontrada.`);
        return;
      }

      const assignedRole: 'host' | 'guest' = data.role === 'host' ? 'host' : 'guest';
      setRole(assignedRole);
      roleRef.current = assignedRole;
      prevGuestPresentRef.current = Boolean(data.room.guest);
      prevRoomStatusRef.current = data.room.status;
      setRoomState(data.room);
      setServerReachable(true);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'bind_socket',
            code: data.room.code,
            role: assignedRole,
            playerId
          })
        );
      }

      soundFx.playSuccess();
      showInfo(`✅ Conectado à sala ${data.room.code} como ${assignedRole === 'host' ? 'Jogador 1' : 'Jogador 2'}!`);
    } catch {
      showError('Erro ao conectar na sala. Verifique o código e tente novamente.');
    } finally {
      setIsBusy(false);
    }
  };

  // Update Club, Squad, or Ready status in Lobby
  const syncLobbySelection = useCallback(
    async (newClubId: string, newSquadOpt: string, newReady?: boolean) => {
      const currentCode = roomStateRef.current?.code;
      const currentRole = roleRef.current;
      if (!currentCode || !currentRole) return;

      const clubObj = INITIAL_CLUBS.find(c => c.id === newClubId) || INITIAL_CLUBS[0];
      const resolved = buildLocalResolvedRoster(clubObj, newSquadOpt);
      const payload = {
        type: 'update_lobby',
        code: currentCode,
        role: currentRole,
        playerId,
        name: playerName.trim() || (currentRole === 'host' ? 'Jogador 1' : 'Jogador 2'),
        clubId: clubObj.id,
        squadType: resolved.squadType,
        customSquadName: resolved.customSquadName,
        roster: resolved.roster,
        ready: newReady !== undefined ? newReady : false
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }

      try {
        const res = await fetch('/api/mp/lobby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok && data.room) {
          applyIncomingRoomState(data.room);
        }
      } catch {
        // Handled by WS or next poll
      }
    },
    [applyIncomingRoomState, buildLocalResolvedRoster, playerId, playerName]
  );

  const handleSelectClubInLobby = (club: Club) => {
    soundFx.playClick();
    setSelectedClubId(club.id);
    syncLobbySelection(club.id, selectedSquadOption, false);
  };

  const handleSelectSquadInLobby = (squadOpt: string) => {
    soundFx.playClick();
    setSelectedSquadOption(squadOpt);
    syncLobbySelection(selectedClubId, squadOpt, false);
  };

  const myPlayerState = role === 'host' ? roomState?.host : roomState?.guest;
  const isMyReady = Boolean(myPlayerState?.ready);
  const bothReady = Boolean(roomState?.host?.ready && roomState?.guest?.ready);

  const handleToggleReady = () => {
    soundFx.playClick();
    syncLobbySelection(selectedClubId, selectedSquadOption, !isMyReady);
  };

  const handleStartOnlineMatch = async () => {
    if (!bothReady || !roomState?.code) {
      showError('A partida só pode ser iniciada quando os 2 jogadores confirmarem (Pronto)!');
      return;
    }
    soundFx.playWhistle();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'start_match',
          code: roomState.code,
          role
        })
      );
    }
    try {
      const res = await fetch('/api/mp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomState.code, role, playerId })
      });
      const data = await res.json();
      if (data.ok && data.room) {
        applyIncomingRoomState(data.room);
      } else if (data.message) {
        showError(data.message);
      }
    } catch {
      // Handled by WS or poll
    }
  };

  const handleLeaveRoom = async () => {
    soundFx.playClick();
    const code = roomState?.code;
    const currentRole = role;
    setRoomState(null);
    setRole(null);
    prevRoomStatusRef.current = 'lobby';

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && code) {
      wsRef.current.send(JSON.stringify({ type: 'leave_room', code, role: currentRole }));
    }
    if (code) {
      try {
        await fetch('/api/mp/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, role: currentRole, playerId })
        });
      } catch {
        // Ignore leave network error
      }
    }
  };

  const handleCopyRoomCode = () => {
    if (!roomState?.code) return;
    navigator.clipboard?.writeText(roomState.code);
    setCopiedCode(true);
    soundFx.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredClubs = useMemo(() => {
    return INITIAL_CLUBS.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.country.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (countryFilter === 'all') return true;
      if (countryFilter === 'br') return c.country === 'Brasil';
      if (countryFilter === 'eng') return c.country === 'Inglaterra';
      if (countryFilter === 'esp') return c.country === 'Espanha';
      if (countryFilter === 'ita') return c.country === 'Itália';
      if (countryFilter === 'ger') return c.country === 'Alemanha';
      if (countryFilter === 'fra') return c.country === 'França';
      return true;
    });
  }, [countryFilter, searchTerm]);

  const hostClub = useMemo(
    () => INITIAL_CLUBS.find(c => c.id === roomState?.host?.clubId) || INITIAL_CLUBS[0],
    [roomState?.host?.clubId]
  );
  const guestClub = useMemo(
    () => INITIAL_CLUBS.find(c => c.id === roomState?.guest?.clubId) || INITIAL_CLUBS[4],
    [roomState?.guest?.clubId]
  );

  const hostRoster = useMemo(() => {
    if (roomState?.host?.roster && roomState.host.roster.length === 11) {
      return roomState.host.roster;
    }
    return getClub2DRoster(hostClub);
  }, [roomState?.host?.roster, hostClub]);

  const guestRoster = useMemo(() => {
    if (roomState?.guest?.roster && roomState.guest.roster.length === 11) {
      return roomState.guest.roster;
    }
    return getClub2DRoster(guestClub);
  }, [roomState?.guest?.roster, guestClub]);

  const multiplayerPitchConfig = useMemo(
    () => ({
      enabled: true,
      role: (role || 'host') as 'host' | 'guest',
      roomCode: roomState?.code || '',
      hostPlayerName: roomState?.host?.name || 'Jogador 1',
      guestPlayerName: roomState?.guest?.name || 'Jogador 2',
      sendMessage: sendPitchMessage,
      subscribeMessage: subscribeWsMessage
    }),
    [
      role,
      roomState?.code,
      roomState?.host?.name,
      roomState?.guest?.name,
      sendPitchMessage,
      subscribeWsMessage
    ]
  );

  const isOnline = wsConnected || serverReachable;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* TOP HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-900/90 p-4 sm:p-5 rounded-3xl border border-neutral-800 shadow-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (roomState) {
                  handleLeaveRoom();
                } else {
                  soundFx.playClick();
                  onBackToMenu();
                }
              }}
              className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition flex items-center gap-2 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{roomState ? 'Sair da Sala' : 'Voltar ao Menu'}</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-extrabold text-[11px] tracking-wider uppercase border border-cyan-500/40 flex items-center gap-1">
                  <Users className="w-3 h-3 text-cyan-400" />
                  Multiplayer Online 1v1
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 border ${
                    isOnline
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>{isOnline ? 'Servidor Online em Tempo Real' : 'Sincronizando...'}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white font-heading mt-0.5">
                {roomState
                  ? `Sala Multiplayer #${roomState.code}`
                  : 'Multiplayer 1v1 • Criar ou Entrar em Sala'}
              </h1>
            </div>
          </div>

          {!roomState && (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onOpenSquadEditor();
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-black text-xs uppercase tracking-wider transition flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Elenco Personalizado</span>
            </button>
          )}
        </div>

        {/* ALERTS */}
        {errorBanner && (
          <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500 text-rose-200 font-black text-xs sm:text-sm text-center shadow-lg">
            ⚠️ {errorBanner}
          </div>
        )}
        {infoBanner && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500 text-emerald-200 font-black text-xs sm:text-sm text-center shadow-lg">
            {infoBanner}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 1: MULTIPLAYER MENU (CRIAR SALA / ENTRAR EM SALA)           */}
        {/* ================================================================ */}
        {!roomState && (
          <div className="space-y-6">
            {/* Player Name Input Card */}
            <div className="bg-neutral-900/90 p-6 rounded-3xl border border-neutral-800 shadow-xl">
              <label className="block text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">
                Seu Nome no Multiplayer:
              </label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Digite seu nome (ex: Lucas, Gabriel...)"
                maxLength={24}
                className="w-full sm:w-96 px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-black text-base focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: CRIAR SALA */}
              <div className="bg-gradient-to-br from-emerald-950/50 via-neutral-900 to-neutral-900 p-6 sm:p-8 rounded-3xl border-2 border-emerald-500/40 shadow-2xl flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                    JOGADOR 1 (ANFITRIÃO)
                  </span>
                  <h2 className="text-2xl font-black text-white font-heading">Criar Sala</h2>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    Gera automaticamente um código único de 5 caracteres (ex:{' '}
                    <code className="text-emerald-300 font-black">AB7K2</code>) no servidor para
                    você copiar e enviar para outra pessoa conectar de outro dispositivo ou navegador.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={isBusy}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>{isBusy ? 'Criando Sala...' : 'Criar Sala Agora'}</span>
                </button>
              </div>

              {/* Card 2: ENTRAR EM SALA */}
              <div className="bg-gradient-to-br from-cyan-950/50 via-neutral-900 to-neutral-900 p-6 sm:p-8 rounded-3xl border-2 border-cyan-500/40 shadow-2xl flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-widest border border-cyan-500/30">
                    JOGADOR 2 (DESAFIANTE)
                  </span>
                  <h2 className="text-2xl font-black text-white font-heading">Entrar em Sala</h2>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    Digite o código da sala recebido do Jogador 1 para conectar-se à mesma sala em
                    tempo real, aparecer no lobby e escolher seu time.
                  </p>

                  <div className="pt-2">
                    <label className="block text-[11px] font-black text-cyan-300 uppercase tracking-wider mb-1.5">
                      Código da Sala:
                    </label>
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && joinCodeInput.trim()) {
                          handleJoinRoom();
                        }
                      }}
                      placeholder="Ex: AB7K2"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl bg-neutral-950 border-2 border-cyan-500/50 text-white font-black text-lg tracking-[0.25em] uppercase text-center focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleJoinRoom}
                  disabled={isBusy || !joinCodeInput.trim()}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/25 transition flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  <span>{isBusy ? 'Conectando...' : 'Entrar em Sala'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2: LOBBY MULTIPLAYER (ESCOLHA DE TIMES, ELENCOS E PRONTO)   */}
        {/* ================================================================ */}
        {roomState && roomState.status === 'lobby' && (
          <div className="space-y-6">
            {/* ROOM CODE BAR & PLAYER 2 STATUS */}
            <div className="bg-gradient-to-r from-neutral-900 via-emerald-950/30 to-neutral-900 p-5 sm:p-6 rounded-3xl border-2 border-emerald-500/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="px-5 py-3 rounded-2xl bg-neutral-950 border-2 border-amber-400/60 flex items-center gap-3">
                  <div>
                    <span className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      CÓDIGO DA SALA
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-amber-300 tracking-[0.22em] font-heading">
                      {roomState.code}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyRoomCode}
                    className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs flex items-center gap-1.5 transition shadow"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        roomState.guest
                          ? 'bg-emerald-400 animate-ping'
                          : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span className="text-sm sm:text-base font-black text-white">
                      {roomState.guest
                        ? `✅ 2/2 Jogadores Conectados (${roomState.host.name} vs ${roomState.guest.name})`
                        : '⏳ Aguardando o Jogador 2 digitar o código para entrar...'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    Cada jogador escolhe seu clube, seu elenco (Original ou Personalizado) e clica
                    em Confirmar Escolha.
                  </p>
                </div>
              </div>

              {/* Start Match Button (Enabled only when BOTH players confirmed!) */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleReady}
                  className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition flex items-center gap-2 shadow-lg ${
                    isMyReady
                      ? 'bg-emerald-500 text-neutral-950 ring-2 ring-emerald-300'
                      : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isMyReady ? 'Escolha Confirmada (Pronto!)' : 'Confirmar Escolha'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartOnlineMatch}
                  disabled={!bothReady}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-40 text-neutral-950 font-black text-xs sm:text-sm uppercase tracking-wider transition flex items-center gap-2 shadow-xl"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {bothReady ? 'Iniciar Partida Online!' : 'Aguardando Confirmação (2/2)'}
                  </span>
                </button>
              </div>
            </div>

            {/* HEAD-TO-HEAD LOBBY CARDS: JOGADOR 1 VS JOGADOR 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* JOGADOR 1 (MANDANTE) */}
              <div
                className={`p-6 rounded-3xl border-2 transition ${
                  roomState.host.ready
                    ? 'bg-emerald-950/30 border-emerald-500/60'
                    : 'bg-neutral-900/90 border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase">
                    Jogador 1 (Mandante) {role === 'host' ? '• VOCÊ' : ''}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${
                      roomState.host.ready
                        ? 'bg-emerald-500 text-neutral-950'
                        : 'bg-neutral-800 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {roomState.host.ready ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> PRONTO
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" /> Escolhendo...
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <ClubBadge club={hostClub} size="xl" />
                  <div>
                    <div className="text-xs font-bold text-neutral-400">
                      Jogador: <span className="text-white font-black">{roomState.host.name}</span>
                    </div>
                    <h3 className="text-xl font-black text-white font-heading">{hostClub.name}</h3>
                    <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-bold text-emerald-300">
                      <span>📋 {roomState.host.customSquadName || 'Elenco Original'}</span>
                    </div>
                  </div>
                </div>

                {/* Preview of Jogador 1's 11 players */}
                <div className="mt-4 pt-3 border-t border-neutral-800/80">
                  <span className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">
                    Escalação Confirmada ({hostRoster.length} Titulares):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {hostRoster.map((p, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[10px] font-bold text-neutral-200"
                      >
                        <strong className="text-emerald-400">#{p.number}</strong> {p.name} ({p.pos})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* JOGADOR 2 (VISITANTE) */}
              <div
                className={`p-6 rounded-3xl border-2 transition ${
                  roomState.guest?.ready
                    ? 'bg-cyan-950/30 border-cyan-500/60'
                    : 'bg-neutral-900/90 border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-black uppercase">
                    Jogador 2 (Visitante) {role === 'guest' ? '• VOCÊ' : ''}
                  </span>
                  {roomState.guest ? (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${
                        roomState.guest.ready
                          ? 'bg-cyan-400 text-neutral-950'
                          : 'bg-neutral-800 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {roomState.guest.ready ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> PRONTO
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" /> Escolhendo...
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 text-xs font-bold">
                      Aguardando conexão...
                    </span>
                  )}
                </div>

                {roomState.guest ? (
                  <>
                    <div className="flex items-center gap-4">
                      <ClubBadge club={guestClub} size="xl" />
                      <div>
                        <div className="text-xs font-bold text-neutral-400">
                          Jogador:{' '}
                          <span className="text-white font-black">{roomState.guest.name}</span>
                        </div>
                        <h3 className="text-xl font-black text-white font-heading">
                          {guestClub.name}
                        </h3>
                        <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-bold text-cyan-300">
                          <span>📋 {roomState.guest.customSquadName || 'Elenco Original'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-800/80">
                      <span className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">
                        Escalação Confirmada ({guestRoster.length} Titulares):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {guestRoster.map((p, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[10px] font-bold text-neutral-200"
                          >
                            <strong className="text-cyan-400">#{p.number}</strong> {p.name} ({p.pos})
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-36 flex flex-col items-center justify-center text-center border-2 border-dashed border-neutral-800 rounded-2xl p-4">
                    <Users className="w-8 h-8 text-neutral-600 mb-2 animate-bounce" />
                    <p className="text-xs font-bold text-neutral-400">
                      Envie o código <strong className="text-amber-300">{roomState.code}</strong>{' '}
                      para o Jogador 2 entrar na sala!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* YOUR TEAM & SQUAD SELECTOR IN LOBBY */}
            <div className="bg-neutral-900/90 p-6 rounded-3xl border border-neutral-800 space-y-5">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white font-heading flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    Escolha Seu Time e Seu Elenco ({role === 'host' ? 'Jogador 1' : 'Jogador 2'})
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Você pode jogar com o <strong>Elenco Original</strong> do clube ou escolher
                    qualquer <strong>Elenco Personalizado</strong> salvo.
                  </p>
                </div>

                {/* Squad Selector Dropdown: Original vs Personalizado */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <div className="flex-1 sm:w-72">
                    <label className="block text-[10px] font-black text-amber-400 uppercase tracking-wider mb-1">
                      Seu Elenco na Partida:
                    </label>
                    <select
                      value={selectedSquadOption}
                      onChange={e => handleSelectSquadInLobby(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-amber-500/50 text-xs font-black text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="original">
                        ⚽ Elenco Original ({selectedClub.shortName})
                      </option>
                      {customSquads.map(sq => (
                        <option key={sq.id} value={sq.id}>
                          ✏️ Elenco Personalizado: {sq.name} ({sq.players.length} jog.)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenSquadEditor}
                    className="px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 text-xs font-black flex items-center gap-1.5 transition self-end"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Criar / Editar Elencos</span>
                  </button>
                </div>
              </div>

              {/* Search & Country Filter */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'br', label: '🇧🇷 Brasil' },
                    { id: 'eng', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra' },
                    { id: 'esp', label: '🇪🇸 Espanha' },
                    { id: 'ita', label: '🇮🇹 Itália' },
                    { id: 'ger', label: '🇩🇪 Alemanha' },
                    { id: 'fra', label: '🇫🇷 França' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCountryFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        countryFilter === tab.id
                          ? 'bg-emerald-500 text-neutral-950'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar clube..."
                  className="w-full sm:w-64 px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Club Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {filteredClubs.map(c => {
                  const isSelected = selectedClubId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClubInLobby(c)}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-400 ring-2 ring-emerald-400/50'
                          : 'bg-neutral-950/70 hover:bg-neutral-800 border-neutral-800'
                      }`}
                    >
                      <ClubBadge club={c} size="md" />
                      <span className="text-xs font-black text-white truncate max-w-full">
                        {c.name}
                      </span>
                      <span className="text-[10px] text-neutral-400">{c.country}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3: ONLINE REAL-TIME MATCH (JOGADOR 1 VS JOGADOR 2)           */}
        {/* ================================================================ */}
        {roomState && (roomState.status === 'playing' || roomState.status === 'ended') && (
          <div className="space-y-6">
            {/* Live Multiplayer Scoreboard */}
            <div className="bg-neutral-900 p-4 sm:p-6 rounded-3xl border border-neutral-800 shadow-xl flex items-center justify-between gap-4">
              {/* Jogador 1 (Home) */}
              <div className="flex items-center gap-3 sm:gap-4">
                <ClubBadge club={hostClub} size="xl" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                      P1 • {roomState.host.name}
                    </span>
                    {role === 'host' && (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-neutral-950 text-[10px] font-black">
                        VOCÊ
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white font-heading mt-0.5">
                    {hostClub.name}
                  </h3>
                  <span className="text-[11px] text-neutral-400">
                    {roomState.host.customSquadName}
                  </span>
                </div>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  SALA #{roomState.code}
                </span>
                <div className="flex items-center gap-3 sm:gap-6 bg-neutral-950 px-6 py-2 rounded-2xl border border-neutral-800">
                  <span className="text-2xl sm:text-4xl font-black text-emerald-400 font-heading">
                    {homeScore}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-neutral-500 uppercase">
                    X
                  </span>
                  <span className="text-2xl sm:text-4xl font-black text-cyan-400 font-heading">
                    {awayScore}
                  </span>
                </div>
              </div>

              {/* Jogador 2 (Away) */}
              <div className="flex items-center gap-3 sm:gap-4 flex-row-reverse text-right">
                <ClubBadge club={guestClub} size="xl" />
                <div>
                  <div className="flex items-center justify-end gap-1.5">
                    {role === 'guest' && (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-neutral-950 text-[10px] font-black">
                        VOCÊ
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase">
                      P2 • {roomState.guest?.name || 'Jogador 2'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white font-heading mt-0.5">
                    {guestClub.name}
                  </h3>
                  <span className="text-[11px] text-neutral-400">
                    {roomState.guest?.customSquadName || 'Elenco Original'}
                  </span>
                </div>
              </div>
            </div>

            {roomState.status === 'playing' && (
              <Interactive2DPitch
                key={matchKey}
                homeClub={hostClub}
                awayClub={guestClub}
                userTeamSide={role === 'guest' ? 'away' : 'home'}
                initialMode="play"
                controlAllTeamByDefault={true}
                customHomeRoster={hostRoster}
                customAwayRoster={guestRoster}
                multiplayerConfig={multiplayerPitchConfig}
                onMatchEvent={(evt, scores, updatedStats) => {
                  setHomeScore(scores.homeScore);
                  setAwayScore(scores.awayScore);
                  setStats({ ...updatedStats });
                  setEvents(prev => [evt, ...prev]);
                }}
                onFullTime={finalData => {
                  setHomeScore(finalData.homeScore);
                  setAwayScore(finalData.awayScore);
                  setEvents(finalData.events);
                  setStats(finalData.stats);
                  prevRoomStatusRef.current = 'ended';
                  setRoomState(prev =>
                    prev ? { ...prev, status: 'ended', gameStarted: false } : prev
                  );
                }}
              />
            )}

            {/* POST-MATCH SYNCHRONIZED RESULT MODAL */}
            {roomState.status === 'ended' && (
              <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 sm:p-8 rounded-3xl border-2 border-amber-500/40 shadow-2xl text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-widest">
                    FIM DE JOGO ONLINE • RESULTADO SINCRONIZADO
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-heading mt-2">
                    {homeScore > awayScore
                      ? `🏆 Vitória de ${roomState.host.name} (${hostClub.name})!`
                      : awayScore > homeScore
                      ? `🏆 Vitória de ${roomState.guest?.name || 'Jogador 2'} (${guestClub.name})!`
                      : '🤝 Empate Eletrizante no Multiplayer!'}
                  </h2>
                  <p className="text-lg font-black text-neutral-300 mt-1">
                    {hostClub.name} {homeScore} x {awayScore} {guestClub.name}
                  </p>
                </div>

                {events.length > 0 && (
                  <div className="max-w-lg mx-auto bg-neutral-950/80 p-4 rounded-2xl border border-neutral-800 text-left space-y-1.5">
                    <span className="block text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-1">
                      Resumo de Eventos da Partida ({ stats.homePossession }% x { stats.awayPossession }% posse):
                    </span>
                    {events.slice(0, 6).map((ev, idx) => (
                      <div key={idx} className="text-xs font-bold text-neutral-200">
                        {ev.text}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      prevRoomStatusRef.current = 'lobby';
                      setRoomState(prev =>
                        prev ? { ...prev, status: 'lobby', gameStarted: false } : prev
                      );
                      syncLobbySelection(selectedClubId, selectedSquadOption, false);
                    }}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 shadow-xl"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Voltar ao Lobby (Jogar Revanche)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
