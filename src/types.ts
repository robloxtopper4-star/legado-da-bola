export type Position = 
  | 'GOL' 
  | 'LE' 
  | 'LD' 
  | 'ZAG' 
  | 'VOL' 
  | 'MC' 
  | 'MEI' 
  | 'PE' 
  | 'PD' 
  | 'ATA';

export type PlayStyle = 
  | 'Velocista' 
  | 'Finalizador Clínico' 
  | 'Armador Clássico' 
  | 'Driblador Nato' 
  | 'Jogador Físico (Box-to-Box)' 
  | 'Cão de Guarda (Marcador)' 
  | 'Especialista em Bolas Paradas' 
  | 'Ponta Agudo' 
  | 'Falso 9' 
  | 'Segundo Atacante'
  | 'Goleiro Líbero';

export type SquadRole = 
  | 'Promessa' 
  | 'Reserva' 
  | 'Rotação' 
  | 'Titular' 
  | 'Estrela' 
  | 'Capitão' 
  | 'Ídolo';

export type MoraleLevel = 'Péssima' | 'Baixa' | 'Normal' | 'Boa' | 'Excelente';

export type LicenseStatus = 'licensed' | 'original' | 'generic';

export type GameMode = 'NORMAL' | 'QUICK' | 'REALISTIC' | 'LEGEND' | 'CHALLENGE';

export type CareerStartPath = 'base' | 'small_club' | 'wonderkid' | 'custom';

export interface PlayerAttributes {
  // Técnicos
  finalizacao: number;
  chuteLonge: number;
  passeCurto: number;
  passeLongo: number;
  cruzamento: number;
  drible: number;
  dominio: number;
  cobrancaFalta: number;
  penalti: number;
  cabeceio: number;

  // Físicos
  velocidade: number;
  aceleracao: number;
  forca: number;
  resistencia: number;
  agilidade: number;
  equilibrio: number;

  // Mentais
  visao: number;
  posicionamento: number;
  decisoes: number;
  concentracao: number;
  lideranca: number;
  compostura: number;

  // Defensivos
  desarme: number;
  interceptacao: number;
  marcacao: number;
  antecipacao: number;

  // Goleiro
  reflexos: number;
  manejo: number;
  elasticidade: number;
  posicionamentoGol: number;
  defesa: number;
  jogoPes: number;
  saidaGol: number;
}

export interface TrainingFocusConfig {
  id: string;
  name: string;
  description: string;
  targetAttributes: (keyof PlayerAttributes)[];
  isCustom?: boolean;
}

export interface PlayerContract {
  clubId: string;
  clubName: string;
  weeklyWage: number;
  bonusPerGoal: number;
  bonusPerCleanSheet: number;
  releaseClause: number;
  yearsRemaining: number;
  role: SquadRole;
}

export interface Agent {
  id: string;
  name: string;
  tier: 'Iniciante' | 'Profissional' | 'Super Agente';
  feePercentage: number;
  reputation: number; // 1-100
  specialty: string;
  description: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  lastName: string;
  shirtName: string;
  shirtNumber: number;
  age: number;
  nationality: string;
  secondNationality?: string;
  heightCm: number;
  weightKg: number;
  preferredFoot: 'Destro' | 'Canhoto' | 'Ambidestro';
  primaryPosition: Position;
  secondaryPositions: Position[];
  playStyle: PlayStyle;
  photoUrl?: string;

  // Rating & Evolution
  ovr: number;
  potential: number;
  form: number; // 0-100
  morale: MoraleLevel;
  confidence: number; // 0-100
  energy: number; // 0-100
  attributes: PlayerAttributes;
  trainingPoints: number;
  trainingFocus?: TrainingFocusConfig;

  // Status & Relations
  marketValue: number;
  squadRole: SquadRole;
  coachTrust: number; // 0-100
  fansPopularity: number; // 0-100
  squadRelationship: number; // 0-100
  followersCount: number;

  // Injury
  isInjured: boolean;
  injuryName?: string;
  injuryWeeksRemaining?: number;

  // Career stats overall
  careerMatches: number;
  careerGoals: number;
  careerAssists: number;
  careerTrophies: number;
  careerAwards: number;
  careerEarnings: number;

  // International
  nationalCaps: number;
  nationalGoals: number;
  nationalAssists: number;
  isNationalTeamCalled: boolean;
  isNationalCaptain: boolean;

  contract: PlayerContract;
  agent: Agent;

