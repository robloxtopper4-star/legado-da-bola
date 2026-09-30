import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Trophy, 
  ArrowLeft, 
  RotateCcw, 
  Shield, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  Circle, 
  Users,
  User,
  Search,
  Sparkles,
  Target,
  X
} from 'lucide-react';
import { Club } from '../types';
import { INITIAL_CLUBS } from '../data/database';
import { soundFx } from '../utils/audio';
import { ClubBadge } from './ClubBadge';

interface PenaltyShootoutProps {
  onBackToMenu?: () => void;
  onBack?: () => void;
  initialHomeClubId?: string;
  initialAwayClubId?: string;
}

// Coordinates and physics parameters
export const BALL_RESTING_SPOT = { x: 50, y: 142, scale: 1, rotation: 0 };

export type PenaltyAimZone = 
  | 'top_left' 
  | 'top_center' 
  | 'top_right' 
  | 'bottom_left' 
  | 'bottom_center' 
  | 'bottom_right';

export type PenaltyGameMode = 'versus' | 'solo';

// Accurate 2D coordinates for ball targeting inside the goal frame (percentages of goal frame)
export const AIM_COORDINATES: Record<PenaltyAimZone, { 
  x: number; 
  y: number; 
  label: string; 
  shortLabel: string;
  icon: string;
}> = {
  top_left: { x: 18, y: 22, label: 'Ângulo Superior Esquerdo (Gaveta)', shortLabel: 'Gaveta Esq.', icon: '↖️' },
  top_center: { x: 50, y: 20, label: 'Alto no Meio (Cavadinha)', shortLabel: 'Cavadinha', icon: '⬆️' },
  top_right: { x: 82, y: 22, label: 'Ângulo Superior Direito (Gaveta)', shortLabel: 'Gaveta Dir.', icon: '↗️' },
  bottom_left: { x: 18, y: 76, label: 'Canto Rasteiro Esquerdo', shortLabel: 'Canto Esq.', icon: '↙️' },
  bottom_center: { x: 50, y: 78, label: 'Meio Rasteiro', shortLabel: 'Meio Baixo', icon: '⬇️' },
  bottom_right: { x: 82, y: 76, label: 'Canto Rasteiro Direito', shortLabel: 'Canto Dir.', icon: '↘️' },
};

// Accurate Goalkeeper dive glove target coordinates inside the goal frame
export const KEEPER_DIVE_COORDINATES: Record<PenaltyAimZone, { x: number; y: number; rotate: number }> = {
  top_left: { x: 20, y: 24, rotate: -35 },
  top_center: { x: 50, y: 22, rotate: 0 },
  top_right: { x: 80, y: 24, rotate: 35 },
  bottom_left: { x: 20, y: 76, rotate: -45 },
  bottom_center: { x: 50, y: 78, rotate: 0 },
  bottom_right: { x: 80, y: 76, rotate: 45 },
};

