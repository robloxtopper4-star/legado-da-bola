import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  FastForward,
  Gamepad2,
  Eye,
  Zap,
  Target,
  Shield,
  Hand,
  MousePointer,
  Keyboard,
  Trophy,
  Activity,
  Sparkles
} from 'lucide-react';
import { Club, PlayerProfile, Position } from '../types';
import { ClubBadge } from './ClubBadge';
import { getClubLogoSources } from '../utils/clubLogos';
import { soundFx } from '../utils/audio';

export interface Pitch2DEvent {
  minute: number;
  type: 'goal' | 'assist' | 'save' | 'post' | 'tackle' | 'pass' | 'dribble';
  team: 'home' | 'away';
  playerNumber: number;
  playerName: string;
  assisterName?: string;
  isUserPlayer?: boolean;
  isUserAssist?: boolean;
  text: string;
}

export interface Pitch2DStats {
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  userGoals: number;
  userAssists: number;
  userPassesCompleted: number;
  userShots: number;
}

export interface Club2DRosterItem {
  number: number;
  name: string;
  pos: 'GK' | 'RB' | 'CB1' | 'CB2' | 'LB' | 'CDM' | 'CM' | 'CAM' | 'RW' | 'LW' | 'ST';
}

export interface MultiplayerGuestInput {
  keys: Record<string, boolean>;
  mouseX: number;
  mouseY: number;
  mouseActive: boolean;
  teamControlMode: boolean;
  autoWalkEnabled: boolean;
  movementStyle: 'hybrid' | 'keyboard';
}

export interface MultiplayerPitchConfig {
  enabled: boolean;
  role: 'host' | 'guest';
  roomCode: string;
  hostPlayerName: string;
  guestPlayerName: string;
  sendMessage: (msg: Record<string, unknown>) => void;
  subscribeMessage: (handler: (msg: any) => void) => () => void;
}

interface Interactive2DPitchProps {
  homeClub: Club;
  awayClub: Club;
  /** Which side the user's team is on ('home' or 'away') */
  userTeamSide: 'home' | 'away';
  /** Optional Career Mode player profile to embed as the user's controlled button */
  careerPlayer?: PlayerProfile | null;
  /** Initial mode: 'play' (control player/team) or 'watch' (spectator 2D) */
  initialMode?: 'play' | 'watch';
  /** When true (default in Main Menu matches), user controls all team players and switches automatically on pass */
  controlAllTeamByDefault?: boolean;
  /** Optional custom 11-player lineup for Home and Away teams */
  customHomeRoster?: Club2DRosterItem[];
  customAwayRoster?: Club2DRosterItem[];
  /** Optional real-time 1v1 Multiplayer configuration */
  multiplayerConfig?: MultiplayerPitchConfig;
  /** Called whenever a match event (goal, save, post) occurs */
  onMatchEvent?: (
    evt: Pitch2DEvent,
    scores: { homeScore: number; awayScore: number },
    stats: Pitch2DStats
  ) => void;
  /** Called when the 90th minute is reached */
  onFullTime?: (finalData: {
    homeScore: number;
    awayScore: number;
    events: Pitch2DEvent[];
    stats: Pitch2DStats;
  }) => void;
  /** Optional callback to skip/simulate to the end */
  onSkipToEnd?: (currentData: {
    minute: number;
    homeScore: number;
    awayScore: number;
    events: Pitch2DEvent[];
    stats: Pitch2DStats;
  }) => void;
  competitionName?: string;
}

interface PitchPlayer {
  id: string;
  number: number;
  name: string;
  shortName: string;
  position: 'GK' | 'RB' | 'CB1' | 'CB2' | 'LB' | 'CDM' | 'CM' | 'CAM' | 'RW' | 'LW' | 'ST';
  team: 'home' | 'away';
  isUserPlayer: boolean;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dirX: number;
  dirY: number;
  speedStat: number; // 50-99
  shootStat: number; // 50-99
  passStat: number;  // 50-99
  /** 3-second cooldown (180 frames at 60fps) for stealing the ball (E) — applies to both User & Bots */
  tackleCooldownFrames: number;
  /** Visual tackle lunge animation counter (frames) */
  tackleAnimFrames: number;
  /** Cooldown for spin-dribble (Q) — applies to both User & Bots */
  dribbleCooldownFrames: number;
  /** Active spin-dribble ("girinho + passinho pra frente") animation counter (frames) */
  dribbleAnimFrames: number;
  /** Continuous autonomous walking cycle phase for animated feet & stride */
  walkPhase: number;
  /** Autonomous walking wander angle for natural off-ball movement */
  wanderAngle: number;
}

interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string | null;
  passTargetId: string | null;
  isShot: boolean;
  shooterId: string | null;
  shooterTeam: 'home' | 'away' | null;
  lastPasserId: string | null;
  lastKickerId: string | null;
  pickupCooldown: number;
}

const LICENSED_ROSTERS: Record<string, [number, string][]> = {
  flamengo: [[1, 'Rossi'], [2, 'Varela'], [3, 'Léo Ortiz'], [4, 'Léo Pereira'], [6, 'Alex Sandro'], [5, 'Pulgar'], [8, 'Gerson'], [14, 'Arrascaeta'], [7, 'Luiz Araújo'], [27, 'Bruno Henrique'], [9, 'Pedro']],
  palmeiras: [[21, 'Weverton'], [2, 'Marcos Rocha'], [15, 'Gustavo Gómez'], [26, 'Murilo'], [22, 'Piquerez'], [5, 'Aníbal Moreno'], [8, 'Richard Ríos'], [23, 'Raphael Veiga'], [41, 'Estêvão'], [17, 'Paulinho'], [9, 'Vitor Roque']],
  corinthians: [[1, 'Hugo Souza'], [2, 'Matheuzinho'], [3, 'André Ramalho'], [5, 'Gustavo Henrique'], [21, 'Matheus Bidu'], [8, 'Raniele'], [19, 'Carrillo'], [10, 'Rodrigo Garro'], [11, 'Romero'], [94, 'Memphis Depay'], [9, 'Yuri Alberto']],
  sao_paulo: [[23, 'Rafael'], [2, 'Igor Vinícius'], [5, 'Arboleda'], [28, 'Alan Franco'], [6, 'Welington'], [29, 'Pablo Maia'], [16, 'Alisson'], [7, 'Lucas Moura'], [10, 'Luciano'], [11, 'Ferreirinha'], [9, 'Calleri']],
  botafogo: [[12, 'John'], [22, 'Vitinho'], [15, 'Bastos'], [34, 'Barboza'], [13, 'Alex Telles'], [17, 'Marlon Freitas'], [26, 'Gregore'], [10, 'Savarino'], [7, 'Luiz Henrique'], [11, 'Júnior Santos'], [99, 'Igor Jesus']],
  atletico_mg: [[22, 'Everson'], [2, 'Lyanco'], [3, 'Battaglia'], [8, 'Junior Alonso'], [13, 'Guilherme Arana'], [23, 'Alan Franco'], [6, 'Gustavo Scarpa'], [10, 'Paulinho'], [9, 'Deyverson'], [11, 'Bernard'], [7, 'Hulk']],
  cruzeiro: [[1, 'Cássio'], [12, 'William'], [43, 'João Marcelo'], [5, 'Zé Ivaldo'], [6, 'Marlon'], [29, 'Lucas Romero'], [16, 'Matheus Henrique'], [10, 'Matheus Pereira'], [11, 'Dudu'], [7, 'Gabriel Veron'], [9, 'Kaio Jorge']],
  internacional: [[1, 'Rochet'], [15, 'Bruno Gomes'], [4, 'Vitão'], [25, 'Mercado'], [6, 'Bernabei'], [5, 'Fernando'], [8, 'Bruno Henrique'], [10, 'Alan Patrick'], [11, 'Wanderson'], [7, 'Wesley'], [19, 'Borré']],
  gremio: [[1, 'Marchesín'], [18, 'João Pedro'], [5, 'Rodrigo Ely'], [4, 'Kannemann'], [6, 'Reinaldo'], [20, 'Villasanti'], [8, 'Dodi'], [10, 'Cristaldo'], [21, 'Pavón'], [7, 'Soteldo'], [22, 'Braithwaite']],
  fluminense: [[1, 'Fábio'], [2, 'Samuel Xavier'], [3, 'Thiago Silva'], [4, 'Ignácio'], [12, 'Marcelo'], [8, 'Martinelli'], [7, 'André'], [10, 'PH Ganso'], [21, 'Jhon Arias'], [11, 'Keno'], [14, 'Cano']],
  vasco: [[1, 'Léo Jardim'], [2, 'Puma Rodríguez'], [4, 'Maicon'], [3, 'Léo'], [6, 'Lucas Piton'], [85, 'Mateus Carvalho'], [25, 'Hugo Moura'], [11, 'Philippe Coutinho'], [10, 'Payet'], [7, 'David'], [99, 'Vegetti']],
  bahia: [[22, 'Marcos Felipe'], [2, 'Gilberto'], [3, 'Gabriel Xavier'], [4, 'Kanu'], [46, 'Luciano Juba'], [19, 'Caio Alexandre'], [8, 'Jean Lucas'], [10, 'Éverton Ribeiro'], [16, 'Thaciano'], [11, 'Biel'], [9, 'Everaldo']],
  fortaleza: [[1, 'João Ricardo'], [2, 'Tinga'], [19, 'Brítez'], [4, 'Titi'], [6, 'Bruno Pacheco'], [17, 'Zé Welison'], [8, 'Hércules'], [18, 'Pochettino'], [21, 'Moisés'], [11, 'Marinho'], [9, 'Lucero']],
  santos: [[1, 'Gabriel Brazão'], [29, 'JP Chermont'], [4, 'Gil'], [2, 'Jair'], [31, 'Escobar'], [5, 'João Schmidt'], [8, 'Diego Pituca'], [10, 'Neymar Jr.'], [11, 'Guilherme'], [7, 'Otero'], [9, 'Wendel Silva']],
  figueirense: [[1, 'Ruan Carneiro'], [2, 'Cedric'], [3, 'Genilson'], [4, 'Thomás Kayck'], [6, 'Samuel'], [5, 'Léo Baiano'], [8, 'Gledson'], [10, 'Camilo'], [7, 'Guilherme Pato'], [11, 'Alisson'], [9, 'Jefinho']],
  remo: [[1, 'Marcelo Rangel'], [2, 'Thalys'], [3, 'Rafael Castro'], [4, 'Ligger'], [6, 'Raimar'], [5, 'Paulinho Curuá'], [8, 'Jaderson'], [10, 'Pavani'], [7, 'Kelvin'], [11, 'Pedro Vitor'], [9, 'Ytalo']],
  paysandu: [[13, 'Matheus Nogueira'], [2, 'Edílson'], [4, 'Wanderson'], [3, 'Lucas Maia'], [6, 'Kevyn'], [5, 'João Vieira'], [8, 'Netinho'], [10, 'Robinho'], [11, 'Esli García'], [7, 'Jean Dias'], [9, 'Nicolas']],
  santa_cruz: [[1, 'André Luiz'], [2, 'Toty'], [3, 'Ítalo Melo'], [4, 'Rafael Pereira'], [6, 'Juan Tavares'], [5, 'Lucas Siqueira'], [8, 'Caio Mello'], [10, 'Matheus Melo'], [7, 'Thiaguinho'], [11, 'João Diogo'], [9, 'Pedro Bortoluzo']],
  nautico: [[1, 'Vágner'], [2, 'Arnaldo'], [3, 'Guilherme Matos'], [4, 'Islan'], [6, 'Luiz Paulo'], [5, 'Sousa'], [8, 'Marco Antônio'], [10, 'Patrick Allan'], [7, 'Gustavo Maia'], [11, 'Bruno Mezenga'], [9, 'Paulo Sérgio']],
  parana_clube: [[1, 'Sidão'], [2, 'Igor Bosel'], [3, 'Lucão'], [4, 'Félix Jorge'], [6, 'Eltinho'], [5, 'Borech'], [8, 'Alex Nemetz'], [10, 'Jonathan'], [7, 'Ueslei Brito'], [11, 'Liliu'], [9, 'Cristiano']],
  sport_recife: [[22, 'Caíque França'], [2, 'Igor Cariús'], [15, 'Rafael Thyere'], [40, 'Chico'], [16, 'Felipinho'], [59, 'Fabricio Domínguez'], [8, 'Felipe'], [10, 'Lucas Lima'], [7, 'Chrystian Barletta'], [11, 'Romarinho'], [9, 'Zé Roberto']],
  coritiba: [[1, 'Pedro Morisco'], [2, 'Natanael'], [3, 'Maurício Antônio'], [4, 'Marcelo Benevenuto'], [6, 'Rodrigo Gelado'], [5, 'Sebastián Gómez'], [8, 'Vini Paulista'], [10, 'Matheus Frizzo'], [7, 'Lucas Ronier'], [11, 'Robson'], [9, 'Júnior Brumado']],
  ceara: [[1, 'Richard'], [2, 'Raí Ramos'], [3, 'Matheus Felipe'], [4, 'David Ricardo'], [6, 'Matheus Bahia'], [5, 'De Lucca'], [8, 'Lourenço'], [10, 'Lucas Mugni'], [7, 'Erick Pulga'], [11, 'Saulo Mineiro'], [9, 'Aylon']],
  real_madrid: [[1, 'Courtois'], [2, 'Carvajal'], [3, 'Éder Militão'], [22, 'Rüdiger'], [23, 'Mendy'], [14, 'Tchouaméni'], [8, 'Valverde'], [5, 'Bellingham'], [11, 'Rodrygo'], [7, 'Vini Jr.'], [9, 'Mbappé']],
  barcelona: [[1, 'Ter Stegen'], [23, 'Koundé'], [2, 'Cubarsí'], [5, 'Iñigo Martínez'], [3, 'Balde'], [17, 'Casadó'], [8, 'Pedri'], [20, 'Dani Olmo'], [19, 'Lamine Yamal'], [11, 'Raphinha'], [9, 'Lewandowski']],
  man_city: [[31, 'Ederson'], [2, 'Walker'], [3, 'Rúben Dias'], [25, 'Akanji'], [24, 'Gvardiol'], [16, 'Rodri'], [17, 'De Bruyne'], [20, 'Bernardo Silva'], [47, 'Phil Foden'], [26, 'Savinho'], [9, 'Haaland']]
};