  // Youth Academy / Categorias de Base
  isYouthAcademy?: boolean;
  youthCategory?: 'Sub-15' | 'Sub-17' | 'Sub-20';
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  country: string;
  state?: string; // UF do clube (ex: 'PR', 'PA', 'SP', 'RJ', 'MG', 'RS', 'SC', 'BA', 'GO', etc.)
  hasCopaDoBrasil?: boolean;
  playsLibertadores?: boolean;
  playsSulamericana?: boolean;
  leagueId: string;
  tier: number;
  prestige: number; // 1 to 5
  attackRating: number; // 50-95
  midfieldRating: number;
  defenseRating: number;
  primaryColor: string;
  secondaryColor: string;
  stadiumName: string;
  stadiumCapacity: number;
  licenseStatus: LicenseStatus;
  budget: number;
}

export interface League {
  id: string;
  name: string;
  country: string;
  region: 'América do Sul' | 'Europa' | 'América do Norte' | 'Ásia' | 'África';
  division: 1 | 2;
  reputation: number; // 1-100
  licenseStatus: LicenseStatus;
}

export interface Competition {
  id: string;
  name: string;
  type: 'league' | 'cup' | 'continental' | 'international' | 'world_cup' | 'state';
  region: string;
  prestige: number;
  seasonFrequency: 'annual' | 'quadrennial';
  currentStage?: string;
}

export interface SeasonStats {
  seasonYear: number;
  clubId: string;
  clubName: string;
  matches: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  avgRating: number;
  cleanSheets: number;
  trophiesWon: string[];
  awardsWon: string[];
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'assist' | 'yellow_card' | 'red_card' | 'sub_in' | 'sub_out' | 'injury' | 'save' | 'penalty_miss' | 'penalty_goal' | 'great_play' | 'opponent_goal';
  description: string;
  isPlayerInvolved: boolean;
}

export interface MatchSimulationResult {
  matchId: string;
  competitionName: string;
  homeClub: Club;
  awayClub: Club;
  homeScore: number;
  awayScore: number;
  isPlayerHome: boolean;
  playerStarted: boolean;
  playerMinutes: number;
  playerRating: number;
  playerGoals: number;
  playerAssists: number;
  playerYellowCards: number;
  playerRedCards: number;
  playerShots: number;
  playerKeyPasses: number;
  playerTackles: number;
  playerEnergyCost: number;
  events: MatchEvent[];
  injuryOccurred?: {
    name: string;
    weeks: number;
  };
  summaryNarrative: string;
}

export interface TransferOffer {
  id: string;
  clubId: string;
  clubName: string;
  clubCountry: string;
  clubPrestige: number;
  type: 'purchase' | 'loan' | 'renewal';
  transferFee: number;
  offeredWage: number;
  bonusPerGoal: number;
  bonusPerCleanSheet: number;
  contractYears: number;
  offeredRole: SquadRole;
  releaseClause: number;
  deadlineWeek: number;
}

export interface NewsItem {
  id: string;
  dateStr: string;
  headline: string;
  snippet: string;
  category: 'transfer' | 'match' | 'award' | 'international' | 'injury' | 'controversy';
  imageUrl?: string;
}

export interface SocialPost {
  id: string;
  authorHandle: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  likes: number;
  retweets: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  timestamp: string;
}

export interface PlayedMatchRecord {
  id: string;
  seasonYear: number;
  week: number;
  tournamentId: string;
  tournamentCategory: 'friendly' | 'state' | 'league' | 'cup' | 'continental' | 'world';
  competitionName: string;
  userClubId: string;
  opponentClubId: string;
  isHome: boolean;
  homeScore: number;
  awayScore: number;
  userGoalsFor: number;
  userGoalsAgainst: number;
  outcome: 'V' | 'E' | 'D';
}

export interface CareerSave {
  id: string;
  saveName: string;
  createdAt: string;
  updatedAt: string;
  gameMode: GameMode;
  currentYear: number;
  currentWeek: number; // 1 to 48
  totalSeasonsPlayed: number;
  player: PlayerProfile;
  history: SeasonStats[];
  news: NewsItem[];
  socialPosts: SocialPost[];
  activeOffers: TransferOffer[];
  trophyCabinet: {
    name: string;
    year: number;
    club: string;
    icon: string;
  }[];
  awardsCabinet: {
    name: string;
    year: number;
    description: string;
  }[];
  leagueStandings: {
    clubId: string;
    clubName: string;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
  }[];
  seasonMatchResults?: PlayedMatchRecord[];
  clubLeagueOverrides?: Record<string, string>;
  lastPromotionRelegation?: {
    seasonYear: number;
    promotedToSerieA: string[];
    relegatedToSerieB: string[];
    userPromoted?: boolean;
    userRelegated?: boolean;
  };
  isRetired: boolean;
  finalCareerGrade?: {
    score: number;
    title: string;
    description: string;
  };
}
