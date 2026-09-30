import React, { useState } from 'react';
import { Trophy, Calendar, Swords, Shield, ChevronRight, Play, Star, Sparkles } from 'lucide-react';
import { Club } from '../types';
import { ClubBadge } from './ClubBadge';
import { 
  getActiveClubCompetitions, 
  getScheduledFixture, 
  TournamentDetails 
} from '../utils/competitionsEngine';

interface CompetitionsCalendarViewProps {
  currentClub: Club;
  currentWeek: number;
  currentYear: number;
  onStartMatch: () => void;
  isRetired: boolean;
}

export const CompetitionsCalendarView: React.FC<CompetitionsCalendarViewProps> = ({
  currentClub,
  currentWeek,
  currentYear,
  onStartMatch,
  isRetired
}) => {
  const [selectedPhase, setSelectedPhase] = useState<'all' | 1 | 2 | 3 | 4>('all');
  
  const activeCompetitions = getActiveClubCompetitions(currentClub);
  const currentFixture = getScheduledFixture(currentClub, currentWeek);

  // Generate fixture list for upcoming 8 weeks
  const upcomingFixtures = [];
  for (let w = currentWeek; w <= Math.min(48, currentWeek + 7); w++) {
    upcomingFixtures.push(getScheduledFixture(currentClub, w));
  }

  // Determine current season phase
  const getPhaseNumber = (w: number): 1 | 2 | 3 | 4 => {
    if (w <= 3) return 1;
    if (w <= 14) return 2;
    if (w <= 42) return 3;
    return 4;
  };

  const currentPhase = getPhaseNumber(currentWeek);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* SPOTLIGHT: Próximo Jogo do Calendário */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-950 p-6 sm:p-8 rounded-3xl border border-neutral-800 shadow-xl relative overflow-hidden">
        <div
          className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: currentClub.primaryColor }}
        />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative">
          <div className="space-y-2 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Semana {currentWeek} de 48 • Temporada {currentYear}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${currentFixture.tournament.badgeColor}`}>
                {currentFixture.tournament.badgeIcon} {currentFixture.tournament.name}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white font-heading">
              {currentFixture.stageLabel}
            </h2>
            <p className="text-xs text-neutral-400">
              {currentFixture.isHome ? 'Partida em Casa' : 'Partida Fora de Casa'} • Estádio {currentFixture.isHome ? currentClub.stadiumName : currentFixture.opponent.stadiumName}
            </p>
          </div>

          {/* Confrontation Matchup Banner */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 bg-neutral-950/80 p-4 sm:p-5 rounded-2xl border border-neutral-800 shadow-inner">
            {/* User Club */}
            <div className="flex flex-col items-center gap-1.5 text-center w-24 sm:w-28">
              <ClubBadge club={currentClub} size="lg" />
              <span className="text-xs font-black text-white truncate max-w-full">{currentClub.name}</span>
              <span className="text-[10px] text-emerald-400 font-bold">{currentFixture.isHome ? 'Mandante' : 'Visitante'}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-black text-neutral-500 uppercase tracking-widest font-heading">VS</span>
              <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center">
                <Swords className="w-4 h-4 text-amber-400" />
              </div>
            </div>

            {/* Opponent Club */}
            <div className="flex flex-col items-center gap-1.5 text-center w-24 sm:w-28">
              <ClubBadge club={currentFixture.opponent} size="lg" />
              <span className="text-xs font-black text-white truncate max-w-full">{currentFixture.opponent.name}</span>
              <span className="text-[10px] text-neutral-400 font-bold">{currentFixture.isHome ? 'Visitante' : 'Mandante'}</span>
            </div>
          </div>

          {!isRetired && (
            <div className="shrink-0 w-full lg:w-auto">
              <button
                type="button"
                onClick={onStartMatch}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                DISPUTAR ESTE JOGO
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: TODAS AS COMPETIÇÕES ATIVAS DO CLUBE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Calendário Oficial
            </span>
            <h3 className="text-xl font-black text-white font-heading">
              Competições do {currentClub.name} ({currentYear})
            </h3>
          </div>
          <span className="text-xs font-bold text-neutral-400 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
            {activeCompetitions.length} Torneios no Ano
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCompetitions.map(tourney => {
            const isCurrentlyPlaying = currentFixture.tournament.id === tourney.id;

            return (
              <div
                key={tourney.id}
                className={`p-5 rounded-2xl border transition flex flex-col justify-between ${
                  isCurrentlyPlaying
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black border flex items-center gap-1.5 ${tourney.badgeColor}`}>
                      <span>{tourney.badgeIcon}</span>
                      <span>{tourney.shortName}</span>
                    </span>

                    {isCurrentlyPlaying && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-neutral-950 px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                        Rodada Atual
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm text-white font-heading">{tourney.name}</h4>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{tourney.description}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="capitalize font-medium">Categoria: {tourney.category}</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Oficial
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: CRONOGRAMA DAS 4 FASES DA TEMPORADA */}
      <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Estrutura da Temporada
          </span>
          <h3 className="text-xl font-black text-white font-heading">
            Linha do Tempo das 48 Semanas
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Veja como o ano é distribuído entre amistosos preparatórios, campeonatos estaduais, ligas nacionais, copas continentais e o mundial de clubes.
          </p>
        </div>

        {/* Phase Filter Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              phase: 1 as const,
              title: 'Fase 1: Pré-Temporada',
              weeks: 'Semanas 1 a 3',
              icon: '⚽',
              desc: currentClub.country === 'Brasil' ? 'Amistosos Preparatórios e Clássicos de Verão' : 'Champions Pre-Season Tour Global'
            },
            {
              phase: 2 as const,
              title: 'Fase 2: Abertura & Regionais',
              weeks: 'Semanas 4 a 14',
              icon: '🏅',
              desc: currentClub.country === 'Brasil' ? 'Campeonato Estadual (Paulistão, Carioca, etc.) + Copa do Brasil' : 'Início da Liga Nacional + Copas + Fase de Liga da Champions'
            },
            {
              phase: 3 as const,
              title: 'Fase 3: Ligas & Glória Continental',
              weeks: 'Semanas 15 a 42',
              icon: '🏆',
              desc: currentClub.country === 'Brasil' ? 'Brasileirão Série A/B + CONMEBOL Libertadores + Copa Betano do Brasil' : 'Premier / La Liga / Serie A + Mata-mata UEFA Champions League + Copa'
            },
            {
              phase: 4 as const,
              title: 'Fase 4: Finais & Mundial de Clubes',
              weeks: 'Semanas 43 a 48',
              icon: '👑',
              desc: 'Grandes Finais da Champions / Libertadores, Final da Copa Nacional, Título da Liga e FIFA Mundial de Clubes'
            }
          ].map(p => {
            const isCurrent = currentPhase === p.phase;

            return (
              <div
                key={p.phase}
                className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-emerald-500/15 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'bg-neutral-950/60 border-neutral-800/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">{p.icon}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isCurrent 
                        ? 'bg-emerald-500 text-neutral-950 font-extrabold shadow-sm' 
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}>
                      {isCurrent ? 'Fase em Andamento' : p.weeks}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-xs text-white font-heading">{p.title}</h4>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* SECTION 3: PRÓXIMAS RODADAS NO RADAR */}
        <div className="pt-4 border-t border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-300">
              Próximos Confrontos Agendados
            </h4>
            <span className="text-[11px] text-neutral-500">Próximas 8 Semanas</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {upcomingFixtures.map(f => {
              const isNow = f.week === currentWeek;

              return (
                <div
                  key={f.week}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition ${
                    isNow
                      ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md'
                      : 'bg-neutral-950/70 border-neutral-800/80 text-neutral-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-1">
                      <span>Semana {f.week}</span>
                      <span className={`px-1.5 py-0.2 rounded font-black border ${f.tournament.badgeColor}`}>
                        {f.tournament.shortName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <ClubBadge club={f.opponent} size="sm" />
                      <div className="truncate">
                        <p className="font-extrabold text-xs text-white truncate">{f.opponent.name}</p>
                        <p className="text-[10px] text-neutral-400">{f.isHome ? 'Mandante' : 'Visitante'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-800/60 text-[10px] text-neutral-400 truncate">
                    {f.stageLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