const POS_ORDER: PitchPlayer['position'][] = ['GK', 'RB', 'CB1', 'CB2', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST'];

// Famous player roster lookup by club for authentic names and shirt numbers
export function getClub2DRoster(
  club: Club
): { number: number; name: string; pos: PitchPlayer['position'] }[] {
  const custom = LICENSED_ROSTERS[club.id];
  if (custom && custom.length === 11) {
    return custom.map(([number, name], idx) => ({
      number,
      name,
      pos: POS_ORDER[idx]
    }));
  }

  // Deterministic licensed-style player names for all other clubs (no generic "Lateral Dir.")
  const brNames = [
    ['M. Alves', 'C. Eduardo', 'B. Silva', 'R. Santos', 'L. Moura', 'W. Rocha', 'G. Teixeira', 'M. Paraíba', 'D. Oliveira', 'R. Marques', 'A. Grafite'],
    ['T. Braga', 'P. Henrique', 'F. Cardoso', 'V. Hugo', 'J. Capixaba', 'Z. Ricardo', 'J. Paulo', 'N. Coelho', 'L. Gamalho', 'M. Bastos', 'E. Gol'],
    ['D. Fernandes', 'L. Matos', 'R. Vaz', 'B. Melo', 'A. Ruschel', 'F. Paulista', 'G. Castilho', 'C. Régis', 'I. Paixão', 'W. Farias', 'K. Brenner']
  ];
  const intlNames = [
    ['J. Pickford', 'K. Trippier', 'M. Guehi', 'L. Dunk', 'L. Shaw', 'D. Rice', 'C. Gallagher', 'J. Maddison', 'J. Bowen', 'A. Gordon', 'O. Watkins'],
    ['U. Simón', 'J. Navas', 'R. Le Normand', 'P. Torres', 'A. Grimaldo', 'M. Zubimendi', 'M. Merino', 'F. Ruiz', 'N. Williams', 'M. Oyarzabal', 'A. Morata']
  ];
  const hash = club.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const pool = club.country === 'Brasil' ? brNames[hash % brNames.length] : intlNames[hash % intlNames.length];
  const nums = [1, 2, 3, 4, 6, 5, 8, 10, 7, 11, 9];

  return POS_ORDER.map((pos, idx) => ({
    number: nums[idx],
    name: pool[idx],
    pos
  }));
}

const HOME_FORMATION_COORDS: Record<PitchPlayer['position'], { x: number; y: number }> = {
  GK: { x: 6, y: 50 },
  RB: { x: 20, y: 80 },
  CB1: { x: 16, y: 60 },
  CB2: { x: 16, y: 40 },
  LB: { x: 20, y: 20 },
  CDM: { x: 31, y: 50 },
  CM: { x: 38, y: 33 },
  CAM: { x: 40, y: 67 },
  RW: { x: 46, y: 78 },
  LW: { x: 46, y: 22 },
  ST: { x: 48, y: 50 }
};

const AWAY_FORMATION_COORDS: Record<PitchPlayer['position'], { x: number; y: number }> = {
  GK: { x: 94, y: 50 },
  RB: { x: 80, y: 20 },
  CB1: { x: 84, y: 40 },
  CB2: { x: 84, y: 60 },
  LB: { x: 80, y: 80 },
  CDM: { x: 69, y: 50 },
  CM: { x: 62, y: 67 },
  CAM: { x: 60, y: 33 },
  RW: { x: 54, y: 22 },
  LW: { x: 54, y: 78 },
  ST: { x: 52, y: 50 }
};

function mapCareerPositionTo2D(pos: Position): PitchPlayer['position'] {
  switch (pos) {
    case 'GOL': return 'GK';
    case 'LD': return 'RB';
    case 'ZAG': return 'CB1';
    case 'LE': return 'LB';
    case 'VOL': return 'CDM';
    case 'MC': return 'CM';
    case 'MEI': return 'CAM';
    case 'PD': return 'RW';
    case 'PE': return 'LW';
    case 'ATA':
    default:
      return 'ST';
  }
}

export const Interactive2DPitch: React.FC<Interactive2DPitchProps> = ({
  homeClub,
  awayClub,
  userTeamSide,
  careerPlayer,
  initialMode = 'play',
  controlAllTeamByDefault,
  customHomeRoster,
  customAwayRoster,
  multiplayerConfig,
  onMatchEvent,
  onFullTime,
  onSkipToEnd
}) => {
  // Control mode: 'play' (interactive) vs 'watch' (AI controls all 22)
  const [matchMode, setMatchMode] = useState<'play' | 'watch'>(initialMode);
  // Team control mode: true = control whole team & switch automatically when passing (default in Main Menu); false = single fixed player
  const [teamControlMode, setTeamControlMode] = useState<boolean>(
    controlAllTeamByDefault !== undefined ? controlAllTeamByDefault : !careerPlayer
  );
  // Autonomous walking system ("sistema em que os jogadores estão andando sozinho")
  const [autoWalkEnabled, setAutoWalkEnabled] = useState<boolean>(true);
  // Movement input preference when in 'play' mode:
  // 'hybrid' = WASD/Arrows OR smooth mouse follow; 'keyboard' = WASD/Arrows + Auto-Walk
  const [movementStyle, setMovementStyle] = useState<'hybrid' | 'keyboard'>('hybrid');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);

  // Display state synchronized from the 60fps engine
  const [minute, setMinute] = useState<number>(0);
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [commentary, setCommentary] = useState<string>(
    'Apito inicial! Use Q para Drible com Girinho, E para Roubar a Bola (3s cooldown), ESPAÇO para Pedir/Trocar, Clique Esq = Chutar e Clique Dir = Passe!'
  );
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [goalBanner, setGoalBanner] = useState<{
    team: 'home' | 'away';
    scorer: string;
    number: number;
    assister?: string;
  } | null>(null);

  const [renderPlayers, setRenderPlayers] = useState<PitchPlayer[]>([]);
  const [renderBall, setRenderBall] = useState<BallState>({
    x: 50,
    y: 50,
    vx: 0,
    vy: 0,
    ownerId: null,
    passTargetId: null,
    isShot: false,
    shooterId: null,
    shooterTeam: null,
    lastPasserId: null,
    lastKickerId: null,
    pickupCooldown: 0
  });
  const [userPlayerId, setUserPlayerId] = useState<string>('');
  const [highlightedTeammateId, setHighlightedTeammateId] = useState<string | null>(null);
  const [mousePitchCoords, setMousePitchCoords] = useState<{ x: number; y: number } | null>(null);
  const [callBallIndicator, setCallBallIndicator] = useState<boolean>(false);
  const [userTackleCooldownSec, setUserTackleCooldownSec] = useState<number>(0);
  const [userDribbleCooldownSec, setUserDribbleCooldownSec] = useState<number>(0);

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
  const [events, setEvents] = useState<Pitch2DEvent[]>([]);

  // Mutable refs for 60fps game loop to avoid closure staleness or React batching lag
  const pitchContainerRef = useRef<HTMLDivElement | null>(null);
  const playersRef = useRef<PitchPlayer[]>([]);
  const ballRef = useRef<BallState>({
    x: 50,
    y: 50,
    vx: 0,
    vy: 0,
    ownerId: null,
    passTargetId: null,
    isShot: false,
    shooterId: null,
    shooterTeam: null,
    lastPasserId: null,
    lastKickerId: null,
    pickupCooldown: 0
  });
  const keysPressedRef = useRef<Record<string, boolean>>({});
  const mouseCoordsRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false
  });
  const lastKeyboardTimeRef = useRef<number>(0);
  const callForBallFramesRef = useRef<number>(0);
  const aiCarrierHoldFramesRef = useRef<number>(0);
  const celebrationFreezeFramesRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const minuteFloatRef = useRef<number>(0);
  const isFullTimeTriggeredRef = useRef<boolean>(false);

  const scoresRef = useRef<{ home: number; away: number }>({ home: 0, away: 0 });
  const statsRef = useRef<Pitch2DStats>({
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
  const eventsRef = useRef<Pitch2DEvent[]>([]);
  const possessionFramesRef = useRef<{ home: number; away: number }>({ home: 1, away: 1 });

  const matchModeRef = useRef<'play' | 'watch'>(matchMode);
  useEffect(() => {
    matchModeRef.current = matchMode;
  }, [matchMode]);

  useEffect(() => {
    setMatchMode(initialMode);
  }, [initialMode]);

  const teamControlModeRef = useRef<boolean>(teamControlMode);
  useEffect(() => {
    teamControlModeRef.current = teamControlMode;
  }, [teamControlMode]);

  const autoWalkRef = useRef<boolean>(autoWalkEnabled);
  useEffect(() => {
    autoWalkRef.current = autoWalkEnabled;
  }, [autoWalkEnabled]);

  const movementStyleRef = useRef<'hybrid' | 'keyboard'>(movementStyle);
  useEffect(() => {
    movementStyleRef.current = movementStyle;
  }, [movementStyle]);

  const isPausedRef = useRef<boolean>(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const speedRef = useRef<number>(speedMultiplier);
  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  const userPlayerIdRef = useRef<string>('');
  useEffect(() => {
    userPlayerIdRef.current = userPlayerId;
  }, [userPlayerId]);

  const [opponentPlayerId, setOpponentPlayerId] = useState<string>('');
  const awayUserPlayerIdRef = useRef<string>('');
  const guestCallForBallFramesRef = useRef<number>(0);
  const guestInputRef = useRef<MultiplayerGuestInput>({
    keys: {},
    mouseX: 50,
    mouseY: 50,
    mouseActive: false,
    teamControlMode: true,
    autoWalkEnabled: true,
    movementStyle: 'hybrid'
  });

  const switchControlledPlayer = useCallback((newPlayerId: string) => {
    userPlayerIdRef.current = newPlayerId;
    setUserPlayerId(newPlayerId);
    playersRef.current.forEach(p => {
      p.isUserPlayer = p.id === newPlayerId;
    });
    if (multiplayerConfig?.enabled && multiplayerConfig.role === 'guest') {
      multiplayerConfig.sendMessage({
        type: 'mp_guest_action',
        action: 'switch_player',
        playerId: newPlayerId
      });
    }
  }, [multiplayerConfig]);

  const switchAwayControlledPlayerOnHost = useCallback((newPlayerId: string) => {
    awayUserPlayerIdRef.current = newPlayerId;
    setOpponentPlayerId(newPlayerId);
  }, []);

  // Build 22 players on mount or club change
  useEffect(() => {
    const hRoster =
      customHomeRoster && customHomeRoster.length === 11
        ? customHomeRoster
        : getClub2DRoster(homeClub);
    const aRoster =
      customAwayRoster && customAwayRoster.length === 11
        ? customAwayRoster
        : getClub2DRoster(awayClub);
    const targetUserPos: PitchPlayer['position'] = careerPlayer
      ? mapCareerPositionTo2D(careerPlayer.primaryPosition)
      : 'CM';

    const builtPlayers: PitchPlayer[] = [];
    let assignedUserId = '';
    let assignedAwayMpId = '';

    hRoster.forEach((p, idx) => {
      const coords = HOME_FORMATION_COORDS[p.pos];
      const isUser = userTeamSide === 'home' && p.pos === targetUserPos && !assignedUserId;
      const pId = `home_${idx}_${p.pos}`;
      if (isUser) assignedUserId = pId;

      const pName = isUser && careerPlayer ? `${careerPlayer.name} ${careerPlayer.lastName}` : p.name;
      const pShort = isUser && careerPlayer ? careerPlayer.shirtName : (p.name.split(' ').pop() || p.name);
      const pNum = isUser && careerPlayer ? careerPlayer.shirtNumber : p.number;

      builtPlayers.push({
        id: pId,
        number: pNum,
        name: pName,
        shortName: pShort,
        position: p.pos,
        team: 'home',
        isUserPlayer: isUser,
        baseX: coords.x,
        baseY: coords.y,
        x: coords.x,
        y: coords.y,
        vx: 0,
        vy: 0,
        dirX: 1,
        dirY: 0,
        speedStat: (isUser && careerPlayer?.attributes?.velocidade) || 76,
        shootStat: (isUser && careerPlayer?.attributes?.finalizacao) || 75,
        passStat: (isUser && careerPlayer?.attributes?.passeCurto) || 75,
        tackleCooldownFrames: 0,
        tackleAnimFrames: 0,
        dribbleCooldownFrames: 0,
        dribbleAnimFrames: 0,
        walkPhase: idx * 0.9,
        wanderAngle: (idx * 1.3) % (Math.PI * 2)
      });
    });

    aRoster.forEach((p, idx) => {
      const coords = AWAY_FORMATION_COORDS[p.pos];
      const isUser = userTeamSide === 'away' && p.pos === targetUserPos && !assignedUserId;
      const pId = `away_${idx}_${p.pos}`;
      if (isUser) assignedUserId = pId;
      if (p.pos === 'CM' && !assignedAwayMpId) assignedAwayMpId = pId;

      const pName = isUser && careerPlayer ? `${careerPlayer.name} ${careerPlayer.lastName}` : p.name;
      const pShort = isUser && careerPlayer ? careerPlayer.shirtName : (p.name.split(' ').pop() || p.name);
      const pNum = isUser && careerPlayer ? careerPlayer.shirtNumber : p.number;

      builtPlayers.push({
        id: pId,
        number: pNum,
        name: pName,
        shortName: pShort,
        position: p.pos,
        team: 'away',
        isUserPlayer: isUser,
        baseX: coords.x,
        baseY: coords.y,
        x: coords.x,
        y: coords.y,
        vx: 0,
        vy: 0,
        dirX: -1,
        dirY: 0,
        speedStat: (isUser && careerPlayer?.attributes?.velocidade) || 76,
        shootStat: (isUser && careerPlayer?.attributes?.finalizacao) || 75,
        passStat: (isUser && careerPlayer?.attributes?.passeCurto) || 75,
        tackleCooldownFrames: 0,
        tackleAnimFrames: 0,
        dribbleCooldownFrames: 0,
        dribbleAnimFrames: 0,
        walkPhase: idx * 0.9,
        wanderAngle: (idx * 1.7) % (Math.PI * 2)
      });
    });

    // Fallback if not assigned
    if (!assignedUserId) {
      const firstUserTeamPlayer = builtPlayers.find(p => p.team === userTeamSide && p.position === 'ST') || builtPlayers[0];
      if (firstUserTeamPlayer) {
        firstUserTeamPlayer.isUserPlayer = true;
        assignedUserId = firstUserTeamPlayer.id;
      }
    }

    if (!assignedAwayMpId) {
      const awaySt = builtPlayers.find(p => p.team === 'away' && p.position === 'ST');
      assignedAwayMpId = awaySt ? awaySt.id : 'away_9_ST';
    }
    awayUserPlayerIdRef.current = assignedAwayMpId;
    if (multiplayerConfig?.enabled) {
      const homeCm = builtPlayers.find(p => p.team === 'home' && p.position === 'CM');
      setOpponentPlayerId(
        multiplayerConfig.role === 'host'
          ? assignedAwayMpId
          : homeCm?.id || 'home_4_CM'
      );
    }

    const kickoffSide = multiplayerConfig?.enabled ? 'home' : userTeamSide;
    const starterMid =
      (teamControlModeRef.current && !multiplayerConfig?.enabled
        ? builtPlayers.find(p => p.id === assignedUserId)
        : builtPlayers.find(p => p.team === kickoffSide && p.position === 'CM')) ||
      builtPlayers.find(p => p.team === kickoffSide && p.position === 'ST') ||
      builtPlayers[0];

    if (teamControlModeRef.current && starterMid && starterMid.team === userTeamSide) {
      builtPlayers.forEach(p => {
        p.isUserPlayer = p.id === starterMid.id;
      });
      assignedUserId = starterMid.id;
    }

    playersRef.current = builtPlayers;
    userPlayerIdRef.current = assignedUserId;
    setUserPlayerId(assignedUserId);

    const initialBall: BallState = {
      x: starterMid ? starterMid.x + (starterMid.team === 'home' ? 1.85 : -1.85) : 50,
      y: starterMid ? starterMid.y : 50,
      vx: 0,
      vy: 0,
      ownerId: starterMid ? starterMid.id : null,
      passTargetId: null,
      isShot: false,
      shooterId: null,
      shooterTeam: null,
      lastPasserId: null,
      lastKickerId: null,
      pickupCooldown: 0
    };

    ballRef.current = initialBall;
    setRenderPlayers([...builtPlayers]);
    setRenderBall({ ...initialBall });
    minuteFloatRef.current = 0;
    isFullTimeTriggeredRef.current = false;
  }, [homeClub.id, awayClub.id, userTeamSide, careerPlayer, customHomeRoster, customAwayRoster, multiplayerConfig?.enabled, multiplayerConfig?.role]);

  // Show temporary HUD banner
  const showQuickBanner = useCallback((msg: string) => {
    setActionBanner(msg);
    setTimeout(() => {
      setActionBanner(prev => (prev === msg ? null : prev));
    }, 1600);
  }, []);

  // Helper: Find best teammate to pass towards target (tx, ty)
  const findBestTeammateForPass = useCallback(
    (passer: PitchPlayer, targetX: number, targetY: number): PitchPlayer | null => {
      const teammates = playersRef.current.filter(
        p => p.team === passer.team && p.id !== passer.id
      );
      if (teammates.length === 0) return null;

      const aimDx = targetX - passer.x;
      const aimDy = targetY - passer.y;
      const aimLen = Math.hypot(aimDx, aimDy) || 1;
      const aimDirX = aimDx / aimLen;
      const aimDirY = aimDy / aimLen;

      let bestPlayer: PitchPlayer | null = null;
      let bestScore = Infinity;

      for (const mate of teammates) {
        const distToClick = Math.hypot(mate.x - targetX, mate.y - targetY);
        const mateDx = mate.x - passer.x;
        const mateDy = mate.y - passer.y;
        const mateDist = Math.hypot(mateDx, mateDy) || 1;
        const dot = (mateDx / mateDist) * aimDirX + (mateDy / mateDist) * aimDirY;

        // Combine proximity to click point with directional alignment
        const anglePenalty = (1 - dot) * 28;
        const score = distToClick + anglePenalty;
        if (score < bestScore) {
          bestScore = score;
          bestPlayer = mate;
        }
      }

      return bestPlayer;
    },
    []
  );

  // Execute SPACE (Call for ball / Switch defender) for either local user or Guest on Host
  const executeCallForBallForActor = useCallback(
    (isGuestOnHost: boolean) => {
      if (isFullTimeTriggeredRef.current) return;
      const actorSide: 'home' | 'away' = isGuestOnHost ? 'away' : userTeamSide;
      const actorPlayerId = isGuestOnHost ? awayUserPlayerIdRef.current : userPlayerIdRef.current;
      const isTeamControl = isGuestOnHost
        ? guestInputRef.current.teamControlMode
        : teamControlModeRef.current;

      const uPlayer = playersRef.current.find(p => p.id === actorPlayerId);
      if (!uPlayer) return;

      const ball = ballRef.current;
      const currentOwner = ball.ownerId
        ? playersRef.current.find(p => p.id === ball.ownerId)
        : null;

      if (isTeamControl && (!currentOwner || currentOwner.team !== uPlayer.team)) {
        const myTeamField = playersRef.current.filter(
          p => p.team === actorSide && p.position !== 'GK'
        );
        let closestMate: PitchPlayer | null = null;
        let bestDist = Infinity;
        for (const m of myTeamField) {
          const d = Math.hypot(m.x - ball.x, m.y - ball.y);
          if (d < bestDist) {
            bestDist = d;
            closestMate = m;
          }
        }
        if (closestMate && closestMate.id !== uPlayer.id) {
          if (isGuestOnHost) {
            switchAwayControlledPlayerOnHost(closestMate.id);
          } else {
            switchControlledPlayer(closestMate.id);
            soundFx.playClick();
            showQuickBanner(
              `🔄 Controlando #${closestMate.number} ${closestMate.shortName} (Pressione E para roubar)!`
            );
          }
          return;
        }
      }

      if (ball.ownerId === uPlayer.id) {
        if (!isGuestOnHost) {
          showQuickBanner('⚽ A bola já está dominada no seu pé!');
        }
        return;
      }

      if (isGuestOnHost) {
        guestCallForBallFramesRef.current = 210;
      } else {
        setCallBallIndicator(true);
        setTimeout(() => setCallBallIndicator(false), 1400);
        callForBallFramesRef.current = 210;
      }

      if (currentOwner && currentOwner.team === uPlayer.team && currentOwner.id !== uPlayer.id) {
        const dx = uPlayer.x - currentOwner.x;
        const dy = uPlayer.y - currentOwner.y;
        const dist = Math.hypot(dx, dy) || 1;
        const passSpeed = Math.min(1.55, Math.max(1.05, dist * 0.045));

        currentOwner.dirX = dx / dist;
        currentOwner.dirY = dy / dist;

        ball.ownerId = null;
        ball.passTargetId = uPlayer.id;
        ball.isShot = false;
        ball.shooterId = null;
        ball.shooterTeam = null;
        ball.lastPasserId = currentOwner.id;
        ball.lastKickerId = currentOwner.id;
        ball.pickupCooldown = 14;
        ball.vx = (dx / dist) * passSpeed;
        ball.vy = (dy / dist) * passSpeed;

        soundFx.playKick();
        if (!isGuestOnHost) {
          showQuickBanner(`✋ ${uPlayer.shortName} pediu a bola! Passe de ${currentOwner.shortName}!`);
        }
        setCommentary(
          `${Math.floor(minuteFloatRef.current)}' 🗣️ ${uPlayer.shortName} pediu a bola no ESPAÇO e ${currentOwner.shortName} (#${currentOwner.number}) tocou na medida!`
        );
      } else if (!isGuestOnHost) {
        showQuickBanner(`✋ ${uPlayer.shortName} pediu a bola! Use E perto do adversário para roubar!`);
        setCommentary(
          `${Math.floor(minuteFloatRef.current)}' ✋ ${uPlayer.shortName} pede a bola! Assim que a equipe recuperar a posse, o passe vai direto no seu pé!`
        );
      }
    },
    [showQuickBanner, switchAwayControlledPlayerOnHost, switchControlledPlayer, userTeamSide]
  );

  // USER ACTION 1: SPACEBAR -> PEDIR BOLA / TROCAR DEFENSOR MAIS PRÓXIMO
  const handleCallForBall = useCallback(() => {
    if (isFullTimeTriggeredRef.current) return;
    if (multiplayerConfig?.enabled && multiplayerConfig.role === 'guest') {
      multiplayerConfig.sendMessage({
        type: 'mp_guest_action',
        action: 'space'
      });
      setCallBallIndicator(true);
      setTimeout(() => setCallBallIndicator(false), 1200);
      return;
    }
    executeCallForBallForActor(false);
  }, [executeCallForBallForActor, multiplayerConfig]);

  // Execute TACKLE ('E') for either local user or Guest on Host
  const executeTackleForActor = useCallback(
    (isGuestOnHost: boolean) => {
      if (isFullTimeTriggeredRef.current || matchModeRef.current !== 'play') return;
      const actorPlayerId = isGuestOnHost ? awayUserPlayerIdRef.current : userPlayerIdRef.current;
      const uPlayer = playersRef.current.find(p => p.id === actorPlayerId);
      if (!uPlayer) return;

      const ball = ballRef.current;
      if (ball.ownerId === uPlayer.id) {
        if (!isGuestOnHost) {
          showQuickBanner('⚽ Você já está com a bola! Use Q para Drible com Girinho!');
        }
        return;
      }

      if (uPlayer.tackleCooldownFrames > 0) {
        if (!isGuestOnHost) {
          const remSec = (uPlayer.tackleCooldownFrames / 60).toFixed(1);
          showQuickBanner(`⏳ Cooldown de Roubar Bola (E): aguarde ${remSec}s!`);
        }
        return;
      }

      uPlayer.tackleCooldownFrames = 180;
      uPlayer.tackleAnimFrames = 20;

      const dxToBall = ball.x - uPlayer.x;
      const dyToBall = ball.y - uPlayer.y;
      const distToBall = Math.hypot(dxToBall, dyToBall) || 1;
      uPlayer.dirX = dxToBall / distToBall;
      uPlayer.dirY = dyToBall / distToBall;
      uPlayer.x = Math.max(3.5, Math.min(96.5, uPlayer.x + uPlayer.dirX * 1.75));
      uPlayer.y = Math.max(6, Math.min(94, uPlayer.y + uPlayer.dirY * 1.75));

      const newDist = Math.hypot(ball.x - uPlayer.x, ball.y - uPlayer.y);
      const currentOwner = ball.ownerId
        ? playersRef.current.find(p => p.id === ball.ownerId)
        : null;

      if (newDist <= 4.3 && (!currentOwner || currentOwner.team !== uPlayer.team)) {
        if (currentOwner && currentOwner.dribbleAnimFrames > 0) {
          soundFx.playClick();
          if (!isGuestOnHost) {
            showQuickBanner(`💨 ${currentOwner.shortName} escapou no giro! Cooldown de 3s ativado.`);
          }
          setCommentary(
            `${Math.floor(minuteFloatRef.current)}' 💨 ${currentOwner.shortName} girou bonito (Q) e escapou do bote de ${uPlayer.shortName}!`
          );
          return;
        }

        if (currentOwner) {
          currentOwner.tackleCooldownFrames = 180;
        }
        ball.ownerId = uPlayer.id;
        ball.passTargetId = null;
        ball.isShot = false;
        ball.shooterId = null;
        ball.shooterTeam = null;
        ball.lastKickerId = uPlayer.id;
        ball.pickupCooldown = 24;
        aiCarrierHoldFramesRef.current = 0;

        soundFx.playDeflection();
        if (!isGuestOnHost) {
          showQuickBanner(`🛡️ BOLA ROUBADA POR ${uPlayer.shortName.toUpperCase()}!`);
        }
        setCommentary(
          `${Math.floor(minuteFloatRef.current)}' 🛡️ DESARME PERFEITO! ${uPlayer.shortName} (#${uPlayer.number}) aperta E e rouba a bola limpa!`
        );
      } else if (!isGuestOnHost) {
        soundFx.playClick();
        showQuickBanner(`🛡️ Bote no vazio! Cooldown de 3.0s para tentar roubar novamente.`);
      }
    },
    [showQuickBanner]
  );

  // USER ACTION 2: KEY 'E' -> ROUBAR A BOLA (COM COOLDOWN DE 3 SEGUNDOS = 180 FRAMES)
  const handleUserTackle = useCallback(() => {
    if (isFullTimeTriggeredRef.current || matchModeRef.current !== 'play') return;
    if (multiplayerConfig?.enabled && multiplayerConfig.role === 'guest') {
      multiplayerConfig.sendMessage({
        type: 'mp_guest_action',
        action: 'tackle'
      });
      return;
    }
    executeTackleForActor(false);
  }, [executeTackleForActor, multiplayerConfig]);

  // Execute DRIBBLE ('Q') for either local user or Guest on Host
  const executeDribbleForActor = useCallback(
    (isGuestOnHost: boolean) => {
      if (isFullTimeTriggeredRef.current || matchModeRef.current !== 'play') return;
      const actorPlayerId = isGuestOnHost ? awayUserPlayerIdRef.current : userPlayerIdRef.current;
      const uPlayer = playersRef.current.find(p => p.id === actorPlayerId);
      if (!uPlayer) return;

      if (uPlayer.dribbleCooldownFrames > 0) {
        if (!isGuestOnHost) {
          const remSec = (uPlayer.dribbleCooldownFrames / 60).toFixed(1);
          showQuickBanner(`⏳ Drible (Q) em recarga: ${remSec}s!`);
        }
        return;
      }

      const ball = ballRef.current;
      const hasBall = ball.ownerId === uPlayer.id;

      uPlayer.dribbleAnimFrames = 26;
      uPlayer.dribbleCooldownFrames = 110;

      const stepDist = hasBall ? 3.3 : 2.5;
      uPlayer.x = Math.max(4, Math.min(96, uPlayer.x + uPlayer.dirX * stepDist));
      uPlayer.y = Math.max(7, Math.min(93, uPlayer.y + uPlayer.dirY * stepDist));

      if (hasBall) {
        ball.x = Math.max(2.2, Math.min(97.8, uPlayer.x + uPlayer.dirX * 1.85));
        ball.y = Math.max(4.5, Math.min(95.5, uPlayer.y + uPlayer.dirY * 1.85));
        ball.pickupCooldown = 20;
      }

      soundFx.playKick();
      if (!isGuestOnHost) {
        showQuickBanner(`🌀 DRIBLE GIRINHO DE ${uPlayer.shortName.toUpperCase()}!`);
      }
      setCommentary(
        `${Math.floor(minuteFloatRef.current)}' 🌀 QUE GIRO! ${uPlayer.shortName} (#${uPlayer.number}) dá o passinho com girinho (Q) e deixa a marcação na saudade!`
      );
    },
    [showQuickBanner]
  );

  // USER ACTION 3: KEY 'Q' -> DRIBLE COM GIRINHO + PASSINHO PARA FRENTE
  const handleUserDribble = useCallback(() => {
    if (isFullTimeTriggeredRef.current || matchModeRef.current !== 'play') return;
    if (multiplayerConfig?.enabled && multiplayerConfig.role === 'guest') {
      multiplayerConfig.sendMessage({
        type: 'mp_guest_action',
        action: 'dribble'
      });
      return;
    }
    executeDribbleForActor(false);
  }, [executeDribbleForActor, multiplayerConfig]);

  // Execute SHOOT (Left Click) for either local user or Guest on Host
  const executeShootForActor = useCallback(
    (isGuestOnHost: boolean, targetPitchX?: number, targetPitchY?: number) => {
      if (isFullTimeTriggeredRef.current) return;
      const actorPlayerId = isGuestOnHost ? awayUserPlayerIdRef.current : userPlayerIdRef.current;
      const uPlayer = playersRef.current.find(p => p.id === actorPlayerId);
      if (!uPlayer) return;

      const ball = ballRef.current;
      const distToBall = Math.hypot(ball.x - uPlayer.x, ball.y - uPlayer.y);
      const userHasBall =
        ball.ownerId === uPlayer.id || (ball.ownerId === null && distToBall <= 4.2);

      if (!userHasBall) {
        if (!isGuestOnHost) {
          showQuickBanner('⚡ Domine a bola (ou aperte E para roubar / ESPAÇO para pedir) antes de chutar!');
        }
        return;
      }

      const attackingRight = uPlayer.team === 'home';
      const goalX = attackingRight ? 98.2 : 1.8;

      let aimY = 50;
      if (typeof targetPitchY === 'number') {
        const clampedClickY = Math.max(36, Math.min(64, targetPitchY));
        aimY = 50 + (clampedClickY - 50) * 0.65;
      } else {
        aimY = 45 + Math.random() * 10;
      }

      const dx = goalX - uPlayer.x;
      const dy = aimY - uPlayer.y;
      const dist = Math.hypot(dx, dy) || 1;
      const shotSpeed = 1.65 + (uPlayer.shootStat / 99) * 0.35;

      uPlayer.dirX = dx / dist;
      uPlayer.dirY = dy / dist;

      ball.x = uPlayer.x + uPlayer.dirX * 2.0;
      ball.y = uPlayer.y + uPlayer.dirY * 2.0;
      ball.vx = (dx / dist) * shotSpeed;
      ball.vy = (dy / dist) * shotSpeed;
      ball.ownerId = null;
      ball.passTargetId = null;
      ball.isShot = true;
      ball.shooterId = uPlayer.id;
      ball.shooterTeam = uPlayer.team;
      ball.lastKickerId = uPlayer.id;
      ball.pickupCooldown = 20;

      if (uPlayer.team === 'home') {
        statsRef.current.homeShots += 1;
      } else {
        statsRef.current.awayShots += 1;
      }
      if (!isGuestOnHost) {
        statsRef.current.userShots += 1;
      }
      setStats({ ...statsRef.current });

      soundFx.playKick();
      if (!isGuestOnHost) {
        showQuickBanner(`🚀 CHUTE DE ${uPlayer.shortName.toUpperCase()}!`);
      }
      setCommentary(
        `${Math.floor(minuteFloatRef.current)}' 🚀 BOMBA! ${uPlayer.shortName} (#${uPlayer.number}) enche o pé em direção ao gol!`
      );
    },
    [showQuickBanner]
  );

  // USER ACTION 4: LEFT CLICK -> CHUTAR ("Botão esquerdo do mouse para chutar")
  const handleUserShoot = useCallback(
    (targetPitchX?: number, targetPitchY?: number) => {
      if (isFullTimeTriggeredRef.current) return;
      if (multiplayerConfig?.enabled && multiplayerConfig.role === 'guest') {
        multiplayerConfig.sendMessage({
          type: 'mp_guest_action',
          action: 'shoot',
          targetX: targetPitchX,
          targetY: targetPitchY
        });
        return;
      }
      executeShootForActor(false, targetPitchX, targetPitchY);
    },
    [executeShootForActor, multiplayerConfig]
  );

  // Execute PASS (Right Click) for either local user or Guest on Host
  const executePassForActor = useCallback(
    (isGuestOnHost: boolean, targetPitchX?: number, targetPitchY?: number) => {
      if (isFullTimeTriggeredRef.current) return;
      const actorPlayerId = isGuestOnHost ? awayUserPlayerIdRef.current : userPlayerIdRef.current;
      const isTeamControl = isGuestOnHost
        ? guestInputRef.current.teamControlMode
        : teamControlModeRef.current;

      const uPlayer = playersRef.current.find(p => p.id === actorPlayerId);
      if (!uPlayer) return;

      const ball = ballRef.current;
      const distToBall = Math.hypot(ball.x - uPlayer.x, ball.y - uPlayer.y);
      const userHasBall =
        ball.ownerId === uPlayer.id || (ball.ownerId === null && distToBall <= 4.2);

      if (!userHasBall) {
        if (!isGuestOnHost) {
          showQuickBanner('⚡ Você precisa estar com a bola para passar (use E para roubar ou ESPAÇO)!');
        }
        return;
      }

      const aimX =
        typeof targetPitchX === 'number'
          ? targetPitchX
          : uPlayer.x + (uPlayer.team === 'home' ? 18 : -18);
      const aimY = typeof targetPitchY === 'number' ? targetPitchY : uPlayer.y;

      const receiver = findBestTeammateForPass(uPlayer, aimX, aimY);
      if (!receiver) return;

      const dx = receiver.x - uPlayer.x;
      const dy = receiver.y - uPlayer.y;
      const dist = Math.hypot(dx, dy) || 1;
      const passSpeed = Math.min(1.55, Math.max(1.08, dist * 0.046));

      uPlayer.dirX = dx / dist;
      uPlayer.dirY = dy / dist;

      ball.x = uPlayer.x + uPlayer.dirX * 2.0;
      ball.y = uPlayer.y + uPlayer.dirY * 2.0;
      ball.vx = (dx / dist) * passSpeed;
      ball.vy = (dy / dist) * passSpeed;
      ball.ownerId = null;
      ball.passTargetId = receiver.id;
      ball.isShot = false;
      ball.shooterId = null;
      ball.shooterTeam = null;
      ball.lastPasserId = uPlayer.id;
      ball.lastKickerId = uPlayer.id;
      ball.pickupCooldown = 14;

      if (!isGuestOnHost) {
        statsRef.current.userPassesCompleted += 1;
        setStats({ ...statsRef.current });
      }

      if (isTeamControl && receiver.position !== 'GK') {
        if (isGuestOnHost) {
          switchAwayControlledPlayerOnHost(receiver.id);
        } else {
          switchControlledPlayer(receiver.id);
        }
      }

      soundFx.playKick();
      if (!isGuestOnHost) {
        showQuickBanner(
          isTeamControl
            ? `🎯 Passe! Agora controlando #${receiver.number} ${receiver.shortName}!`
            : `🎯 Passe para ${receiver.shortName} (#${receiver.number})!`
        );
      }
      setCommentary(
        `${Math.floor(minuteFloatRef.current)}' 🎯 Passe certinho de ${uPlayer.shortName} para ${receiver.shortName} (#${receiver.number})!`
      );
    },
    [findBestTeammateForPass, showQuickBanner, switchAwayControlledPlayerOnHost, switchControlledPlayer]
  );

  // USER ACTION 5: RIGHT CLICK -> FAZER UM PASSE ("Quando você passa para um, você já muda e começa a controlar o que você passou")
  const handleUserPass = useCallback(
    (targetPitchX?: number, targetPitchY?: number) => {
      if (isFullTimeTriggeredRef.current) return;
      if (multiplayerConfig?.enabled && multiplayerConfig.role === 'guest') {
        multiplayerConfig.sendMessage({
          type: 'mp_guest_action',
          action: 'pass',
          targetX: targetPitchX,
          targetY: targetPitchY
        });
        return;
      }
      executePassForActor(false, targetPitchX, targetPitchY);
    },
    [executePassForActor, multiplayerConfig]
  );

  // Keyboard listeners: WASD / Arrow keys + SPACEBAR + E (Roubar Bola) + Q (Drible Girinho)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (matchModeRef.current === 'play') {
          handleCallForBall();
        }
        return;
      }

      const key = e.key.toLowerCase();

      if (key === 'e') {
        e.preventDefault();
        handleUserTackle();
        return;
      }

      if (key === 'q') {
        e.preventDefault();
        handleUserDribble();
        return;
      }

      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
      ) {
        if (key.startsWith('arrow')) {
          e.preventDefault();
        }
        keysPressedRef.current[key] = true;
        lastKeyboardTimeRef.current = performance.now();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressedRef.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleCallForBall, handleUserTackle, handleUserDribble]);

  // Reset positions to center kickoff after a goal
  const resetToKickoff = useCallback((kickoffTeam: 'home' | 'away') => {
    const allPlayers = playersRef.current;
    allPlayers.forEach(p => {
      const coords =
        p.team === 'home'
          ? HOME_FORMATION_COORDS[p.position]
          : AWAY_FORMATION_COORDS[p.position];
      p.x = coords.x;
      p.y = coords.y;
      p.vx = 0;
      p.vy = 0;
      p.dirX = p.team === 'home' ? 1 : -1;
      p.dirY = 0;
      p.tackleAnimFrames = 0;
      p.dribbleAnimFrames = 0;
    });

    const kickoffPlayer =
      allPlayers.find(p => p.team === kickoffTeam && p.position === 'CM') ||
      allPlayers.find(p => p.team === kickoffTeam && p.position === 'ST') ||
      allPlayers[0];

    if (kickoffPlayer) {
      kickoffPlayer.x = 50;
      kickoffPlayer.y = 50;
      if (teamControlModeRef.current && kickoffPlayer.team === userTeamSide) {
        switchControlledPlayer(kickoffPlayer.id);
      }
      if (
        multiplayerConfig?.enabled &&
        multiplayerConfig.role === 'host' &&
        guestInputRef.current.teamControlMode &&
        kickoffPlayer.team === 'away'
      ) {
        switchAwayControlledPlayerOnHost(kickoffPlayer.id);
      }
    }

    ballRef.current = {
      x: 50,
      y: 50,
      vx: 0,
      vy: 0,
      ownerId: kickoffPlayer ? kickoffPlayer.id : null,
      passTargetId: null,
      isShot: false,
      shooterId: null,
      shooterTeam: null,
      lastPasserId: null,
      lastKickerId: null,
      pickupCooldown: 20
    };
  }, [multiplayerConfig?.enabled, multiplayerConfig?.role, switchAwayControlledPlayerOnHost, switchControlledPlayer, userTeamSide]);

  const commentarySyncRef = useRef<string>(commentary);
  useEffect(() => {
    commentarySyncRef.current = commentary;
  }, [commentary]);

  const goalBannerSyncRef = useRef<typeof goalBanner>(goalBanner);
  useEffect(() => {
    goalBannerSyncRef.current = goalBanner;
  }, [goalBanner]);

  // Multiplayer WebSocket Subscription (Host receives Guest inputs/actions; Guest receives authoritative state sync)
  useEffect(() => {
    if (!multiplayerConfig?.enabled) return;

    const unsubscribe = multiplayerConfig.subscribeMessage((msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      if (multiplayerConfig.role === 'host') {
        if (msg.type === 'mp_guest_input' && msg.input) {
          guestInputRef.current = {
            ...guestInputRef.current,
            ...msg.input
          };
        } else if (msg.type === 'mp_guest_action') {
          if (msg.action === 'space') {
            executeCallForBallForActor(true);
          } else if (msg.action === 'tackle') {
            executeTackleForActor(true);
          } else if (msg.action === 'dribble') {
            executeDribbleForActor(true);
          } else if (msg.action === 'shoot') {
            executeShootForActor(true, msg.targetX, msg.targetY);
          } else if (msg.action === 'pass') {
            executePassForActor(true, msg.targetX, msg.targetY);
          } else if (msg.action === 'switch_player' && typeof msg.playerId === 'string') {
            const targetP = playersRef.current.find(
              p => p.id === msg.playerId && p.team === 'away' && p.position !== 'GK'
            );
            if (targetP) {
              switchAwayControlledPlayerOnHost(targetP.id);
            }
          }
        }
      } else if (multiplayerConfig.role === 'guest') {
        if (msg.type === 'mp_state_sync' && msg.state) {
          const st = msg.state;
          if (Array.isArray(st.players)) {
            const pMap = new Map<string, any>();
            st.players.forEach((sp: any) => pMap.set(sp.id, sp));
            playersRef.current.forEach(p => {
              const sp = pMap.get(p.id);
              if (sp) {
                p.x = sp.x;
                p.y = sp.y;
                p.vx = sp.vx;
                p.vy = sp.vy;
                p.dirX = sp.dirX;
                p.dirY = sp.dirY;
                p.walkPhase = sp.walkPhase;
                p.tackleCooldownFrames = sp.tackleCooldownFrames;
                p.tackleAnimFrames = sp.tackleAnimFrames;
                p.dribbleCooldownFrames = sp.dribbleCooldownFrames;
                p.dribbleAnimFrames = sp.dribbleAnimFrames;
                p.isUserPlayer = p.id === st.awayUserPlayerId;
              }
            });
            setRenderPlayers(playersRef.current.map(p => ({ ...p })));
          }

          if (st.ball) {
            ballRef.current = { ...ballRef.current, ...st.ball };
            setRenderBall({ ...ballRef.current });
          }

          if (typeof st.awayUserPlayerId === 'string' && st.awayUserPlayerId !== userPlayerIdRef.current) {
            userPlayerIdRef.current = st.awayUserPlayerId;
            setUserPlayerId(st.awayUserPlayerId);
          }
          if (typeof st.homeUserPlayerId === 'string') {
            setOpponentPlayerId(st.homeUserPlayerId);
          }

          const activeGuestP = playersRef.current.find(p => p.id === userPlayerIdRef.current);
          if (activeGuestP) {
            setUserTackleCooldownSec(Number((activeGuestP.tackleCooldownFrames / 60).toFixed(1)));
            setUserDribbleCooldownSec(Number((activeGuestP.dribbleCooldownFrames / 60).toFixed(1)));
          }

          if (typeof st.minute === 'number') {
            setMinute(st.minute);
          }
          if (typeof st.homeScore === 'number' && typeof st.awayScore === 'number') {
            if (
              st.homeScore !== scoresRef.current.home ||
              st.awayScore !== scoresRef.current.away
            ) {
              soundFx.playCheer();
              soundFx.playWhistle();
            }
            scoresRef.current = { home: st.homeScore, away: st.awayScore };
            setHomeScore(st.homeScore);
            setAwayScore(st.awayScore);
          }
          if (st.stats) {
            statsRef.current = st.stats;
            setStats({ ...st.stats });
          }
          if (typeof st.commentary === 'string') {
            setCommentary(st.commentary);
          }
          setGoalBanner(st.goalBanner || null);
          if (Array.isArray(st.events)) {
            eventsRef.current = st.events;
            setEvents([...st.events]);
          }
          if (typeof st.isPaused === 'boolean') {
            setIsPaused(st.isPaused);
          }
        } else if (msg.type === 'mp_match_finished' && msg.result && !isFullTimeTriggeredRef.current) {
          isFullTimeTriggeredRef.current = true;
          setMinute(90);
          soundFx.playWhistle();
          if (onFullTime) {
            onFullTime(msg.result);
          }
        }
      }
    });

    return unsubscribe;
  }, [
    executeCallForBallForActor,
    executeDribbleForActor,
    executePassForActor,
    executeShootForActor,
    executeTackleForActor,
    multiplayerConfig,
    onFullTime,
    switchAwayControlledPlayerOnHost
  ]);

  // Guest input streaming loop (~30fps) so Jogador 2's WASD + Mouse move in real time on Host
  useEffect(() => {
    if (!multiplayerConfig?.enabled || multiplayerConfig.role !== 'guest') return;
    const interval = setInterval(() => {
      multiplayerConfig.sendMessage({
        type: 'mp_guest_input',
        input: {
          keys: { ...keysPressedRef.current },
          mouseX: mouseCoordsRef.current.x,
          mouseY: mouseCoordsRef.current.y,
          mouseActive: mouseCoordsRef.current.active,
          teamControlMode: teamControlModeRef.current,
          autoWalkEnabled: autoWalkRef.current,
          movementStyle: movementStyleRef.current
        }
      });
    }, 33);
    return () => clearInterval(interval);
  }, [multiplayerConfig]);

  // Main 60 FPS Game Loop (requestAnimationFrame)
  useEffect(() => {
    let animId: number;

    const stepPhysics = () => {
      animId = requestAnimationFrame(stepPhysics);

      // In Multiplayer, Guest renders state streamed from Host
      if (multiplayerConfig?.enabled && multiplayerConfig.role === 'guest') {
        return;
      }

      if (isPausedRef.current || isFullTimeTriggeredRef.current) return;

      const allPlayers = playersRef.current;
      const ball = ballRef.current;
      if (allPlayers.length === 0) return;

      // Celebration pause after goal
      if (celebrationFreezeFramesRef.current > 0) {
        celebrationFreezeFramesRef.current -= 1;
        if (celebrationFreezeFramesRef.current === 0) {
          setGoalBanner(null);
        }
        return;
      }

      const spdMult = speedRef.current;

      // Advance match clock: 90 minutes in ~90 seconds at 1x (60 frames = 1 minute)
      minuteFloatRef.current += (1 / 60) * spdMult;
      const currentIntMin = Math.min(90, Math.floor(minuteFloatRef.current));

      if (minuteFloatRef.current >= 90 && !isFullTimeTriggeredRef.current) {
        isFullTimeTriggeredRef.current = true;
        setMinute(90);
        soundFx.playWhistle();
        setCommentary(
          `90' 🏁 APITO FINAL! Fim de jogo: ${homeClub.name} ${scoresRef.current.home} x ${scoresRef.current.away} ${awayClub.name}!`
        );
        const finalResult = {
          homeScore: scoresRef.current.home,
          awayScore: scoresRef.current.away,
          events: eventsRef.current,
          stats: statsRef.current
        };
        if (multiplayerConfig?.enabled && multiplayerConfig.role === 'host') {
          multiplayerConfig.sendMessage({
            type: 'mp_match_finished',
            result: finalResult
          });
        }
        if (onFullTime) {
          onFullTime(finalResult);
        }
        return;
      }

      if (ball.pickupCooldown > 0) {
        ball.pickupCooldown -= 1;
      }
      if (callForBallFramesRef.current > 0) {
        callForBallFramesRef.current -= 1;
      }
      if (guestCallForBallFramesRef.current > 0) {
        guestCallForBallFramesRef.current -= 1;
      }

      // Tick cooldowns and animations for all 22 players (User + Bots)
      for (const p of allPlayers) {
        if (p.tackleCooldownFrames > 0) p.tackleCooldownFrames -= 1;
        if (p.tackleAnimFrames > 0) p.tackleAnimFrames -= 1;
        if (p.dribbleCooldownFrames > 0) p.dribbleCooldownFrames -= 1;
        if (p.dribbleAnimFrames > 0) p.dribbleAnimFrames -= 1;
      }

      const currentOwner = ball.ownerId
        ? allPlayers.find(p => p.id === ball.ownerId) || null
        : null;

      // In Team Control Mode, if a teammate on user's team has the ball, ensure we control them!
      if (
        matchModeRef.current === 'play' &&
        teamControlModeRef.current &&
        currentOwner &&
        currentOwner.team === userTeamSide &&
        currentOwner.position !== 'GK' &&
        currentOwner.id !== userPlayerIdRef.current
      ) {
        switchControlledPlayer(currentOwner.id);
      }

      // In Multiplayer Host, if an Away teammate has the ball and Guest has Team Control Mode on, switch Guest to them!
      if (
        multiplayerConfig?.enabled &&
        multiplayerConfig.role === 'host' &&
        guestInputRef.current.teamControlMode &&
        currentOwner &&
        currentOwner.team === 'away' &&
        currentOwner.position !== 'GK' &&
        currentOwner.id !== awayUserPlayerIdRef.current
      ) {
        switchAwayControlledPlayerOnHost(currentOwner.id);
      }

      // Track possession percentages
      if (currentOwner) {
        if (currentOwner.team === 'home') possessionFramesRef.current.home += 1;
        else possessionFramesRef.current.away += 1;
      }

      const uPlayer = allPlayers.find(p => p.id === userPlayerIdRef.current) || null;
      const guestUPlayer =
        multiplayerConfig?.enabled && multiplayerConfig.role === 'host'
          ? allPlayers.find(p => p.id === awayUserPlayerIdRef.current) || null
          : null;

      // =========================================================================
      // 1. UPDATE PLAYERS MOVEMENT (AUTONOMOUS WALKING + USER & AI CONTROLS)
      // =========================================================================
      for (const p of allPlayers) {
        const isLocalHumanControlled =
          matchModeRef.current === 'play' && p.id === userPlayerIdRef.current;
        const isGuestHumanControlled =
          Boolean(multiplayerConfig?.enabled && multiplayerConfig.role === 'host') &&
          p.id === awayUserPlayerIdRef.current;

        if (isLocalHumanControlled || isGuestHumanControlled) {
          // -------------------------------------------------------------------
          // HUMAN-CONTROLLED PLAYER (JOGADOR 1 OR JOGADOR 2 IN MULTIPLAYER)
          // -------------------------------------------------------------------
          const keys = isGuestHumanControlled
            ? guestInputRef.current.keys || {}
            : keysPressedRef.current;
          const mCoords = isGuestHumanControlled
            ? {
                x: guestInputRef.current.mouseX,
                y: guestInputRef.current.mouseY,
                active: guestInputRef.current.mouseActive
              }
            : mouseCoordsRef.current;
          const movStyle = isGuestHumanControlled
            ? guestInputRef.current.movementStyle
            : movementStyleRef.current;
          const isAutoWalk = isGuestHumanControlled
            ? guestInputRef.current.autoWalkEnabled
            : autoWalkRef.current;

          let moveX = 0;
          let moveY = 0;

          if (keys['w'] || keys['arrowup']) moveY -= 1;
          if (keys['s'] || keys['arrowdown']) moveY += 1;
          if (keys['a'] || keys['arrowleft']) moveX -= 1;
          if (keys['d'] || keys['arrowright']) moveX += 1;

          const dribbleBoost = p.dribbleAnimFrames > 0 ? 1.32 : 1.0;
          const maxUserSpeed =
            (0.21 + (p.speedStat / 99) * 0.09) * Math.min(1.6, spdMult) * dribbleBoost;

          if (moveX !== 0 || moveY !== 0) {
            const len = Math.hypot(moveX, moveY) || 1;
            p.vx = (moveX / len) * maxUserSpeed;
            p.vy = (moveY / len) * maxUserSpeed;
            p.x = Math.max(3.5, Math.min(96.5, p.x + p.vx));
            p.y = Math.max(6, Math.min(94, p.y + p.vy));
            p.walkPhase += 0.28 * spdMult;

            if (!mCoords.active) {
              p.dirX = moveX / len;
              p.dirY = moveY / len;
            }
          } else if (
            movStyle === 'hybrid' &&
            mCoords.active &&
            (isGuestHumanControlled || performance.now() - lastKeyboardTimeRef.current > 900)
          ) {
            const dx = mCoords.x - p.x;
            const dy = mCoords.y - p.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 2.0) {
              p.vx = (dx / dist) * maxUserSpeed;
              p.vy = (dy / dist) * maxUserSpeed;
              p.x = Math.max(3.5, Math.min(96.5, p.x + p.vx));
              p.y = Math.max(6, Math.min(94, p.y + p.vy));
              p.walkPhase += 0.26 * spdMult;
            } else if (isAutoWalk) {
              const attackDirX = p.team === 'home' ? 1 : -1;
              p.vx = attackDirX * maxUserSpeed * 0.45;
              p.vy = Math.sin(p.walkPhase * 0.5) * 0.04;
              p.x = Math.max(3.5, Math.min(96.5, p.x + p.vx));
              p.y = Math.max(6, Math.min(94, p.y + p.vy));
              p.walkPhase += 0.18 * spdMult;
            } else {
              p.vx = 0;
              p.vy = 0;
            }
          } else if (isAutoWalk) {
            let autoTargetX = p.team === 'home' ? 92 : 8;
            let autoTargetY = 50;

            if (ball.ownerId === p.id) {
              autoTargetX = p.team === 'home' ? 94 : 6;
              autoTargetY = 50 + Math.sin(p.walkPhase * 0.25) * 12;
            } else if (!currentOwner || currentOwner.team !== p.team) {
              autoTargetX = ball.x;
              autoTargetY = ball.y;
            } else {
              const ballShiftX = (ball.x - 50) * 0.45 + (p.team === 'home' ? 10 : -10);
              autoTargetX = Math.max(10, Math.min(90, p.baseX + ballShiftX));
              autoTargetY = Math.max(12, Math.min(88, p.baseY + Math.sin(p.walkPhase * 0.3) * 8));
            }

            const dx = autoTargetX - p.x;
            const dy = autoTargetY - p.y;
            const dist = Math.hypot(dx, dy) || 1;
            const walkSpd = maxUserSpeed * 0.72;
            p.vx = (dx / dist) * walkSpd;
            p.vy = (dy / dist) * walkSpd;
            p.x = Math.max(3.5, Math.min(96.5, p.x + p.vx));
            p.y = Math.max(6, Math.min(94, p.y + p.vy));
            p.dirX = dx / dist;
            p.dirY = dy / dist;
            p.walkPhase += 0.22 * spdMult;
          } else {
            p.vx = 0;
            p.vy = 0;
          }

          if (mCoords.active) {
            const aimDx = mCoords.x - p.x;
            const aimDy = mCoords.y - p.y;
            const aimDist = Math.hypot(aimDx, aimDy);
            if (aimDist > 0.5) {
              p.dirX = aimDx / aimDist;
              p.dirY = aimDy / aimDist;
            }
          }
          continue;
        }

        // ---------------------------------------------------------------------
        // AI-CONTROLLED PLAYERS (Goalkeepers, Teammates, and Opponents)
        // Always walking autonomously with animated stride ("andando sozinho")
        // ---------------------------------------------------------------------
        const botDribbleBoost = p.dribbleAnimFrames > 0 ? 1.3 : 1.0;
        const aiSpeed = 0.165 * Math.min(1.6, spdMult) * botDribbleBoost;
        p.walkPhase += 0.22 * spdMult;
        p.wanderAngle += 0.03;

        if (p.position === 'GK') {
          // Goalkeeper stays on goal line and tracks ball Y within the penalty box
          const gkX = p.team === 'home' ? 5.2 : 94.8;
          const targetGkY = Math.max(43, Math.min(57, 50 + (ball.y - 50) * 0.32));
          const dx = gkX - p.x;
          const dy = targetGkY - p.y;
          p.x += dx * 0.12;
          p.y += dy * 0.15;
          p.dirX = p.team === 'home' ? 1 : -1;
          p.dirY = 0;
          continue;
        }

        // If this AI player currently HAS THE BALL:
        if (ball.ownerId === p.id) {
          const attackGoalX = p.team === 'home' ? 96 : 4;
          const attackGoalY = 50;
          const goalDx = attackGoalX - p.x;
          const goalDy = (attackGoalY - p.y) * 0.35;
          const len = Math.hypot(goalDx, goalDy) || 1;

          p.dirX = goalDx / len;
          p.dirY = goalDy / len;
          p.x = Math.max(5, Math.min(95, p.x + p.dirX * aiSpeed * 0.94));
          p.y = Math.max(8, Math.min(92, p.y + p.dirY * aiSpeed * 0.94));
          continue;
        }

        // If a pass is specifically targeted to this AI player, move to meet the ball
        if (ball.ownerId === null && ball.passTargetId === p.id) {
          const dx = ball.x - p.x;
          const dy = ball.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          p.dirX = dx / dist;
          p.dirY = dy / dist;
          p.x = Math.max(4, Math.min(96, p.x + p.dirX * aiSpeed * 1.15));
          p.y = Math.max(7, Math.min(93, p.y + p.dirY * aiSpeed * 1.15));
          continue;
        }

        // Determine if this AI player is the closest defender/challenger to the ball
        const teammatesField = allPlayers.filter(
          m =>
            m.team === p.team &&
            m.position !== 'GK' &&
            m.id !== userPlayerIdRef.current &&
            !(
              multiplayerConfig?.enabled &&
              multiplayerConfig.role === 'host' &&
              m.id === awayUserPlayerIdRef.current
            )
        );
        let closestToBallId = '';
        let minBallDist = Infinity;
        for (const m of teammatesField) {
          const d = Math.hypot(m.x - ball.x, m.y - ball.y);
          if (d < minBallDist) {
            minBallDist = d;
            closestToBallId = m.id;
          }
        }

        const teamHasBall = currentOwner && currentOwner.team === p.team;

        if (!teamHasBall && p.id === closestToBallId && minBallDist < 30) {
          // Closest defender presses the ball / ball carrier!
          // If this bot is on its 3-second tackle cooldown, it jockeys slightly slower
          const cooldownFactor = p.tackleCooldownFrames > 0 ? 0.72 : 1.0;
          const pressBoost =
            (callForBallFramesRef.current > 0 && uPlayer && p.team === uPlayer.team ? 1.22 : 0.96) *
            cooldownFactor;
          const dx = ball.x - p.x;
          const dy = ball.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          p.dirX = dx / dist;
          p.dirY = dy / dist;
          p.x = Math.max(5, Math.min(95, p.x + p.dirX * aiSpeed * pressBoost));
          p.y = Math.max(8, Math.min(92, p.y + p.dirY * aiSpeed * pressBoost));
        } else {
          // Tactical formation positioning + continuous autonomous walking ("andando sozinho")
          const ballShiftX = (ball.x - 50) * 0.42;
          const ballShiftY = (ball.y - 50) * 0.22;
          const attackPush = teamHasBall ? (p.team === 'home' ? 8 : -8) : 0;
          const wanderX = Math.cos(p.wanderAngle) * 3.2;
          const wanderY = Math.sin(p.wanderAngle * 1.3) * 3.2;

          const targetX = Math.max(8, Math.min(92, p.baseX + ballShiftX + attackPush + wanderX));
          const targetY = Math.max(10, Math.min(90, p.baseY + ballShiftY + wanderY));

          const dx = targetX - p.x;
          const dy = targetY - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          p.dirX = dx / dist;
          p.dirY = dy / dist;
          p.x = Math.max(5, Math.min(95, p.x + p.dirX * aiSpeed * 0.76));
          p.y = Math.max(8, Math.min(92, p.y + p.dirY * aiSpeed * 0.76));
        }
      }

      // =========================================================================
      // 2. AI DECISION ENGINE (DRIBBLE Q, PASS, SHOOT, AND TACKLE E WITH 3S COOLDOWN)
      // =========================================================================
      if (currentOwner) {
        const isUserControlledCarrier =
          (matchModeRef.current === 'play' && currentOwner.id === userPlayerIdRef.current) ||
          (Boolean(multiplayerConfig?.enabled && multiplayerConfig.role === 'host') &&
            currentOwner.id === awayUserPlayerIdRef.current);

        if (!isUserControlledCarrier) {
          aiCarrierHoldFramesRef.current += 1;

          // Rule 0: AI BOTS ALSO USE THE SPIN-DRIBBLE (Q) ("faça que os bots também usem essas mecânicas novas")
          // When an opponent approaches an AI ball carrier and the bot's dribble cooldown is ready:
          if (currentOwner.position !== 'GK' && currentOwner.dribbleCooldownFrames <= 0) {
            const nearbyDef = allPlayers.find(
              op =>
                op.team !== currentOwner.team &&
                op.position !== 'GK' &&
                Math.hypot(op.x - currentOwner.x, op.y - currentOwner.y) <= 3.3
            );
            if (nearbyDef && Math.random() < 0.28) {
              currentOwner.dribbleAnimFrames = 24;
              currentOwner.dribbleCooldownFrames = 140; // ~2.3s cooldown for bot dribble
              const stepDist = 2.8;
              currentOwner.x = Math.max(
                5,
                Math.min(95, currentOwner.x + currentOwner.dirX * stepDist)
              );
              currentOwner.y = Math.max(
                8,
                Math.min(92, currentOwner.y + currentOwner.dirY * stepDist)
              );
              soundFx.playKick();
              setCommentary(
                `${currentIntMin}' 🌀 ${currentOwner.shortName} (#${currentOwner.number}) aplica o drible girinho e passa por ${nearbyDef.shortName}!`
              );
            }
          }

          // Rule A: If a teammate has the ball AND the user pressed SPACE (callForBallFramesRef > 0), pass immediately to user!
          if (
            matchModeRef.current === 'play' &&
            uPlayer &&
            currentOwner.team === uPlayer.team &&
            currentOwner.id !== uPlayer.id &&
            callForBallFramesRef.current > 0 &&
            aiCarrierHoldFramesRef.current >= 8
          ) {
            callForBallFramesRef.current = 0;
            aiCarrierHoldFramesRef.current = 0;
            const dx = uPlayer.x - currentOwner.x;
            const dy = uPlayer.y - currentOwner.y;
            const dist = Math.hypot(dx, dy) || 1;
            const passSpeed = Math.min(1.5, Math.max(1.05, dist * 0.045));

            currentOwner.dirX = dx / dist;
            currentOwner.dirY = dy / dist;

            ball.ownerId = null;
            ball.passTargetId = uPlayer.id;
            ball.isShot = false;
            ball.lastPasserId = currentOwner.id;
            ball.lastKickerId = currentOwner.id;
            ball.pickupCooldown = 14;
            ball.vx = (dx / dist) * passSpeed;
            ball.vy = (dy / dist) * passSpeed;

            soundFx.playKick();
            setCommentary(
              `${currentIntMin}' 🗣️ ${currentOwner.shortName} ouve o seu pedido e toca a bola no pé de ${uPlayer.shortName}!`
            );
          } else if (
            multiplayerConfig?.enabled &&
            multiplayerConfig.role === 'host' &&
            guestUPlayer &&
            currentOwner.team === guestUPlayer.team &&
            currentOwner.id !== guestUPlayer.id &&
            guestCallForBallFramesRef.current > 0 &&
            aiCarrierHoldFramesRef.current >= 8
          ) {
            guestCallForBallFramesRef.current = 0;
            aiCarrierHoldFramesRef.current = 0;
            const dx = guestUPlayer.x - currentOwner.x;
            const dy = guestUPlayer.y - currentOwner.y;
            const dist = Math.hypot(dx, dy) || 1;
            const passSpeed = Math.min(1.5, Math.max(1.05, dist * 0.045));

            currentOwner.dirX = dx / dist;
            currentOwner.dirY = dy / dist;

            ball.ownerId = null;
            ball.passTargetId = guestUPlayer.id;
            ball.isShot = false;
            ball.lastPasserId = currentOwner.id;
            ball.lastKickerId = currentOwner.id;
            ball.pickupCooldown = 14;
            ball.vx = (dx / dist) * passSpeed;
            ball.vy = (dy / dist) * passSpeed;

            soundFx.playKick();
            setCommentary(
              `${currentIntMin}' 🗣️ ${currentOwner.shortName} toca a bola no pé de ${guestUPlayer.shortName}!`
            );
          } else if (aiCarrierHoldFramesRef.current >= 42) {
            // AI decides whether to pass or shoot after holding the ball for ~0.7s
            aiCarrierHoldFramesRef.current = 0;
            const isHome = currentOwner.team === 'home';
            const inShootingZone = isHome ? currentOwner.x >= 79 : currentOwner.x <= 21;

            if (inShootingZone && currentOwner.position !== 'GK' && Math.random() < 0.48) {
              // AI SHOOTS AT GOAL
              const goalX = isHome ? 98.2 : 1.8;
              const goalY = 44 + Math.random() * 12;
              const dx = goalX - currentOwner.x;
              const dy = goalY - currentOwner.y;
              const dist = Math.hypot(dx, dy) || 1;
              const shotSpeed = 1.55;

              currentOwner.dirX = dx / dist;
              currentOwner.dirY = dy / dist;

              ball.ownerId = null;
              ball.passTargetId = null;
              ball.isShot = true;
              ball.shooterId = currentOwner.id;
              ball.shooterTeam = currentOwner.team;
              ball.lastKickerId = currentOwner.id;
              ball.pickupCooldown = 20;
              ball.vx = (dx / dist) * shotSpeed;
              ball.vy = (dy / dist) * shotSpeed;

              if (isHome) statsRef.current.homeShots += 1;
              else statsRef.current.awayShots += 1;
              setStats({ ...statsRef.current });

              soundFx.playKick();
              setCommentary(
                `${currentIntMin}' 👟 Finalização perigosa de ${currentOwner.shortName} (#${currentOwner.number})!`
              );
            } else {
              // AI PASSES TO A FORWARD/OPEN TEAMMATE
              const mates = allPlayers.filter(
                m => m.team === currentOwner.team && m.id !== currentOwner.id && m.position !== 'GK'
              );
              const forwardMates = mates.filter(m =>
                isHome ? m.x >= currentOwner.x - 6 : m.x <= currentOwner.x + 6
              );
              const pool = forwardMates.length > 0 ? forwardMates : mates;
              const receiver = pool[Math.floor(Math.random() * pool.length)];

              if (receiver) {
                const dx = receiver.x - currentOwner.x;
                const dy = receiver.y - currentOwner.y;
                const dist = Math.hypot(dx, dy) || 1;
                const passSpeed = Math.min(1.42, Math.max(0.95, dist * 0.042));

                currentOwner.dirX = dx / dist;
                currentOwner.dirY = dy / dist;

                ball.ownerId = null;
                ball.passTargetId = receiver.id;
                ball.isShot = false;
                ball.lastPasserId = currentOwner.id;
                ball.lastKickerId = currentOwner.id;
                ball.pickupCooldown = 15;
                ball.vx = (dx / dist) * passSpeed;
                ball.vy = (dy / dist) * passSpeed;

                if (
                  matchModeRef.current === 'play' &&
                  teamControlModeRef.current &&
                  receiver.team === userTeamSide &&
                  receiver.position !== 'GK'
                ) {
                  switchControlledPlayer(receiver.id);
                }
                if (
                  multiplayerConfig?.enabled &&
                  multiplayerConfig.role === 'host' &&
                  guestInputRef.current.teamControlMode &&
                  receiver.team === 'away' &&
                  receiver.position !== 'GK'
                ) {
                  switchAwayControlledPlayerOnHost(receiver.id);
                }

                soundFx.playKick();
                setCommentary(
                  `${currentIntMin}' Passe trabalhado de ${currentOwner.shortName} para ${receiver.shortName} (#${receiver.number}).`
                );
              }
            }
          }
        }

        // AI BOTS TACKLE WITH 3-SECOND COOLDOWN ("Adicione esse cooldown de 3 segundos para os bots também")
        // Note: The user-controlled player tackles manually via Key 'E' (`handleUserTackle`), while AI bots tackle automatically when ready!
        const opponents = allPlayers.filter(
          op =>
            op.team !== currentOwner.team &&
            op.position !== 'GK' &&
            !(matchModeRef.current === 'play' && op.id === userPlayerIdRef.current) &&
            !(
              multiplayerConfig?.enabled &&
              multiplayerConfig.role === 'host' &&
              op.id === awayUserPlayerIdRef.current
            )
        );
        for (const opp of opponents) {
          if (opp.tackleCooldownFrames > 0) continue; // Bot is on 3-second cooldown!

          const d = Math.hypot(opp.x - currentOwner.x, opp.y - currentOwner.y);
          const tackleRange = 2.15;
          if (d <= tackleRange && ball.pickupCooldown <= 0) {
            // Bot attempts to steal the ball -> immediately enters 3-SECOND COOLDOWN (180 frames)!
            opp.tackleCooldownFrames = 180;
            opp.tackleAnimFrames = 20;

            // Lunge step towards carrier
            const lDx = currentOwner.x - opp.x;
            const lDy = currentOwner.y - opp.y;
            const lDist = Math.hypot(lDx, lDy) || 1;
            opp.dirX = lDx / lDist;
            opp.dirY = lDy / lDist;

            // If carrier is spinning with Q dribble, the bot's tackle misses completely!
            if (currentOwner.dribbleAnimFrames > 0) {
              setCommentary(
                `${currentIntMin}' 🌀 OLÉ! ${currentOwner.shortName} escapa no giro e deixa ${opp.shortName} no chão (3s cooldown)!`
              );
              break;
            }

            // Otherwise bot has a realistic chance to steal the ball
            const stealSuccessChance = currentOwner.id === userPlayerIdRef.current ? 0.45 : 0.58;
            if (Math.random() < stealSuccessChance) {
              currentOwner.tackleCooldownFrames = 180; // Dispossessed player also gets 3s cooldown
              ball.ownerId = opp.id;
              ball.passTargetId = null;
              ball.isShot = false;
              ball.lastPasserId = null;
              ball.lastKickerId = opp.id;
              ball.pickupCooldown = 22;
              aiCarrierHoldFramesRef.current = 0;

              if (
                matchModeRef.current === 'play' &&
                teamControlModeRef.current &&
                opp.team === userTeamSide
              ) {
                switchControlledPlayer(opp.id);
              }

              soundFx.playDeflection();
              setCommentary(
                `${currentIntMin}' 🛡️ Desarme de ${opp.shortName} (#${opp.number}) roubando a bola!`
              );
              break;
            }
          }
        }
      }

      // =========================================================================
      // 3. BALL POSITION & TRAJECTORY ("deixe a bola certinha no pé do jogador")
      // =========================================================================
      const updatedOwner = ball.ownerId
        ? allPlayers.find(p => p.id === ball.ownerId) || null
        : null;

      if (updatedOwner) {
        // LOCKED TO PLAYER'S FRONT FOOT! Zero drift, zero random flying!
        const footDist = 1.85;
        ball.x = Math.max(2.2, Math.min(97.8, updatedOwner.x + updatedOwner.dirX * footDist));
        ball.y = Math.max(4.5, Math.min(95.5, updatedOwner.y + updatedOwner.dirY * footDist));
        ball.vx = 0;
        ball.vy = 0;
      } else {
        // Ball is in flight (pass or shot)
        // If it's a pass specifically targeted to the user's player, gently home toward user's foot so calling for the ball feels ultra-reliable
        if (
          ball.passTargetId &&
          ball.passTargetId === userPlayerIdRef.current &&
          uPlayer &&
          !ball.isShot
        ) {
          const dx = uPlayer.x - ball.x;
          const dy = uPlayer.y - ball.y;
          const dist = Math.hypot(dx, dy) || 1;
          const currentSpd = Math.hypot(ball.vx, ball.vy) || 1.15;
          ball.vx = (dx / dist) * currentSpd;
          ball.vy = (dy / dist) * currentSpd;
        }

        ball.x += ball.vx * Math.min(1.5, spdMult);
        ball.y += ball.vy * Math.min(1.5, spdMult);
        ball.vx *= 0.986;
        ball.vy *= 0.986;

        // Check if any player traps/collects the loose ball
        for (const p of allPlayers) {
          if (p.id === ball.lastKickerId && ball.pickupCooldown > 0) continue;

          // If it's a shot, only the defending Goalkeeper (or a defender right in the path) can intercept it
          if (ball.isShot && p.team === ball.shooterTeam) continue;

          const trapRadius = p.id === ball.passTargetId ? 2.6 : p.position === 'GK' ? 3.1 : 1.9;
          const d = Math.hypot(p.x - ball.x, p.y - ball.y);

          if (d <= trapRadius) {
            if (ball.isShot && p.position === 'GK') {
              // GOALKEEPER SAVE!
              // Calibrated so ~80% of shots within keeper reach are saved, ~20% beat the keeper if well-placed
              const shooter = allPlayers.find(s => s.id === ball.shooterId);
              const isUserShot = shooter && shooter.id === userPlayerIdRef.current;
              const saveChance = isUserShot ? 0.65 : 0.84;

              if (Math.random() < saveChance) {
                ball.ownerId = p.id;
                ball.isShot = false;
                ball.passTargetId = null;
                ball.vx = 0;
                ball.vy = 0;
                ball.pickupCooldown = 25;
                aiCarrierHoldFramesRef.current = 15;

                if (p.team === 'away') {
                  statsRef.current.homeShotsOnTarget += 1;
                } else {
                  statsRef.current.awayShotsOnTarget += 1;
                }
                setStats({ ...statsRef.current });

                soundFx.playDeflection();
                const saveEvt: Pitch2DEvent = {
                  minute: currentIntMin,
                  type: 'save',
                  team: p.team,
                  playerNumber: p.number,
                  playerName: p.name,
                  text: `🧤 Grande defesa do goleiro ${p.shortName} (#${p.number})!`
                };
                eventsRef.current = [saveEvt, ...eventsRef.current];
                setEvents([...eventsRef.current]);
                setCommentary(
                  `${currentIntMin}' 🧤 DEFENDEU ${p.shortName.toUpperCase()}! O goleiro segura firme na área!`
                );
                if (onMatchEvent) {
                  onMatchEvent(
                    saveEvt,
                    { homeScore: scoresRef.current.home, awayScore: scoresRef.current.away },
                    statsRef.current
                  );
                }
                break;
              }
            } else if (!ball.isShot) {
              // Normal pass reception or loose ball recovery
              ball.ownerId = p.id;
              ball.passTargetId = null;
              ball.vx = 0;
              ball.vy = 0;
              aiCarrierHoldFramesRef.current = 0;
              break;
            }
          }
        }

        // Check if ball crossed GOAL LINE (x >= 97.8 or x <= 2.2)
        if (ball.ownerId === null) {
          const inGoalMouthY = ball.y >= 42.2 && ball.y <= 57.8;

          if (ball.x >= 97.6) {
            if (inGoalMouthY && ball.isShot) {
              // GOOOOOOOL FOR HOME TEAM!
              scoresRef.current.home += 1;
              setHomeScore(scoresRef.current.home);
              statsRef.current.homeShotsOnTarget += 1;

              const scorer =
                allPlayers.find(p => p.id === ball.shooterId) ||
                allPlayers.find(p => p.team === 'home' && p.position === 'ST') ||
                allPlayers[0];
              const assister =
                ball.lastPasserId && ball.lastPasserId !== scorer.id
                  ? allPlayers.find(p => p.id === ball.lastPasserId && p.team === 'home')
                  : undefined;

              const isUserGoal = scorer.id === userPlayerIdRef.current;
              const isUserAssist = Boolean(assister && assister.id === userPlayerIdRef.current);

              if (isUserGoal) statsRef.current.userGoals += 1;
              if (isUserAssist) statsRef.current.userAssists += 1;
              setStats({ ...statsRef.current });

              soundFx.playCheer();
              soundFx.playWhistle();

              const goalEvt: Pitch2DEvent = {
                minute: currentIntMin,
                type: 'goal',
                team: 'home',
                playerNumber: scorer.number,
                playerName: scorer.name,
                assisterName: assister?.shortName,
                isUserPlayer: isUserGoal,
                isUserAssist,
                text: `⚽ GOL DO ${homeClub.shortName}! ${scorer.name} (#${scorer.number})${
                  assister ? ` (Assistência: ${assister.shortName})` : ''
                }!`
              };
              eventsRef.current = [goalEvt, ...eventsRef.current];
              setEvents([...eventsRef.current]);
              setGoalBanner({
                team: 'home',
                scorer: scorer.name,
                number: scorer.number,
                assister: assister?.shortName
              });
              setCommentary(
                `${currentIntMin}' ⚽ GOOOOOOOL DO ${homeClub.name.toUpperCase()}! ${scorer.name} (#${scorer.number}) manda pro fundo da rede!`
              );

              if (onMatchEvent) {
                onMatchEvent(
                  goalEvt,
                  { homeScore: scoresRef.current.home, awayScore: scoresRef.current.away },
                  statsRef.current
                );
              }

              celebrationFreezeFramesRef.current = 120; // 2 seconds pause
              resetToKickoff('away');
            } else {
              // Goal kick for Away GK
              const awayGk = allPlayers.find(p => p.team === 'away' && p.position === 'GK');
              if (awayGk) {
                ball.ownerId = awayGk.id;
                ball.isShot = false;
                ball.passTargetId = null;
                ball.vx = 0;
                ball.vy = 0;
                aiCarrierHoldFramesRef.current = 10;
              }
            }
          } else if (ball.x <= 2.4) {
            if (inGoalMouthY && ball.isShot) {
              // GOOOOOOOL FOR AWAY TEAM!
              scoresRef.current.away += 1;
              setAwayScore(scoresRef.current.away);
              statsRef.current.awayShotsOnTarget += 1;

              const scorer =
                allPlayers.find(p => p.id === ball.shooterId) ||
                allPlayers.find(p => p.team === 'away' && p.position === 'ST') ||
                allPlayers[11];
              const assister =
                ball.lastPasserId && ball.lastPasserId !== scorer.id
                  ? allPlayers.find(p => p.id === ball.lastPasserId && p.team === 'away')
                  : undefined;

              const isUserGoal = scorer.id === userPlayerIdRef.current;
              const isUserAssist = Boolean(assister && assister.id === userPlayerIdRef.current);

              if (isUserGoal) statsRef.current.userGoals += 1;
              if (isUserAssist) statsRef.current.userAssists += 1;
              setStats({ ...statsRef.current });

              soundFx.playCheer();
              soundFx.playWhistle();

              const goalEvt: Pitch2DEvent = {
                minute: currentIntMin,
                type: 'goal',
                team: 'away',
                playerNumber: scorer.number,
                playerName: scorer.name,
                assisterName: assister?.shortName,
                isUserPlayer: isUserGoal,
                isUserAssist,
                text: `⚽ GOL DO ${awayClub.shortName}! ${scorer.name} (#${scorer.number})${
                  assister ? ` (Assistência: ${assister.shortName})` : ''
                }!`
              };
              eventsRef.current = [goalEvt, ...eventsRef.current];
              setEvents([...eventsRef.current]);
              setGoalBanner({
                team: 'away',
                scorer: scorer.name,
                number: scorer.number,
                assister: assister?.shortName
              });
              setCommentary(
                `${currentIntMin}' ⚽ GOOOOOOOL DO ${awayClub.name.toUpperCase()}! ${scorer.name} (#${scorer.number}) balança as redes!`
              );

              if (onMatchEvent) {
                onMatchEvent(
                  goalEvt,
                  { homeScore: scoresRef.current.home, awayScore: scoresRef.current.away },
                  statsRef.current
                );
              }

              celebrationFreezeFramesRef.current = 120;
              resetToKickoff('home');
            } else {
              // Goal kick for Home GK
              const homeGk = allPlayers.find(p => p.team === 'home' && p.position === 'GK');
              if (homeGk) {
                ball.ownerId = homeGk.id;
                ball.isShot = false;
                ball.passTargetId = null;
                ball.vx = 0;
                ball.vy = 0;
                aiCarrierHoldFramesRef.current = 10;
              }
            }
          }

          // Keep ball inside top/bottom touchlines (4..96)
          if (ball.y <= 4.2 || ball.y >= 95.8) {
            ball.y = Math.max(4.5, Math.min(95.5, ball.y));
            ball.vy = -ball.vy * 0.6;
          }

          // If loose ball slows to a stop, nearest outfield player picks it up
          if (Math.hypot(ball.vx, ball.vy) < 0.06 && ball.ownerId === null) {
            let nearest: PitchPlayer | null = null;
            let bestD = Infinity;
            for (const p of allPlayers) {
              const d = Math.hypot(p.x - ball.x, p.y - ball.y);
              if (d < bestD) {
                bestD = d;
                nearest = p;
              }
            }
            if (nearest && bestD < 5.5) {
              ball.ownerId = nearest.id;
              ball.isShot = false;
              ball.passTargetId = null;
            }
          }
        }
      }

      // Update React render state every 2 frames (~30fps UI sync, super smooth & zero React lag)
      frameCountRef.current += 1;
      if (frameCountRef.current % 2 === 0) {
        setMinute(currentIntMin);
        setRenderPlayers(allPlayers.map(p => ({ ...p })));
        setRenderBall({ ...ball });

        const activeUserP = allPlayers.find(p => p.id === userPlayerIdRef.current);
        if (activeUserP) {
          setUserTackleCooldownSec(
             Number((activeUserP.tackleCooldownFrames / 60).toFixed(1))
          );
          setUserDribbleCooldownSec(
            Number((activeUserP.dribbleCooldownFrames / 60).toFixed(1))
          );
        }

        const totalPoss =
          possessionFramesRef.current.home + possessionFramesRef.current.away || 1;
        const hPoss = Math.round((possessionFramesRef.current.home / totalPoss) * 100);
        statsRef.current.homePossession = hPoss;
        statsRef.current.awayPossession = 100 - hPoss;

        if (multiplayerConfig?.enabled && multiplayerConfig.role === 'host') {
          multiplayerConfig.sendMessage({
            type: 'mp_state_sync',
            state: {
              players: allPlayers.map(p => ({
                id: p.id,
                x: Number(p.x.toFixed(2)),
                y: Number(p.y.toFixed(2)),
                vx: Number(p.vx.toFixed(3)),
                vy: Number(p.vy.toFixed(3)),
                dirX: Number(p.dirX.toFixed(2)),
                dirY: Number(p.dirY.toFixed(2)),
                walkPhase: Number(p.walkPhase.toFixed(2)),
                tackleCooldownFrames: p.tackleCooldownFrames,
                tackleAnimFrames: p.tackleAnimFrames,
                dribbleCooldownFrames: p.dribbleCooldownFrames,
                dribbleAnimFrames: p.dribbleAnimFrames
              })),
              ball: {
                x: Number(ball.x.toFixed(2)),
                y: Number(ball.y.toFixed(2)),
                vx: Number(ball.vx.toFixed(3)),
                vy: Number(ball.vy.toFixed(3)),
                ownerId: ball.ownerId,
                passTargetId: ball.passTargetId,
                isShot: ball.isShot
              },
              minute: currentIntMin,
              homeScore: scoresRef.current.home,
              awayScore: scoresRef.current.away,
              stats: statsRef.current,
              commentary: commentarySyncRef.current,
              goalBanner: goalBannerSyncRef.current,
              events: eventsRef.current.slice(0, 12),
              homeUserPlayerId: userPlayerIdRef.current,
              awayUserPlayerId: awayUserPlayerIdRef.current,
              isPaused: isPausedRef.current
            }
          });
        }
      }
    };

    animId = requestAnimationFrame(stepPhysics);
    return () => cancelAnimationFrame(animId);
  }, [
    homeClub.name,
    homeClub.shortName,
    awayClub.name,
    awayClub.shortName,
    onFullTime,
    onMatchEvent,
    resetToKickoff,
    switchAwayControlledPlayerOnHost,
    switchControlledPlayer,
    userTeamSide,
    multiplayerConfig
  ]);

  // Convert mouse event on pitch to percentage (0..100)
  const getPitchPercentageFromMouse = (
    e: React.MouseEvent<HTMLDivElement>
  ): { x: number; y: number } => {
    const rect = pitchContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handlePitchMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getPitchPercentageFromMouse(e);
    mouseCoordsRef.current = { x: coords.x, y: coords.y, active: true };
    setMousePitchCoords(coords);

    if (matchModeRef.current === 'play') {
      const uPlayer = playersRef.current.find(p => p.id === userPlayerIdRef.current);
      if (uPlayer) {
        const bestMate = findBestTeammateForPass(uPlayer, coords.x, coords.y);
        setHighlightedTeammateId(bestMate ? bestMate.id : null);
      }
    }
  };

  const handlePitchMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (matchModeRef.current !== 'play') return;
    const coords = getPitchPercentageFromMouse(e);

    if (e.button === 0) {
      // LEFT MOUSE BUTTON -> SHOOT ("botão esquerdo do mouse seja para chutar")
      e.preventDefault();
      handleUserShoot(coords.x, coords.y);
    } else if (e.button === 2) {
      // RIGHT MOUSE BUTTON -> PASS ("botão direito para fazer um passe")
      e.preventDefault();
      handleUserPass(coords.x, coords.y);
    }
  };

  const userPlayerObj = renderPlayers.find(p => p.id === userPlayerId) || null;
  const userHasBallNow = Boolean(userPlayerObj && renderBall.ownerId === userPlayerObj.id);
  const highlightedMateObj = highlightedTeammateId
    ? renderPlayers.find(p => p.id === highlightedTeammateId) || null
    : null;

  const homeLogos = getClubLogoSources(homeClub.id, homeClub.logoUrl, homeClub.shortName);
  const awayLogos = getClubLogoSources(awayClub.id, awayClub.logoUrl, awayClub.shortName);

  return (
    <div className="space-y-4">
      {/* =================================================================== */}
      {/* MODE SWITCHER & CONTROLS HUD BAR */}
      {/* =================================================================== */}
      <div className="bg-neutral-900/95 p-3.5 sm:p-4 rounded-2xl border border-neutral-800 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Left: Jogar Partida vs Assistir Jogo 2D + Team Control & Auto-Walk Toggles */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-center lg:justify-start">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setMatchMode('play');
            }}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              matchMode === 'play'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-neutral-950 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>🎮 Jogar Partida</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setMatchMode('watch');
            }}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              matchMode === 'watch'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/50'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>👁️ Assistir Jogo 2D</span>
          </button>

          {matchMode === 'play' && (
            <>
              {/* Toggle: Control Entire Team (Auto-Switch on Pass) vs Single Player */}
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setTeamControlMode(prev => !prev);
                }}
                className={`px-3 py-2 rounded-xl text-[11px] font-black border transition flex items-center gap-1.5 ${
                  teamControlMode
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-sm'
                    : 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-sm'
                }`}
                title="Alternar entre controlar o time todo (muda de jogador automaticamente ao tocar a bola) ou controlar apenas 1 jogador fixo"
              >
                <span>
                  {teamControlMode
                    ? '🔄 Controle: Time Todo (Muda no Passe)'
                    : '⭐ Controle: Só Seu Jogador'}
                </span>
              </button>

              {/* Toggle: Autonomous Walking ON/OFF */}
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setAutoWalkEnabled(prev => !prev);
                }}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 ${
                  autoWalkEnabled
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
                title="Quando ativado, seu jogador anda sozinho de forma inteligente quando você solta as teclas"
              >
                <span>{autoWalkEnabled ? '🚶 Andar Sozinho: ON' : '🚶 Andar Sozinho: OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setMovementStyle(prev => (prev === 'hybrid' ? 'keyboard' : 'hybrid'));
                }}
                className="px-3 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-300 text-[11px] font-bold border border-neutral-800 transition flex items-center gap-1.5"
                title="Alternar entre mover com WASD/Setas + Mouse ou somente Teclado WASD/Setas"
              >
                {movementStyle === 'hybrid' ? (
                  <>
                    <MousePointer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mouse / WASD</span>
                  </>
                ) : (
                  <>
                    <Keyboard className="w-3.5 h-3.5 text-amber-400" />
                    <span>Só WASD</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Right: Speed, Pause & Skip Controls */}
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsPaused(p => !p);
            }}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs border border-neutral-700 transition flex items-center gap-1.5"
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                <span>Retomar</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>Pausar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setSpeedMultiplier(s => (s === 1 ? 2 : s === 2 ? 4 : 1));
            }}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-black text-xs border border-neutral-700 transition flex items-center gap-1"
          >
            <FastForward className="w-3.5 h-3.5 text-emerald-400" />
            <span>{speedMultiplier}x</span>
          </button>

          {onSkipToEnd && minute < 90 && (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onSkipToEnd({
                  minute,
                  homeScore: scoresRef.current.home,
                  awayScore: scoresRef.current.away,
                  events: eventsRef.current,
                  stats: statsRef.current
                });
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-xs border border-amber-500/40 transition flex items-center gap-1.5"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Encerrar Partida (Manter {homeScore}x{awayScore})</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* CONTROLS LEGEND & ACTION BAR (WHEN IN 'PLAY' MODE) */}
      {/* =================================================================== */}
      {matchMode === 'play' && (
        <div className="bg-gradient-to-r from-emerald-950/60 via-neutral-900 to-neutral-900 px-4 py-3 rounded-2xl border border-emerald-500/30 flex flex-col xl:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center xl:justify-start gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-neutral-950/90 px-3 py-1.5 rounded-xl border border-amber-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-neutral-400 font-bold">Controlando:</span>
              <span className="text-amber-300 font-black">
                {userPlayerObj ? `#${userPlayerObj.number} ${userPlayerObj.shortName}` : 'Carregando...'}
              </span>
            </div>

            {/* Key Q: Spin Dribble */}
            <div className="flex items-center gap-1.5 bg-neutral-950/85 px-2.5 py-1.5 rounded-xl border border-cyan-500/40">
              <kbd className="px-2 py-0.5 rounded bg-cyan-400 text-neutral-950 font-black text-[10px]">
                TECLA Q
              </kbd>
              <span className="text-cyan-200 font-bold">Drible Girinho</span>
              {userDribbleCooldownSec > 0 ? (
                <span className="text-[10px] font-black text-amber-400">
                  ({userDribbleCooldownSec.toFixed(1)}s)
                </span>
              ) : (
                <span className="text-[10px] font-black text-emerald-400">PRONTO</span>
              )}
            </div>

            {/* Key E: Steal Ball (3s Cooldown) */}
            <div className="flex items-center gap-1.5 bg-neutral-950/85 px-2.5 py-1.5 rounded-xl border border-rose-500/40">
              <kbd className="px-2 py-0.5 rounded bg-rose-500 text-white font-black text-[10px]">
                TECLA E
              </kbd>
              <span className="text-rose-200 font-bold">Roubar Bola</span>
              {userTackleCooldownSec > 0 ? (
                <span className="px-1.5 py-0.2 rounded bg-rose-500/25 text-rose-300 font-black text-[10px]">
                  ⏳ {userTackleCooldownSec.toFixed(1)}s
                </span>
              ) : (
                <span className="text-[10px] font-black text-emerald-400">PRONTO (3s CD)</span>
              )}
            </div>

            {/* Key SPACE: Call for Ball / Switch Player */}
            <div className="flex items-center gap-1.5 bg-neutral-950/80 px-2.5 py-1.5 rounded-xl border border-neutral-800">
              <kbd className="px-2 py-0.5 rounded bg-emerald-500 text-neutral-950 font-black text-[10px]">
                ESPAÇO
              </kbd>
              <span className="text-white font-bold">Pedir Bola</span>
            </div>

            {/* Left Click: Shoot */}
            <div className="flex items-center gap-1.5 bg-neutral-950/80 px-2.5 py-1.5 rounded-xl border border-neutral-800">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-neutral-950 font-black text-[10px]">
                BOTÃO ESQ.
              </span>
              <span className="text-white font-bold">Chutar</span>
            </div>

            {/* Right Click: Pass (Auto-switches in Team Control mode) */}
            <div className="flex items-center gap-1.5 bg-neutral-950/80 px-2.5 py-1.5 rounded-xl border border-neutral-800">
              <span className="px-2 py-0.5 rounded bg-sky-400 text-neutral-950 font-black text-[10px]">
                BOTÃO DIR.
              </span>
              <span className="text-white font-bold">
                {teamControlMode ? 'Passe + Assumir Receptor' : 'Fazer Passe'}
              </span>
            </div>
          </div>

          {/* Quick on-screen action buttons (also work via mouse/touch) */}
          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUserDribble}
              disabled={userDribbleCooldownSec > 0}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-neutral-950 font-black text-xs shadow transition flex items-center gap-1"
            >
              <span>🌀 Girinho (Q)</span>
            </button>
            <button
              type="button"
              onClick={handleUserTackle}
              disabled={userTackleCooldownSec > 0 || userHasBallNow}
              className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white font-black text-xs shadow transition flex items-center gap-1"
            >
              <span>
                🛡️ {userTackleCooldownSec > 0 ? `Roubar (${userTackleCooldownSec.toFixed(1)}s)` : 'Roubar Bola (E)'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleCallForBall}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs shadow transition flex items-center gap-1"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pedir Bola</span>
            </button>
            <button
              type="button"
              onClick={() => handleUserPass()}
              disabled={!userHasBallNow}
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-neutral-950 font-black text-xs shadow transition"
            >
              🎯 Passe
            </button>
            <button
              type="button"
              onClick={() => handleUserShoot()}
              disabled={!userHasBallNow}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 font-black text-xs shadow transition"
            >
              🚀 Chutar
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* GOAL CELEBRATION BANNER */}
      {/* =================================================================== */}
      {goalBanner && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-neutral-950 font-black text-center shadow-2xl animate-bounce flex items-center justify-center gap-3">
          <Trophy className="w-6 h-6" />
          <span className="text-base sm:text-xl uppercase tracking-wider">
            ⚽ GOOOOOOOL DO{' '}
            {goalBanner.team === 'home'
              ? homeClub.name.toUpperCase()
              : awayClub.name.toUpperCase()}
            ! {goalBanner.scorer} (#{goalBanner.number})
            {goalBanner.assister ? ` • Assist: ${goalBanner.assister}` : ''}
          </span>
          <Trophy className="w-6 h-6" />
        </div>
      )}

      {/* =================================================================== */}
      {/* THE 2D INTERACTIVE SOCCER PITCH */}
      {/* =================================================================== */}
      <div
        ref={pitchContainerRef}
        onMouseMove={handlePitchMouseMove}
        onMouseLeave={() => {
          mouseCoordsRef.current.active = false;
          setMousePitchCoords(null);
        }}
        onMouseDown={handlePitchMouseDown}
        onContextMenu={e => {
          // Always prevent browser context menu so Right-Click passes cleanly!
          e.preventDefault();
        }}
        className={`relative w-full aspect-[16/10] sm:aspect-[18/10] bg-gradient-to-b from-emerald-800 via-emerald-850 to-emerald-900 rounded-3xl border-4 border-emerald-950 shadow-2xl overflow-hidden select-none ${
          matchMode === 'play' ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        {/* Cut grass stripes pattern */}
        <div className="absolute inset-0 grid grid-cols-12 pointer-events-none opacity-20">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={i % 2 === 0 ? 'bg-black/25' : 'bg-white/10'} />
          ))}
        </div>

        {/* Pitch Lines & Aim Guides (SVG overlay) */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* Outer boundary */}
          <rect
            x="2"
            y="4"
            width="96"
            height="92"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.4"
          />

          {/* Center Line */}
          <line
            x1="50"
            y1="4"
            x2="50"
            y2="96"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.4"
          />

          {/* Center Circle */}
          <circle
            cx="50"
            cy="50"
            r="9.5"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.4"
          />
          <circle cx="50" cy="50" r="0.8" fill="rgba(255,255,255,0.75)" />

          {/* Left Penalty Box (Home Goal) */}
          <rect
            x="2"
            y="24"
            width="14.5"
            height="52"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.4"
          />
          <rect
            x="2"
            y="36"
            width="5.5"
            height="28"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.4"
          />
          <circle cx="11" cy="50" r="0.6" fill="rgba(255,255,255,0.75)" />
          {/* Left Goal Net */}
          <rect
            x="0.2"
            y="42"
            width="1.8"
            height="16"
            fill="rgba(255,255,255,0.28)"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.4"
          />

          {/* Right Penalty Box (Away Goal) */}
          <rect
            x="83.5"
            y="24"
            width="14.5"
            height="52"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.4"
          />
          <rect
            x="92.5"
            y="36"
            width="5.5"
            height="28"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.4"
          />
          <circle cx="89" cy="50" r="0.6" fill="rgba(255,255,255,0.75)" />
          {/* Right Goal Net */}
          <rect
            x="98"
            y="42"
            width="1.8"
            height="16"
            fill="rgba(255,255,255,0.28)"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.4"
          />

          {/* Visual Pass & Shot Guide Lines when User Has the Ball in Play Mode */}
          {matchMode === 'play' && userPlayerObj && userHasBallNow && (
            <>
              {/* Pass guide line to highlighted teammate (Right-Click) */}
              {highlightedMateObj && (
                <line
                  x1={userPlayerObj.x}
                  y1={userPlayerObj.y}
                  x2={highlightedMateObj.x}
                  y2={highlightedMateObj.y}
                  stroke="rgba(56, 189, 248, 0.7)"
                  strokeWidth="0.45"
                  strokeDasharray="1.2 1.2"
                />
              )}

              {/* Shot aim line towards mouse / goal (Left-Click) */}
              {mousePitchCoords && (
                <line
                  x1={userPlayerObj.x}
                  y1={userPlayerObj.y}
                  x2={mousePitchCoords.x}
                  y2={mousePitchCoords.y}
                  stroke="rgba(251, 191, 36, 0.55)"
                  strokeWidth="0.35"
                  strokeDasharray="0.8 0.8"
                />
              )}
            </>
          )}
        </svg>

        {/* Quick Action Floating Toast inside Pitch */}
        {actionBanner && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-neutral-950/90 border border-amber-400/60 text-amber-300 font-black text-xs shadow-xl pointer-events-none whitespace-nowrap">
            {actionBanner}
          </div>
        )}

        {/* ALL 22 PLAYERS ("BOTÕEZINHOS" DE FUTEBOL DE BOTÃO PREMIUM) */}
        {renderPlayers.map(p => {
          const hasBall = renderBall.ownerId === p.id;
          const isUser = p.id === userPlayerId;
          const isOpponentControlled =
            Boolean(multiplayerConfig?.enabled) && p.id === opponentPlayerId;
          const isPassCandidate =
            matchMode === 'play' && userHasBallNow && p.id === highlightedTeammateId;
          const club = p.team === 'home' ? homeClub : awayClub;
          const logos = p.team === 'home' ? homeLogos : awayLogos;
          const primaryLogo = logos[0] || club.logoUrl;
          const secondaryLogo = logos[1] || club.logoUrl;

          // Walking stride animation offset for left/right boots
          const strideLeft = Math.sin(p.walkPhase || 0) * 3.2;
          const strideRight = -Math.sin(p.walkPhase || 0) * 3.2;
          const bodyBob = Math.abs(Math.cos(p.walkPhase || 0)) * 1.1;

          // Spin-dribble ("girinho" Q) 360 degree rotation angle
          const isSpinning = p.dribbleAnimFrames > 0;
          const spinDegrees = isSpinning ? (22 - p.dribbleAnimFrames) * (360 / 22) : 0;

          // Steal/tackle (E) lunge animation & 3s cooldown status
          const isTackling = p.tackleAnimFrames > 0;
          const tackleCdSec = p.tackleCooldownFrames > 0 ? (p.tackleCooldownFrames / 60).toFixed(1) : null;

          return (
            <div
              key={p.id}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: `translate(-50%, calc(-50% - ${bodyBob}px))`
              }}
              className={`absolute flex flex-col items-center justify-center pointer-events-none ${
                isUser ? 'z-30' : hasBall ? 'z-25' : 'z-20'
              }`}
            >
              {/* Floating "PEDIU BOLA!" callout above user player */}
              {isUser && callBallIndicator && (
                <div className="mb-1 px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-black text-[9px] uppercase tracking-wider shadow-lg animate-bounce whitespace-nowrap">
                  ✋ BOLA AQUI!
                </div>
              )}

              {/* Floating Spin-Dribble ("GIROU!") badge for User or Bots */}
              {isSpinning && (
                <div className="mb-1 px-2 py-0.5 rounded-full bg-cyan-400 text-neutral-950 font-black text-[8px] uppercase tracking-wider shadow-lg whitespace-nowrap">
                  🌀 DRIBLE!
                </div>
              )}

              {/* Floating Tackle Lunge badge */}
              {isTackling && !isSpinning && (
                <div className="mb-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-black text-[8px] uppercase tracking-wider shadow-lg whitespace-nowrap">
                  🛡️ BOTE!
                </div>
              )}

              {/* Animated Walking Feet / Boots underneath the button token */}
              <div className="relative flex items-center justify-center">
                <div
                  style={{
                    transform: `translate(${strideLeft}px, ${strideRight * 0.5}px)`
                  }}
                  className="absolute -bottom-1 left-1 w-2 h-1.5 rounded-full bg-neutral-950 border border-white/40 shadow-sm"
                />
                <div
                  style={{
                    transform: `translate(${strideRight}px, ${strideLeft * 0.5}px)`
                  }}
                  className="absolute -bottom-1 right-1 w-2 h-1.5 rounded-full bg-neutral-950 border border-white/40 shadow-sm"
                />

                {/* Spin-Dribble Vortex Ring */}
                {isSpinning && (
                  <div className="absolute -inset-2 rounded-full border-2 border-dashed border-cyan-300 animate-spin opacity-90 pointer-events-none" />
                )}

                {/* Tackle Shockwave Ring */}
                {isTackling && (
                  <div className="absolute -inset-2 rounded-full border-2 border-rose-400 animate-ping opacity-80 pointer-events-none" />
                )}

                {/* The Player Button Token ("Botãozinho" 3D Acrílico) */}
                <div
                  style={{
                    backgroundColor:
                      club.primaryColor || (p.team === 'home' ? '#10b981' : '#3b82f6'),
                    transform: isSpinning
                      ? `rotate(${spinDegrees}deg) scale(1.16)`
                      : isTackling
                      ? 'scale(1.14)'
                      : undefined
                  }}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center relative shadow-[0_4px_10px_rgba(0,0,0,0.65)] transition-transform duration-75 ${
                    isUser && matchMode === 'play'
                      ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-emerald-950 scale-110'
                      : isOpponentControlled
                      ? 'ring-4 ring-fuchsia-400 ring-offset-2 ring-offset-emerald-950 scale-110'
                      : hasBall
                      ? 'ring-3 ring-white scale-105'
                      : isPassCandidate
                      ? 'ring-2 ring-sky-400 ring-dashed'
                      : 'border-2 border-white/95'
                  }`}
                >
                  {/* Inner 3D glossy button rim */}
                  <div
                    className="absolute inset-0.5 rounded-full pointer-events-none border opacity-55"
                    style={{
                      borderColor: club.secondaryColor || '#ffffff',
                      background:
                        'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35), transparent 60%)'
                    }}
                  />

                  {/* Direction indicator dot on rim showing facing angle */}
                  <div
                    style={{
                      transform: `rotate(${(Math.atan2(p.dirY || 0, p.dirX || 1) * 180) / Math.PI}deg)`
                    }}
                    className="absolute inset-0 pointer-events-none flex items-center justify-end pr-0.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow border border-neutral-950" />
                  </div>

                  {primaryLogo ? (
                    <img
                      src={primaryLogo}
                      alt={club.shortName}
                      onError={e => {
                        if (secondaryLogo && e.currentTarget.src !== secondaryLogo) {
                          e.currentTarget.src = secondaryLogo;
                        }
                      }}
                      className="w-4 h-4 sm:w-5 sm:h-5 object-contain pointer-events-none drop-shadow"
                    />
                  ) : (
                    <span className="text-[9px] font-black text-white">{p.number}</span>
                  )}

                  {/* Shirt Number mini badge */}
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full font-black text-[9px] flex items-center justify-center border shadow ${
                      isUser && matchMode === 'play'
                        ? 'bg-amber-400 text-neutral-950 border-neutral-950'
                        : 'bg-neutral-950 text-white border-neutral-600'
                    }`}
                  >
                    {p.number}
                  </span>

                  {/* 3-Second Tackle Cooldown mini badge (for User and Bots when on cooldown) */}
                  {tackleCdSec && (
                    <span className="absolute -top-1.5 -left-1.5 px-1 py-0.1 rounded-full bg-rose-600 text-white font-black text-[7px] border border-white/70 shadow">
                      {tackleCdSec}s
                    </span>
                  )}
                </div>
              </div>

              {/* Player Name & "VOCÊ" / "ADVERSÁRIO" indicator */}
              <div
                className={`mt-1 px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-black whitespace-nowrap shadow border ${
                  isUser && matchMode === 'play'
                    ? 'bg-amber-400 text-neutral-950 border-amber-300'
                    : isOpponentControlled
                    ? 'bg-fuchsia-500 text-white border-fuchsia-300'
                    : hasBall
                    ? 'bg-emerald-500 text-neutral-950 border-emerald-300'
                    : 'bg-neutral-950/90 text-white border-neutral-800'
                }`}
              >
                {isUser && matchMode === 'play'
                  ? `★ ${p.shortName} (VOCÊ)`
                  : isOpponentControlled
                  ? `⚔️ ${p.shortName} (${
                      multiplayerConfig?.role === 'host'
                        ? multiplayerConfig?.guestPlayerName || 'P2'
                        : multiplayerConfig?.hostPlayerName || 'P1'
                    })`
                  : p.shortName}
              </div>
            </div>
          );
        })}

        {/* THE SOCCER BALL (⚽) — GLUED TO FOOT OR SMOOTH FLIGHT */}
        <div
          style={{
            left: `${renderBall.x}%`,
            top: `${renderBall.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
          className="absolute w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-xl flex items-center justify-center text-[11px] sm:text-xs z-35 pointer-events-none ring-2 ring-neutral-950"
        >
          <span className="leading-none select-none">⚽</span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* LIVE NARRATION & PLAYER SELECTION FOR FRIENDLY MODE */}
      {/* =================================================================== */}
      <div className="bg-neutral-900/95 p-4 rounded-2xl border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-emerald-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Narração Ao Vivo • {minute}' Min
              </span>
              {userHasBallNow && matchMode === 'play' && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40">
                  ⚽ Bola no seu pé! Q = Drible Girinho | Clique Esq = Chutar | Clique Dir = Passe
                </span>
              )}
              {!userHasBallNow && matchMode === 'play' && (
                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px] font-black border border-rose-500/30">
                  🛡️ Sem a bola: Tecla E = Roubar Bola (3s Cooldown) | Espaço = Pedir Bola
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold text-white mt-0.5">{commentary}</p>
          </div>
        </div>

        {/* Allow manually changing which player button you control at any time */}
        {matchMode === 'play' && (
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            <span className="text-[11px] font-bold text-neutral-400 whitespace-nowrap">
              Jogador Ativo:
            </span>
            <select
              value={userPlayerId}
              onChange={e => {
                const newId = e.target.value;
                switchControlledPlayer(newId);
                soundFx.playClick();
              }}
              className="bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
            >
              {renderPlayers
                .filter(p => p.team === userTeamSide && p.position !== 'GK')
                .map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.number} {p.name} ({p.position})
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
