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
  Sparkles,
  Wifi,
  WifiOff,
  RotateCcw,
  Trophy,
  Edit3,
  Gamepad2
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
  name: string;
  clubId: string;
  squadType: 'original' | 'custom';
  customSquadName: string;
  roster: Club2DRosterItem[];
  ready: boolean;
}

interface RoomStatePayload {
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  host: MultiplayerPlayerState;
  guest: MultiplayerPlayerState | null;
}

interface MultiplayerModeProps {
  onBackToMenu: () => void;
  onOpenSquadEditor: () => void;
}

export const MultiplayerMode: React.FC<MultiplayerModeProps> = ({
  onBackToMenu,
  onOpenSquadEditor
}) => {
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('carreira_mp_player_name') || 'Jogador 1';
  });
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);

  // Local Lobby Selections before syncing to server
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

  // Refresh custom squads when entering lobby
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

  // Connect WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isUnmounted) return;
        setWsConnected(true);
      };

      socket.onmessage = event => {
        if (isUnmounted) return;
        try {
          const msg = JSON.parse(event.data);

          // Notify pitch listeners first for ultra-low latency
          listenersRef.current.forEach(fn => fn(msg));

          if (msg.type === 'room_created') {
            setRole(msg.role);
            setRoomState(msg.room);
            prevGuestPresentRef.current = Boolean(msg.room?.guest);
            soundFx.playSuccess();
            showInfo(`✅ Sala ${msg.room.code} criada! Compartilhe o código com o Jogador 2.`);
          } else if (msg.type === 'room_joined') {
            setRole(msg.role);
            setRoomState(msg.room);
            prevGuestPresentRef.current = true;
            soundFx.playSuccess();
            showInfo(`✅ Você entrou na sala ${msg.room.code} como Jogador 2!`);
          } else if (msg.type === 'room_state') {
            const hadGuest = prevGuestPresentRef.current;
            const hasGuestNow = Boolean(msg.room?.guest);
            if (!hadGuest && hasGuestNow) {
              soundFx.playCheer();
              showInfo(`🎉 ${msg.room.guest.name} entrou na sala! Escolham seus times e confirmem.`);
            }
            prevGuestPresentRef.current = hasGuestNow;
            setRoomState(msg.room);
          } else if (msg.type === 'match_started') {
            setRoomState(msg.room);
            setHomeScore(0);
            setAwayScore(0);
            setEvents([]);
            setMatchKey(k => k + 1);
            soundFx.playWhistle();
          } else if (msg.type === 'mp_match_finished' && msg.result) {
            setHomeScore(msg.result.homeScore);
            setAwayScore(msg.result.awayScore);
            setEvents(msg.result.events || []);
            if (msg.result.stats) setStats(msg.result.stats);
            setRoomState(prev => (prev ? { ...prev, status: 'ended' } : prev));
          } else if (msg.type === 'player_disconnected') {
            showError(msg.message || 'O outro jogador desconectou da sala.');
            if (msg.room) {
              prevGuestPresentRef.current = Boolean(msg.room.guest);
              setRoomState(msg.room);
            } else {
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
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [showError, showInfo]);

  const sendWsMessage = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
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
    (club: Club, squadOpt: string): {
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

  // Create Room (Jogador 1)
  const handleCreateRoom = () => {
    const trimmedName = playerName.trim() || 'Jogador 1';
    localStorage.setItem('carreira_mp_player_name', trimmedName);
    const defaultClub = INITIAL_CLUBS[0];
    setSelectedClubId(defaultClub.id);
    setSelectedSquadOption('original');
    const resolved = buildLocalResolvedRoster(defaultClub, 'original');

    sendWsMessage({
      type: 'create_room',
      name: trimmedName,
      clubId: defaultClub.id,
      squadType: resolved.squadType,
      customSquadName: resolved.customSquadName,
      roster: resolved.roster
    });
  };

  // Join Room (Jogador 2)
  const handleJoinRoom = () => {
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      showError('Digite o código da sala para entrar!');
      return;
    }
    const trimmedName = playerName.trim() || 'Jogador 2';
    localStorage.setItem('carreira_mp_player_name', trimmedName);
    const defaultClub = INITIAL_CLUBS[4] || INITIAL_CLUBS[1];
    setSelectedClubId(defaultClub.id);
    setSelectedSquadOption('original');
    const resolved = buildLocalResolvedRoster(defaultClub, 'original');

    sendWsMessage({
      type: 'join_room',
      code: cleanCode,
      name: trimmedName,
      clubId: defaultClub.id,
      squadType: resolved.squadType,
      customSquadName: resolved.customSquadName,
      roster: resolved.roster
    });
  };

  // Update Club or Squad in Lobby
  const syncLobbySelection = useCallback(
    (newClubId: string, newSquadOpt: string, newReady?: boolean) => {
      const clubObj = INITIAL_CLUBS.find(c => c.id === newClubId) || INITIAL_CLUBS[0];
      const resolved = buildLocalResolvedRoster(clubObj, newSquadOpt);
      sendWsMessage({
        type: 'update_lobby',
        name: playerName.trim() || (role === 'host' ? 'Jogador 1' : 'Jogador 2'),
        clubId: clubObj.id,
        squadType: resolved.squadType,
        customSquadName: resolved.customSquadName,
        roster: resolved.roster,
        ready: newReady !== undefined ? newReady : false
      });
    },
    [buildLocalResolvedRoster, playerName, role, sendWsMessage]
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

  const handleStartOnlineMatch = () => {
    if (!bothReady) {
      showError('A partida só pode ser iniciada quando os 2 jogadores confirmarem (Pronto)!');
      return;
    }
    soundFx.playWhistle();
    sendWsMessage({ type: 'start_match' });
  };

  const handleLeaveRoom = () => {
    soundFx.playClick();
    sendWsMessage({ type: 'leave_room' });
    setRoomState(null);
    setRole(null);
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
      sendMessage: sendWsMessage,
      subscribeMessage: subscribeWsMessage
    }),
    [
      role,
      roomState?.code,
      roomState?.host?.name,
      roomState?.guest?.name,
      sendWsMessage,
      subscribeWsMessage
    ]
  );

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
                    wsConnected
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {wsConnected ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-400" /> Online em Tempo Real
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-rose-400" /> Reconectando...
                    </>
                  )}
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
                    Gera automaticamente um código único de 5 caracteres (ex: <code className="text-emerald-300 font-black">F7K29</code>) para você copiar e enviar para seu amigo jogar contra você em tempo real.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={!wsConnected}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Criar Sala Agora</span>
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
                    Digite o código da sala recebido do Jogador 1 para entrar imediatamente no mesmo Lobby e escolher seu time e elenco.
                  </p>

                  <div className="pt-2">
                    <label className="block text-[11px] font-black text-cyan-300 uppercase tracking-wider mb-1.5">
                      Código da Sala:
                    </label>
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                      placeholder="Ex: F7K29"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl bg-neutral-950 border-2 border-cyan-500/50 text-white font-black text-lg tracking-[0.25em] uppercase text-center focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleJoinRoom}
                  disabled={!wsConnected || !joinCodeInput.trim()}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/25 transition flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Entrar em Sala</span>
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
                        roomState.guest ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span className="text-sm sm:text-base font-black text-white">
                      {roomState.guest
                        ? `✅ 2/2 Jogadores Conectados (${roomState.host.name} vs ${roomState.guest.name})`
                        : '⏳ Aguardando o Jogador 2 digitar o código para entrar...'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    Cada jogador escolhe seu clube, seu elenco (Original ou Personalizado) e clica em Confirmar Escolha.
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
                      Envie o código <strong className="text-amber-300">{roomState.code}</strong> para o Jogador 2 entrar na sala!
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
                    Você pode jogar com o <strong>Elenco Original</strong> do clube ou escolher qualquer <strong>Elenco Personalizado</strong> salvo.
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
                  <span className="text-xs sm:text-sm font-black text-neutral-500 uppercase">X</span>
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
                  setRoomState(prev => (prev ? { ...prev, status: 'ended' } : prev));
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

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      syncLobbySelection(selectedClubId, selectedSquadOption, false);
                      setRoomState(prev => (prev ? { ...prev, status: 'lobby' } : prev));
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
