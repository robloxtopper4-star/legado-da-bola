import { CareerSave, Club, PlayedMatchRecord } from '../types';
import { INITIAL_CLUBS } from '../data/database';
import {
  TOURNAMENTS,
  TournamentDetails,
  getClubLeagueTournament,
  getClubDomesticCupTournament,
  getClubContinentalTournament,
  getBrazilianClubStateTourney,
  clubHasCopaDoBrasil,
  getCompetitionBracketSeeds,
  syncClubsWithCareer
} from './competitionsEngine';

export interface StandingsRow {
  position: number;
  club: Club;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('V' | 'E' | 'D')[];
  zoneLabel?: string;
  zoneColor?: string;
  isUserClub: boolean;
}

export interface KnockoutTie {
  id: string;
  stageGroup: 'oitavas' | 'quartas' | 'semifinal' | 'final';
  stage: string;
  weekLabel: string;
  homeClub: Club;
  awayClub: Club;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
  winnerClubId?: string;
  isUserInvolved: boolean;
  userOutcome?: 'V' | 'E' | 'D';
}

export interface ScheduledCompetitionMatch {
  id: string;
  stageLabel: string;
  weekLabel: string;
  opponent: Club;
  playedMatch?: PlayedMatchRecord;
}

export interface CompetitionParticipationStatus {
  id: string;
  name: string;
  shortName: string;
  badgeIcon: string;
  category: 'league' | 'copa_do_brasil' | 'champions' | 'libertadores' | 'secondary_continental' | 'cup' | 'state' | 'world';
  isParticipating: boolean;
  statusText: string; // "Participando" or "Não está participando"
  reasonOrStage: string;
  userPositionLabel?: string;
}

