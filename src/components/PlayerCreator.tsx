import React, { useState, useMemo, useEffect } from 'react';
import { 
  User, 
  Sparkles, 
  Shield, 
  ChevronRight, 
  ChevronLeft, 
  ArrowRight, 
  CheckCircle2, 
  Activity, 
  Compass, 
  Flag, 
  HelpCircle,
  Dice5,
  Search,
  Filter,
  Zap,
  Globe,
  Camera,
  ArrowLeft,
  Home
} from 'lucide-react';
import { PlayerPhotoModal } from './PlayerPhotoModal';
import { 
  Position, 
  PlayStyle, 
  GameMode, 
  CareerStartPath, 
  PlayerProfile, 
  Club, 
  CareerSave 
} from '../types';
import { 
  NATIONALITIES, 
  INITIAL_CLUBS, 
  INITIAL_AGENTS, 
  INITIAL_LEAGUES 
} from '../data/database';
import { 
  generateInitialAttributes, 
  calculateOvr, 
  calculateMarketValue,
  calculateTrialSuccessRate,
  TrialCalculation
} from '../utils/calculator';
import { soundFx } from '../utils/audio';
import { TrialModal } from './TrialModal';
import { ClubBadge } from './ClubBadge';

interface PlayerCreatorProps {
  onCareerCreated: (newSave: CareerSave) => void;
  onCancel: () => void;
}

const POSITIONS: { pos: Position; label: string; group: string }[] = [
  { pos: 'GOL', label: 'Goleiro', group: 'Defesa' },
  { pos: 'LE', label: 'Lateral Esquerdo', group: 'Defesa' },
  { pos: 'LD', label: 'Lateral Direito', group: 'Defesa' },
  { pos: 'ZAG', label: 'Zagueiro Central', group: 'Defesa' },
  { pos: 'VOL', label: 'Volante Marcador', group: 'Meio-Campo' },
  { pos: 'MC', label: 'Meio-Campista Central', group: 'Meio-Campo' },
  { pos: 'MEI', label: 'Meia Armador (Camisa 10)', group: 'Meio-Campo' },
  { pos: 'PE', label: 'Ponta Esquerda', group: 'Ataque' },
  { pos: 'PD', label: 'Ponta Direita', group: 'Ataque' },
  { pos: 'ATA', label: 'Centroavante Finalizador', group: 'Ataque' },
];

const PLAY_STYLES: { style: PlayStyle; desc: string }[] = [
  { style: 'Velocista', desc: 'Arranque explosivo e velocidade pura nos contra-ataques.' },
  { style: 'Finalizador Clínico', desc: 'Frieza mortal na cara do gol e posicionamento de predador.' },
  { style: 'Armador Clássico', desc: 'Visão panorâmica, lançamentos cirúrgicos e cadência de jogo.' },
  { style: 'Driblador Nato', desc: 'Imprevisibilidade, dribles curtos no mano a mano e agilidade.' },
  { style: 'Jogador Físico (Box-to-Box)', desc: 'Fôlego inesgotável, força nos combates e chegada de área a área.' },
  { style: 'Cão de Guarda (Marcador)', desc: 'Desarmes precisos, interceptações e imposição defensiva dura.' },
  { style: 'Especialista em Bolas Paradas', desc: 'Mestre nas cobranças de falta, pênaltis e escanteios.' },
  { style: 'Ponta Agudo', desc: 'Verticalidade para quebrar linhas e cruzar com perfeição.' },
  { style: 'Falso 9', desc: 'Recua para articular e arrasta zagueiros criando espaços vazios.' },
  { style: 'Segundo Atacante', desc: 'Movimentação inteligente em volta do centroavante de referência.' },
  { style: 'Goleiro Líbero', desc: 'Excelente reflexo e jogo moderno com os pés fora da área.' },
];

const GAME_MODES: { mode: GameMode; title: string; desc: string; badge: string }[] = [
  { mode: 'NORMAL', title: 'Carreira Normal', desc: 'A experiência clássica completa e equilibrada do futebol mundial.', badge: 'Equilibrado' },
  { mode: 'QUICK', title: 'Carreira Rápida', desc: 'Simulações aceleradas para percorrer temporadas com dinamismo.', badge: 'Rápido' },
  { mode: 'REALISTIC', title: 'Modo Realista', desc: 'Exigência máxima: evolução mais cadenciada e maior cobrança da torcida.', badge: 'Desafiador' },
  { mode: 'LEGEND', title: 'Modo Lenda', desc: 'Alto potencial desde cedo, eventos épicos e rápida ascensão aos gigantes.', badge: 'Épico' },
  { mode: 'CHALLENGE', title: 'Modo Desafio', desc: 'Missão especial: Levar um clube em ascensão à glória continental.', badge: 'Missão' },
];