export const PenaltyShootout: React.FC<PenaltyShootoutProps> = ({ 
  onBackToMenu, 
  onBack,
  initialHomeClubId,
  initialAwayClubId
}) => {
  const handleReturn = () => {
    soundFx.playClick();
    if (onBackToMenu) onBackToMenu();
    else if (onBack) onBack();
  };

  // All first divisions and traditional clubs available
  const penaltyClubs = useMemo(() => {
    return INITIAL_CLUBS;
  }, []);

  // Country & League selector state
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Game Mode: 'versus' (1v1 local, each controls shooter) or 'solo' (Player vs CPU)
  const [gameMode, setGameMode] = useState<PenaltyGameMode>('versus');

  // Selected clubs
  const [homeClub, setHomeClub] = useState<Club>(() => {
    if (initialHomeClubId) {
      const found = penaltyClubs.find(c => c.id === initialHomeClubId);
      if (found) return found;
    }
    return penaltyClubs.find(c => c.id === 'flamengo') || penaltyClubs[0];
  });
  const [awayClub, setAwayClub] = useState<Club>(() => {
    if (initialAwayClubId) {
      const found = penaltyClubs.find(c => c.id === initialAwayClubId);
      if (found) return found;
    }
    return penaltyClubs.find(c => c.id === 'real_madrid') || penaltyClubs[1];
  });

  // Game flow state: 'selection' | 'match' | 'finished'
  const [gameState, setGameState] = useState<'selection' | 'match' | 'finished'>('selection');

  // Match state
  // In 'solo': 'user_kick' (P1 shoots) | 'opp_kick' (CPU shoots, P1 dives)
  // In 'versus': 'p1_kick' (P1 shoots) | 'p2_kick' (P2 shoots) - Both only control kicker!
  const [turn, setTurn] = useState<'p1_kick' | 'p2_kick' | 'user_kick' | 'opp_kick'>('p1_kick');
  const [currentRound, setCurrentRound] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [homeHistory, setHomeHistory] = useState<boolean[]>([]);
  const [awayHistory, setAwayHistory] = useState<boolean[]>([]);

  // Ball physics and animation state
  const [isKicking, setIsKicking] = useState(false);
  const [hoverAim, setHoverAim] = useState<PenaltyAimZone | null>(null);
  const [activeKickerAim, setActiveKickerAim] = useState<PenaltyAimZone | null>(null);
  const [activeKeeperDive, setActiveKeeperDive] = useState<PenaltyAimZone | null>(null);
  const [ballVisual, setBallVisual] = useState<{
    x: number;
    y: number;
    scale: number;
    rotation: number;
    isHitboxSaved?: boolean;
    isCrossbar?: boolean;
  }>(BALL_RESTING_SPOT);

  const [shotOutcome, setShotOutcome] = useState<{
    scored: boolean;
    title: string;
    sub: string;
  } | null>(null);

  // Power bar state for shooting
  const [power, setPower] = useState(50);
  const [powerDirection, setPowerDirection] = useState<'up' | 'down'>('up');

  // Power bar oscillation
  useEffect(() => {
    const isWaitingKick = 
      gameState === 'match' && 
      !isKicking && 
      (gameMode === 'versus' || turn === 'user_kick');

    if (isWaitingKick) {
      const interval = setInterval(() => {
        setPower(prev => {
          if (prev >= 96) {
            setPowerDirection('down');
            return 90;
          } else if (prev <= 8) {
            setPowerDirection('up');
            return 14;
          }
          return powerDirection === 'up' ? prev + 5 : prev - 5;
        });
      }, 45);
      return () => clearInterval(interval);
    }
  }, [gameState, turn, isKicking, powerDirection, gameMode]);

  // Country filtering map covering all first divisions and classic Brazilian clubs
  const leagueByCountry: Record<string, string[]> = {
    br: ['br_a', 'br_b'], // Brasileirão Série A & Série B (incluindo Coritiba, Paraná Clube, etc.)
    eng: ['eng_1'],       // Premier League completa (20 clubes)
    esp: ['esp_1'],       // La Liga completa (20 clubes)
    por: ['por_1'],       // Liga Portugal completa (18 clubes)
    ita: ['ita_1'],       // Serie A Italiana completa (20 clubes)
    ger: ['ger_1'],       // Bundesliga completa (18 clubes)
    fra: ['fra_1'],       // Ligue 1 completa (18 clubes)
    south_america: ['arg_1', 'uru_1', 'col_1', 'ecu_1', 'chi_1', 'par_1'],
    world: ['sau_1', 'usa_1', 'mex_1', 'jpn_1', 'egy_1', 'ned_1', 'tur_1', 'sco_1']
  };

  // Filtered clubs by country and search text
  const displayedClubs = useMemo(() => {
    let list = penaltyClubs;
    // When typing in search, search across ALL clubs so any club (e.g., Coritiba, Paraná) appears instantly!
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.shortName.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
      );
    }
    if (countryFilter !== 'all') {
      const targetLeagues = leagueByCountry[countryFilter] || [];
      list = list.filter(c => targetLeagues.includes(c.leagueId));
    }
    return list;
  }, [penaltyClubs, countryFilter, searchQuery]);

  // Reset ball to penalty spot
  const resetBallToSpot = () => {
    setBallVisual(BALL_RESTING_SPOT);
    setActiveKickerAim(null);
    setActiveKeeperDive(null);
    setHoverAim(null);
  };

  // Start penalty shootout match
  const handleStartMatch = () => {
    soundFx.playWhistle();
    setHomeScore(0);
    setAwayScore(0);
    setHomeHistory([]);
    setAwayHistory([]);
    setCurrentRound(1);
    setTurn(gameMode === 'versus' ? 'p1_kick' : 'user_kick');
    setIsKicking(false);
    setShotOutcome(null);
    resetBallToSpot();
    setGameState('match');
  };

  // Swap home and away clubs
  const handleSwapClubs = () => {
    soundFx.playClick();
    const temp = homeClub;
    setHomeClub(awayClub);
    setAwayClub(temp);
  };

  // Check if shootout has reached a decisive winner
  const checkWinner = (
    newHomeHistory: boolean[], 
    newAwayHistory: boolean[], 
    hScore: number, 
    aScore: number
  ) => {
    const totalRounds = 5;

    // Normal 5 rounds check
    if (newHomeHistory.length <= totalRounds && newAwayHistory.length <= totalRounds) {
      const homeRemaining = totalRounds - newHomeHistory.length;
      const awayRemaining = totalRounds - newAwayHistory.length;

      // Impossibility for opponent to catch up
      if (hScore > aScore + awayRemaining) return 'home';
      if (aScore > hScore + homeRemaining) return 'away';

      // Both completed 5 kicks
      if (newHomeHistory.length === totalRounds && newAwayHistory.length === totalRounds) {
        if (hScore > aScore) return 'home';
        if (aScore > hScore) return 'away';
        return null; // Tied -> sudden death proceeds
      }
      return null;
    }

    // Sudden death (after round 5): both must take equal shots per pair
    if (newHomeHistory.length === newAwayHistory.length && newHomeHistory.length > totalRounds) {
      if (hScore > aScore) return 'home';
      if (aScore > hScore) return 'away';
    }

    return null;
  };

  // Centralized physics execution for kicks
  const executeKick = (
    targetZone: PenaltyAimZone,
    kickerClub: Club,
    defendingClub: Club,
    isPlayer1Shot: boolean
  ) => {
    if (isKicking) return;
    setIsKicking(true);
    setActiveKickerAim(targetZone);
    soundFx.playKick();

    const targetCoord = AIM_COORDINATES[targetZone];
    const zones: PenaltyAimZone[] = [
      'top_left', 'top_center', 'top_right', 
      'bottom_left', 'bottom_center', 'bottom_right'
    ];

    // Goalkeeper AI prediction probability based on club defense rating
    const oppDefBonus = (defendingClub.defenseRating - 75) * 0.015;
    const guessRightChance = 0.30 + Math.max(0, Math.min(0.35, oppDefBonus));

    let keeperDive: PenaltyAimZone;
    if (Math.random() < guessRightChance) {
      keeperDive = targetZone; // Goalkeeper predicted the exact zone!
    } else {
      const otherZones = zones.filter(z => z !== targetZone);
      keeperDive = otherZones[Math.floor(Math.random() * otherZones.length)];
    }
    setActiveKeeperDive(keeperDive);

    // Overpowered shot condition
    const isOverpowered = power > 90;

    let isGoal = false;
    let isCrossbar = false;
    let isDefended = false;
    let title = '';
    let sub = '';

    if (isOverpowered && Math.random() > 0.35) {
      // Hits crossbar / over the bar
      isGoal = false;
      isCrossbar = true;
      title = '💥 NA TRAVE!';
      sub = `Chute fortíssimo no ${targetCoord.shortLabel} explodiu no travessão!`;
    } else if (keeperDive === targetZone) {
      // Hitbox: Goalkeeper's gloves intercept the ball directly!
      isGoal = false;
      isDefended = true;
      title = '🧤 DEFENDEU O GOLEIRO!';
      sub = `A mão do goleiro do ${defendingClub.name} espalmou a bola no ${targetCoord.shortLabel}!`;
    } else {
      // Clean Goal!
      isGoal = true;
      title = '⚽ GOLAÇO INDEFENSÁVEL!';
      sub = `Bola no ${targetCoord.shortLabel}! O goleiro caiu para o outro lado!`;
    }

    // Step 1: Animate ball flying directly into the targeted goal coordinates!
    // Ball smoothly transitions to targetX and targetY inside goal frame
    setTimeout(() => {
      if (isCrossbar) {
        // Fly to crossbar edge
        setBallVisual({
          x: targetCoord.x,
          y: -2,
          scale: 0.65,
          rotation: 540,
          isCrossbar: true
        });
        soundFx.playPost();
      } else if (isDefended) {
        // Fly directly into the goalkeeper's gloves
        const keeperCoord = KEEPER_DIVE_COORDINATES[keeperDive];
        setBallVisual({
          x: keeperCoord.x,
          y: keeperCoord.y,
          scale: 0.65,
          rotation: 360,
          isHitboxSaved: true
        });
        soundFx.playDeflection(); // Punchy glove deflection slap!
      } else {
        // Clean goal straight to target coordinates
        setBallVisual({
          x: targetCoord.x,
          y: targetCoord.y,
          scale: 0.58,
          rotation: 360
        });
      }
    }, 50);

    // Step 2: Hitbox rebound or goal cheer at impact
    setTimeout(() => {
      if (isDefended) {
        // Ball rebounds off keeper's gloves downwards and to the side
        setBallVisual(prev => ({
          ...prev,
          x: prev.x + (Math.random() > 0.5 ? 10 : -10),
          y: Math.min(105, prev.y + 22),
          scale: 0.72,
          rotation: prev.rotation + 180
        }));
      } else if (isCrossbar) {
        // Ball rebounds off crossbar back out onto pitch
        setBallVisual(prev => ({
          ...prev,
          y: 70,
          scale: 0.72,
          rotation: prev.rotation + 240
        }));
      } else if (isGoal) {
        soundFx.playCheer();
      }

      setShotOutcome({ scored: isGoal, title, sub });

      // Update match history
      const nextHomeHistory = isPlayer1Shot ? [...homeHistory, isGoal] : homeHistory;
      const nextAwayHistory = !isPlayer1Shot ? [...awayHistory, isGoal] : awayHistory;
      const nextHomeScore = isPlayer1Shot && isGoal ? homeScore + 1 : homeScore;
      const nextAwayScore = !isPlayer1Shot && isGoal ? awayScore + 1 : awayScore;

      if (isPlayer1Shot) {
        setHomeHistory(nextHomeHistory);
        setHomeScore(nextHomeScore);
      } else {
        setAwayHistory(nextAwayHistory);
        setAwayScore(nextAwayScore);
      }

      // Check if winner decided
      const winner = checkWinner(nextHomeHistory, nextAwayHistory, nextHomeScore, nextAwayScore);

      setTimeout(() => {
        setIsKicking(false);
        setShotOutcome(null);
        resetBallToSpot();

        if (winner) {
          setGameState('finished');
          soundFx.playFanfare();
        } else {
          // Switch turn
          if (gameMode === 'versus') {
            if (isPlayer1Shot) {
              setTurn('p2_kick');
            } else {
              setCurrentRound(r => r + 1);
              setTurn('p1_kick');
            }
          } else {
            // Solo mode
            setTurn('opp_kick');
          }
        }
      }, 2300);
    }, 550);
  };

  // Solo mode: User dives as Goalkeeper when CPU shoots
  const handleUserSoloDive = (chosenDive: PenaltyAimZone) => {
    if (isKicking || turn !== 'opp_kick') return;
    setIsKicking(true);
    setActiveKeeperDive(chosenDive);
    soundFx.playKick();

    // CPU shooter picks a target zone
    const zones: PenaltyAimZone[] = [
      'top_left', 'top_center', 'top_right', 
      'bottom_left', 'bottom_center', 'bottom_right'
    ];
    const cpuTarget = zones[Math.floor(Math.random() * zones.length)];
    setActiveKickerAim(cpuTarget);
    const targetCoord = AIM_COORDINATES[cpuTarget];

    let isGoal = false;
    let isDefended = false;
    let title = '';
    let sub = '';

    if (chosenDive === cpuTarget) {
      // User predicted correctly: gloves touch the ball!
      isGoal = false;
      isDefended = true;
      title = '🧤 DEFENDEU! VOCÊ PEGOU!';
      sub = `Você pulou no ${targetCoord.shortLabel} e espalmou a cobrança do ${awayClub.name}!`;
    } else {
      // 8% chance CPU misses
      if (Math.random() < 0.08) {
        isGoal = false;
        title = '💨 PRA FORA!';
        sub = `O cobrador do ${awayClub.name} isolou na arquibancada!`;
      } else {
        isGoal = true;
        title = '⚽ GOL DO ADVERSÁRIO';
        sub = `O batedor colocou a bola no ${targetCoord.shortLabel}.`;
      }
    }

    // Animate ball
    setTimeout(() => {
      if (isDefended) {
        const keeperCoord = KEEPER_DIVE_COORDINATES[chosenDive];
        setBallVisual({
          x: keeperCoord.x,
          y: keeperCoord.y,
          scale: 0.65,
          rotation: 360,
          isHitboxSaved: true
        });
        soundFx.playDeflection();
      } else {
        setBallVisual({
          x: targetCoord.x,
          y: targetCoord.y,
          scale: 0.58,
          rotation: 360
        });
      }
    }, 50);

    setTimeout(() => {
      if (isDefended) {
        setBallVisual(prev => ({
          ...prev,
          x: prev.x + (Math.random() > 0.5 ? 10 : -10),
          y: Math.min(105, prev.y + 22),
          scale: 0.72,
          rotation: prev.rotation + 180
        }));
        soundFx.playCheer();
      }

      setShotOutcome({ scored: isGoal, title, sub });

      const newHistory = [...awayHistory, isGoal];
      const newScore = isGoal ? awayScore + 1 : awayScore;
      setAwayHistory(newHistory);
      setAwayScore(newScore);

      const winner = checkWinner(homeHistory, newHistory, homeScore, newScore);

      setTimeout(() => {
        setIsKicking(false);
        setShotOutcome(null);
        resetBallToSpot();

        if (winner) {
          setGameState('finished');
          soundFx.playFanfare();
        } else {
          setCurrentRound(r => r + 1);
          setTurn('user_kick');
        }
      }, 2300);
    }, 550);
  };

  const isSuddenDeath = currentRound > 5;
  const matchWinner = homeScore > awayScore ? homeClub : awayScore > homeScore ? awayClub : null;

  // Active shooter club & name according to turn
  const currentShooterInfo = useMemo(() => {
    if (gameMode === 'versus') {
      if (turn === 'p1_kick') {
        return {
          title: '🟢 VEZ DO JOGADOR 1',
          club: homeClub,
          roleText: 'Controle o batedor! Mire na trave e chute no tempo ideal da barra de força.',
          color: 'text-emerald-400'
        };
      } else {
        return {
          title: '🔴 VEZ DO JOGADOR 2',
          club: awayClub,
          roleText: 'Controle o batedor! Mire na trave e chute no tempo ideal da barra de força.',
          color: 'text-rose-400'
        };
      }
    } else {
      if (turn === 'user_kick') {
        return {
          title: 'SEU TIME COBRANDO',
          club: homeClub,
          roleText: 'Mire e chute com precisão para balançar as redes!',
          color: 'text-emerald-400'
        };
      } else {
        return {
          title: 'ADVERSÁRIO NA MARCA DA CAL',
          club: awayClub,
          roleText: 'Escolha para qual canto seu goleiro vai pular!',
          color: 'text-amber-400'
        };
      }
    }
  }, [gameMode, turn, homeClub, awayClub]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 animate-fadeIn">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <button
          onClick={handleReturn}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 border border-neutral-700 transition"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          Voltar ao Menu Principal
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            Amistoso Oficial: Disputa de Pênaltis
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1">
            {gameMode === 'versus' ? <Users className="w-3 h-3 text-emerald-400" /> : <User className="w-3 h-3 text-blue-400" />}
            {gameMode === 'versus' ? '1v1 Local' : 'Solo'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCREEN 1: SETUP & CLUB SELECTION */}
      {/* ========================================================================= */}
      {gameState === 'selection' && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black text-white font-heading tracking-tight">
              DISPUTA DE PÊNALTIS
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto">
              Escolha entre o modo <strong className="text-emerald-400">1x1 Multiplayer</strong> (cada um controla seu batedor) ou <strong className="text-blue-400">Solo</strong> (você chuta e defende).
            </p>
          </div>

          {/* Game Mode Selector Card */}
          <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 max-w-xl mx-auto flex items-center justify-center gap-3">
            <button
              onClick={() => { soundFx.playClick(); setGameMode('versus'); }}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1.5 border ${
                gameMode === 'versus'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/10'
                  : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 font-extrabold text-sm">
                <Users className="w-4 h-4 text-emerald-400" />
                Modo 1 vs 1 (Multiplayer)
              </div>
              <span className="text-[10px] text-neutral-400 text-center font-normal">
                Dois jogadores! Cada um controla exclusivamente o seu batedor.
              </span>
            </button>

            <button
              onClick={() => { soundFx.playClick(); setGameMode('solo'); }}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1.5 border ${
                gameMode === 'solo'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/10'
                  : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5 font-extrabold text-sm">
                <User className="w-4 h-4 text-blue-400" />
                Modo Solo (vs CPU)
              </div>
              <span className="text-[10px] text-neutral-400 text-center font-normal">
                Você chuta pelo seu time e pula no gol para defender contra a máquina.
              </span>
            </button>
          </div>

          {/* Teams Matchup Preview Card */}
          <div className="bg-gradient-to-r from-neutral-900/90 via-neutral-950 to-neutral-900/90 p-6 rounded-3xl border border-neutral-800 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Home Club / Player 1 */}
            <div className="flex flex-col items-center text-center space-y-2 flex-1">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                {gameMode === 'versus' ? 'Jogador 1 (Mandante)' : 'Seu Time (Mandante)'}
              </span>
              <ClubBadge clubId={homeClub.id} name={homeClub.name} size="lg" />
              <h3 className="font-extrabold text-lg text-white font-heading">{homeClub.name}</h3>
              <span className="text-xs text-neutral-400">{homeClub.country} • Defesa: {homeClub.defenseRating}</span>
            </div>

            {/* VS / Swap Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleSwapClubs}
                title="Inverter Mandante / Visitante"
                className="p-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition shadow-lg"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <span className="text-xs font-black text-amber-400 tracking-wider">VS</span>
            </div>

            {/* Away Club / Player 2 or CPU */}
            <div className="flex flex-col items-center text-center space-y-2 flex-1">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30 flex items-center gap-1">
                {gameMode === 'versus' ? 'Jogador 2 (Visitante)' : 'Adversário CPU'}
              </span>
              <ClubBadge clubId={awayClub.id} name={awayClub.name} size="lg" />
              <h3 className="font-extrabold text-lg text-white font-heading">{awayClub.name}</h3>
              <span className="text-xs text-neutral-400">{awayClub.country} • Defesa: {awayClub.defenseRating}</span>
            </div>
          </div>

          {/* Search Bar & Country Tabs */}
          <div className="space-y-3 bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar clube (ex: Flamengo, Real Madrid, Benfica)..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Count */}
              <span className="text-xs text-neutral-400 shrink-0">
                {displayedClubs.length} times disponíveis
              </span>
            </div>

            {/* Country Selector Tabs */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[
                { id: 'all', label: '🌍 Todos os Clubes' },
                { id: 'br', label: '🇧🇷 Brasil (Série A & Tradicionais)' },
                { id: 'eng', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra (Premier League)' },
                { id: 'esp', label: '🇪🇸 Espanha (La Liga)' },
                { id: 'ita', label: '🇮🇹 Itália (Serie A)' },
                { id: 'ger', label: '🇩🇪 Alemanha (Bundesliga)' },
                { id: 'fra', label: '🇫🇷 França (Ligue 1)' },
                { id: 'por', label: '🇵🇹 Portugal (Liga Portugal)' },
                { id: 'south_america', label: '🌎 América do Sul' },
                { id: 'world', label: '🌐 Resto do Mundo' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { soundFx.playClick(); setCountryFilter(tab.id); }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    countryFilter === tab.id
                      ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20 font-black'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 border border-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clubs Selection Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-80 overflow-y-auto pr-1">
            {displayedClubs.map(c => {
              const isHome = homeClub.id === c.id;
              const isAway = awayClub.id === c.id;

              return (
                <div
                  key={c.id}
                  className={`p-3 rounded-2xl border transition flex flex-col items-center justify-between text-center gap-2 ${
                    isHome 
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10'
                      : isAway
                      ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-500/10'
                      : 'bg-neutral-900/80 hover:bg-neutral-900 border-neutral-800'
                  }`}
                >
                  <ClubBadge clubId={c.id} name={c.name} size="md" />
                  <div>
                    <h4 className="font-bold text-xs text-white line-clamp-1">{c.name}</h4>
                    <span className="text-[10px] text-neutral-400">{c.country}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 w-full pt-1">
                    <button
                      onClick={() => { soundFx.playClick(); setHomeClub(c); }}
                      disabled={isHome}
                      className={`py-1 text-[10px] font-bold rounded-lg transition ${
                        isHome 
                          ? 'bg-emerald-500 text-neutral-950'
                          : 'bg-neutral-800 hover:bg-emerald-600/30 text-emerald-400 border border-neutral-700'
                      }`}
                    >
                      {isHome ? 'Time 1 ✓' : 'Time 1'}
                    </button>
                    <button
                      onClick={() => { soundFx.playClick(); setAwayClub(c); }}
                      disabled={isAway}
                      className={`py-1 text-[10px] font-bold rounded-lg transition ${
                        isAway 
                          ? 'bg-rose-500 text-white'
                          : 'bg-neutral-800 hover:bg-rose-600/30 text-rose-400 border border-neutral-700'
                      }`}
                    >
                      {isAway ? 'Time 2 ✓' : 'Time 2'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Launch Shootout Button */}
          <div className="pt-2 text-center">
            <button
              onClick={handleStartMatch}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm tracking-wider shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-[0.98]"
            >
              ⚽ INICIAR DISPUTA DE PÊNALTIS
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2: ACTIVE PENALTY SHOOTOUT ARENA */}
      {/* ========================================================================= */}
      {gameState === 'match' && (
        <div className="space-y-4">
          {/* Match Scoreboard Banner */}
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-3xl flex items-center justify-between shadow-xl">
            {/* Home Club */}
            <div className="flex items-center gap-3 flex-1">
              <ClubBadge clubId={homeClub.id} name={homeClub.name} size="md" />
              <div>
                <span className="font-extrabold text-sm text-white flex items-center gap-2">
                  {homeClub.name}
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    {gameMode === 'versus' ? 'JOGADOR 1' : 'VOCÊ'}
                  </span>
                </span>
                {/* Dots indicator */}
                <div className="flex items-center gap-1.5 mt-1">
                  {Array.from({ length: Math.max(5, homeHistory.length) }).map((_, idx) => {
                    const status = homeHistory[idx];
                    if (status === true) {
                      return <CheckCircle2 key={idx} className="w-3.5 h-3.5 text-emerald-400" />;
                    } else if (status === false) {
                      return <XCircle key={idx} className="w-3.5 h-3.5 text-red-400" />;
                    }
                    return <Circle key={idx} className="w-3.5 h-3.5 text-neutral-600" />;
                  })}
                </div>
              </div>
            </div>

            {/* Score in Center */}
            <div className="text-center px-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                {isSuddenDeath ? `Mata-Mata (Cobrança ${currentRound})` : `Rodada ${currentRound} de 5`}
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-widest">
                {homeScore} - {awayScore}
              </div>
              <span className={`text-[11px] font-extrabold ${currentShooterInfo.color}`}>
                {currentShooterInfo.title}
              </span>
            </div>

            {/* Away Club */}
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="text-right">
                <span className="font-extrabold text-sm text-white flex items-center justify-end gap-2">
                  {awayClub.name}
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">
                    {gameMode === 'versus' ? 'JOGADOR 2' : 'CPU'}
                  </span>
                </span>
                {/* Dots indicator */}
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  {Array.from({ length: Math.max(5, awayHistory.length) }).map((_, idx) => {
                    const status = awayHistory[idx];
                    if (status === true) {
                      return <CheckCircle2 key={idx} className="w-3.5 h-3.5 text-emerald-400" />;
                    } else if (status === false) {
                      return <XCircle key={idx} className="w-3.5 h-3.5 text-red-400" />;
                    }
                    return <Circle key={idx} className="w-3.5 h-3.5 text-neutral-600" />;
                  })}
                </div>
              </div>
              <ClubBadge clubId={awayClub.id} name={awayClub.name} size="md" />
            </div>
          </div>

          {/* Interactive Penalty Pitch / Goal Arena */}
          <div className="relative w-full h-84 sm:h-96 rounded-3xl overflow-hidden border-2 border-neutral-700 shadow-2xl bg-gradient-to-b from-neutral-950 via-emerald-950/70 to-emerald-900 flex flex-col justify-between p-4 select-none">
            {/* Stadium Floodlights Glow */}
            <div className="absolute top-0 inset-x-0 h-32 bg-radial from-emerald-500/15 via-transparent to-transparent pointer-events-none" />

            {/* Pitch Grass Texture & Penalty Box Lines */}
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

            {/* Goal Frame Box */}
            <div className="relative mx-auto w-full max-w-xl h-52 sm:h-60 border-t-8 border-x-8 border-neutral-100 rounded-t-lg bg-neutral-950/50 shadow-2xl flex flex-col justify-between overflow-visible">
              {/* Goal Net Cross-Hatch Lines */}
              <div 
                className={`absolute inset-0 rounded-t-sm overflow-hidden opacity-20 pointer-events-none transition-transform duration-300 ${
                  shotOutcome?.scored ? 'scale-[1.02] opacity-35' : ''
                }`}
                style={{
                  backgroundImage: 'radial-gradient(circle, #ffffff 1.5px, transparent 1.5px)',
                  backgroundSize: '14px 14px'
                }}
              />

              {/* Goal Line Turf */}
              <div className="absolute bottom-0 inset-x-0 h-4 bg-emerald-800/80 border-t-2 border-white/60 pointer-events-none" />

              {/* Goalkeeper Avatar & Gloves Hitbox Rendering */}
              {(() => {
                // Determine Goalkeeper Position based on active dive or default center
                let keeperStyle: React.CSSProperties = {
                  left: '50%',
                  bottom: '6px',
                  transform: 'translateX(-50%)',
                  transition: 'all 450ms cubic-bezier(0.2, 0.8, 0.2, 1)'
                };

                if (activeKeeperDive) {
                  const diveCoords = KEEPER_DIVE_COORDINATES[activeKeeperDive];
                  keeperStyle = {
                    left: `${diveCoords.x}%`,
                    top: `${diveCoords.y}%`,
                    transform: `translate(-50%, -50%) rotate(${diveCoords.rotate}deg)`,
                    transition: 'all 450ms cubic-bezier(0.2, 0.8, 0.2, 1)'
                  };
                }

                const keeperClub = 
                  gameMode === 'versus'
                    ? (turn === 'p1_kick' ? awayClub : homeClub)
                    : (turn === 'user_kick' ? awayClub : homeClub);

                return (
                  <div 
                    className="absolute z-10 pointer-events-none flex flex-col items-center"
                    style={keeperStyle}
                  >
                    {/* Glowing save aura when hitbox intercepts ball */}
                    <div className={`relative flex flex-col items-center transition duration-300 ${
                      ballVisual.isHitboxSaved ? 'scale-125 filter drop-shadow-[0_0_15px_rgba(234,179,8,1)]' : ''
                    }`}>
                      <div className="text-3xl sm:text-4xl filter drop-shadow-md">
                        🧤
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-black/80 text-amber-300 border border-neutral-700 whitespace-nowrap shadow">
                        Goleiro {keeperClub.shortName}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Hover Aim Reticle Indicator */}
              {hoverAim && !isKicking && (
                <div
                  className="absolute pointer-events-none z-15 w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-400/90 border-dashed animate-spin flex items-center justify-center transition-all duration-150"
                  style={{
                    left: `${AIM_COORDINATES[hoverAim].x}%`,
                    top: `${AIM_COORDINATES[hoverAim].y}%`
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
              )}

              {/* Goal Target Zones (6 Clickable sectors) */}
              <div className="relative z-20 w-full h-full grid grid-cols-3 grid-rows-2 p-2 gap-2">
                {(['top_left', 'top_center', 'top_right', 'bottom_left', 'bottom_center', 'bottom_right'] as PenaltyAimZone[]).map((zone) => {
                  const info = AIM_COORDINATES[zone];
                  const isSelectedAim = activeKickerAim === zone;

                  const handleClick = () => {
                    if (isKicking) return;
                    if (gameMode === 'versus') {
                      if (turn === 'p1_kick') {
                        executeKick(zone, homeClub, awayClub, true);
                      } else {
                        executeKick(zone, awayClub, homeClub, false);
                      }
                    } else {
                      // Solo mode
                      if (turn === 'user_kick') {
                        executeKick(zone, homeClub, awayClub, true);
                      } else {
                        handleUserSoloDive(zone);
                      }
                    }
                  };

                  return (
                    <button
                      key={zone}
                      disabled={isKicking}
                      onMouseEnter={() => setHoverAim(zone)}
                      onMouseLeave={() => setHoverAim(null)}
                      onClick={handleClick}
                      className={`rounded-xl border border-dashed flex flex-col items-center justify-center p-1.5 transition-all duration-150 group relative cursor-pointer ${
                        isSelectedAim
                          ? 'bg-emerald-500/40 border-emerald-400 scale-102 shadow-lg shadow-emerald-500/20'
                          : 'bg-black/30 hover:bg-emerald-500/20 border-white/20 hover:border-emerald-400/80 text-neutral-300'
                      }`}
                    >
                      <span className="text-base sm:text-lg group-hover:scale-110 transition-transform">
                        {info.icon}
                      </span>
                      <span className="text-[10px] font-bold group-hover:text-emerald-300 line-clamp-1">
                        {info.shortLabel}
                      </span>

                      {/* Aim reticle hint */}
                      <span className="text-[9px] text-neutral-400 opacity-0 group-hover:opacity-100 transition">
                        Mirar Aqui
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Ball at Penalty Spot or in Flight - anchored directly inside Goal Frame coordinate space */}
              <div 
                className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${ballVisual.x}%`,
                  top: `${ballVisual.y}%`,
                  transform: `translate(-50%, -50%) scale(${ballVisual.scale}) rotate(${ballVisual.rotation}deg)`,
                  transition: isKicking 
                    ? 'all 480ms cubic-bezier(0.18, 0.85, 0.3, 1)' 
                    : 'all 200ms ease-out'
                }}
              >
                <div className="w-9 h-9 rounded-full bg-white border-2 border-neutral-900 flex items-center justify-center text-sm shadow-2xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]">
                  ⚽
                </div>
              </div>
            </div>

            {/* Penalty Spot Mark */}
            <div className="relative flex flex-col items-center justify-center pb-2 pointer-events-none">
              <div className="w-3 h-3 rounded-full bg-white/80 shadow" />
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-300/80 mt-1">
                Marca do Pênalti (11m)
              </span>
            </div>

            {/* Floating Outcome Announcement Banner */}
            {shotOutcome && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-40 animate-scaleUp p-4 text-center">
                <span className="text-3xl sm:text-5xl font-black text-white font-heading drop-shadow-lg">
                  {shotOutcome.title}
                </span>
                <p className="text-xs sm:text-sm text-neutral-300 font-medium max-w-md mt-2">
                  {shotOutcome.sub}
                </p>
              </div>
            )}
          </div>

          {/* Action Instruction Controls */}
          {!isKicking && (
            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl space-y-3">
              {/* When shooting (Both players in 1v1, or User in solo) */}
              {(gameMode === 'versus' || turn === 'user_kick') && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Barra de Força & Precisão do Batedor:
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {power}% {power >= 35 && power <= 85 ? '(Área Perfeita)' : power > 85 ? '(Perigo de Trave / Isolar!)' : '(Chute Fraco)'}
                    </span>
                  </div>

                  {/* Power Slider Indicator */}
                  <div className="w-full bg-neutral-950 h-4 rounded-full overflow-hidden relative border border-neutral-800">
                    <div className="absolute inset-y-0 left-[35%] right-[20%] bg-emerald-500/20 border-x border-emerald-500/50" />
                    <div
                      className={`h-full transition-all duration-75 ${
                        power > 85 ? 'bg-red-500' : power >= 35 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${power}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-neutral-300 text-center">
                    👆 <strong>Clique no setor desejado dentro do gol</strong> para chutar no ângulo, cantinho ou cavadinha com precisão física total!
                  </p>
                </>
              )}

              {/* When user goalkeeps in Solo mode */}
              {gameMode === 'solo' && turn === 'opp_kick' && (
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                    <Shield className="w-4 h-4" />
                    O cobrador da CPU está na marca da cal!
                  </div>
                  <p className="text-xs text-neutral-300">
                    👆 <strong>Clique em um dos cantos do gol acima</strong> para seu goleiro saltar e tentar a defesa!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: MATCH FINISHED / CELEBRATION */}
      {/* ========================================================================= */}
      {gameState === 'finished' && matchWinner && (
        <div className="bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/25">
            🏆
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
              {gameMode === 'versus'
                ? (matchWinner.id === homeClub.id ? '🎉 VITÓRIA DO JOGADOR 1!' : '🎉 VITÓRIA DO JOGADOR 2!')
                : (matchWinner.id === homeClub.id ? '🎉 VITÓRIA ÉPICA DO SEU TIME!' : 'DERROTA NOS PÊNALTIS')
              }
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white font-heading">
              {matchWinner.name} É O CAMPEÃO!
            </h2>
            <p className="text-sm text-neutral-400 max-w-md mx-auto">
              Placar final emocionante nos pênaltis: <strong className="text-white">{homeClub.name} {homeScore} x {awayScore} {awayClub.name}</strong>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={handleStartMatch}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-xs tracking-wider shadow-lg shadow-emerald-500/20 transition"
            >
              <RotateCcw className="w-4 h-4" />
              JOGAR REVANCHE
            </button>

            <button
              onClick={() => { soundFx.playClick(); setGameState('selection'); }}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs border border-neutral-700 transition"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              Escolher Novos Times
            </button>

            <button
              onClick={handleReturn}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-bold text-xs border border-neutral-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Menu Principal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
