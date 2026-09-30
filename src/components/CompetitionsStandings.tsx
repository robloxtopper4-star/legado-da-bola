import React, { useState } from 'react';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Globe,
  Award,
  Calendar,
  Swords
} from 'lucide-react';
import { CareerSave, Club, PlayedMatchRecord } from '../types';
import { INITIAL_CLUBS, INITIAL_LEAGUES } from '../data/database';
import {
  StandingsRow,
  KnockoutTie,
  ScheduledCompetitionMatch,
  getClubCompetitionsOverview,
  getDomesticLeagueStandings,
  getChampionsLeagueData,
  getLibertadoresData,
  getSecondaryContinentalData,
  getStateAndCupData,
  getCopaDoBrasilData,
  getLeagueRoundsPlayed,
  getUserSeasonMatches
} from '../utils/standingsGenerator';
import {
  getClubLeagueTournament,
  getScheduledFixture,
  syncClubsWithCareer
} from '../utils/competitionsEngine';
import { ClubBadge } from './ClubBadge';
import { soundFx } from '../utils/audio';

interface CompetitionsStandingsProps {
  career: CareerSave;
  userClub: Club;
}

export const CompetitionsStandings: React.FC<CompetitionsStandingsProps> = ({
  career,
  userClub
}) => {
  syncClubsWithCareer(career);
  // Determine initial section based on current week's scheduled competition or last played match
  const nextFixture = getScheduledFixture(userClub, career.currentWeek);
  const allUserMatches = getUserSeasonMatches(career, userClub.id);
  const lastPlayed =
    allUserMatches.length > 0 ? allUserMatches[allUserMatches.length - 1] : null;

  const getInitialTab = ():
    | 'league'
    | 'copa_do_brasil'
    | 'champions'
    | 'libertadores'
    | 'secondary_continental'
    | 'cup_state'
    | 'world_leagues' => {
    const refId = lastPlayed ? lastPlayed.tournamentId : nextFixture.tournament.id;
    const refCat = lastPlayed ? lastPlayed.tournamentCategory : nextFixture.tournament.category;
    if (refId === 'copa_brasil') return 'copa_do_brasil';
    if (refId === 'champions_league') return 'champions';
    if (refId === 'libertadores') return 'libertadores';
    if (refId === 'sulamericana' || refId === 'europa_league') return 'secondary_continental';
    if (refCat === 'cup' || refCat === 'state') return 'cup_state';
    return 'league';
  };

  const [selectedSection, setSelectedSection] = useState<
    | 'league'
    | 'copa_do_brasil'
    | 'champions'
    | 'libertadores'
    | 'secondary_continental'
    | 'cup_state'
    | 'world_leagues'
  >(getInitialTab);

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(userClub.leagueId || 'br_a');
  const [libertadoresViewMode, setLibertadoresViewMode] = useState<'groups' | 'overall'>('groups');
  const [bracketStageFilter, setBracketStageFilter] = useState<
    'all' | 'oitavas' | 'quartas' | 'semifinal' | 'final'
  >('all');

  const overviewCards = getClubCompetitionsOverview(userClub, career);
  const userLeagueTournament = getClubLeagueTournament(userClub);

  // STRICT: Only matches played in the user's National League
  const myLeagueMatches = allUserMatches.filter(m => m.tournamentCategory === 'league');
  const myLeagueStandings = getDomesticLeagueStandings(userClub.leagueId, userClub, career);
  const myLeagueRounds = getLeagueRoundsPlayed(
    userClub.leagueId,
    career.currentWeek,
    career,
    userClub
  );

  const browsedLeagueStandings = getDomesticLeagueStandings(selectedLeagueId, userClub, career);
  const browsedLeagueObj = INITIAL_LEAGUES.find(l => l.id === selectedLeagueId);
  const isUserInBrowsedLeague = userClub.leagueId === selectedLeagueId;

  const uclData = getChampionsLeagueData(userClub, career);
  const libData = getLibertadoresData(userClub, career);
  const secContinental = getSecondaryContinentalData(userClub, career);
  const stateAndCup = getStateAndCupData(userClub, career);
  const cdbData = getCopaDoBrasilData(userClub, career);

  // Renders the STRICT match history and W/D/L counters for a SINGLE competition
  const renderCompetitionSpecificRecord = (
    compTitle: string,
    compMatches: PlayedMatchRecord[],
    isParticipating: boolean
  ) => {
    if (!isParticipating) return null;

    const wins = compMatches.filter(m => m.outcome === 'V').length;
    const draws = compMatches.filter(m => m.outcome === 'E').length;
    const losses = compMatches.filter(m => m.outcome === 'D').length;

    return (
      <div className="bg-neutral-900/90 p-4 sm:p-5 rounded-3xl border border-neutral-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Resultados Exclusivos Desta Competição
            </span>
            <h4 className="text-sm sm:text-base font-black text-white font-heading">
              Campanha do {userClub.name} em: {compTitle}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-neutral-950 text-neutral-300 border border-neutral-800 font-mono font-bold text-xs">
              {compMatches.length} {compMatches.length === 1 ? 'Jogo' : 'Jogos'}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-black text-xs">
              {wins} {wins === 1 ? 'Vitória' : 'Vitórias'}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-black text-xs">
              {draws} {draws === 1 ? 'Empate' : 'Empates'}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-black text-xs">
              {losses} {losses === 1 ? 'Derrota' : 'Derrotas'}
            </span>
          </div>
        </div>

        {compMatches.length === 0 ? (
          <div className="p-3 rounded-2xl bg-neutral-950/90 border border-neutral-800 text-xs text-neutral-400">
            ⚽ O seu time ainda não disputou partidas por <strong>{compTitle}</strong> nesta temporada (0J • 0V • 0E • 0D). Os jogos de outras competições não interferem nesta tabela.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {compMatches.map(m => {
              const opp = INITIAL_CLUBS.find(c => c.id === m.opponentClubId);
              const oppName = opp ? opp.shortName || opp.name : 'Adversário';
              return (
                <div
                  key={m.id}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    m.outcome === 'V'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                      : m.outcome === 'E'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <span className="text-[10px] font-mono text-neutral-400">Sem. {m.week}</span>
                  <span className="font-black">
                    {m.outcome === 'V'
                      ? '🏆 GANHOU'
                      : m.outcome === 'E'
                      ? '⚖️ EMPATOU'
                      : '❌ PERDEU'}
                  </span>
                  <span className="font-mono text-white">
                    {userClub.shortName} {m.userGoalsFor} x {m.userGoalsAgainst} {oppName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Renders the synchronized fixture schedule for the user's club in Champions / Libertadores
  const renderUserFixturesSchedule = (
    compTitle: string,
    fixtures: ScheduledCompetitionMatch[]
  ) => {
    if (fixtures.length === 0) return null;

    return (
      <div className="bg-neutral-900/90 p-5 sm:p-6 rounded-3xl border border-neutral-800 space-y-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Calendário Sincronizado com as Partidas
          </span>
          <h4 className="text-sm sm:text-base font-black text-white font-heading flex items-center gap-2 mt-0.5">
            <Swords className="w-4 h-4 text-amber-400" />
            <span>Confrontos do {userClub.name} • {compTitle}</span>
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Estes são exatamente os adversários que o seu time enfrenta quando chega a semana de cada fase.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {fixtures.map(fix => {
            const pm = fix.playedMatch;
            return (
              <div
                key={fix.id}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2.5 ${
                  pm
                    ? pm.outcome === 'V'
                      ? 'bg-emerald-950/30 border-emerald-500/50'
                      : pm.outcome === 'E'
                      ? 'bg-amber-950/30 border-amber-500/50'
                      : 'bg-rose-950/30 border-rose-500/50'
                    : 'bg-neutral-950/90 border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase">
                  <span className="text-amber-400 truncate">{fix.stageLabel}</span>
                  <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-700 shrink-0">
                    {fix.weekLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ClubBadge club={userClub} size="sm" />
                    <span className="text-xs font-black text-amber-300 truncate">
                      {userClub.shortName}
                    </span>
                  </div>

                  <span className="px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-700 font-mono font-black text-xs text-white shrink-0">
                    {pm ? `${pm.userGoalsFor} x ${pm.userGoalsAgainst}` : 'vs'}
                  </span>

                  <div className="flex items-center gap-1.5 min-w-0 justify-end">
                    <span className="text-xs font-bold text-white truncate">
                      {fix.opponent.shortName || fix.opponent.name}
                    </span>
                    <ClubBadge club={fix.opponent} size="sm" />
                  </div>
                </div>

                <div className="text-[10px] font-bold text-center pt-1 border-t border-neutral-800/80">
                  {pm ? (
                    <span
                      className={
                        pm.outcome === 'V'
                          ? 'text-emerald-400 font-black'
                          : pm.outcome === 'E'
                          ? 'text-amber-400 font-black'
                          : 'text-rose-400 font-black'
                      }
                    >
                      {pm.outcome === 'V'
                        ? '🏆 VOCÊ GANHOU'
                        : pm.outcome === 'E'
                        ? '⚖️ VOCÊ EMPATOU'
                        : '❌ VOCÊ PERDEU'}
                    </span>
                  ) : (
                    <span className="text-neutral-400">
                      Adversário definido: <strong className="text-white">{fix.opponent.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Reusable Standings Table Renderer
  const renderStandingsTable = (
    rows: StandingsRow[],
    title: string,
    subtitle: string,
    legendItems?: { label: string; colorClass: string }[]
  ) => {
    return (
      <div className="bg-neutral-900/90 rounded-3xl border border-neutral-800 shadow-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white font-heading flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>{title}</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-neutral-950 px-3.5 py-2 rounded-xl border border-neutral-800">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-neutral-300">
              Temporada <strong className="text-white">{career.currentYear}</strong> • Semana{' '}
              <strong className="text-emerald-400">{career.currentWeek}/48</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950/90 border-b border-neutral-800 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                <th className="py-3 px-3 sm:px-4 w-12 text-center">Pos</th>
                <th className="py-3 px-3 sm:px-4">Clube</th>
                <th className="py-3 px-2.5 text-center text-amber-300">PTS</th>
                <th className="py-3 px-2 text-center">J</th>
                <th className="py-3 px-2 text-center">V</th>
                <th className="py-3 px-2 text-center">E</th>
                <th className="py-3 px-2 text-center">D</th>
                <th className="py-3 px-2 text-center hidden sm:table-cell">GP</th>
                <th className="py-3 px-2 text-center hidden sm:table-cell">GC</th>
                <th className="py-3 px-2 text-center">SG</th>
                <th className="py-3 px-2.5 text-center hidden md:table-cell">%</th>
                <th className="py-3 px-3 text-center hidden lg:table-cell">Últimos Jogos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70 text-xs font-mono">
              {rows.map(r => {
                const winPct =
                  r.played > 0 ? Math.round((r.points / (r.played * 3)) * 100) : 0;

                return (
                  <tr
                    key={r.club.id}
                    className={`transition ${
                      r.isUserClub
                        ? 'bg-emerald-500/15 hover:bg-emerald-500/25 ring-1 ring-inset ring-emerald-500/50'
                        : 'hover:bg-neutral-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3 sm:px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-black text-[11px] ${
                          r.zoneColor ? r.zoneColor : 'bg-neutral-800 text-neutral-300'
                        }`}
                        title={r.zoneLabel || `${r.position}º colocado`}
                      >
                        {r.position}º
                      </span>
                    </td>

                    <td className="py-2.5 px-3 sm:px-4 font-sans">
                      <div className="flex items-center gap-2.5">
                        <ClubBadge club={r.club} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`font-extrabold truncate ${
                                r.isUserClub ? 'text-amber-300 text-xs sm:text-sm' : 'text-white text-xs'
                              }`}
                            >
                              {r.club.name}
                            </span>
                            {r.isUserClub && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950 font-black text-[9px] uppercase tracking-wider">
                                ★ SEU TIME
                              </span>
                            )}
                          </div>
                          {r.zoneLabel && (
                            <span className="text-[10px] text-neutral-400 block truncate">
                              {r.zoneLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-2.5 text-center font-black text-sm text-amber-300 bg-neutral-950/35">
                      {r.points}
                    </td>

                    <td className="py-2.5 px-2 text-center text-neutral-200 font-bold">{r.played}</td>
                    <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">{r.won}</td>
                    <td className="py-2.5 px-2 text-center text-neutral-400">{r.drawn}</td>
                    <td className="py-2.5 px-2 text-center text-rose-400">{r.lost}</td>

                    <td className="py-2.5 px-2 text-center text-neutral-300 hidden sm:table-cell">
                      {r.goalsFor}
                    </td>
                    <td className="py-2.5 px-2 text-center text-neutral-400 hidden sm:table-cell">
                      {r.goalsAgainst}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-center font-bold ${
                        r.goalDifference > 0
                          ? 'text-emerald-400'
                          : r.goalDifference < 0
                          ? 'text-rose-400'
                          : 'text-neutral-400'
                      }`}
                    >
                      {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                    </td>

                    <td className="py-2.5 px-2.5 text-center text-neutral-400 hidden md:table-cell">
                      {winPct}%
                    </td>

                    <td className="py-2.5 px-3 text-center hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {r.form.length === 0 ? (
                          <span className="text-[10px] text-neutral-600">-</span>
                        ) : (
                          r.form.map((res, i) => (
                            <span
                              key={i}
                              className={`w-5 h-5 rounded-md font-black text-[10px] flex items-center justify-center ${
                                res === 'V'
                                  ? 'bg-emerald-500 text-neutral-950'
                                  : res === 'E'
                                  ? 'bg-neutral-600 text-white'
                                  : 'bg-rose-500 text-white'
                              }`}
                            >
                              {res}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {legendItems && legendItems.length > 0 && (
          <div className="p-4 bg-neutral-950/80 border-t border-neutral-800 flex flex-wrap items-center gap-4 text-[11px]">
            <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
              Legenda de Classificação:
            </span>
            {legendItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${item.colorClass}`} />
                <span className="text-neutral-300 font-semibold">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Full 4-Stage Knockout Bracket Renderer (Oitavas de Final, Quartas de Final, Semifinais e Grande Final)
  const renderKnockoutBracket = (ties: KnockoutTie[], title: string) => {
    if (ties.length === 0) return null;

    const r16Ties = ties.filter(t => t.stageGroup === 'oitavas');
    const qfTies = ties.filter(t => t.stageGroup === 'quartas');
    const sfTies = ties.filter(t => t.stageGroup === 'semifinal');
    const finalTies = ties.filter(t => t.stageGroup === 'final');

    const stagesToRender: {
      key: 'oitavas' | 'quartas' | 'semifinal' | 'final';
      label: string;
      badge: string;
      items: KnockoutTie[];
    }[] = [
      { key: 'oitavas', label: 'Oitavas de Final (16 Clubes)', badge: '8 Confrontos', items: r16Ties },
      { key: 'quartas', label: 'Quartas de Final (8 Clubes)', badge: '4 Confrontos', items: qfTies },
      { key: 'semifinal', label: 'Semifinais (4 Clubes)', badge: '2 Confrontos', items: sfTies },
      { key: 'final', label: '🏆 Grande Final (Decisão)', badge: 'Jogo Único', items: finalTies }
    ];

    const filteredStages =
      bracketStageFilter === 'all'
        ? stagesToRender
        : stagesToRender.filter(s => s.key === bracketStageFilter);

    return (
      <div className="bg-neutral-900/90 p-5 sm:p-6 rounded-3xl border border-neutral-800 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              Chaveamento Completo do Mata-Mata (Sincronizado)
            </span>
            <h4 className="text-base sm:text-lg font-black text-white font-heading flex items-center gap-2 mt-0.5">
              <Award className="w-5 h-5 text-amber-400" />
              <span>{title}</span>
            </h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Oitavas de Final, Quartas de Final, Semifinais e Grande Final — você joga exatamente contra quem aparece na sua chave!
            </p>
          </div>

          {/* Stage Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Todas as Fases' },
              { id: 'oitavas', label: 'Oitavas (8)' },
              { id: 'quartas', label: 'Quartas (4)' },
              { id: 'semifinal', label: 'Semifinais (2)' },
              { id: 'final', label: '🏆 Final' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setBracketStageFilter(tab.id as typeof bracketStageFilter);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                  bracketStageFilter === tab.id
                    ? 'bg-amber-500 text-neutral-950 shadow'
                    : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {filteredStages.map(stageObj => (
            <div key={stageObj.key} className="space-y-3">
              <div className="flex items-center justify-between bg-neutral-950/90 px-4 py-2.5 rounded-2xl border border-neutral-800">
                <span className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider">
                  {stageObj.label}
                </span>
                <span className="text-[11px] font-mono font-bold text-neutral-400">
                  {stageObj.badge}
                </span>
              </div>

              <div
                className={`grid grid-cols-1 ${
                  stageObj.key === 'final' ? 'md:grid-cols-1 max-w-2xl mx-auto' : 'md:grid-cols-2'
                } gap-3`}
              >
                {stageObj.items.map(tie => (
                  <div
                    key={tie.id}
                    className={`p-4 rounded-2xl border flex flex-col gap-2.5 transition ${
                      tie.isUserInvolved
                        ? 'bg-gradient-to-r from-emerald-950/50 via-neutral-900 to-emerald-950/30 border-emerald-500/70 ring-1 ring-emerald-500/40 shadow-lg'
                        : 'bg-neutral-950/85 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">{tie.stage}</span>
                        {tie.isUserInvolved && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-black text-[9px]">
                            ★ CONFRONTO DO SEU TIME
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded ${
                          tie.played
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-neutral-900 text-neutral-400 border border-neutral-700'
                        }`}
                      >
                        {tie.played ? 'Encerrado' : tie.weekLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ClubBadge club={tie.homeClub} size="sm" />
                        <span
                          className={`text-xs font-bold truncate ${
                            tie.homeClub.id === userClub.id
                              ? 'text-amber-300 font-black'
                              : 'text-white'
                          }`}
                        >
                          {tie.homeClub.name}
                        </span>
                      </div>

                      <div className="px-3 py-1 rounded-xl bg-neutral-900 border border-neutral-700 font-mono font-black text-xs text-amber-300 shrink-0">
                        {tie.played ? `${tie.homeScore} x ${tie.awayScore}` : 'vs'}
                      </div>

                      <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
                        <span
                          className={`text-xs font-bold truncate ${
                            tie.awayClub.id === userClub.id
                              ? 'text-amber-300 font-black'
                              : 'text-white'
                          }`}
                        >
                          {tie.awayClub.name}
                        </span>
                        <ClubBadge club={tie.awayClub} size="sm" />
                      </div>
                    </div>

                    {tie.isUserInvolved && (
                      <div className="pt-1.5 border-t border-emerald-500/25 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-300 font-bold">
                          🎯 Você joga contra:{' '}
                          <strong className="text-white">
                            {tie.homeClub.id === userClub.id
                              ? tie.awayClub.name
                              : tie.homeClub.name}
                          </strong>
                        </span>
                        {tie.played && tie.userOutcome && (
                          <span
                            className={`font-black ${
                              tie.userOutcome === 'V'
                                ? 'text-emerald-400'
                                : tie.userOutcome === 'E'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {tie.userOutcome === 'V'
                              ? '🏆 VOCÊ GANHOU'
                              : tie.userOutcome === 'E'
                              ? '⚖️ VOCÊ EMPATOU'
                              : '❌ VOCÊ PERDEU'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Participation Banner Helper
  const renderParticipationBanner = (
    competitionTitle: string,
    isParticipating: boolean,
    reasonOrDetails: string,
    highlightBadge?: string
  ) => {
    return (
      <div
        className={`p-5 rounded-3xl border shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isParticipating
            ? 'bg-gradient-to-r from-emerald-950/70 via-neutral-900 to-neutral-900 border-emerald-500/50'
            : 'bg-gradient-to-r from-rose-950/60 via-neutral-900 to-neutral-900 border-rose-500/50'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <ClubBadge club={userClub} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
                {userClub.name} • {competitionTitle}
              </span>
              {isParticipating ? (
                <span className="px-3 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-black text-[11px] uppercase tracking-wider flex items-center gap-1 shadow">
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>ESTÁ PARTICIPANDO</span>
                </span>
              ) : (
                <span className="px-3 py-0.5 rounded-full bg-rose-500 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1 shadow">
                  <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>NÃO ESTÁ PARTICIPANDO</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-neutral-200 font-semibold mt-1">
              {reasonOrDetails}
            </p>
          </div>
        </div>

        {highlightBadge && (
          <div className="px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-right shrink-0">
            <span className="text-[10px] text-neutral-400 uppercase font-bold block">
              Situação Atual
            </span>
            <span
              className={`text-sm font-black font-mono ${
                isParticipating ? 'text-amber-300' : 'text-rose-400'
              }`}
            >
              {highlightBadge}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* =================================================================== */}
      {/* 1. OVERVIEW CARDS: ALL COMPETITIONS & NEXT SCHEDULED MATCH */}
      {/* =================================================================== */}
      <div className="bg-neutral-900/80 p-5 sm:p-6 rounded-3xl border border-neutral-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Central de Competições & Chaveamentos Sincronizados
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white font-heading mt-0.5">
              Competições do {userClub.name} na Temporada {career.currentYear}
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Cada resultado (vitória, empate ou derrota) é contabilizado exclusivamente na competição em que a partida foi disputada.
            </p>
          </div>

          {/* Next Scheduled Opponent Box */}
          <div className="p-3.5 rounded-2xl bg-neutral-950 border border-amber-500/40 flex items-center gap-3 shrink-0">
            <ClubBadge club={nextFixture.opponent} size="md" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                🎯 Próximo Jogo (Semana {career.currentWeek})
              </span>
              <span className="text-xs sm:text-sm font-black text-white block">
                {userClub.shortName} vs {nextFixture.opponent.name}
              </span>
              <span className="text-[11px] text-neutral-400 block">
                {nextFixture.competitionName}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {overviewCards.map(card => {
            const targetTab =
              card.category === 'league'
                ? 'league'
                : card.category === 'copa_do_brasil'
                ? 'copa_do_brasil'
                : card.category === 'champions'
                ? 'champions'
                : card.category === 'libertadores'
                ? 'libertadores'
                : card.category === 'secondary_continental'
                ? 'secondary_continental'
                : card.category === 'cup' || card.category === 'state'
                ? 'cup_state'
                : 'league';

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setSelectedSection(targetTab);
                }}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 ${
                  card.isParticipating
                    ? 'bg-gradient-to-br from-neutral-950 via-neutral-900 to-emerald-950/30 border-emerald-500/40 hover:border-emerald-400 shadow-lg'
                    : 'bg-neutral-950/70 border-neutral-800/80 hover:border-rose-500/40 opacity-85'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl">{card.badgeIcon}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider border ${
                        card.isParticipating
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {card.statusText}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-white font-heading">
                      {card.name}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                      {card.reasonOrStage}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between w-full text-[10px] font-bold">
                  <span className={card.isParticipating ? 'text-amber-300' : 'text-neutral-500'}>
                    {card.isParticipating
                      ? card.userPositionLabel || 'Em disputa'
                      : 'Fora do torneio'}
                  </span>
                  <span className="text-emerald-400 underline">Ver Tabela →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. COMPETITION NAVIGATION SUB-TABS */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedSection('league');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
            selectedSection === 'league'
              ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/20'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
          }`}
        >
          <span>{userLeagueTournament.badgeIcon}</span>
          <span>Minha Liga ({userLeagueTournament.shortName})</span>
          <span className="px-1.5 py-0.2 rounded bg-black/20 text-[10px]">
            {myLeagueMatches.length}J
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedSection('copa_do_brasil');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
            selectedSection === 'copa_do_brasil'
              ? 'bg-green-500 text-neutral-950 shadow-lg shadow-green-500/25'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
          }`}
        >
          <span>🔰</span>
          <span>Copa Betano do Brasil</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] ${
              cdbData.isUserParticipating
                ? 'bg-emerald-950/60 text-emerald-300'
                : 'bg-rose-500/30 text-rose-200'
            }`}
          >
            {cdbData.isUserParticipating
              ? `Participando (${cdbData.userPlayedMatches.length}J)`
              : 'Não está participando'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedSection('champions');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
            selectedSection === 'champions'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
          }`}
        >
          <span>🌟</span>
          <span>UEFA Champions League</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] ${
              uclData.isUserParticipating
                ? 'bg-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/30 text-rose-200'
            }`}
          >
            {uclData.isUserParticipating
              ? `Participando (${uclData.userPlayedMatches.length}J)`
              : 'Não está participando'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedSection('libertadores');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
            selectedSection === 'libertadores'
              ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/25'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
          }`}
        >
          <span>⭐</span>
          <span>CONMEBOL Libertadores</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] ${
              libData.isUserParticipating
                ? 'bg-emerald-950/50 text-emerald-300'
                : 'bg-rose-500/30 text-rose-200'
            }`}
          >
            {libData.isUserParticipating
              ? `Participando (${libData.userPlayedMatches.length}J)`
              : 'Não está participando'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedSection('secondary_continental');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
            selectedSection === 'secondary_continental'
              ? 'bg-orange-500 text-neutral-950 shadow-lg shadow-orange-500/25'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
          }`}
        >
          <span>🥈</span>
          <span>Sul-Americana & Europa League</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedSection('cup_state');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
            selectedSection === 'cup_state'
              ? 'bg-yellow-500 text-neutral-950 shadow-lg shadow-yellow-500/25'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
          }`}
        >
          <span>🏆</span>
          <span>Copa Nacional & Estadual</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedSection('world_leagues');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
            selectedSection === 'world_leagues'
              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Todas as Ligas do Mundo</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* SECTION A: MINHA LIGA NACIONAL */}
      {/* =================================================================== */}
      {selectedSection === 'league' && (
        <div className="space-y-5">
          {renderParticipationBanner(
            userLeagueTournament.name,
            true,
            `O ${userClub.name} está disputando o título nacional da ${userLeagueTournament.name} (${myLeagueRounds} jogos disputados na liga).`,
            myLeagueRounds > 0
              ? `${
                  myLeagueStandings.find(r => r.club.id === userClub.id)?.position || 1
                }º Colocado`
              : '0 Jogos na Liga'
          )}

          {/* Promotion / Relegation Status Banner */}
          {(userClub.leagueId === 'br_a' || userClub.leagueId === 'br_b' || career.lastPromotionRelegation) && (
            <div className="bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-rose-950/40 p-4 sm:p-5 rounded-3xl border border-emerald-500/30 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  ⬆️⬇️ Sistema Oficial de Acesso e Rebaixamento (Série A ↔ Série B)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-950 border border-neutral-800 text-[10px] font-bold text-neutral-300">
                  G-4 Sobe para a Série A • Z-4 Cai para a Série B
                </span>
              </div>

              {career.lastPromotionRelegation ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30">
                    <span className="text-[10px] font-black uppercase text-emerald-400 block">
                      ⬆️ Subiram para a Série A ({career.lastPromotionRelegation.seasonYear})
                    </span>
                    <p className="text-xs font-bold text-white mt-0.5">
                      {career.lastPromotionRelegation.promotedToSerieA.join(', ')}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-500/30">
                    <span className="text-[10px] font-black uppercase text-rose-400 block">
                      ⬇️ Rebaixados para a Série B ({career.lastPromotionRelegation.seasonYear})
                    </span>
                    <p className="text-xs font-bold text-white mt-0.5">
                      {career.lastPromotionRelegation.relegatedToSerieB.join(', ')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-300">
                  Ao término da temporada, os <strong>4 primeiros colocados (1º ao 4º lugar) da Série B</strong> sobem automaticamente para o <strong>Brasileirão Série A</strong>, enquanto os <strong>4 últimos colocados da Série A (Z-4)</strong> são rebaixados para a Série B.
                </p>
              )}
            </div>
          )}

          {renderCompetitionSpecificRecord(userLeagueTournament.name, myLeagueMatches, true)}

          {renderStandingsTable(
            myLeagueStandings,
            `Classificação • ${userLeagueTournament.name}`,
            userLeagueTournament.description,
            userClub.leagueId === 'br_a'
              ? [
                  { label: 'G-4 CONMEBOL Libertadores', colorClass: 'bg-emerald-500' },
                  { label: 'Pré-Libertadores (5º-6º)', colorClass: 'bg-sky-400' },
                  { label: 'CONMEBOL Sul-Americana (7º-12º)', colorClass: 'bg-amber-400' },
                  { label: 'Zona de Rebaixamento Z-4 (Cai p/ Série B)', colorClass: 'bg-rose-500' }
                ]
              : userClub.leagueId === 'br_b'
              ? [
                  { label: 'G-4 Acesso à Série A (Sobe p/ Série A)', colorClass: 'bg-emerald-500' },
                  { label: 'Zona de Rebaixamento Z-4', colorClass: 'bg-rose-500' }
                ]
              : [
                  { label: 'UEFA Champions League (G-4)', colorClass: 'bg-blue-500' },
                  { label: 'UEFA Europa League (5º-6º)', colorClass: 'bg-orange-500' },
                  { label: 'Zona de Rebaixamento', colorClass: 'bg-rose-500' }
                ]
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION A2: COPA BETANO DO BRASIL (DEDICATED TAB) */}
      {/* =================================================================== */}
      {selectedSection === 'copa_do_brasil' && (
        <div className="space-y-5">
          {renderParticipationBanner(
            'Copa Betano do Brasil',
            cdbData.isUserParticipating,
            cdbData.isUserParticipating
              ? `O ${userClub.name} está disputando o mata-mata nacional da Copa Betano do Brasil (${cdbData.currentPhaseLabel})!`
              : cdbData.reasonIfNotParticipating,
            cdbData.isUserParticipating
              ? cdbData.currentPhaseLabel
              : 'Não está participando'
          )}

          {renderCompetitionSpecificRecord(
            'Copa Betano do Brasil',
            cdbData.userPlayedMatches,
            cdbData.isUserParticipating
          )}

          {cdbData.isUserParticipating &&
            renderUserFixturesSchedule('Copa Betano do Brasil', cdbData.userFixtures)}

          {renderKnockoutBracket(
            cdbData.ties,
            'Chaveamento da Copa Betano do Brasil (Oitavas, Quartas, Semifinais e Grande Final)'
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION B: UEFA CHAMPIONS LEAGUE */}
      {/* =================================================================== */}
      {selectedSection === 'champions' && (
        <div className="space-y-5">
          {renderParticipationBanner(
            'UEFA Champions League',
            uclData.isUserParticipating,
            uclData.isUserParticipating
              ? `O ${userClub.name} está disputando a UEFA Champions League nesta temporada!`
              : uclData.reasonIfNotParticipating,
            uclData.isUserParticipating
              ? uclData.roundsPlayed > 0
                ? `${
                    uclData.standings.find(r => r.club.id === userClub.id)?.position || '-'
                  }º na Fase de Liga`
                : '0 Jogos na Champions'
              : 'Não está participando'
          )}

          {renderCompetitionSpecificRecord(
            'UEFA Champions League',
            uclData.userPlayedMatches,
            uclData.isUserParticipating
          )}

          {uclData.isUserParticipating &&
            renderUserFixturesSchedule('UEFA Champions League', uclData.userFixtures)}

          {renderKnockoutBracket(
            uclData.knockoutTies,
            'Chaveamento da UEFA Champions League (Oitavas, Quartas, Semifinais e Final)'
          )}

          {renderStandingsTable(
            uclData.standings,
            'Classificação da UEFA Champions League • Fase de Liga',
            'Os 8 primeiros avançam direto às Oitavas de Final; do 9º ao 16º disputam os Playoffs das Oitavas.',
            [
              { label: 'Classificação Direta Oitavas (1º ao 8º)', colorClass: 'bg-blue-500' },
              { label: 'Playoffs das Oitavas (9º ao 16º)', colorClass: 'bg-sky-400' },
              { label: 'Eliminados (17º ao 24º)', colorClass: 'bg-rose-500' }
            ]
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION C: CONMEBOL LIBERTADORES */}
      {/* =================================================================== */}
      {selectedSection === 'libertadores' && (
        <div className="space-y-5">
          {renderParticipationBanner(
            'CONMEBOL Libertadores',
            libData.isUserParticipating,
            libData.isUserParticipating
              ? `O ${userClub.name} está no Grupo A em busca da Glória Eterna na CONMEBOL Libertadores!`
              : libData.reasonIfNotParticipating,
            libData.isUserParticipating
              ? libData.roundsPlayed > 0
                ? `${libData.roundsPlayed}J na Libertadores`
                : '0 Jogos na Libertadores'
              : 'Não está participando'
          )}

          {renderCompetitionSpecificRecord(
            'CONMEBOL Libertadores',
            libData.userPlayedMatches,
            libData.isUserParticipating
          )}

          {libData.isUserParticipating &&
            renderUserFixturesSchedule('CONMEBOL Libertadores', libData.userFixtures)}

          {renderKnockoutBracket(
            libData.knockoutTies,
            'Chaveamento da CONMEBOL Libertadores (Oitavas, Quartas, Semifinais e Final)'
          )}

          <div className="flex items-center justify-between flex-wrap gap-3 bg-neutral-900/80 p-3.5 rounded-2xl border border-neutral-800">
            <span className="text-xs font-bold text-neutral-300">
              Visualização da Fase de Grupos da Libertadores:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLibertadoresViewMode('groups')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                  libertadoresViewMode === 'groups'
                    ? 'bg-amber-500 text-neutral-950'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                Fase de Grupos (Grupos A a D)
              </button>
              <button
                type="button"
                onClick={() => setLibertadoresViewMode('overall')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                  libertadoresViewMode === 'overall'
                    ? 'bg-amber-500 text-neutral-950'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                Classificação Geral das Campanhas
              </button>
            </div>
          </div>

          {libertadoresViewMode === 'groups' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {libData.groups.map(grp => (
                <div key={grp.groupName}>
                  {renderStandingsTable(
                    grp.rows,
                    `CONMEBOL Libertadores • ${grp.groupName}`,
                    'Os 2 melhores de cada grupo avançam às Oitavas da Libertadores.',
                    [
                      { label: 'Oitavas da Libertadores (1º e 2º)', colorClass: 'bg-amber-400' },
                      { label: 'Playoffs Sul-Americana (3º)', colorClass: 'bg-sky-400' },
                      { label: 'Eliminado (4º)', colorClass: 'bg-rose-500' }
                    ]
                  )}
                </div>
              ))}
            </div>
          ) : (
            renderStandingsTable(
              libData.overallStandings,
              'Classificação Geral • CONMEBOL Libertadores',
              'Desempenho geral de todos os clubes participantes da Libertadores.',
              [
                { label: 'Classificados às Oitavas (Top 8)', colorClass: 'bg-amber-400' },
                { label: 'Eliminados', colorClass: 'bg-rose-500' }
              ]
            )
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION D: SUL-AMERICANA & EUROPA LEAGUE */}
      {/* =================================================================== */}
      {selectedSection === 'secondary_continental' && (
        <div className="space-y-6">
          <div className="space-y-4">
            {renderParticipationBanner(
              'CONMEBOL Sul-Americana',
              secContinental.sulamericana.isUserParticipating,
              secContinental.sulamericana.isUserParticipating
                ? `O ${userClub.name} está disputando a CONMEBOL Sul-Americana!`
                : secContinental.sulamericana.reasonIfNotParticipating,
              secContinental.sulamericana.isUserParticipating
                ? 'Participando'
                : 'Não está participando'
            )}

            {renderCompetitionSpecificRecord(
              'CONMEBOL Sul-Americana',
              secContinental.sulamericana.userPlayedMatches,
              secContinental.sulamericana.isUserParticipating
            )}

            {renderKnockoutBracket(
              secContinental.sulamericana.knockoutTies,
              'Chaveamento da CONMEBOL Sul-Americana (Oitavas, Quartas, Semifinais e Final)'
            )}

            {renderStandingsTable(
              secContinental.sulamericana.standings,
              'Classificação • CONMEBOL Sul-Americana',
              'A Grande Conquista do continente sul-americano.'
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-800">
            {renderParticipationBanner(
              'UEFA Europa League',
              secContinental.europaLeague.isUserParticipating,
              secContinental.europaLeague.isUserParticipating
                ? `O ${userClub.name} está disputando a UEFA Europa League!`
                : secContinental.europaLeague.reasonIfNotParticipating,
              secContinental.europaLeague.isUserParticipating
                ? 'Participando'
                : 'Não está participando'
            )}

            {renderCompetitionSpecificRecord(
              'UEFA Europa League',
              secContinental.europaLeague.userPlayedMatches,
              secContinental.europaLeague.isUserParticipating
            )}

            {renderKnockoutBracket(
              secContinental.europaLeague.knockoutTies,
              'Chaveamento da UEFA Europa League (Oitavas, Quartas, Semifinais e Final)'
            )}

            {renderStandingsTable(
              secContinental.europaLeague.standings,
              'Classificação • UEFA Europa League',
              'Fase de Liga da UEFA Europa League.'
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION E: COPA NACIONAL & CAMPEONATO ESTADUAL */}
      {/* =================================================================== */}
      {selectedSection === 'cup_state' && (
        <div className="space-y-6">
          {/* Domestic Cup */}
          <div className="space-y-4">
            {renderParticipationBanner(
              stateAndCup.domesticCup.tournament.name,
              stateAndCup.domesticCup.isParticipating,
              stateAndCup.domesticCup.isParticipating
                ? `O ${userClub.name} está disputando a ${stateAndCup.domesticCup.tournament.name} (${stateAndCup.domesticCup.currentPhaseLabel}).`
                : stateAndCup.domesticCup.reasonIfNotParticipating,
              stateAndCup.domesticCup.isParticipating
                ? stateAndCup.domesticCup.currentPhaseLabel
                : 'Não está participando'
            )}

            {renderCompetitionSpecificRecord(
              stateAndCup.domesticCup.tournament.name,
              stateAndCup.domesticCup.userPlayedMatches,
              stateAndCup.domesticCup.isParticipating
            )}

            {renderKnockoutBracket(
              stateAndCup.domesticCup.ties,
              `Chaveamento Completo • ${stateAndCup.domesticCup.tournament.name} (Oitavas, Quartas, Semifinais e Final)`
            )}
          </div>

          {/* State Championship */}
          <div className="space-y-4 pt-4 border-t border-neutral-800">
            {renderParticipationBanner(
              stateAndCup.stateChampionship.tournament?.name || 'Campeonato Estadual',
              stateAndCup.stateChampionship.isParticipating,
              stateAndCup.stateChampionship.isParticipating
                ? `O ${userClub.name} disputa o ${stateAndCup.stateChampionship.tournament?.name} nesta temporada.`
                : stateAndCup.stateChampionship.reasonIfNotParticipating,
              stateAndCup.stateChampionship.isParticipating
                ? `${stateAndCup.stateChampionship.userPlayedMatches.length}J no Estadual`
                : 'Não está participando'
            )}

            {renderCompetitionSpecificRecord(
              stateAndCup.stateChampionship.tournament?.name || 'Campeonato Estadual',
              stateAndCup.stateChampionship.userPlayedMatches,
              stateAndCup.stateChampionship.isParticipating
            )}

            {stateAndCup.stateChampionship.isParticipating &&
              stateAndCup.stateChampionship.standings.length > 0 &&
              renderStandingsTable(
                stateAndCup.stateChampionship.standings,
                `Classificação • ${stateAndCup.stateChampionship.tournament?.name}`,
                stateAndCup.stateChampionship.tournament?.description || '',
                [{ label: 'Classificados às Semifinais (G-4)', colorClass: 'bg-emerald-500' }]
              )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION F: TODAS AS LIGAS DO MUNDO */}
      {/* =================================================================== */}
      {selectedSection === 'world_leagues' && (
        <div className="space-y-5">
          <div className="bg-neutral-900/90 p-5 rounded-3xl border border-neutral-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
              Selecione uma Liga para Consultar a Tabela:
            </span>
            <div className="flex flex-wrap gap-2">
              {INITIAL_LEAGUES.map(lg => (
                <button
                  key={lg.id}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedLeagueId(lg.id);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${
                    selectedLeagueId === lg.id
                      ? 'bg-emerald-500 text-neutral-950 shadow-md'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                  }`}
                >
                  {lg.name} ({lg.country})
                </button>
              ))}
            </div>
          </div>

          {renderParticipationBanner(
            browsedLeagueObj?.name || 'Liga Nacional',
            isUserInBrowsedLeague,
            isUserInBrowsedLeague
              ? `O seu time (${userClub.name}) está participando desta liga nesta temporada.`
              : `O ${userClub.name} não está participando da ${
                  browsedLeagueObj?.name || 'desta liga'
                } (atualmente disputa a ${userLeagueTournament.name}).`,
            isUserInBrowsedLeague ? 'Participando' : 'Não está participando'
          )}

          {renderStandingsTable(
            browsedLeagueStandings,
            `Classificação • ${browsedLeagueObj?.name || 'Liga'}`,
            `Tabela oficial da temporada ${career.currentYear}`
          )}
        </div>
      )}
    </div>
  );
};