const START_PATHS: { path: CareerStartPath; title: string; desc: string; ovrBase: number; potBase: number }[] = [
  { path: 'base', title: 'Caminho 1 — Categorias de Base', desc: 'Comece no sub-20 lapidando seu talento para cavar a primeira vaga nos profissionais.', ovrBase: 63, potBase: 84 },
  { path: 'small_club', title: 'Caminho 2 — Clube de Acesso', desc: 'Inicie na Série B ou divisão de acesso com minutos imediatos em campo.', ovrBase: 67, potBase: 82 },
  { path: 'wonderkid', title: 'Caminho 3 — Jovem Promessa', desc: 'Jóia badalada da imprensa com holofotes em um grande clube tradicional.', ovrBase: 72, potBase: 90 },
  { path: 'custom', title: 'Caminho 4 — Personalizado', desc: 'Você escolhe qualquer país e clube onde quer arriscar sua peneira inicial.', ovrBase: 68, potBase: 85 },
];

export const PlayerCreator: React.FC<PlayerCreatorProps> = ({ onCareerCreated, onCancel }) => {
  // Step tracker: 1 = Info & Style, 2 = Mode & Path, 3 = Peneira (Trial Selection & Evaluation)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Profile state
  const [name, setName] = useState('Lucas');
  const [lastName, setLastName] = useState('Silva');
  const [shirtName, setShirtName] = useState('LUCAS');
  const [shirtNumber, setShirtNumber] = useState(10);
  const [age, setAge] = useState(17);
  const [nationality, setNationality] = useState('Brasil');
  const [secondNationality, setSecondNationality] = useState<string>('Nenhuma');
  const [heightCm, setHeightCm] = useState(178);
  const [weightKg, setWeightKg] = useState(72);
  const [preferredFoot, setPreferredFoot] = useState<'Destro' | 'Canhoto' | 'Ambidestro'>('Destro');
  const [primaryPosition, setPrimaryPosition] = useState<Position>('MEI');
  const [secondaryPositions, setSecondaryPositions] = useState<Position[]>(['MC', 'PE']);
  const [playStyle, setPlayStyle] = useState<PlayStyle>('Armador Clássico');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Mode & Path
  const [gameMode, setGameMode] = useState<GameMode>('NORMAL');
  const [startPath, setStartPath] = useState<CareerStartPath>('base');

  // Peneira (Trial) Tab and Club state
  const [trialTab, setTrialTab] = useState<'drawn' | 'search'>('drawn');
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('Todos');
  const [leagueFilter, setLeagueFilter] = useState<string>('Todas');
  const [drawnClubIds, setDrawnClubIds] = useState<string[]>([]);
  const [rejectedClubIds, setRejectedClubIds] = useState<string[]>([]);

  // Active Trial Modal
  const [activeTrialClub, setActiveTrialClub] = useState<Club | null>(null);

  // Target OVR and Potential based on selections
  const baseTarget = useMemo(() => {
    const p = START_PATHS.find(sp => sp.path === startPath) || START_PATHS[0];
    let ovr = p.ovrBase;
    let pot = p.potBase;
    if (gameMode === 'LEGEND') {
      ovr += 4;
      pot += 5;
    } else if (gameMode === 'REALISTIC') {
      ovr -= 2;
      pot -= 2;
    }
    return { ovr, pot };
  }, [startPath, gameMode]);

  // Generate preview attributes
  const previewAttributes = useMemo(() => {
    return generateInitialAttributes(primaryPosition, baseTarget.ovr);
  }, [primaryPosition, baseTarget.ovr]);

  const calculatedOvr = useMemo(() => {
    return calculateOvr(primaryPosition, previewAttributes);
  }, [primaryPosition, previewAttributes]);

  // Function to randomize trial clubs (Peneiras Sorteadas)
  const rerollDrawnClubs = () => {
    soundFx.playClick();
    // Pick clubs from player's country or accessible tier excluding already rejected clubs
    const domesticClubs = INITIAL_CLUBS.filter(c => c.country === nationality && !rejectedClubIds.includes(c.id));
    const pool = domesticClubs.length >= 4 
      ? domesticClubs 
      : INITIAL_CLUBS.filter(c => !rejectedClubIds.includes(c.id));

    // Shuffle and pick up to 5 unique clubs
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5).map(c => c.id);

    setDrawnClubIds(selected);
    if (selected.length > 0 && !selected.includes(selectedClubId)) {
      setSelectedClubId(selected[0]);
    }
  };

  // Initial draw of trials when moving to step 3 or when nationality changes
  useEffect(() => {
    if (drawnClubIds.length === 0) {
      rerollDrawnClubs();
    }
  }, [nationality]);

  // Master league labels for filter
  const LEAGUES_LABEL_MAP: Record<string, string> = {
    Todas: 'Todas as Ligas',
    br_a: '🇧🇷 Brasileirão Série A',
    br_b: '🇧🇷 Brasileirão Série B',
    eng_1: '🦁 Premier League (Inglaterra)',
    esp_1: '🇪🇸 La Liga (Espanha)',
    ita_1: '🇮🇹 Serie A (Itália)',
    ger_1: '🇩🇪 Bundesliga (Alemanha)',
    fra_1: '🇫🇷 Ligue 1 (França)',
    por_1: '🇵🇹 Liga Portugal',
    ned_1: '🇳🇱 Eredivisie (Holanda)',
    tur_1: '🇹🇷 Süper Lig (Turquia)',
    sco_1: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Premiership (Escócia)',
  };

  // Filtered clubs for "Escolher Qualquer Clube" tab
  const filteredAllClubs = useMemo(() => {
    return INITIAL_CLUBS.filter(c => {
      const matchName = c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        c.shortName.toLowerCase().includes(searchFilter.toLowerCase());
      const matchCountry = countryFilter === 'Todos' || c.country === countryFilter;
      const matchLeague = leagueFilter === 'Todas' || c.leagueId === leagueFilter;
      return matchName && matchCountry && matchLeague;
    });
  }, [searchFilter, countryFilter, leagueFilter]);

  // Clubs in the drawn tab
  const drawnClubs = useMemo(() => {
    return drawnClubIds
      .map(id => INITIAL_CLUBS.find(c => c.id === id))
      .filter((c): c is Club => !!c);
  }, [drawnClubIds]);

  // Currently focused club in UI
  const focusedClub = useMemo(() => {
    const found = INITIAL_CLUBS.find(c => c.id === selectedClubId);
    return found || drawnClubs[0] || INITIAL_CLUBS[0];
  }, [selectedClubId, drawnClubs]);

  // Calculated trial odds for focused club
  const focusedTrialOdds = useMemo(() => {
    return calculateTrialSuccessRate(
      calculatedOvr,
      baseTarget.pot,
      age,
      nationality,
      focusedClub
    );
  }, [calculatedOvr, baseTarget.pot, age, nationality, focusedClub]);

  // Available countries for filter dropdown
  const uniqueCountries = useMemo(() => {
    const set = new Set(INITIAL_CLUBS.map(c => c.country));
    return ['Todos', ...Array.from(set)];
  }, []);

  // Available leagues for filter dropdown
  const uniqueLeagues = useMemo(() => {
    const set = new Set(INITIAL_CLUBS.map(c => c.leagueId));
    return ['Todas', ...Array.from(set)];
  }, []);

  // Handle successful approval from TrialModal
  const handleTrialSuccess = (approvedClub: Club) => {
    const startYear = 2026;
    const initialAgent = INITIAL_AGENTS[0];

    const isYouth = age < 18;
    const youthCat: 'Sub-15' | 'Sub-17' | 'Sub-20' = age <= 15 ? 'Sub-15' : 'Sub-17';
    const clubDisplayName = isYouth ? `${approvedClub.name} (BASE)` : approvedClub.name;

    const baseWage = approvedClub.prestige >= 4 ? 2500 : approvedClub.prestige === 3 ? 1200 : 750;
    const weeklyWage = isYouth ? Math.round(baseWage * 0.35) : baseWage;
    const initialMarketVal = calculateMarketValue(calculatedOvr, baseTarget.pot, age, 3);

    const initialPlayer: PlayerProfile = {
      id: 'player_' + Date.now(),
      name,
      lastName,
      shirtName: shirtName.toUpperCase(),
      shirtNumber,
      age,
      nationality,
      secondNationality: secondNationality === 'Nenhuma' ? undefined : secondNationality,
      heightCm,
      weightKg,
      preferredFoot,
      primaryPosition,
      secondaryPositions,
      playStyle,
      photoUrl,
      ovr: calculatedOvr,
      potential: baseTarget.pot,
      form: 75,
      morale: 'Excelente',
      confidence: 75,
      energy: 100,
      attributes: previewAttributes,
      trainingPoints: 10,
      marketValue: initialMarketVal,
      squadRole: isYouth ? 'Promessa' : (approvedClub.prestige >= 4 ? 'Promessa' : 'Rotação'),
      coachTrust: 60,
      fansPopularity: 50,
      squadRelationship: 65,
      followersCount: approvedClub.prestige >= 4 ? 18000 : 4200,
      isInjured: false,
      careerMatches: 0,
      careerGoals: 0,
      careerAssists: 0,
      careerTrophies: 0,
      careerAwards: 0,
      careerEarnings: 0,
      nationalCaps: 0,
      nationalGoals: 0,
      nationalAssists: 0,
      isNationalTeamCalled: false,
      isNationalCaptain: false,
      contract: {
        clubId: approvedClub.id,
        clubName: clubDisplayName,
        weeklyWage,
        bonusPerGoal: Math.round(weeklyWage * 0.1),
        bonusPerCleanSheet: Math.round(weeklyWage * 0.08),
        releaseClause: initialMarketVal * 2,
        yearsRemaining: Math.max(3, 18 - age + 2),
        role: isYouth ? 'Promessa' : (approvedClub.prestige >= 4 ? 'Promessa' : 'Rotação')
      },
      agent: initialAgent,
      isYouthAcademy: isYouth,
      youthCategory: isYouth ? youthCat : undefined
    };

    // Simulated initial league table
    const clubsInLeague = INITIAL_CLUBS.filter(c => c.leagueId === approvedClub.leagueId);
    const leagueStandings = clubsInLeague.map((c) => ({
      clubId: c.id,
      clubName: isYouth ? `${c.name} (BASE)` : c.name,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0
    }));

    const newSave: CareerSave = {
      id: 'career_' + Date.now(),
      saveName: `${name} ${lastName} (${approvedClub.shortName}${isYouth ? ' BASE' : ''})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameMode,
      currentYear: startYear,
      currentWeek: 1,
      totalSeasonsPlayed: 0,
      player: initialPlayer,
      history: [],
      news: [
        {
          id: 'news_1',
          dateStr: 'Semana 1, ' + startYear,
          headline: isYouth
            ? `CATEGORIA DE BASE: ${name} ${lastName} assina com o ${approvedClub.name} (BASE)!`
            : `Aprovado na Peneira: ${name} ${lastName} assina com o ${approvedClub.name}!`,
          snippet: isYouth
            ? `A joia de ${age} anos foi aprovada nos testes e ingressa na categoria de base (${youthCat}) do ${approvedClub.name} (BASE). Ficará em desenvolvimento até se profissionalizar aos 18 anos.`
            : `Após impressionar os avaliadores no teste de formação, a jovem promessa de ${age} anos acertou contrato e já treina com o elenco.`,
          category: 'transfer'
        }
      ],
      socialPosts: [
        {
          id: 'tweet_1',
          authorHandle: '@FutebolDeBase',
          authorName: 'Radar da Base',
          authorAvatar: '⚽',
          content: `Olho nesse garoto! ${name} ${lastName} foi o grande destaque da peneira do ${approvedClub.name}. Muita técnica na perna ${preferredFoot.toLowerCase()}!`,
          likes: 342,
          retweets: 58,
          sentiment: 'positive',
          timestamp: 'Há 1 hora'
        }
      ],
      activeOffers: [],
      trophyCabinet: [],
      awardsCabinet: [],
      leagueStandings,
      isRetired: false
    };

    onCareerCreated(newSave);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Top Quick Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { soundFx.playClick(); onCancel(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-xs font-black text-neutral-300 hover:text-white border border-neutral-700 transition shadow-sm group"
          title="Voltar para a lista de carreiras e menu inicial"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Voltar ao Menu Principal</span>
        </button>

        <span className="text-xs text-neutral-500 font-medium">Novo Atleta</span>
      </div>

      {/* Header & Step progress */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Criação de Personagem & Início de Carreira
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-heading">
          {step === 1 && 'Perfil do Atleta & Estilo'}
          {step === 2 && 'Modo de Jogo & Caminho'}
          {step === 3 && 'Teste em Peneira Oficial'}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto">
          {step === 1 && 'Defina as características biográficas, posição de ofício e estilo de jogo do seu atleta.'}
          {step === 2 && 'Selecione a dificuldade e o histórico inicial que moldará seu potencial.'}
          {step === 3 && 'Faça teste de peneira nos clubes. Você pode sortear peneiras ou arriscar teste em qualquer time do mundo!'}
        </p>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 pt-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                  step === s
                    ? 'bg-emerald-500 text-neutral-950 font-black shadow-lg shadow-emerald-500/30'
                    : step > s
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              <span className={`text-xs font-semibold ${step === s ? 'text-white' : 'text-neutral-500'}`}>
                {s === 1 ? 'Perfil' : s === 2 ? 'Modo' : 'Peneira'}
              </span>
              {s < 3 && <span className="w-8 h-[1px] bg-neutral-800" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Info & Style */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Athlete Photo Card */}
          <div className="bg-gradient-to-r from-neutral-900/90 via-neutral-900/70 to-neutral-950 p-5 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-lg">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div
                onClick={() => setIsPhotoModalOpen(true)}
                className="relative w-20 h-20 rounded-2xl overflow-hidden bg-neutral-950 border-2 border-dashed border-emerald-500/60 hover:border-emerald-400 flex items-center justify-center cursor-pointer group shadow-lg transition"
                title="Clique para adicionar ou trocar a foto do jogador"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="Foto do Atleta" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-400 group-hover:text-emerald-400 transition">
                    <Camera className="w-6 h-6 mb-0.5" />
                    <span className="text-[9px] font-bold">Foto</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-base font-extrabold text-white font-heading">
                    {name || 'Novo'} {lastName || 'Atleta'}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-emerald-400 font-bold border border-neutral-700">
                    #{shirtNumber}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  {photoUrl ? '✓ Foto oficial configurada' : 'Adicione uma foto real (arquivo/link) ou escolha um avatar'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs font-bold text-emerald-400 border border-emerald-500/40 hover:border-emerald-500/80 transition flex items-center justify-center gap-2 shadow"
            >
              <Camera className="w-4 h-4" />
              {photoUrl ? 'Alterar Foto do Jogador' : 'Adicionar Foto do Jogador'}
            </button>
          </div>

          <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
            <h2 className="text-base font-bold text-neutral-200 flex items-center gap-2 border-b border-neutral-800 pb-3">
              <User className="w-4 h-4 text-emerald-400" />
              Dados Pessoais & Documentação
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Primeiro Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Sobrenome</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Nome na Camisa</label>
                <input
                  type="text"
                  value={shirtName}
                  onChange={(e) => setShirtName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Número Preferido</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={shirtNumber}
                  onChange={(e) => setShirtNumber(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Nacionalidade Principal</label>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {NATIONALITIES.map((n) => (
                    <option key={n.name} value={n.name}>
                      {n.flag} {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Idade Inicial</label>
                <select
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={13}>13 anos (Base Sub-15 • Início na Categoria de Base)</option>
                  <option value={14}>14 anos (Base Sub-15 • Joia da Categoria de Base)</option>
                  <option value={15}>15 anos (Base Sub-15 • Destaque da Categoria de Base)</option>
                  <option value={16}>16 anos (Base Sub-17 • Revelação da Categoria de Base)</option>
                  <option value={17}>17 anos (Base Sub-20 • Quase Profissional)</option>
                  <option value={18}>18 anos (Profissional • Maioridade & Estreia Principal)</option>
                  <option value={19}>19 anos (Profissional • Jovem Titular)</option>
                  <option value={20}>20 anos (Profissional • Em Afirmação)</option>
                  <option value={21}>21 anos (Profissional • Maduro)</option>
                  <option value={22}>22 anos (Profissional • Experiente)</option>
                  <option value={23}>23 anos (Profissional • Pico Físico Inicial)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Pé Preferido</label>
                <select
                  value={preferredFoot}
                  onChange={(e) => setPreferredFoot(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Destro">Destro</option>
                  <option value="Canhoto">Canhoto</option>
                  <option value="Ambidestro">Ambidestro</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Porte Físico (Altura/Peso)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    className="w-1/2 px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white"
                    placeholder="cm"
                  />
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-1/2 px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white"
                    placeholder="kg"
                  />
                </div>
              </div>

              {age < 18 && (
                <div className="sm:col-span-2 lg:col-span-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[10px] tracking-wider uppercase border border-amber-500/40 shrink-0">
                      CATEGORIA DE BASE ({age <= 15 ? 'SUB-15' : 'SUB-17/SUB-20'})
                    </span>
                    <span className="leading-snug">
                      Com <strong>{age} anos</strong>, seu jogador defenderá a <strong>BASE</strong> do clube e os times terão o sufixo <strong>(BASE)</strong>. Ao completar 18 anos, você será promovido ao time profissional principal!
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-400 shrink-0">
                    Faltam {18 - age} {18 - age > 1 ? 'anos' : 'ano'} para se profissionalizar
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Position Selector */}
          <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
            <h2 className="text-base font-bold text-neutral-200 flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Activity className="w-4 h-4 text-emerald-400" />
              Posição Principal de Campo
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {POSITIONS.map((p) => (
                <button
                  key={p.pos}
                  type="button"
                  onClick={() => { soundFx.playClick(); setPrimaryPosition(p.pos); }}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                    primaryPosition === p.pos
                      ? 'bg-emerald-500/20 text-white border-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-neutral-950/70 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-black font-heading">{p.pos}</span>
                    <span className="text-[10px] text-neutral-500">{p.group}</span>
                  </div>
                  <span className="text-[11px] font-medium text-neutral-300 mt-1 line-clamp-1">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Play Style */}
          <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
            <h2 className="text-base font-bold text-neutral-200 flex items-center gap-2 border-b border-neutral-800 pb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Estilo de Jogo & Características
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PLAY_STYLES.map(s => (
                <button
                  key={s.style}
                  type="button"
                  onClick={() => { soundFx.playClick(); setPlayStyle(s.style); }}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    playStyle === s.style
                      ? 'bg-amber-500/15 text-white border-amber-500/60 shadow-md shadow-amber-500/10'
                      : 'bg-neutral-950/70 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-neutral-100">{s.style}</span>
                    {playStyle === s.style && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { soundFx.playClick(); setStep(2); }}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/20 transition"
            >
              Avançar: Modo & Caminho
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Game Mode & Starting Path */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Game Mode */}
          <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-neutral-200 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                Selecione o Modo de Jogo
              </h2>
              <span className="text-xs text-neutral-400">Influencia a dificuldade e curva de evolução</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {GAME_MODES.map(m => (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => { soundFx.playClick(); setGameMode(m.mode); }}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                    gameMode === m.mode
                      ? 'bg-emerald-500/15 text-white border-emerald-500/60 shadow-md shadow-emerald-500/10'
                      : 'bg-neutral-950/70 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-sm text-neutral-100 font-heading">{m.title}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{m.desc}</p>
                  </div>
                  {gameMode === m.mode && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Selecionado
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Starting Path */}
          <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-neutral-200 flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                Histórico de Base / Caminho Inicial
              </h2>
              <span className="text-xs text-neutral-400">Molda seu OVR de saída para as peneiras</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {START_PATHS.map(p => (
                <button
                  key={p.path}
                  type="button"
                  onClick={() => { soundFx.playClick(); setStartPath(p.path); }}
                  className={`p-4 rounded-xl border text-left transition ${
                    startPath === p.path
                      ? 'bg-amber-500/15 text-white border-amber-500/60 shadow-md shadow-amber-500/10'
                      : 'bg-neutral-950/70 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-sm text-neutral-100 font-heading">{p.title}</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      OVR ~{p.ovrBase} / POT {p.potBase}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed mt-1">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => { soundFx.playClick(); setStep(1); }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar: Perfil
            </button>
            <button
              type="button"
              onClick={() => { soundFx.playClick(); setStep(3); }}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/20 transition"
            >
              Avançar: Fazer Teste na Peneira
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: PENEIRA / AVALIAÇÃO DE CLUBES (Trial Testing Mechanic) */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Top Banner: Peneira Mechanics */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 p-6 rounded-3xl border border-neutral-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                    Sistema Oficial de Peneiras
                  </span>
                  <span className="text-xs text-neutral-500">•</span>
                  <span className="text-xs text-neutral-300">Seu Atleta: {calculatedOvr} OVR</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white font-heading mt-0.5">
                  Escolha Onde Fazer Teste na Peneira
                </h2>
                <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                  Para assinar seu primeiro contrato profissional, você deve ser avaliado pelos olheiros e comissão técnica. Quanto maior o prestígio do clube, maior a concorrência na posição!
                </p>
              </div>

              {/* Mode Toggle: Drawn Trials vs Choose Any Club */}
              <div className="flex items-center bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800 shrink-0">
                <button
                  type="button"
                  onClick={() => { soundFx.playClick(); setTrialTab('drawn'); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    trialTab === 'drawn'
                      ? 'bg-emerald-500 text-neutral-950 shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Dice5 className="w-3.5 h-3.5" />
                  Peneiras Sorteadas
                </button>

                <button
                  type="button"
                  onClick={() => { soundFx.playClick(); setTrialTab('search'); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    trialTab === 'search'
                      ? 'bg-emerald-500 text-neutral-950 shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Escolher Qualquer Clube
                </button>
              </div>
            </div>

            {/* TAB 1: PENEIRAS SORTEADAS */}
            {trialTab === 'drawn' && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300">
                    Clubes com vagas abertas para peneira nesta semana:
                  </span>
                  <button
                    type="button"
                    onClick={rerollDrawnClubs}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 transition"
                  >
                    <Dice5 className="w-3.5 h-3.5" />
                    Sortear Novas Peneiras 🎲
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {drawnClubs.map(c => {
                    const odds = calculateTrialSuccessRate(
                      calculatedOvr,
                      baseTarget.pot,
                      age,
                      nationality,
                      c
                    );
                    const isSelected = focusedClub.id === c.id;
                    const isRejected = rejectedClubIds.includes(c.id);

                    return (
                      <div
                        key={c.id}
                        onClick={() => { soundFx.playClick(); setSelectedClubId(c.id); }}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                          isRejected
                            ? 'bg-rose-950/20 border-rose-900/40 opacity-70'
                            : isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                            : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <ClubBadge club={c} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-sm text-white truncate">{c.name}</h4>
                              {isRejected && (
                                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-black border border-rose-500/40">
                                  Reprovado
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400">{c.country} • {c.stadiumName}</p>
                            
                            {/* Chance badge */}
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className={`text-xs font-black font-heading ${isRejected ? 'text-neutral-500 line-through' : odds.difficultyColor}`}>
                                {odds.percentage}% de Chance
                              </span>
                              <span className="text-[10px] text-neutral-500">
                                {isRejected ? '(Portas Fechadas)' : `(${odds.difficulty})`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-neutral-400">Prestígio: {'★'.repeat(c.prestige)}</span>
                          {isRejected ? (
                            <span className="text-[11px] text-rose-400 font-bold">Portas Fechadas</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                soundFx.playClick();
                                setSelectedClubId(c.id);
                                setActiveTrialClub(c);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow transition flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3 fill-current" />
                              Fazer Teste
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: ESCOLHER QUALQUER CLUBE DO MUNDO */}
            {trialTab === 'search' && (
              <div className="space-y-4 pt-2">
                {/* Search, League & Country Filters */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Pesquisar clube (ex: Flamengo, Real Madrid, Palmeiras, Manchester City, PSG...)"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* League Selector */}
                  <div className="sm:w-56">
                    <select
                      value={leagueFilter}
                      onChange={(e) => setLeagueFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      {uniqueLeagues.map(l => (
                        <option key={l} value={l}>
                          {LEAGUES_LABEL_MAP[l] || l}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Country Selector */}
                  <div className="sm:w-44">
                    <select
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      {uniqueCountries.map(c => (
                        <option key={c} value={c}>
                          {c === 'Todos' ? 'Todos os Países' : c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Clubs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {filteredAllClubs.map(c => {
                    const odds = calculateTrialSuccessRate(
                      calculatedOvr,
                      baseTarget.pot,
                      age,
                      nationality,
                      c
                    );
                    const isSelected = focusedClub.id === c.id;
                    const isRejected = rejectedClubIds.includes(c.id);

                    return (
                      <div
                        key={c.id}
                        onClick={() => { soundFx.playClick(); setSelectedClubId(c.id); }}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                          isRejected
                            ? 'bg-rose-950/20 border-rose-900/40 opacity-70'
                            : isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-white shadow'
                            : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ClubBadge club={c} size="sm" />
                          <div className="truncate">
                            <div className="flex items-center gap-1">
                              <h4 className="font-bold text-xs truncate">
                                {c.name} {age < 18 ? <span className="text-amber-400 font-extrabold text-[10px]">(BASE)</span> : null}
                              </h4>
                              {isRejected && (
                                <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.2 rounded font-black border border-rose-500/40">
                                  Reprovado
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-400">{c.country}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black font-heading ${isRejected ? 'text-neutral-500 line-through' : odds.difficultyColor}`}>
                            {odds.percentage}%
                          </span>
                          <p className="text-[10px] text-neutral-500">{isRejected ? 'fechado' : 'chance'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* FOCUSED CLUB DETAILS & TRIAL BUTTON */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-950 p-6 rounded-3xl border border-neutral-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div
              className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: focusedClub.primaryColor }}
            />

            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <ClubBadge club={focusedClub} size="xl" />

              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl sm:text-2xl font-black text-white font-heading">
                    {focusedClub.name} {age < 18 ? <span className="text-amber-400 font-black text-base">(BASE)</span> : null}
                  </h3>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border border-neutral-700 ${focusedTrialOdds.difficultyColor}`}>
                    {focusedTrialOdds.difficulty}
                  </span>
                  {age < 18 && (
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Categoria de Base
                    </span>
                  )}
                  {rejectedClubIds.includes(focusedClub.id) && (
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                      ❌ Reprovado nesta peneira
                    </span>
                  )}
                </div>

                <p className="text-xs text-neutral-300">
                  {focusedClub.country} • Estádio {focusedClub.stadiumName} • Prestígio: {'★'.repeat(focusedClub.prestige)}
                </p>

                {/* Scout snippet */}
                <p className="text-xs text-neutral-400 max-w-xl leading-relaxed pt-1">
                  <strong className="text-white">Parecer dos Olheiros:</strong> {focusedTrialOdds.scoutVerdict}
                </p>
              </div>
            </div>

            {/* Trial CTA button with live % */}
            <div className="shrink-0 text-center sm:text-right w-full sm:w-auto">
              <div className="mb-2 hidden sm:block">
                <span className="text-xs text-neutral-400">Probabilidade de Aprovação:</span>
                <span className="text-2xl font-black font-heading text-white ml-2">
                  {focusedTrialOdds.percentage}%
                </span>
              </div>

              {rejectedClubIds.includes(focusedClub.id) ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-neutral-800 text-neutral-500 font-black text-sm tracking-wide cursor-not-allowed border border-neutral-700"
                  >
                    PORTAS FECHADAS (REPROVADO)
                  </button>
                  <p className="text-[11px] text-rose-400 font-semibold">Tente outro clube da lista ou sorteie novas peneiras.</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setActiveTrialClub(focusedClub);
                  }}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  FAZER TESTE NA PENEIRA ({focusedTrialOdds.percentage}%)
                </button>
              )}
            </div>
          </div>

          {/* Navigation Back */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => { soundFx.playClick(); setStep(2); }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar: Modo & Caminho
            </button>
          </div>
        </div>
      )}

      {/* Trial Simulation Modal */}
      {activeTrialClub && (
        <TrialModal
          club={activeTrialClub}
          playerName={`${name} ${lastName}`}
          position={primaryPosition}
          playStyle={playStyle}
          playerOvr={calculatedOvr}
          calculation={calculateTrialSuccessRate(calculatedOvr, baseTarget.pot, age, nationality, activeTrialClub)}
          onSuccess={(approvedClub) => {
            setActiveTrialClub(null);
            handleTrialSuccess(approvedClub);
          }}
          onReject={(rejectedClub) => {
            setRejectedClubIds(prev => [...new Set([...prev, rejectedClub.id])]);
          }}
          onTryAnotherClub={() => {
            setActiveTrialClub(null);
            setTrialTab('search');
          }}
          onRerollTrials={() => {
            setActiveTrialClub(null);
            setTrialTab('drawn');
            rerollDrawnClubs();
          }}
          onClose={() => setActiveTrialClub(null)}
        />
      )}

      {/* Player Photo Modal */}
      <PlayerPhotoModal
        isOpen={isPhotoModalOpen}
        currentPhotoUrl={photoUrl}
        playerName={`${name || 'Meu'} ${lastName || 'Jogador'}`}
        position={primaryPosition}
        shirtNumber={shirtNumber}
        onSavePhoto={(url) => setPhotoUrl(url)}
        onClose={() => setIsPhotoModalOpen(false)}
      />
    </div>
  );
};