// Deterministic pseudo-random generator seeded by string (only used for AI vs AI matches)
function seededRandom(seedStr: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Returns all real matches played by the user's club in the current season
 */
export function getUserSeasonMatches(career: CareerSave, userClubId: string): PlayedMatchRecord[] {
  const all = career.seasonMatchResults || [];
  return all.filter(m => m.seasonYear === career.currentYear && m.userClubId === userClubId);
}

/**
 * Generates a complete 16-club Knockout Bracket (8 Oitavas, 4 Quartas, 2 Semifinais, 1 Grande Final)
 * where the user's matchups in Oitavas (vs seeds[1]), Quartas (vs seeds[2]), Semifinal (vs seeds[4]), and Final (vs seeds[8])
 * are 100% identical to getScheduledFixture!
 */
function buildFull16ClubKnockoutBracket(
  seeds16: Club[],
  userClub: Club,
  isUserParticipating: boolean,
  userCompMatches: PlayedMatchRecord[],
  compPrefix: string,
  stageWeeks: {
    r16MinWeek: number;
    r16Label: string;
    qfMinWeek: number;
    qfLabel: string;
    sfMinWeek: number;
    sfLabel: string;
    finalMinWeek: number;
    finalLabel: string;
  }
): KnockoutTie[] {
  const ties: KnockoutTie[] = [];
  if (seeds16.length < 16) return ties;

  const findUserMatchVs = (oppId: string, minW: number, maxW: number) => {
    const matches = userCompMatches.filter(
      m => m.opponentClubId === oppId || (m.week >= minW && m.week <= maxW)
    );
    return matches.length > 0 ? matches[matches.length - 1] : undefined;
  };

  // 1. OITAVAS DE FINAL (8 confrontos: seeds[0] vs seeds[1], seeds[2] vs seeds[3], ..., seeds[14] vs seeds[15])
  for (let i = 0; i < 8; i++) {
    const home = seeds16[i * 2];
    const away = seeds16[i * 2 + 1];
    const isUserTie = isUserParticipating && (home.id === userClub.id || away.id === userClub.id);
    const userMatch = isUserTie
      ? findUserMatchVs(away.id, stageWeeks.r16MinWeek, stageWeeks.qfMinWeek - 1)
      : undefined;

    const aiPlayed = !isUserTie && userCompMatches.some(m => m.week >= stageWeeks.r16MinWeek);
    const played = isUserTie ? Boolean(userMatch) : aiPlayed;

    let hScore: number | null = null;
    let aScore: number | null = null;
    if (userMatch) {
      hScore = home.id === userClub.id ? userMatch.userGoalsFor : userMatch.userGoalsAgainst;
      aScore = away.id === userClub.id ? userMatch.userGoalsFor : userMatch.userGoalsAgainst;
    } else if (aiPlayed) {
      hScore = 2;
      aScore = i % 2;
    }

    ties.push({
      id: `${compPrefix}_r16_${i}`,
      stageGroup: 'oitavas',
      stage: `Oitavas de Final • Confronto ${i + 1}`,
      weekLabel: stageWeeks.r16Label,
      homeClub: home,
      awayClub: away,
      homeScore: hScore,
      awayScore: aScore,
      played,
      winnerClubId:
        played && hScore !== null && aScore !== null
          ? hScore >= aScore
            ? home.id
            : away.id
          : undefined,
      isUserInvolved: isUserTie,
      userOutcome: userMatch?.outcome
    });
  }

  // 2. QUARTAS DE FINAL (4 confrontos: seeds[0] vs seeds[2], seeds[4] vs seeds[6], seeds[8] vs seeds[10], seeds[12] vs seeds[14])
  const qfPairs: [Club, Club][] = [
    [seeds16[0], seeds16[2]],
    [seeds16[4], seeds16[6]],
    [seeds16[8], seeds16[10]],
    [seeds16[12], seeds16[14]]
  ];
  qfPairs.forEach(([home, away], i) => {
    const isUserTie = isUserParticipating && (home.id === userClub.id || away.id === userClub.id);
    const userMatch = isUserTie
      ? findUserMatchVs(away.id, stageWeeks.qfMinWeek, stageWeeks.sfMinWeek - 1)
      : undefined;

    const aiPlayed = !isUserTie && userCompMatches.some(m => m.week >= stageWeeks.qfMinWeek);
    const played = isUserTie ? Boolean(userMatch) : aiPlayed;

    let hScore: number | null = null;
    let aScore: number | null = null;
    if (userMatch) {
      hScore = home.id === userClub.id ? userMatch.userGoalsFor : userMatch.userGoalsAgainst;
      aScore = away.id === userClub.id ? userMatch.userGoalsFor : userMatch.userGoalsAgainst;
    } else if (aiPlayed) {
      hScore = 2;
      aScore = 1;
    }

    ties.push({
      id: `${compPrefix}_qf_${i}`,
      stageGroup: 'quartas',
      stage: `Quartas de Final • Confronto ${i + 1}`,
      weekLabel: stageWeeks.qfLabel,
      homeClub: home,
      awayClub: away,
      homeScore: hScore,
      awayScore: aScore,
      played,
      winnerClubId:
        played && hScore !== null && aScore !== null
          ? hScore >= aScore
            ? home.id
            : away.id
          : undefined,
      isUserInvolved: isUserTie,
      userOutcome: userMatch?.outcome
    });
  });

  // 3. SEMIFINAIS (2 confrontos: seeds[0] vs seeds[4], seeds[8] vs seeds[12])
  const sfPairs: [Club, Club][] = [
    [seeds16[0], seeds16[4]],
    [seeds16[8], seeds16[12]]
  ];
  sfPairs.forEach(([home, away], i) => {
    const isUserTie = isUserParticipating && (home.id === userClub.id || away.id === userClub.id);
    const userMatch = isUserTie
      ? findUserMatchVs(away.id, stageWeeks.sfMinWeek, stageWeeks.finalMinWeek - 1)
      : undefined;

    const aiPlayed = !isUserTie && userCompMatches.some(m => m.week >= stageWeeks.sfMinWeek);
    const played = isUserTie ? Boolean(userMatch) : aiPlayed;

    let hScore: number | null = null;
    let aScore: number | null = null;
    if (userMatch) {
      hScore = home.id === userClub.id ? userMatch.userGoalsFor : userMatch.userGoalsAgainst;
      aScore = away.id === userClub.id ? userMatch.userGoalsFor : userMatch.userGoalsAgainst;
    } else if (aiPlayed) {
      hScore = 2;
      aScore = 1;
    }

    ties.push({
      id: `${compPrefix}_sf_${i}`,
      stageGroup: 'semifinal',
      stage: `Semifinal • Confronto ${i + 1}`,
      weekLabel: stageWeeks.sfLabel,
      homeClub: home,
      awayClub: away,
      homeScore: hScore,
      awayScore: aScore,
      played,
      winnerClubId:
        played && hScore !== null && aScore !== null
          ? hScore >= aScore
            ? home.id
            : away.id
          : undefined,
      isUserInvolved: isUserTie,
      userOutcome: userMatch?.outcome
    });
  });

  // 4. GRANDE FINAL (1 confronto: seeds[0] vs seeds[8])
  const fHome = seeds16[0];
  const fAway = seeds16[8];
  const isUserFinal = isUserParticipating && (fHome.id === userClub.id || fAway.id === userClub.id);
  const userFinalMatch = isUserFinal
    ? findUserMatchVs(fAway.id, stageWeeks.finalMinWeek, 48)
    : undefined;
  const finalPlayed = isUserFinal
    ? Boolean(userFinalMatch)
    : userCompMatches.some(m => m.week >= stageWeeks.finalMinWeek);

  let fhScore: number | null = null;
  let faScore: number | null = null;
  if (userFinalMatch) {
    fhScore = fHome.id === userClub.id ? userFinalMatch.userGoalsFor : userFinalMatch.userGoalsAgainst;
    faScore = fAway.id === userClub.id ? userFinalMatch.userGoalsFor : userFinalMatch.userGoalsAgainst;
  } else if (finalPlayed) {
    fhScore = 2;
    faScore = 1;
  }

  ties.push({
    id: `${compPrefix}_final`,
    stageGroup: 'final',
    stage: '🏆 GRANDE FINAL',
    weekLabel: stageWeeks.finalLabel,
    homeClub: fHome,
    awayClub: fAway,
    homeScore: fhScore,
    awayScore: faScore,
    played: finalPlayed,
    winnerClubId:
      finalPlayed && fhScore !== null && faScore !== null
        ? fhScore >= faScore
          ? fHome.id
          : fAway.id
        : undefined,
    isUserInvolved: isUserFinal,
    userOutcome: userFinalMatch?.outcome
  });

  return ties;
}

/**
 * Generates a standings table where:
 * - If the user's club is in `clubs`, the user's row is 100% computed from `userMatchesForComp` (ONLY matches of this competition!).
 * - If the user hasn't played any match in this competition (`userMatchesForComp.length === 0`), `played` is 0 for ALL clubs in this table.
 * - Any opponent club in `clubs` that played against the user in this competition gets the exact mirror outcome of that match.
 */
export function buildStandingsForClubs(
  clubs: Club[],
  aiRoundsIfUserNotInTable: number,
  userClubId: string,
  career: CareerSave,
  competitionKey: string,
  getZoneInfo?: (pos: number, total: number) => { label?: string; color?: string },
  userMatchesForComp?: PlayedMatchRecord[]
): StandingsRow[] {
  const year = career.currentYear;
  const userInTable = clubs.some(c => c.id === userClubId);
  const actualUserMatches = userMatchesForComp || [];

  const effectiveRounds = userInTable
    ? actualUserMatches.length
    : Math.max(0, aiRoundsIfUserNotInTable);

  const rows: StandingsRow[] = clubs.map(club => {
    const isUser = club.id === userClubId;

    if (effectiveRounds === 0) {
      return {
        position: 1,
        club,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        form: [],
        isUserClub: isUser
      };
    }

    if (isUser) {
      let won = 0;
      let drawn = 0;
      let lost = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;
      const form: ('V' | 'E' | 'D')[] = [];

      actualUserMatches.forEach(m => {
        goalsFor += m.userGoalsFor;
        goalsAgainst += m.userGoalsAgainst;
        if (m.outcome === 'V') {
          won += 1;
          form.push('V');
        } else if (m.outcome === 'E') {
          drawn += 1;
          form.push('E');
        } else {
          lost += 1;
          form.push('D');
        }
      });

      const played = actualUserMatches.length;
      const points = won * 3 + drawn;
      const goalDifference = goalsFor - goalsAgainst;

      return {
        position: 1,
        club,
        played,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference,
        points,
        form: form.slice(-5),
        isUserClub: true
      };
    }

    // AI CLUBS: First apply exact mirror results of any matches played against the user in this competition
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    const form: ('V' | 'E' | 'D')[] = [];

    const matchesVsUser = userInTable
      ? actualUserMatches.filter(m => m.opponentClubId === club.id)
      : [];

    matchesVsUser.forEach(m => {
      const aiGf = m.userGoalsAgainst;
      const aiGa = m.userGoalsFor;
      goalsFor += aiGf;
      goalsAgainst += aiGa;
      if (aiGf > aiGa) {
        won += 1;
        form.push('V');
      } else if (aiGf === aiGa) {
        drawn += 1;
        form.push('E');
      } else {
        lost += 1;
        form.push('D');
      }
    });

    const remainingAiRounds = Math.max(0, effectiveRounds - matchesVsUser.length);
    const baseStrength =
      club.attackRating * 0.38 + club.midfieldRating * 0.32 + club.defenseRating * 0.3;

    for (let r = 1; r <= remainingAiRounds; r++) {
      const rSeed = `${year}_${competitionKey}_${club.id}_r${r}`;
      const rand1 = seededRandom(rSeed + '_res');
      const rand2 = seededRandom(rSeed + '_gf');
      const rand3 = seededRandom(rSeed + '_ga');

      const winProb = Math.min(0.68, Math.max(0.2, (baseStrength - 52) / 54));
      const drawProb = 0.27;

      if (rand1 < winProb) {
        won += 1;
        const gf = 1 + Math.floor(rand2 * (baseStrength >= 82 ? 2.8 : 2.1));
        const ga = Math.min(gf - 1, Math.floor(rand3 * 1.6));
        goalsFor += gf;
        goalsAgainst += ga;
        form.push('V');
      } else if (rand1 < winProb + drawProb) {
        drawn += 1;
        const g = Math.floor(rand2 * 2.2);
        goalsFor += g;
        goalsAgainst += g;
        form.push('E');
      } else {
        lost += 1;
        const ga = 1 + Math.floor(rand3 * (baseStrength < 72 ? 2.6 : 2.0));
        const gf = Math.min(ga - 1, Math.floor(rand2 * 1.5));
        goalsFor += gf;
        goalsAgainst += ga;
        form.push('D');
      }
    }

    const played = won + drawn + lost;
    const points = won * 3 + drawn;
    const goalDifference = goalsFor - goalsAgainst;

    return {
      position: 1,
      club,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
      form: form.slice(-5),
      isUserClub: false
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (a.played === 0 && b.played === 0) {
      if (a.isUserClub) return -1;
      if (b.isUserClub) return 1;
    }
    return a.club.name.localeCompare(b.club.name);
  });

  const total = rows.length;
  rows.forEach((row, idx) => {
    row.position = idx + 1;
    if (getZoneInfo) {
      const z = getZoneInfo(row.position, total);
      row.zoneLabel = z.label;
      row.zoneColor = z.color;
    }
  });

  return rows;
}

/**
 * Returns how many rounds of a given league have been played based strictly on league matches played
 */
export function getLeagueRoundsPlayed(
  leagueId: string,
  _currentWeek: number,
  career?: CareerSave,
  userClub?: Club
): number {
  if (career && userClub) {
    const allUserMatches = getUserSeasonMatches(career, userClub.id);
    const leagueOnlyMatches = allUserMatches.filter(m => m.tournamentCategory === 'league');
    return leagueOnlyMatches.length;
  }
  return 0;
}

/**
 * Zone colors & labels for domestic leagues
 */
export function getDomesticLeagueZone(
  leagueId: string,
  pos: number,
  total: number
): { label?: string; color?: string } {
  if (leagueId === 'br_a') {
    if (pos <= 4) {
      return {
        label: 'Fase de Grupos da Libertadores (G-4)',
        color: 'bg-emerald-500 text-neutral-950'
      };
    }
    if (pos <= 6) {
      return {
        label: 'Pré-Libertadores (G-6)',
        color: 'bg-sky-400 text-neutral-950'
      };
    }
    if (pos <= 12) {
      return {
        label: 'CONMEBOL Sul-Americana',
        color: 'bg-amber-400 text-neutral-950'
      };
    }
    if (pos > total - 4) {
      return {
        label: 'Zona de Rebaixamento (Z-4)',
        color: 'bg-rose-500 text-white'
      };
    }
    return {};
  }

  if (leagueId === 'br_b') {
    if (pos <= 4) {
      return {
        label: 'Acesso à Série A (G-4)',
        color: 'bg-emerald-500 text-neutral-950'
      };
    }
    if (pos > total - 4) {
      return {
        label: 'Zona de Rebaixamento (Z-4)',
        color: 'bg-rose-500 text-white'
      };
    }
    return {};
  }

  if (pos <= 4) {
    return {
      label: 'UEFA Champions League',
      color: 'bg-blue-500 text-white'
    };
  }
  if (pos <= 6) {
    return {
      label: 'UEFA Europa League',
      color: 'bg-orange-500 text-neutral-950'
    };
  }
  if (pos > total - 3) {
    return {
      label: 'Zona de Rebaixamento',
      color: 'bg-rose-500 text-white'
    };
  }
  return {};
}

/**
 * Generates the National League Standings for any leagueId (STRICTLY using only matches of that league!)
 */
export function getDomesticLeagueStandings(
  leagueId: string,
  userClub: Club,
  career: CareerSave
): StandingsRow[] {
  syncClubsWithCareer(career);
  let clubs = INITIAL_CLUBS.filter(c => c.leagueId === leagueId);
  if (clubs.length === 0) {
    clubs = INITIAL_CLUBS.filter(c => c.country === userClub.country);
  }
  const isUserInThisLeague = userClub.leagueId === leagueId;
  if (isUserInThisLeague && !clubs.some(c => c.id === userClub.id)) {
    clubs = [userClub, ...clubs];
  }

  const allUserMatches = getUserSeasonMatches(career, userClub.id);
  // STRICT: Only matches where tournamentCategory === 'league'
  const userLeagueMatches = isUserInThisLeague
    ? allUserMatches.filter(m => m.tournamentCategory === 'league')
    : [];

  const aiRounds = allUserMatches.filter(m => m.tournamentCategory === 'league').length;

  return buildStandingsForClubs(
    clubs,
    aiRounds,
    isUserInThisLeague ? userClub.id : '__none__',
    career,
    `league_${leagueId}`,
    (pos, tot) => getDomesticLeagueZone(leagueId, pos, tot),
    userLeagueMatches
  );
}

/**
 * Generates UEFA Champions League Standings (League Phase) and Full 16-Team Knockout Bracket
 * (Oitavas, Quartas, Semifinais, Final) 100% synchronized with getScheduledFixture
 */
export function getChampionsLeagueData(userClub: Club, career: CareerSave): {
  isUserParticipating: boolean;
  reasonIfNotParticipating: string;
  roundsPlayed: number;
  standings: StandingsRow[];
  knockoutTies: KnockoutTie[];
  userFixtures: ScheduledCompetitionMatch[];
  userPlayedMatches: PlayedMatchRecord[];
} {
  const brackets = getCompetitionBracketSeeds(userClub);
  const uclBracket = brackets.ucl;
  const isUserParticipating = uclBracket.isUserParticipating;
  const userContinental = getClubContinentalTournament(userClub);

  let reasonIfNotParticipating = '';
  if (!isUserParticipating) {
    if (
      ['Brasil', 'Argentina', 'Uruguai', 'Colômbia', 'Equador', 'Chile'].includes(userClub.country)
    ) {
      reasonIfNotParticipating = `O ${userClub.name} pertence à América do Sul (${userClub.country}) e por isso disputa competições da CONMEBOL, não participando da UEFA Champions League.`;
    } else if (
      ['Estados Unidos', 'Arábia Saudita', 'México', 'Japão', 'Egito'].includes(userClub.country)
    ) {
      reasonIfNotParticipating = `O ${userClub.name} (${userClub.country}) não pertence à UEFA e não disputa a UEFA Champions League.`;
    } else if (userContinental?.id === 'europa_league') {
      reasonIfNotParticipating = `O ${userClub.name} não se classificou para a UEFA Champions League nesta temporada (está disputando a UEFA Europa League).`;
    } else {
      reasonIfNotParticipating = `O ${userClub.name} não obteve vaga para a UEFA Champions League nesta temporada.`;
    }
  }

  const allUserMatches = getUserSeasonMatches(career, userClub.id);
  // STRICT: Only UEFA Champions League matches
  const userUclMatches = allUserMatches.filter(m => m.tournamentId === 'champions_league');

  const roundsPlayed = isUserParticipating ? userUclMatches.length : 0;

  const standings = buildStandingsForClubs(
    uclBracket.pool24,
    roundsPlayed,
    isUserParticipating ? userClub.id : '__none__',
    career,
    'ucl_league_phase',
    pos => {
      if (pos <= 8) {
        return {
          label: 'Classificado Direto às Oitavas (Top 8)',
          color: 'bg-blue-500 text-white'
        };
      }
      if (pos <= 16) {
        return {
          label: 'Classificado aos Playoffs / Oitavas',
          color: 'bg-sky-400 text-neutral-950'
        };
      }
      return {
        label: 'Zona de Eliminação',
        color: 'bg-rose-500/80 text-white'
      };
    },
    userUclMatches
  );

  const knockoutTies = buildFull16ClubKnockoutBracket(
    uclBracket.seeds16,
    userClub,
    isUserParticipating,
    userUclMatches,
    'ucl',
    {
      r16MinWeek: 6,
      r16Label: 'Semanas 6 e 10',
      qfMinWeek: 18,
      qfLabel: 'Semanas 18 e 22',
      sfMinWeek: 30,
      sfLabel: 'Semanas 30 e 34',
      finalMinWeek: 44,
      finalLabel: 'Semana 44'
    }
  );

  const userFixtures: ScheduledCompetitionMatch[] = isUserParticipating
    ? [
        {
          id: 'ucl_r16',
          stageLabel: 'Oitavas de Final (Ida / Volta)',
          weekLabel: 'Semanas 6 e 10',
          opponent: uclBracket.r16Opponent,
          playedMatch: userUclMatches.filter(m => m.week === 6 || m.week === 10).slice(-1)[0]
        },
        {
          id: 'ucl_qf',
          stageLabel: 'Quartas de Final (Ida / Volta)',
          weekLabel: 'Semanas 18 e 22',
          opponent: uclBracket.qfOpponent,
          playedMatch: userUclMatches.filter(m => m.week === 18 || m.week === 22).slice(-1)[0]
        },
        {
          id: 'ucl_sf',
          stageLabel: 'Semifinal (Ida / Volta)',
          weekLabel: 'Semanas 30 e 34',
          opponent: uclBracket.sfOpponent,
          playedMatch: userUclMatches.filter(m => m.week === 30 || m.week === 34).slice(-1)[0]
        },
        {
          id: 'ucl_final',
          stageLabel: '🏆 Grande Final',
          weekLabel: 'Semana 44',
          opponent: uclBracket.finalOpponent,
          playedMatch: userUclMatches.find(m => m.week === 44)
        }
      ]
    : [];

  return {
    isUserParticipating,
    reasonIfNotParticipating,
    roundsPlayed,
    standings,
    knockoutTies,
    userFixtures,
    userPlayedMatches: userUclMatches
  };
}

/**
 * Generates CONMEBOL Libertadores Data (Groups A-D + General Standings + Full 16-Team Knockout Bracket)
 * 100% synchronized with getScheduledFixture
 */
export function getLibertadoresData(userClub: Club, career: CareerSave): {
  isUserParticipating: boolean;
  reasonIfNotParticipating: string;
  roundsPlayed: number;
  groups: { groupName: string; rows: StandingsRow[] }[];
  overallStandings: StandingsRow[];
  knockoutTies: KnockoutTie[];
  userFixtures: ScheduledCompetitionMatch[];
  userPlayedMatches: PlayedMatchRecord[];
} {
  const brackets = getCompetitionBracketSeeds(userClub);
  const libBracket = brackets.libertadores;
  const isUserParticipating = libBracket.isUserParticipating;
  const userContinental = getClubContinentalTournament(userClub);

  let reasonIfNotParticipating = '';
  if (!isUserParticipating) {
    if (
      !['Brasil', 'Argentina', 'Uruguai', 'Colômbia', 'Equador', 'Chile'].includes(
        userClub.country
      )
    ) {
      reasonIfNotParticipating = `O ${userClub.name} (${userClub.country}) pertence a outro continente e não disputa a CONMEBOL Libertadores.`;
    } else if (userContinental?.id === 'sulamericana') {
      reasonIfNotParticipating = `O ${userClub.name} não se classificou para a Libertadores nesta temporada (está disputando a CONMEBOL Sul-Americana).`;
    } else if (userClub.leagueId === 'br_b') {
      reasonIfNotParticipating = `O ${userClub.name} está no Brasileirão Série B e não conquistou vaga para a CONMEBOL Libertadores nesta temporada.`;
    } else {
      reasonIfNotParticipating = `O ${userClub.name} não está classificado para a CONMEBOL Libertadores nesta temporada.`;
    }
  }

  const allUserMatches = getUserSeasonMatches(career, userClub.id);
  // STRICT: Only CONMEBOL Libertadores matches
  const userLibMatches = allUserMatches.filter(m => m.tournamentId === 'libertadores');
  const roundsPlayed = isUserParticipating ? userLibMatches.length : 0;

  const pool16 = libBracket.pool16;
  const groupNames = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D'];
  const groups = groupNames.map((groupName, gIdx) => {
    const groupClubs = pool16.slice(gIdx * 4, gIdx * 4 + 4);
    const rows = buildStandingsForClubs(
      groupClubs,
      roundsPlayed,
      isUserParticipating ? userClub.id : '__none__',
      career,
      `lib_grp_${gIdx}`,
      pos => {
        if (pos <= 2) {
          return {
            label: 'Classificado às Oitavas da Libertadores',
            color: 'bg-amber-400 text-neutral-950'
          };
        }
        if (pos === 3) {
          return {
            label: 'Playoffs da Sul-Americana (3º)',
            color: 'bg-sky-400 text-neutral-950'
          };
        }
        return {
          label: 'Eliminado na Fase de Grupos',
          color: 'bg-rose-500/80 text-white'
        };
      },
      userLibMatches
    );
    return { groupName, rows };
  });

  const overallStandings = buildStandingsForClubs(
    pool16,
    roundsPlayed,
    isUserParticipating ? userClub.id : '__none__',
    career,
    'lib_overall',
    pos => {
      if (pos <= 8) {
        return {
          label: 'Classificado às Oitavas (Top 8)',
          color: 'bg-amber-400 text-neutral-950'
        };
      }
      return {
        label: 'Eliminado',
        color: 'bg-rose-500/80 text-white'
      };
    },
    userLibMatches
  );

  const knockoutTies = buildFull16ClubKnockoutBracket(
    libBracket.seeds16,
    userClub,
    isUserParticipating,
    userLibMatches,
    'lib',
    {
      r16MinWeek: 7,
      r16Label: 'Semanas 7 e 11',
      qfMinWeek: 18,
      qfLabel: 'Semanas 18 e 24',
      sfMinWeek: 30,
      sfLabel: 'Semanas 30 e 38',
      finalMinWeek: 43,
      finalLabel: 'Semana 43'
    }
  );

  const userFixtures: ScheduledCompetitionMatch[] = isUserParticipating
    ? [
        {
          id: 'lib_r16',
          stageLabel: 'Oitavas de Final (Ida / Volta)',
          weekLabel: 'Semanas 7 e 11',
          opponent: libBracket.r16Opponent,
          playedMatch: userLibMatches.filter(m => m.week === 7 || m.week === 11).slice(-1)[0]
        },
        {
          id: 'lib_qf',
          stageLabel: 'Quartas de Final (Ida / Volta)',
          weekLabel: 'Semanas 18 e 24',
          opponent: libBracket.qfOpponent,
          playedMatch: userLibMatches.filter(m => m.week === 18 || m.week === 24).slice(-1)[0]
        },
        {
          id: 'lib_sf',
          stageLabel: 'Semifinal (Ida / Volta)',
          weekLabel: 'Semanas 30 e 38',
          opponent: libBracket.sfOpponent,
          playedMatch: userLibMatches.filter(m => m.week === 30 || m.week === 38).slice(-1)[0]
        },
        {
          id: 'lib_final',
          stageLabel: '🏆 Grande Final (Glória Eterna)',
          weekLabel: 'Semana 43',
          opponent: libBracket.finalOpponent,
          playedMatch: userLibMatches.find(m => m.week === 43)
        }
      ]
    : [];

  return {
    isUserParticipating,
    reasonIfNotParticipating,
    roundsPlayed,
    groups,
    overallStandings,
    knockoutTies,
    userFixtures,
    userPlayedMatches: userLibMatches
  };
}

/**
 * Generates Secondary Continental Data (CONMEBOL Sul-Americana & UEFA Europa League)
 */
export function getSecondaryContinentalData(userClub: Club, career: CareerSave): {
  sulamericana: {
    isUserParticipating: boolean;
    reasonIfNotParticipating: string;
    standings: StandingsRow[];
    knockoutTies: KnockoutTie[];
    userPlayedMatches: PlayedMatchRecord[];
  };
  europaLeague: {
    isUserParticipating: boolean;
    reasonIfNotParticipating: string;
    standings: StandingsRow[];
    knockoutTies: KnockoutTie[];
    userPlayedMatches: PlayedMatchRecord[];
  };
} {
  const brackets = getCompetitionBracketSeeds(userClub);
  const userContinental = getClubContinentalTournament(userClub);
  const isUserSula = brackets.sulamericana.isUserParticipating;
  const isUserEuropa = brackets.europa.isUserParticipating;

  const allUserMatches = getUserSeasonMatches(career, userClub.id);
  const userSulaMatches = allUserMatches.filter(m => m.tournamentId === 'sulamericana');
  const userEuropaMatches = allUserMatches.filter(m => m.tournamentId === 'europa_league');

  const sulaStandings = buildStandingsForClubs(
    brackets.sulamericana.pool16,
    isUserSula ? userSulaMatches.length : 0,
    isUserSula ? userClub.id : '__none__',
    career,
    'sulamericana_table',
    pos =>
      pos <= 8
        ? { label: 'Classificado às Oitavas da Sul-Americana', color: 'bg-emerald-500 text-neutral-950' }
        : { label: 'Eliminado', color: 'bg-rose-500/80 text-white' },
    userSulaMatches
  );

  const sulaKnockoutTies = buildFull16ClubKnockoutBracket(
    brackets.sulamericana.seeds16,
    userClub,
    isUserSula,
    userSulaMatches,
    'sula',
    {
      r16MinWeek: 7,
      r16Label: 'Semanas 7 e 11',
      qfMinWeek: 18,
      qfLabel: 'Semanas 18 e 24',
      sfMinWeek: 30,
      sfLabel: 'Semanas 30 e 38',
      finalMinWeek: 43,
      finalLabel: 'Semana 43'
    }
  );

  const europaStandings = buildStandingsForClubs(
    brackets.europa.pool16,
    isUserEuropa ? userEuropaMatches.length : 0,
    isUserEuropa ? userClub.id : '__none__',
    career,
    'europa_league_table',
    pos =>
      pos <= 8
        ? { label: 'Classificado às Oitavas da Europa League', color: 'bg-orange-500 text-neutral-950' }
        : { label: 'Eliminado', color: 'bg-rose-500/80 text-white' },
    userEuropaMatches
  );

  const europaKnockoutTies = buildFull16ClubKnockoutBracket(
    brackets.europa.seeds16,
    userClub,
    isUserEuropa,
    userEuropaMatches,
    'europa',
    {
      r16MinWeek: 6,
      r16Label: 'Semanas 6 e 10',
      qfMinWeek: 18,
      qfLabel: 'Semanas 18 e 22',
      sfMinWeek: 30,
      sfLabel: 'Semanas 30 e 34',
      finalMinWeek: 44,
      finalLabel: 'Semana 44'
    }
  );

  return {
    sulamericana: {
      isUserParticipating: isUserSula,
      reasonIfNotParticipating: isUserSula
        ? ''
        : userContinental?.id === 'libertadores'
        ? `O ${userClub.name} já está disputando a CONMEBOL Libertadores nesta temporada.`
        : `O ${userClub.name} não está participando da CONMEBOL Sul-Americana nesta temporada.`,
      standings: sulaStandings,
      knockoutTies: sulaKnockoutTies,
      userPlayedMatches: userSulaMatches
    },
    europaLeague: {
      isUserParticipating: isUserEuropa,
      reasonIfNotParticipating: isUserEuropa
        ? ''
        : userContinental?.id === 'champions_league'
        ? `O ${userClub.name} já está disputando a UEFA Champions League nesta temporada.`
        : `O ${userClub.name} não está participando da UEFA Europa League nesta temporada.`,
      standings: europaStandings,
      knockoutTies: europaKnockoutTies,
      userPlayedMatches: userEuropaMatches
    }
  };
}

/**
 * Generates State Championship (Estadual) and Domestic Cup (Copa do Brasil / FA Cup / etc.) Data
 */
export function getStateAndCupData(userClub: Club, career: CareerSave): {
  stateChampionship: {
    isParticipating: boolean;
    tournament: TournamentDetails | null;
    reasonIfNotParticipating: string;
    standings: StandingsRow[];
    userPlayedMatches: PlayedMatchRecord[];
  };
  domesticCup: {
    isParticipating: boolean;
    tournament: TournamentDetails;
    reasonIfNotParticipating: string;
    currentPhaseLabel: string;
    ties: KnockoutTie[];
    userPlayedMatches: PlayedMatchRecord[];
  };
} {
  const brackets = getCompetitionBracketSeeds(userClub);
  const allUserMatches = getUserSeasonMatches(career, userClub.id);
  // STRICT: Only state matches for Estadual, and only cup matches for Copa Nacional
  const userStateMatches = allUserMatches.filter(m => m.tournamentCategory === 'state');
  const userCupMatches = allUserMatches.filter(m => m.tournamentCategory === 'cup');

  // 1. State Championship
  const stateId =
    userClub.country === 'Brasil' ? getBrazilianClubStateTourney(userClub.id, userClub) : null;
  const stateTourney = stateId && TOURNAMENTS[stateId] ? TOURNAMENTS[stateId] : null;

  let stateStandings: StandingsRow[] = [];
  if (stateTourney && stateId) {
    let stateClubs = INITIAL_CLUBS.filter(
      c => c.country === 'Brasil' && getBrazilianClubStateTourney(c.id, c) === stateId
    );
    if (!stateClubs.some(c => c.id === userClub.id)) {
      stateClubs.unshift(userClub);
    }
    stateStandings = buildStandingsForClubs(
      stateClubs,
      userStateMatches.length,
      userClub.id,
      career,
      `state_${stateId}`,
      pos =>
        pos <= 4
          ? {
              label: 'Classificado às Semifinais do Estadual (G-4)',
              color: 'bg-emerald-500 text-neutral-950'
            }
          : {},
      userStateMatches
    );
  }

  // 2. Domestic Cup (Full 16-team bracket: Oitavas, Quartas, Semifinal, Final)
  const cupTourney = getClubDomesticCupTournament(userClub);
  const isParticipatingCup = brackets.cup.isUserParticipating;
  const isBrazil = userClub.country === 'Brasil';

  const cupTies = buildFull16ClubKnockoutBracket(
    brackets.cup.seeds16,
    userClub,
    isParticipatingCup,
    userCupMatches,
    'cup',
    isBrazil
      ? {
          r16MinWeek: 6,
          r16Label: 'Semanas 6 e 10',
          qfMinWeek: 22,
          qfLabel: 'Semana 22',
          sfMinWeek: 28,
          sfLabel: 'Semanas 28 e 36',
          finalMinWeek: 44,
          finalLabel: 'Semana 44'
        }
      : {
          r16MinWeek: 8,
          r16Label: 'Semanas 8 e 16',
          qfMinWeek: 24,
          qfLabel: 'Semana 24',
          sfMinWeek: 32,
          sfLabel: 'Semana 32',
          finalMinWeek: 42,
          finalLabel: 'Semana 42'
        }
  );

  const currentPhaseLabel =
    userCupMatches.length === 0
      ? `Próximo: vs ${brackets.cup.r16Opponent.shortName || brackets.cup.r16Opponent.name}`
      : `${userCupMatches.length} Jogo(s) Disputado(s)`;

  return {
    stateChampionship: {
      isParticipating: Boolean(stateTourney),
      tournament: stateTourney,
      reasonIfNotParticipating:
        userClub.country !== 'Brasil'
          ? `O ${userClub.name} (${userClub.country}) não disputa Campeonatos Estaduais brasileiros.`
          : `O ${userClub.name} não está participando de Campeonato Estadual nesta temporada.`,
      standings: stateStandings,
      userPlayedMatches: userStateMatches
    },
    domesticCup: {
      isParticipating: isParticipatingCup,
      tournament: cupTourney,
      reasonIfNotParticipating: isParticipatingCup
        ? ''
        : `O ${userClub.name} não obteve índice técnico para disputar a ${cupTourney.name} nesta temporada.`,
      currentPhaseLabel,
      ties: cupTies,
      userPlayedMatches: userCupMatches
    }
  };
}

/**
 * Generates dedicated Copa Betano do Brasil data (Full 16-team bracket: Oitavas, Quartas, Semifinal, Final)
 */
export function getCopaDoBrasilData(userClub: Club, career: CareerSave): {
  isUserParticipating: boolean;
  tournament: TournamentDetails;
  reasonIfNotParticipating: string;
  currentPhaseLabel: string;
  ties: KnockoutTie[];
  userFixtures: ScheduledCompetitionMatch[];
  userPlayedMatches: PlayedMatchRecord[];
} {
  syncClubsWithCareer(career);
  const brackets = getCompetitionBracketSeeds(userClub);
  const cdbBracket = brackets.copaDoBrasil;
  const isUserParticipating = cdbBracket.isUserParticipating;
  const allUserMatches = getUserSeasonMatches(career, userClub.id);
  const userCdbMatches = allUserMatches.filter(m => m.tournamentId === 'copa_brasil');

  const ties = buildFull16ClubKnockoutBracket(
    cdbBracket.seeds16,
    userClub,
    isUserParticipating,
    userCdbMatches,
    'cdb',
    {
      r16MinWeek: 6,
      r16Label: 'Semanas 6 e 10',
      qfMinWeek: 22,
      qfLabel: 'Semana 22',
      sfMinWeek: 28,
      sfLabel: 'Semanas 28 e 36',
      finalMinWeek: 44,
      finalLabel: 'Semana 44'
    }
  );

  const findMatchForStage = (oppId: string, minW: number, maxW: number) => {
    const matches = userCdbMatches.filter(
      m => m.opponentClubId === oppId || (m.week >= minW && m.week <= maxW)
    );
    return matches.length > 0 ? matches[matches.length - 1] : undefined;
  };

  const userFixtures: ScheduledCompetitionMatch[] = isUserParticipating
    ? [
        {
          id: 'cdb_uf_1',
          stageLabel: 'Oitavas de Final (Ida / Volta)',
          weekLabel: 'Semanas 6 e 10',
          opponent: cdbBracket.r16Opponent,
          playedMatch: findMatchForStage(cdbBracket.r16Opponent.id, 6, 15)
        },
        {
          id: 'cdb_uf_2',
          stageLabel: 'Quartas de Final',
          weekLabel: 'Semana 22',
          opponent: cdbBracket.qfOpponent,
          playedMatch: findMatchForStage(cdbBracket.qfOpponent.id, 16, 25)
        },
        {
          id: 'cdb_uf_3',
          stageLabel: 'Semifinal (Ida / Volta)',
          weekLabel: 'Semanas 28 e 36',
          opponent: cdbBracket.sfOpponent,
          playedMatch: findMatchForStage(cdbBracket.sfOpponent.id, 26, 39)
        },
        {
          id: 'cdb_uf_4',
          stageLabel: 'Grande Final da Copa do Brasil',
          weekLabel: 'Semana 44',
          opponent: cdbBracket.finalOpponent,
          playedMatch: findMatchForStage(cdbBracket.finalOpponent.id, 40, 48)
        }
      ]
    : [];

  const currentPhaseLabel = !isUserParticipating
    ? 'Não está participando'
    : userCdbMatches.length === 0
    ? `Próximo: Oitavas vs ${cdbBracket.r16Opponent.shortName || cdbBracket.r16Opponent.name}`
    : `${userCdbMatches.length} Jogo(s) na Copa do Brasil`;

  return {
    isUserParticipating,
    tournament: TOURNAMENTS.copa_brasil,
    reasonIfNotParticipating: isUserParticipating
      ? ''
      : `O ${userClub.name} pertence a outro país (${userClub.country}) e não disputa a Copa Betano do Brasil.`,
    currentPhaseLabel,
    ties,
    userFixtures,
    userPlayedMatches: userCdbMatches
  };
}

/**
 * Returns the complete participation summary of the user's current club across ALL major competitions
 */
export function getClubCompetitionsOverview(
  userClub: Club,
  career: CareerSave
): CompetitionParticipationStatus[] {
  syncClubsWithCareer(career);
  const leagueTourney = getClubLeagueTournament(userClub);
  const leagueStandings = getDomesticLeagueStandings(userClub.leagueId, userClub, career);
  const userLeagueRow = leagueStandings.find(r => r.club.id === userClub.id);

  const cdbData = getCopaDoBrasilData(userClub, career);
  const uclData = getChampionsLeagueData(userClub, career);
  const userUclRow = uclData.standings.find(r => r.club.id === userClub.id);

  const libData = getLibertadoresData(userClub, career);
  const userLibRow = libData.overallStandings.find(r => r.club.id === userClub.id);

  const secData = getSecondaryContinentalData(userClub, career);
  const stateAndCup = getStateAndCupData(userClub, career);
  const userStateRow = stateAndCup.stateChampionship.standings.find(r => r.club.id === userClub.id);

  const playsClubWorldCup = userClub.prestige >= 5;

  const formatRowSummary = (row?: StandingsRow) => {
    if (!row || row.played === 0) {
      return '0 pts • 0J (0V 0E 0D • Ainda não jogou nesta competição)';
    }
    return `${row.position}º colocado • ${row.points} pts (${row.played}J: ${row.won}V ${row.drawn}E ${row.lost}D)`;
  };

  return [
    {
      id: 'league',
      name: leagueTourney.name,
      shortName: leagueTourney.shortName,
      badgeIcon: leagueTourney.badgeIcon,
      category: 'league',
      isParticipating: true,
      statusText: 'Participando',
      reasonOrStage: formatRowSummary(userLeagueRow),
      userPositionLabel:
        userLeagueRow && userLeagueRow.played > 0
          ? `${userLeagueRow.position}º Lugar (${userLeagueRow.played}J)`
          : '0 Jogos nesta competição'
    },
    {
      id: 'copa_do_brasil',
      name: TOURNAMENTS.copa_brasil.name,
      shortName: 'COPA DO BRASIL',
      badgeIcon: '🔰',
      category: 'copa_do_brasil',
      isParticipating: cdbData.isUserParticipating,
      statusText: cdbData.isUserParticipating ? 'Participando' : 'Não está participando',
      reasonOrStage: cdbData.isUserParticipating
        ? cdbData.currentPhaseLabel
        : cdbData.reasonIfNotParticipating,
      userPositionLabel: cdbData.isUserParticipating
        ? `${cdbData.userPlayedMatches.length}J Disputado(s)`
        : undefined
    },
    {
      id: 'champions',
      name: TOURNAMENTS.champions_league.name,
      shortName: 'CHAMPIONS LEAGUE',
      badgeIcon: '🌟',
      category: 'champions',
      isParticipating: uclData.isUserParticipating,
      statusText: uclData.isUserParticipating ? 'Participando' : 'Não está participando',
      reasonOrStage: uclData.isUserParticipating
        ? formatRowSummary(userUclRow)
        : uclData.reasonIfNotParticipating,
      userPositionLabel:
        uclData.isUserParticipating && userUclRow && userUclRow.played > 0
          ? `${userUclRow.position}º Lugar (${userUclRow.played}J)`
          : uclData.isUserParticipating
          ? '0 Jogos nesta competição'
          : undefined
    },
    {
      id: 'libertadores',
      name: TOURNAMENTS.libertadores.name,
      shortName: 'LIBERTADORES',
      badgeIcon: '⭐',
      category: 'libertadores',
      isParticipating: libData.isUserParticipating,
      statusText: libData.isUserParticipating ? 'Participando' : 'Não está participando',
      reasonOrStage: libData.isUserParticipating
        ? formatRowSummary(userLibRow)
        : libData.reasonIfNotParticipating,
      userPositionLabel:
        libData.isUserParticipating && userLibRow && userLibRow.played > 0
          ? `${userLibRow.position}º Geral (${userLibRow.played}J)`
          : libData.isUserParticipating
          ? '0 Jogos nesta competição'
          : undefined
    },
    {
      id: 'secondary_continental',
      name:
        userClub.country === 'Brasil' ||
        ['Argentina', 'Uruguai', 'Colômbia', 'Equador'].includes(userClub.country)
          ? TOURNAMENTS.sulamericana.name
          : TOURNAMENTS.europa_league.name,
      shortName:
        userClub.country === 'Brasil' ||
        ['Argentina', 'Uruguai', 'Colômbia', 'Equador'].includes(userClub.country)
          ? 'SUL-AMERICANA'
          : 'EUROPA LEAGUE',
      badgeIcon:
        userClub.country === 'Brasil' ||
        ['Argentina', 'Uruguai', 'Colômbia', 'Equador'].includes(userClub.country)
          ? '🥈'
          : '🟠',
      category: 'secondary_continental',
      isParticipating:
        secData.sulamericana.isUserParticipating || secData.europaLeague.isUserParticipating,
      statusText:
        secData.sulamericana.isUserParticipating || secData.europaLeague.isUserParticipating
          ? 'Participando'
          : 'Não está participando',
      reasonOrStage: secData.sulamericana.isUserParticipating
        ? formatRowSummary(secData.sulamericana.standings.find(r => r.club.id === userClub.id))
        : secData.europaLeague.isUserParticipating
        ? formatRowSummary(secData.europaLeague.standings.find(r => r.club.id === userClub.id))
        : userClub.country === 'Brasil' ||
          ['Argentina', 'Uruguai', 'Colômbia', 'Equador'].includes(userClub.country)
        ? secData.sulamericana.reasonIfNotParticipating
        : secData.europaLeague.reasonIfNotParticipating
    },
    {
      id: 'cup',
      name: stateAndCup.domesticCup.tournament.name,
      shortName: stateAndCup.domesticCup.tournament.shortName,
      badgeIcon: '🏆',
      category: 'cup',
      isParticipating: stateAndCup.domesticCup.isParticipating,
      statusText: stateAndCup.domesticCup.isParticipating
        ? 'Participando'
        : 'Não está participando',
      reasonOrStage: stateAndCup.domesticCup.isParticipating
        ? stateAndCup.domesticCup.currentPhaseLabel
        : stateAndCup.domesticCup.reasonIfNotParticipating,
      userPositionLabel: stateAndCup.domesticCup.isParticipating
        ? stateAndCup.domesticCup.currentPhaseLabel
        : undefined
    },
    {
      id: 'state',
      name: stateAndCup.stateChampionship.tournament
        ? stateAndCup.stateChampionship.tournament.name
        : 'Campeonato Estadual / Regional',
      shortName: stateAndCup.stateChampionship.tournament
        ? stateAndCup.stateChampionship.tournament.shortName
        : 'ESTADUAL',
      badgeIcon: stateAndCup.stateChampionship.tournament?.badgeIcon || '🏅',
      category: 'state',
      isParticipating: stateAndCup.stateChampionship.isParticipating,
      statusText: stateAndCup.stateChampionship.isParticipating
        ? 'Participando'
        : 'Não está participando',
      reasonOrStage: stateAndCup.stateChampionship.isParticipating
        ? formatRowSummary(userStateRow)
        : stateAndCup.stateChampionship.reasonIfNotParticipating,
      userPositionLabel:
        stateAndCup.stateChampionship.isParticipating && userStateRow && userStateRow.played > 0
          ? `${userStateRow.position}º Lugar (${userStateRow.played}J)`
          : stateAndCup.stateChampionship.isParticipating
          ? '0 Jogos nesta competição'
          : undefined
    },
    {
      id: 'world',
      name: TOURNAMENTS.mundial_clubes.name,
      shortName: 'MUNDIAL DE CLUBES',
      badgeIcon: '🌍',
      category: 'world',
      isParticipating: playsClubWorldCup,
      statusText: playsClubWorldCup ? 'Participando' : 'Não está participando',
      reasonOrStage: playsClubWorldCup
        ? 'Classificado para o Mundial de Clubes da FIFA (Semanas 47-48)'
        : `O ${userClub.name} precisa conquistar a Libertadores ou a Champions League para disputar o Mundial de Clubes da FIFA.`
    }
  ];
}
