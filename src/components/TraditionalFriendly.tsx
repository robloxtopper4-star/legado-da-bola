import React, { useState, useMemo } from 'react';
import {
  Play,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Swords,
  Sparkles,
  Shield,
  Flame,
  Target,
  Zap,
  Gamepad2,
  Eye
} from 'lucide-react';
import { Club } from '../types';
import { INITIAL_CLUBS } from '../data/database';
import { ClubBadge } from './ClubBadge';
import { Interactive2DPitch, Pitch2DEvent, Pitch2DStats, getClub2DRoster } from './Interactive2DPitch';
import {
  loadCustomSquads,
  convertCustomSquadTo2DRoster,
  CustomSquad
} from '../services/customRostersService';
import { soundFx } from '../utils/audio';

interface TraditionalFriendlyProps {
  onBackToMenu: () => void;
  onOpenPenalties?: (homeClubId?: string, awayClubId?: string) => void;
}

export const TraditionalFriendly: React.FC<TraditionalFriendlyProps> = ({
  onBackToMenu,
  onOpenPenalties
}) => {
  // Navigation & setup states
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'ended'>('setup');
  const [initialMode, setInitialMode] = useState<'play' | 'watch'>('play');
  const [userTeamSide, setUserTeamSide] = useState<'home' | 'away'>('home');
  const [matchKey, setMatchKey] = useState<number>(1);

  // Selection states
  const [homeClub, setHomeClub] = useState<Club>(() => INITIAL_CLUBS[0]); // Flamengo default
  const [awayClub, setAwayClub] = useState<Club>(() => INITIAL_CLUBS[4]); // Real Madrid default
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [savedCustomSquads] = useState<CustomSquad[]>(() => loadCustomSquads());
  const [homeSquadSelection, setHomeSquadSelection] = useState<string>('original');
  const [awaySquadSelection, setAwaySquadSelection] = useState<string>('original');

  const resolvedHomeRoster = useMemo(() => {
    if (homeSquadSelection === 'original') return getClub2DRoster(homeClub);
    const found = savedCustomSquads.find(s => s.id === homeSquadSelection);
    return found ? convertCustomSquadTo2DRoster(found, homeClub) : getClub2DRoster(homeClub);
  }, [homeSquadSelection, homeClub, savedCustomSquads]);

  const resolvedAwayRoster = useMemo(() => {
    if (awaySquadSelection === 'original') return getClub2DRoster(awayClub);
    const found = savedCustomSquads.find(s => s.id === awaySquadSelection);
    return found ? convertCustomSquadTo2DRoster(found, awayClub) : getClub2DRoster(awayClub);
  }, [awaySquadSelection, awayClub, savedCustomSquads]);

  // Live Score & Stats
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

  // Filter available clubs
  const filteredClubs = useMemo(() => {
    return INITIAL_CLUBS.filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.shortName.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      if (countryFilter === 'all') return true;
      if (countryFilter === 'br') return c.country === 'Brasil';
      if (countryFilter === 'eng') return c.country === 'Inglaterra';
      if (countryFilter === 'esp') return c.country === 'Espanha';
      if (countryFilter === 'ita') return c.country === 'Itália';
      if (countryFilter === 'ger') return c.country === 'Alemanha';
      if (countryFilter === 'fra') return c.country === 'França';
      if (countryFilter === 'por') return c.country === 'Portugal';
      if (countryFilter === 'sa')
        return ['Argentina', 'Uruguai', 'Colômbia', 'Equador', 'Chile'].includes(c.country);
      if (countryFilter === 'world')
        return ![
          'Brasil',
          'Inglaterra',
          'Espanha',
          'Itália',
          'Alemanha',
          'França',
          'Portugal'
        ].includes(c.country);
      return true;
    });
  }, [searchTerm, countryFilter]);

  // Quick Match Presets
  const handleSelectPreset = (
    preset:
      | 'el_clasico'
      | 'fla_flu'
      | 'derbi_paulista'
      | 'manchester'
      | 'superclasico'
      | 're_pa'
      | 'classico_sc'
  ) => {
    soundFx.playClick();
    if (preset === 'el_clasico') {
      const rma = INITIAL_CLUBS.find(c => c.id === 'real_madrid') || INITIAL_CLUBS[4];
      const bar = INITIAL_CLUBS.find(c => c.id === 'barcelona') || INITIAL_CLUBS[5];
      setHomeClub(rma);
      setAwayClub(bar);
    } else if (preset === 'fla_flu') {
      const fla = INITIAL_CLUBS.find(c => c.id === 'flamengo') || INITIAL_CLUBS[0];
      const flu = INITIAL_CLUBS.find(c => c.id === 'fluminense') || INITIAL_CLUBS[9];
      setHomeClub(fla);
      setAwayClub(flu);
    } else if (preset === 'derbi_paulista') {
      const cor = INITIAL_CLUBS.find(c => c.id === 'corinthians') || INITIAL_CLUBS[5];
      const pal = INITIAL_CLUBS.find(c => c.id === 'palmeiras') || INITIAL_CLUBS[1];
      setHomeClub(cor);
      setAwayClub(pal);
    } else if (preset === 'manchester') {
      const mci = INITIAL_CLUBS.find(c => c.id === 'man_city') || INITIAL_CLUBS[39];
      const mun = INITIAL_CLUBS.find(c => c.id === 'man_united') || INITIAL_CLUBS[43];
      setHomeClub(mci);
      setAwayClub(mun);
    } else if (preset === 'superclasico') {
      const boc = INITIAL_CLUBS.find(c => c.id === 'boca_juniors') || INITIAL_CLUBS[0];
      const riv = INITIAL_CLUBS.find(c => c.id === 'river_plate') || INITIAL_CLUBS[1];
      setHomeClub(boc);
      setAwayClub(riv);
    } else if (preset === 're_pa') {
      const rem = INITIAL_CLUBS.find(c => c.id === 'remo') || INITIAL_CLUBS[0];
      const pay = INITIAL_CLUBS.find(c => c.id === 'paysandu') || INITIAL_CLUBS[1];
      setHomeClub(rem);
      setAwayClub(pay);
    } else if (preset === 'classico_sc') {
      const fig = INITIAL_CLUBS.find(c => c.id === 'figueirense') || INITIAL_CLUBS[0];
      const ava = INITIAL_CLUBS.find(c => c.id === 'avai') || INITIAL_CLUBS[1];
      setHomeClub(fig);
      setAwayClub(ava);
    }
  };

  // Start Friendly Match in either 'play' or 'watch' mode
  const startMatch = (mode: 'play' | 'watch') => {
    soundFx.playWhistle();
    setInitialMode(mode);
    setHomeScore(0);
    setAwayScore(0);
    setEvents([]);
    setStats({
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
    setMatchKey(k => k + 1);
    setGameState('playing');
  };

  // Finish match preserving the exact scoreboard result
  const handleSimulateDirectly = (currentData: {
    minute: number;
    homeScore: number;
    awayScore: number;
    events: Pitch2DEvent[];
    stats: Pitch2DStats;
  }) => {
    soundFx.playWhistle();
    setHomeScore(currentData.homeScore);
    setAwayScore(currentData.awayScore);
    setEvents(currentData.events);
    setStats(currentData.stats);
    setGameState('ended');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* TOP HEADER */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onBackToMenu();
            }}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] tracking-wider uppercase border border-emerald-500/40 flex items-center gap-1">
                <Flame className="w-3 h-3 text-emerald-400" />
                Amistoso Tradicional 2D
              </span>
              <span className="text-xs text-neutral-500 font-bold">
                • Jogue Controlando Seu Jogador ou Assista
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-heading mt-0.5">
              Partida Amistosa Interativa 2D
            </h1>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. SETUP / SELECTION SCREEN */}
      {/* ======================================================== */}
      {gameState === 'setup' && (
        <div className="space-y-6">
          {/* Confrontation Matchup Banner */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 p-6 sm:p-8 rounded-3xl border border-neutral-800 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              {/* Home Team */}
              <div className="flex flex-col items-center text-center gap-2 w-full md:w-56">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setUserTeamSide('home');
                  }}
                  className={`px-3 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wider border transition ${
                    userTeamSide === 'home'
                      ? 'bg-emerald-500 text-neutral-950 border-emerald-400 shadow'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {userTeamSide === 'home' ? '★ Seu Time (Mandante)' : 'Mandante (Casa)'}
                </button>
                <ClubBadge club={homeClub} size="2xl" />
                <h2 className="text-lg sm:text-xl font-black text-white font-heading">
                  {homeClub.name}
                </h2>
                <span className="text-xs text-neutral-400">{homeClub.stadiumName}</span>

                {/* Elenco Original vs Elenco Personalizado (Home) */}
                <div className="w-full mt-2 bg-neutral-950/90 p-2 rounded-xl border border-neutral-800 text-left">
                  <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1">
                    Escalação / Elenco:
                  </label>
                  <select
                    value={homeSquadSelection}
                    onChange={e => setHomeSquadSelection(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="original">⚽ Elenco Original ({homeClub.shortName})</option>
                    {savedCustomSquads.map(sq => (
                      <option key={sq.id} value={sq.id}>
                        ✏️ Personalizado: {sq.name} ({sq.players.length} jog.)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Center VS & Action Buttons */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center shadow-lg">
                  <Swords className="w-7 h-7 text-amber-400" />
                </div>
                <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                  ESCOLHA O MODO DE JOGO
                </span>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startMatch('play')}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl shadow-emerald-500/25 transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
                  >
                    <Gamepad2 className="w-4 h-4" />
                    <span>🎮 Jogar Partida (Controlar Time Todo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startMatch('watch')}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl shadow-amber-500/25 transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>👁️ Assistir Jogo 2D</span>
                  </button>
                </div>

                <p className="text-[11px] text-neutral-400 text-center max-w-md mt-1 leading-relaxed">
                  No modo <strong>Jogar Partida</strong> você controla todo o time (ao passar no <strong>Clique Direito</strong>, já muda pro jogador que recebeu!), <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-cyan-400 font-bold">Q</kbd> faz Drible Girinho, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-rose-400 font-bold">E</kbd> rouba a bola (3s cooldown), <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-emerald-400 font-bold">ESPAÇO</kbd> pede bola e <strong>Clique Esquerdo</strong> chuta!
                </p>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center text-center gap-2 w-full md:w-56">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setUserTeamSide('away');
                  }}
                  className={`px-3 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wider border transition ${
                    userTeamSide === 'away'
                      ? 'bg-blue-500 text-neutral-950 border-blue-400 shadow'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}
                >
                  {userTeamSide === 'away' ? '★ Seu Time (Visitante)' : 'Visitante (Fora)'}
                </button>
                <ClubBadge club={awayClub} size="2xl" />
                <h2 className="text-lg sm:text-xl font-black text-white font-heading">
                  {awayClub.name}
                </h2>
                <span className="text-xs text-neutral-400">{awayClub.stadiumName}</span>

                {/* Elenco Original vs Elenco Personalizado (Away) */}
                <div className="w-full mt-2 bg-neutral-950/90 p-2 rounded-xl border border-neutral-800 text-left">
                  <label className="block text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1">
                    Escalação / Elenco:
                  </label>
                  <select
                    value={awaySquadSelection}
                    onChange={e => setAwaySquadSelection(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="original">⚽ Elenco Original ({awayClub.shortName})</option>
                    {savedCustomSquads.map(sq => (
                      <option key={sq.id} value={sq.id}>
                        ✏️ Personalizado: {sq.name} ({sq.players.length} jog.)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Duelos Históricos:
            </span>
            <button
              type="button"
              onClick={() => handleSelectPreset('el_clasico')}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-200 border border-neutral-800 hover:border-amber-500/40 transition"
            >
              🇪🇸 El Clásico (Real Madrid x Barcelona)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('fla_flu')}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-200 border border-neutral-800 hover:border-emerald-500/40 transition"
            >
              🇧🇷 Fla-Flu (Flamengo x Fluminense)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('derbi_paulista')}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-200 border border-neutral-800 hover:border-emerald-500/40 transition"
            >
              🇧🇷 Dérbi Paulista (Corinthians x Palmeiras)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('manchester')}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-200 border border-neutral-800 hover:border-purple-500/40 transition"
            >
              🏴󠁧󠁢󠁥󠁮󠁧󠁿 Derby de Manchester (City x United)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('superclasico')}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-200 border border-neutral-800 hover:border-amber-500/40 transition"
            >
              🇦🇷 Superclásico (Boca x River)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('re_pa')}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-200 border border-neutral-800 hover:border-emerald-500/40 transition"
            >
              🇧🇷 Re-Pa Licenciado (Remo x Paysandu)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('classico_sc')}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-200 border border-neutral-800 hover:border-emerald-500/40 transition"
            >
              🇧🇷 Clássico de SC (Figueirense x Avaí)
            </button>
          </div>

          {/* CLUB SELECTOR TABS & SEARCH */}
          <div className="bg-neutral-900/90 p-6 rounded-3xl border border-neutral-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="text-base font-black text-white font-heading flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Selecione os Clubes do Amistoso
              </h3>

              <input
                type="text"
                placeholder="Pesquisar clube (ex: Coritiba, Real Madrid, City, PSG)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-80 px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Country Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'Todos os Clubes' },
                { id: 'br', label: '🇧🇷 Brasil (Série A & B)' },
                { id: 'eng', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra' },
                { id: 'esp', label: '🇪🇸 Espanha' },
                { id: 'ita', label: '🇮🇹 Itália' },
                { id: 'ger', label: '🇩🇪 Alemanha' },
                { id: 'fra', label: '🇫🇷 França' },
                { id: 'por', label: '🇵🇹 Portugal' },
                { id: 'sa', label: '🌎 América do Sul' },
                { id: 'world', label: '🌍 Outros do Mundo' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setCountryFilter(tab.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    countryFilter === tab.id
                      ? 'bg-emerald-500 text-neutral-950 shadow-md'
                      : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Club Grid Selection */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-80 overflow-y-auto pr-1">
              {filteredClubs.map(c => {
                const isHome = homeClub.id === c.id;
                const isAway = awayClub.id === c.id;

                return (
                  <div
                    key={c.id}
                    className={`p-3 rounded-2xl border transition flex flex-col items-center text-center gap-1.5 ${
                      isHome
                        ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500'
                        : isAway
                        ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-neutral-950/60 hover:bg-neutral-800/80 border-neutral-800'
                    }`}
                  >
                    <ClubBadge club={c} size="md" />
                    <span className="text-xs font-black text-white truncate max-w-full">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-neutral-400">{c.country}</span>

                    <div className="grid grid-cols-2 gap-1 w-full mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setHomeClub(c);
                        }}
                        className={`py-1 rounded-lg text-[10px] font-black uppercase transition ${
                          isHome
                            ? 'bg-emerald-500 text-neutral-950'
                            : 'bg-neutral-800 hover:bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        Mandante
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setAwayClub(c);
                        }}
                        className={`py-1 rounded-lg text-[10px] font-black uppercase transition ${
                          isAway
                            ? 'bg-blue-500 text-neutral-950'
                            : 'bg-neutral-800 hover:bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        Visitante
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MATCH PLAYING & VISUAL 2D FIELD SCREEN */}
      {/* ======================================================== */}
      {gameState !== 'setup' && (
        <div className="space-y-6">
          {/* Live Scoreboard */}
          <div className="bg-neutral-900 p-4 sm:p-6 rounded-3xl border border-neutral-800 shadow-xl flex items-center justify-between gap-4">
            {/* Home Score Card */}
            <div className="flex items-center gap-3 sm:gap-4">
              <ClubBadge club={homeClub} size="xl" />
              <div>
                <h3 className="text-base sm:text-lg font-black text-white font-heading">
                  {homeClub.name}
                </h3>
                <span className="text-xs text-emerald-400 font-bold">
                  Mandante {userTeamSide === 'home' ? '• Seu Time' : ''}
                </span>
              </div>
            </div>

            {/* Center Score */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3 sm:gap-6 bg-neutral-950 px-6 py-2 rounded-2xl border border-neutral-800">
                <span className="text-2xl sm:text-4xl font-black text-emerald-400 font-heading">
                  {homeScore}
                </span>
                <span className="text-xs sm:text-sm font-black text-neutral-500 uppercase">X</span>
                <span className="text-2xl sm:text-4xl font-black text-blue-400 font-heading">
                  {awayScore}
                </span>
              </div>
            </div>

            {/* Away Score Card */}
            <div className="flex items-center gap-3 sm:gap-4 flex-row-reverse text-right">
              <ClubBadge club={awayClub} size="xl" />
              <div>
                <h3 className="text-base sm:text-lg font-black text-white font-heading">
                  {awayClub.name}
                </h3>
                <span className="text-xs text-blue-400 font-bold">
                  Visitante {userTeamSide === 'away' ? '• Seu Time' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive 2D Pitch Engine */}
          {gameState === 'playing' && (
            <Interactive2DPitch
              key={matchKey}
              homeClub={homeClub}
              awayClub={awayClub}
              userTeamSide={userTeamSide}
              initialMode={initialMode}
              controlAllTeamByDefault={true}
              customHomeRoster={resolvedHomeRoster}
              customAwayRoster={resolvedAwayRoster}
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
                setGameState('ended');
              }}
              onSkipToEnd={currentData => handleSimulateDirectly(currentData)}
            />
          )}

          {/* Match Stats & Events Feed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live Stats Table */}
            <div className="bg-neutral-900/90 p-5 rounded-3xl border border-neutral-800 space-y-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-400" />
                Estatísticas do Confronto
              </h4>

              {/* Possession bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-neutral-300">
                  <span>
                    {homeClub.shortName} {stats.homePossession}%
                  </span>
                  <span>Posse de Bola</span>
                  <span>
                    {100 - stats.homePossession}% {awayClub.shortName}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-800 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${stats.homePossession}%` }}
                  />
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{ width: `${100 - stats.homePossession}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-800 text-neutral-300">
                  <span className="font-bold text-emerald-400">{stats.homeShots}</span>
                  <span className="text-neutral-500 font-bold">Finalizações Totais</span>
                  <span className="font-bold text-blue-400">{stats.awayShots}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800 text-neutral-300">
                  <span className="font-bold text-emerald-400">{stats.homeShotsOnTarget}</span>
                  <span className="text-neutral-500 font-bold">Chutes no Alvo</span>
                  <span className="font-bold text-blue-400">{stats.awayShotsOnTarget}</span>
                </div>
              </div>
            </div>

            {/* Events Timeline */}
            <div className="bg-neutral-900/90 p-5 rounded-3xl border border-neutral-800 space-y-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Momentos Chave da Partida ({events.length})
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {events.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">
                    Nenhum evento importante ainda...
                  </p>
                ) : (
                  events.map((ev, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                        ev.type === 'goal'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          : ev.type === 'save'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[11px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          {ev.minute}'
                        </span>
                        <span className="font-bold">{ev.text}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase text-neutral-400">
                        {ev.team === 'home' ? homeClub.shortName : awayClub.shortName}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* POST-MATCH END SCREEN OVERLAY / ACTIONS */}
          {gameState === 'ended' && (() => {
            const myGoals = userTeamSide === 'home' ? homeScore : awayScore;
            const oppGoals = userTeamSide === 'home' ? awayScore : homeScore;
            const myClub = userTeamSide === 'home' ? homeClub : awayClub;
            const oppClub = userTeamSide === 'home' ? awayClub : homeClub;
            const isWin = myGoals > oppGoals;
            const isDraw = myGoals === oppGoals;

            return (
            <div className="p-6 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border border-amber-500/40 shadow-2xl text-center space-y-4 animate-in fade-in duration-500">
              <div
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wider border ${
                  isWin
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : isDraw
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                }`}
              >
                <span>{isWin ? '🏆 VOCÊ GANHOU!' : isDraw ? '⚖️ VOCÊ EMPATOU!' : '❌ VOCÊ PERDEU!'}</span>
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white font-heading">
                  {isWin
                    ? `VITÓRIA DO ${myClub.name.toUpperCase()} (${homeScore} x ${awayScore})!`
                    : isDraw
                    ? `EMPATE EM ${homeScore} A ${awayScore}!`
                    : `DERROTA PARA O ${oppClub.name.toUpperCase()} (${homeScore} x ${awayScore})`}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  {isWin
                    ? `Parabéns! O seu time (${myClub.name}) venceu o ${oppClub.name} por ${myGoals} a ${oppGoals}!`
                    : isDraw
                    ? `Tudo igual! ${homeClub.name} e ${awayClub.name} empataram em ${homeScore} a ${awayScore} após os 90 minutos.`
                    : `O ${oppClub.name} venceu o seu time (${myClub.name}) por ${oppGoals} a ${myGoals}.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => startMatch('play')}
                  className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Jogar Revanche (Controlar Jogador)</span>
                </button>

                <button
                  type="button"
                  onClick={() => startMatch('watch')}
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Assistir Revanche 2D</span>
                </button>

                {homeScore === awayScore && onOpenPenalties && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playWhistle();
                      onOpenPenalties(homeClub.id, awayClub.id);
                    }}
                    className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-2"
                  >
                    <Target className="w-4 h-4" />
                    <span>Decidir nos Pênaltis!</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setGameState('setup');
                  }}
                  className="px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-black text-xs uppercase tracking-wider border border-neutral-700 transition flex items-center gap-2"
                >
                  <Swords className="w-4 h-4 text-amber-400" />
                  <span>Novo Amistoso (Trocar Times)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onBackToMenu();
                  }}
                  className="px-6 py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-black text-xs uppercase tracking-wider border border-neutral-800 transition"
                >
                  Voltar ao Menu
                </button>
              </div>
            </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
