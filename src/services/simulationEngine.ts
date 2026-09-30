import { 
  PlayerProfile, 
  Club, 
  MatchSimulationResult, 
  MatchEvent, 
  CareerSave, 
  SeasonStats, 
  NewsItem, 
  SocialPost
} from '../types';
import { calculateSeasonAwards, evaluateEndOfSeason } from './awardsEngine';
import { generateTransferOffers } from './transferEngine';
import { calculateMarketValue } from '../utils/calculator';
import {
  getScheduledFixture,
  applyBrazilianPromotionRelegation,
  syncClubsWithCareer
} from '../utils/competitionsEngine';
import { getDomesticLeagueStandings } from '../utils/standingsGenerator';

export function simulateMatch(
  player: PlayerProfile,
  userClub: Club,
  opponentClub: Club,
  competitionName: string,
  isHome: boolean,
  isDecisiveMatch: boolean = false
): MatchSimulationResult {
  // Team strengths
  const homeAdvantage = isHome ? 4 : -4;
  const userTeamPower = ((userClub.attackRating + userClub.midfieldRating + userClub.defenseRating) / 3) + (isHome ? 3 : 0);
  const oppTeamPower = ((opponentClub.attackRating + opponentClub.midfieldRating + opponentClub.defenseRating) / 3) + (!isHome ? 3 : 0);

  // Player starting probability based on role and coach trust
  const startingChance = player.squadRole === 'Titular' || player.squadRole === 'Estrela' || player.squadRole === 'Capitão'
    ? 0.95
    : player.squadRole === 'Rotação'
    ? 0.65
    : player.squadRole === 'Promessa'
    ? 0.40
    : 0.20;

  const playerStarted = !player.isInjured && (Math.random() < Math.min(0.98, startingChance + (player.coachTrust / 200)));
  const playerMinutes = player.isInjured
    ? 0
    : playerStarted
    ? (Math.random() > 0.3 ? 90 : Math.floor(65 + Math.random() * 20))
    : (Math.random() > 0.4 ? Math.floor(15 + Math.random() * 25) : 0);

  // Calculate scores (realistic football distribution ~1.1-1.4 goals per team)
  const baseChance = (userTeamPower - oppTeamPower + homeAdvantage) / 28;
  let homeGoals = Math.max(0, Math.round((Math.random() * 1.75) + (isHome ? baseChance : -baseChance)));
  let awayGoals = Math.max(0, Math.round((Math.random() * 1.65) + (!isHome ? baseChance : -baseChance)));

  const userGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;

  // Individual player performance factors
  const formBonus = (player.form - 50) / 40;
  const moraleBonus = player.morale === 'Excelente' ? 0.3 : player.morale === 'Boa' ? 0.15 : player.morale === 'Baixa' ? -0.2 : player.morale === 'Péssima' ? -0.4 : 0;
  const effectiveOvr = player.ovr + formBonus + (moraleBonus * 5);

  let playerGoals = 0;
  let playerAssists = 0;
  let playerYellow = 0;
  let playerRed = 0;
  let playerSaves = 0;
  let playerTackles = 0;
  let playerKeyPasses = 0;
  let playerShots = 0;

  const events: MatchEvent[] = [];

  // Generate general match narrative events
  const totalGoals = homeGoals + awayGoals;
  const goalMinutes: { minute: number; team: 'home' | 'away' }[] = [];

  for (let i = 0; i < homeGoals; i++) {
    goalMinutes.push({ minute: Math.floor(5 + Math.random() * 85), team: 'home' });
  }
  for (let i = 0; i < awayGoals; i++) {
    goalMinutes.push({ minute: Math.floor(5 + Math.random() * 85), team: 'away' });
  }
  goalMinutes.sort((a, b) => a.minute - b.minute);

  // If player played minutes
  if (playerMinutes > 0 && !player.isInjured) {
    // Probability of scoring based on position & OVR
    let goalProbPerUserGoal = 0.05;
    let assistProbPerUserGoal = 0.1;

    switch (player.primaryPosition) {
      case 'ATA':
        goalProbPerUserGoal = 0.45 + (effectiveOvr - 75) * 0.012;
        assistProbPerUserGoal = 0.20;
        playerShots = Math.floor(1 + Math.random() * 4);
        break;
      case 'PE':
      case 'PD':
        goalProbPerUserGoal = 0.30 + (effectiveOvr - 75) * 0.01;
        assistProbPerUserGoal = 0.30 + (effectiveOvr - 75) * 0.01;
        playerShots = Math.floor(1 + Math.random() * 3);
        break;
      case 'MEI':
        goalProbPerUserGoal = 0.22;
        assistProbPerUserGoal = 0.38 + (effectiveOvr - 75) * 0.012;
        playerKeyPasses = Math.floor(2 + Math.random() * 4);
        break;
      case 'MC':
      case 'VOL':
        goalProbPerUserGoal = 0.08;
        assistProbPerUserGoal = 0.20;
        playerTackles = Math.floor(2 + Math.random() * 5);
        playerKeyPasses = Math.floor(1 + Math.random() * 3);
        break;
      case 'LE':
      case 'LD':
        goalProbPerUserGoal = 0.05;
        assistProbPerUserGoal = 0.25;
        playerTackles = Math.floor(2 + Math.random() * 4);
        break;
      case 'ZAG':
        goalProbPerUserGoal = 0.04; // Corner header
        assistProbPerUserGoal = 0.03;
        playerTackles = Math.floor(3 + Math.random() * 6);
        break;
      case 'GOL':
        goalProbPerUserGoal = 0.0;
        assistProbPerUserGoal = 0.0;
        playerSaves = Math.floor(2 + Math.random() * 6);
        break;
    }

    // Allocate goals and assists
    const userTeamScored = userGoals;
    for (let g = 0; g < userTeamScored; g++) {
      if (Math.random() < goalProbPerUserGoal && playerGoals + playerAssists < userTeamScored) {
        playerGoals++;
      } else if (Math.random() < assistProbPerUserGoal && playerGoals + playerAssists < userTeamScored) {
        playerAssists++;
      }
    }

    // Disciplinary cards
    if (Math.random() < 0.15) {
      playerYellow = 1;
      if (Math.random() < 0.03) playerRed = 1;
    }
  }

  // Injury chance (2%)
  let injuryOccurred: { name: string; weeks: number } | undefined = undefined;
  if (playerMinutes > 0 && Math.random() < 0.025) {
    const injuries = [
      { name: 'Estiramento muscular na coxa', weeks: 2 },
      { name: 'Entorse no tornozelo', weeks: 3 },
      { name: 'Contusão no joelho', weeks: 4 },
      { name: 'Fadiga muscular severa', weeks: 1 }
    ];
    injuryOccurred = injuries[Math.floor(Math.random() * injuries.length)];
  }

  // Populate narrative events
  let playerAssignedGoals = playerGoals;
  let playerAssignedAssists = playerAssists;

  goalMinutes.forEach(({ minute, team }) => {
    const isUserTeam = (team === 'home' && isHome) || (team === 'away' && !isHome);
    const scoringClub = team === 'home' ? userClub.name : opponentClub.name;

    if (isUserTeam && playerMinutes > 0) {
      if (playerAssignedGoals > 0) {
        playerAssignedGoals--;
        events.push({
          minute,
          type: 'goal',
          description: `${minute}' — GOOOOOL! ${player.shirtName} recebe na medida, limpa o marcador e manda no ângulo! O estádio explode!`,
          isPlayerInvolved: true
        });
        return;
      } else if (playerAssignedAssists > 0) {
        playerAssignedAssists--;
        events.push({
          minute,
          type: 'assist',
          description: `${minute}' — GOOOL! Passe magistral de ${player.shirtName} desmontando a linha defensiva para o companheiro só empurrar!`,
          isPlayerInvolved: true
        });
        return;
      }
    }

    events.push({
      minute,
      type: isUserTeam ? 'goal' : 'opponent_goal',
      description: `${minute}' — Gol marcado por ${isUserTeam ? userClub.shortName : opponentClub.shortName}! Jogada veloz pela ponta e cabeceio firme.`,
      isPlayerInvolved: false
    });
  });

  // Add card events if player got booked
  if (playerYellow) {
    const min = Math.floor(10 + Math.random() * 75);
    events.push({
      minute: min,
      type: 'yellow_card',
      description: `${min}' — Cartão amarelo para ${player.shirtName} por falta tática no meio de campo.`,
      isPlayerInvolved: true
    });
  }

  // Add injury event if occurred
  if (injuryOccurred) {
    events.push({
      minute: Math.floor(40 + Math.random() * 40),
      type: 'injury',
      description: `Atenção: ${player.shirtName} sente dores intensas após dividida e pede substituição imediata (${injuryOccurred.name}).`,
      isPlayerInvolved: true
    });
  }

  // Sort events by minute
  events.sort((a, b) => a.minute - b.minute);

  // Player Match Rating (4.0 to 10.0)
  let rating = 6.0;
  if (playerMinutes > 0) {
    rating += (effectiveOvr - 70) * 0.05;
    rating += playerGoals * 1.5;
    rating += playerAssists * 1.0;
    if (userGoals > oppGoals) rating += 0.5;
    if (userGoals < oppGoals) rating -= 0.5;
    if (playerYellow) rating -= 0.3;
    if (playerRed) rating -= 2.0;
    if (player.primaryPosition === 'GOL' && oppGoals === 0) rating += 1.2;
    if (player.primaryPosition === 'ZAG' && oppGoals === 0) rating += 0.8;
  } else {
    rating = 0; // Did not play
  }

  rating = Math.max(4.0, Math.min(10.0, Math.round(rating * 10) / 10));

  // Energy stamina drain
  const playerEnergyCost = playerMinutes > 60 ? Math.floor(15 + Math.random() * 10) : Math.floor(6 + Math.random() * 8);

  // Summary narrative (100% accurate to Win, Draw, or Loss)
  let summaryNarrative = '';
  if (userGoals > oppGoals) {
    if (playerMinutes === 0) {
      summaryNarrative = `VITÓRIA DO ${userClub.name.toUpperCase()} (${userGoals}x${oppGoals})! ${player.shirtName} permaneceu no banco de reservas durante a vitória da equipe.`;
    } else if (playerGoals >= 2) {
      summaryNarrative = `VITÓRIA DO ${userClub.name.toUpperCase()} (${userGoals}x${oppGoals})! Atuação monumental de ${player.shirtName} com ${playerGoals} gols marcados!`;
    } else if (playerGoals === 1) {
      summaryNarrative = `VITÓRIA DO ${userClub.name.toUpperCase()} (${userGoals}x${oppGoals})! ${player.shirtName} balançou as redes e garantiu os 3 pontos para a equipe!`;
    } else {
      summaryNarrative = `VITÓRIA DO ${userClub.name.toUpperCase()} por ${userGoals} a ${oppGoals} sobre o ${opponentClub.name}, com participação consistente de ${player.shirtName}.`;
    }
  } else if (userGoals === oppGoals) {
    if (playerMinutes === 0) {
      summaryNarrative = `EMPATE EM ${userGoals} A ${oppGoals}! ${player.shirtName} permaneceu no banco de reservas no empate diante do ${opponentClub.name}.`;
    } else if (playerGoals >= 1) {
      summaryNarrative = `EMPATE EM ${userGoals} A ${oppGoals}! ${player.shirtName} deixou sua marca com ${playerGoals} gol(s), e as equipes dividiram os pontos.`;
    } else {
      summaryNarrative = `EMPATE EM ${userGoals} A ${oppGoals}! Confronto equilibrado entre ${userClub.name} e ${opponentClub.name}, somando 1 ponto na tabela.`;
    }
  } else {
    if (playerMinutes === 0) {
      summaryNarrative = `DERROTA POR ${oppGoals} A ${userGoals}. ${player.shirtName} permaneceu no banco de reservas no revés diante do ${opponentClub.name}.`;
    } else if (playerGoals >= 1) {
      summaryNarrative = `DERROTA POR ${oppGoals} A ${userGoals}. Apesar do(s) ${playerGoals} gol(s) de ${player.shirtName}, o ${userClub.name} foi superado pelo ${opponentClub.name}.`;
    } else {
      summaryNarrative = `DERROTA POR ${oppGoals} A ${userGoals}. O ${userClub.name} foi superado pelo ${opponentClub.name} e buscará a reabilitação na próxima rodada.`;
    }
  }

  return {
    matchId: 'match_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    competitionName,
    homeClub: isHome ? userClub : opponentClub,
    awayClub: isHome ? opponentClub : userClub,
    homeScore: homeGoals,
    awayScore: awayGoals,
    isPlayerHome: isHome,
    playerStarted,
    playerMinutes,
    playerRating: rating,
    playerGoals,
    playerAssists,
    playerYellowCards: playerYellow,
    playerRedCards: playerRed,
    playerShots,
    playerKeyPasses,
    playerTackles,
    playerEnergyCost,
    events,
    injuryOccurred,
    summaryNarrative
  };
}

export interface SeasonKeyMoment {
  week: number;
  headline: string;
  isHighlight: boolean;
  scoreStr: string;
  opponentName: string;
  playerContribution: string;
}

export interface FullSeasonSimulationSummary {
  seasonYear: number;
  club: Club;
  matchesPlayed: number;
  goalsScored: number;
  assistsGiven: number;
  avgRating: number;
  cleanSheets: number;
  teamWins: number;
  teamDraws: number;
  teamLosses: number;
  points: number;
  leaguePosition: number;
  trophiesWon: string[];
  awardsWon: string[];
  transfersOffersReceived: number;
  trainingPointsEarned: number;
  keyMoments: SeasonKeyMoment[];
  updatedCareer: CareerSave;
}

export function simulateFullSeason(
  career: CareerSave,
  allClubs: Club[]
): FullSeasonSimulationSummary {
  const currentClub = allClubs.find(c => c.id === career.player.contract.clubId) || allClubs[0];
  const leagueClubs = allClubs.filter(c => c.leagueId === currentClub.leagueId && c.id !== currentClub.id);
  const rivalClubs = leagueClubs.length > 0 ? leagueClubs : allClubs.filter(c => c.id !== currentClub.id);

  let tempPlayer = { ...career.player, attributes: { ...career.player.attributes } };
  let startWeek = career.currentWeek;
  const endWeek = 48;
  const totalWeeksToSim = Math.max(1, endWeek - startWeek + 1);

  let seasonMatchesPlayed = 0;
  let seasonGoals = 0;
  let seasonAssists = 0;
  let totalRatingSum = 0;
  let seasonCleanSheets = 0;
  let teamWins = 0;
  let teamDraws = 0;
  let teamLosses = 0;
  let trainingPointsEarned = 0;

  const keyMoments: SeasonKeyMoment[] = [];
  const generatedNews: NewsItem[] = [];
  const generatedTweets: SocialPost[] = [];

  // Standings tracker
  const standingsMap = new Map<string, { points: number; won: number; drawn: number; lost: number; gf: number; ga: number }>();
  for (const s of career.leagueStandings) {
    standingsMap.set(s.clubId, {
      points: s.points,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      gf: s.goalsFor,
      ga: s.goalsAgainst
    });
  }

  // Ensure current club is in standings map and seeded with already-played matches this season
  const priorSeasonMatches = (career.seasonMatchResults || []).filter(
    m => m.seasonYear === career.currentYear && m.userClubId === currentClub.id
  );
  const priorWins = priorSeasonMatches.filter(m => m.outcome === 'V').length;
  const priorDraws = priorSeasonMatches.filter(m => m.outcome === 'E').length;
  const priorLosses = priorSeasonMatches.filter(m => m.outcome === 'D').length;
  const priorGf = priorSeasonMatches.reduce((acc, m) => acc + m.userGoalsFor, 0);
  const priorGa = priorSeasonMatches.reduce((acc, m) => acc + m.userGoalsAgainst, 0);

  teamWins += priorWins;
  teamDraws += priorDraws;
  teamLosses += priorLosses;

  if (!standingsMap.has(currentClub.id)) {
    standingsMap.set(currentClub.id, {
      points: priorWins * 3 + priorDraws,
      won: priorWins,
      drawn: priorDraws,
      lost: priorLosses,
      gf: priorGf,
      ga: priorGa
    });
  }

  // Simulate week by week
  for (let week = startWeek; week <= endWeek; week++) {
    // Weekly training recovery & skill point
    tempPlayer.energy = Math.min(100, tempPlayer.energy + 25);
    tempPlayer.trainingPoints += 1;
    trainingPointsEarned += 1;

    // Pick authentic tournament fixture and opponent
    const fixture = getScheduledFixture(currentClub, week);
    const opponent = fixture.opponent;
    const isHome = fixture.isHome;
    const isDecisive = fixture.isDecisive;
    const competitionName = fixture.competitionName;

    // Simulate match
    const result = simulateMatch(tempPlayer, currentClub, opponent, competitionName, isHome, isDecisive);

    // Track player stats
    if (result.playerMinutes > 0) {
      seasonMatchesPlayed += 1;
      seasonGoals += result.playerGoals;
      seasonAssists += result.playerAssists;
      totalRatingSum += result.playerRating;
      if (tempPlayer.primaryPosition === 'GOL' && (isHome ? result.awayScore : result.homeScore) === 0) {
        seasonCleanSheets += 1;
      }
    }

    // Track team result
    const userGoals = isHome ? result.homeScore : result.awayScore;
    const oppGoals = isHome ? result.awayScore : result.homeScore;

    const currStat = standingsMap.get(currentClub.id) || { points: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
    currStat.gf += userGoals;
    currStat.ga += oppGoals;

    if (userGoals > oppGoals) {
      teamWins += 1;
      currStat.won += 1;
      currStat.points += 3;
    } else if (userGoals === oppGoals) {
      teamDraws += 1;
      currStat.drawn += 1;
      currStat.points += 1;
    } else {
      teamLosses += 1;
      currStat.lost += 1;
    }
    standingsMap.set(currentClub.id, currStat);

    // Simulate other clubs results lightly
    for (const rival of rivalClubs) {
      const rStat = standingsMap.get(rival.id) || { points: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
      const rRoll = Math.random();
      if (rRoll > 0.45) {
        rStat.won += 1;
        rStat.points += 3;
        rStat.gf += Math.floor(1 + Math.random() * 3);
      } else if (rRoll > 0.25) {
        rStat.drawn += 1;
        rStat.points += 1;
        rStat.gf += 1;
        rStat.ga += 1;
      } else {
        rStat.lost += 1;
        rStat.ga += Math.floor(1 + Math.random() * 2);
      }
      standingsMap.set(rival.id, rStat);
    }

    // Highlight key moments (hat tricks, decisive goals, big derbies)
    if (result.playerGoals >= 2 || (result.playerGoals === 1 && userGoals > oppGoals) || result.playerRating >= 8.5) {
      keyMoments.push({
        week,
        headline: result.playerGoals >= 2
          ? `Espetáculo de ${tempPlayer.shirtName}: ${result.playerGoals} gols contra ${opponent.name}!`
          : `Gol decisivo de ${tempPlayer.shirtName} contra o ${opponent.name}!`,
        isHighlight: true,
        scoreStr: `${result.homeScore} x ${result.awayScore}`,
        opponentName: opponent.name,
        playerContribution: `${result.playerGoals}G ${result.playerAssists}A • Nota ${result.playerRating.toFixed(1)}`
      });
    }

    // Weekly player fatigue & slight form fluctuation
    tempPlayer.energy = Math.max(40, tempPlayer.energy - result.playerEnergyCost);
    tempPlayer.form = Math.min(99, Math.max(50, tempPlayer.form + (result.playerRating >= 7.0 ? 3 : -2)));
  }

  // Calculate season final stats
  const avgRating = seasonMatchesPlayed > 0 ? Math.round((totalRatingSum / seasonMatchesPlayed) * 10) / 10 : 6.0;

  // Build updated standings list sorted by points
  const updatedStandings = Array.from(standingsMap.entries())
    .map(([clubId, data]) => {
      const c = allClubs.find(club => club.id === clubId);
      return {
        clubId,
        clubName: c ? c.name : 'Clube',
        points: data.points,
        played: data.won + data.drawn + data.lost,
        won: data.won,
        drawn: data.drawn,
        lost: data.lost,
        goalsFor: data.gf,
        goalsAgainst: data.ga
      };
    })
    .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));

  // Determine league position
  const leaguePosIndex = updatedStandings.findIndex(s => s.clubId === currentClub.id);
  const leaguePosition = leaguePosIndex >= 0 ? leaguePosIndex + 1 : 1;

  // Evaluate End of Season Trophies and Awards
  const completedSeasonStats: SeasonStats = {
    seasonYear: career.currentYear,
    clubId: currentClub.id,
    clubName: currentClub.name,
    matches: seasonMatchesPlayed,
    starts: Math.round(seasonMatchesPlayed * 0.9),
    minutes: seasonMatchesPlayed * 80,
    goals: seasonGoals,
    assists: seasonAssists,
    yellowCards: 2,
    redCards: 0,
    avgRating,
    cleanSheets: seasonCleanSheets,
    trophiesWon: [],
    awardsWon: []
  };

  const endOfSeasonEval = evaluateEndOfSeason(
    tempPlayer,
    completedSeasonStats,
    currentClub.tier,
    currentClub.leagueId,
    career.currentYear
  );

  // If won league by position
  const finalTrophies = [...endOfSeasonEval.trophiesWon];
  if (leaguePosition === 1 && !finalTrophies.some(t => t.includes(currentClub.leagueId))) {
    finalTrophies.unshift(`Campeão do(a) ${currentClub.leagueId}`);
  }
  completedSeasonStats.trophiesWon = finalTrophies;

  // Calculate individual awards
  const seasonAwardsCalculated = calculateSeasonAwards(tempPlayer, career.currentYear);
  const finalAwards = [...endOfSeasonEval.awardsWon, ...seasonAwardsCalculated.map(a => a.name)];
  // Remove duplicates
  const uniqueAwards = Array.from(new Set(finalAwards));
  completedSeasonStats.awardsWon = uniqueAwards;

  // Update Player Career totals
  tempPlayer.careerMatches += seasonMatchesPlayed;
  tempPlayer.careerGoals += seasonGoals;
  tempPlayer.careerAssists += seasonAssists;
  tempPlayer.careerTrophies += finalTrophies.length;
  tempPlayer.careerAwards += uniqueAwards.length;
  tempPlayer.age += 1; // Season rollover aging

  let promotionNews: NewsItem | null = null;
  if (tempPlayer.isYouthAcademy) {
    if (tempPlayer.age >= 18) {
      tempPlayer.isYouthAcademy = false;
      tempPlayer.youthCategory = undefined;
      // Strip (BASE) from contract club name
      tempPlayer.contract.clubName = tempPlayer.contract.clubName.replace(/\s*\(BASE\)/gi, '').trim();
      tempPlayer.contract.weeklyWage = Math.max(tempPlayer.contract.weeklyWage * 3, 2500);
      tempPlayer.squadRole = tempPlayer.ovr >= 74 ? 'Titular' : 'Rotação';
      promotionNews = {
        id: 'news_pro_promo_' + Date.now(),
        dateStr: `Temporada ${career.currentYear + 1} • Início`,
        headline: `PROFISSIONALIZOU! ${tempPlayer.shirtName.toUpperCase()} COMPLETA 18 ANOS E SOBE AO ELENCO PRINCIPAL!`,
        snippet: `Após atingir a maioridade de 18 anos, a revelação foi oficialmente promovida da Categoria de Base para o elenco profissional do ${tempPlayer.contract.clubName}.`,
        category: 'award'
      };
    } else {
      tempPlayer.youthCategory = tempPlayer.age <= 15 ? 'Sub-15' : 'Sub-17';
    }
  }

  if (tempPlayer.contract.yearsRemaining > 0) {
    tempPlayer.contract.yearsRemaining -= 1;
  }

  // Bonus earnings calculation
  const seasonEarnings = (tempPlayer.contract.weeklyWage * 48) +
    (seasonGoals * tempPlayer.contract.bonusPerGoal) +
    (seasonCleanSheets * tempPlayer.contract.bonusPerCleanSheet);
  tempPlayer.careerEarnings += seasonEarnings;

  // Potential progression based on performance
  if (avgRating >= 7.3 && seasonMatchesPlayed >= 18) {
    tempPlayer.ovr = Math.min(tempPlayer.potential, tempPlayer.ovr + (tempPlayer.age <= 22 ? 2 : 1));
  } else if (tempPlayer.age >= 33) {
    // Natural athletic decline past 33
    tempPlayer.ovr = Math.max(65, tempPlayer.ovr - 1);
  }

  // Update market value
  tempPlayer.marketValue = calculateMarketValue(
    tempPlayer.ovr,
    tempPlayer.potential,
    tempPlayer.age,
    tempPlayer.contract.yearsRemaining
  );

  // Generate transfer offers for the new season
  const freshOffers = generateTransferOffers(tempPlayer, allClubs);

  // Construct updated trophy and award cabinets
  const newTrophies = [
    ...career.trophyCabinet,
    ...finalTrophies.map(t => ({
      name: t,
      year: career.currentYear,
      club: currentClub.name,
      icon: '🏆'
    }))
  ];

  const newAwards = [
    ...career.awardsCabinet,
    ...uniqueAwards.map(a => ({
      name: a,
      year: career.currentYear,
      description: `Premiação conquistada com a camisa do ${currentClub.name} na temporada ${career.currentYear}.`
    }))
  ];

  // News item celebrating season conclusion
  const seasonNews: NewsItem = {
    id: 'news_season_' + Date.now(),
    dateStr: `Fim de Temporada, ${career.currentYear}`,
    headline: `Temporada ${career.currentYear} Concluída: ${tempPlayer.shirtName} encerra o ano com ${seasonGoals} gols e nota ${avgRating}!`,
    snippet: `O ${currentClub.name} finalizou sua campanha na ${leaguePosition}ª colocação. A diretoria e comissão técnica elogiaram o empenho e evolução do atleta.`,
    category: 'award'
  };

  // Execute official promotion (G-4 of Série B -> Série A) and relegation (Z-4 of Série A -> Série B)
  syncClubsWithCareer(career);
  const finalSerieAStandings = getDomesticLeagueStandings('br_a', currentClub, career);
  const finalSerieBStandings = getDomesticLeagueStandings('br_b', currentClub, career);
  const promoResult = applyBrazilianPromotionRelegation(
    career.clubLeagueOverrides,
    career.currentYear,
    currentClub.id,
    leaguePosition,
    finalSerieAStandings.map(r => r.club.id),
    finalSerieBStandings.map(r => r.club.id)
  );

  if (promoResult.userPromoted) {
    keyMoments.unshift({
      week: 48,
      headline: `⬆️ ACESSO HISTÓRICO! Terminou em ${leaguePosition}º lugar na Série B e subiu para o Brasileirão Série A!`,
      isHighlight: true,
      scoreStr: 'SÉRIE A',
      opponentName: 'Acesso Garantido (G-4)',
      playerContribution: `Subiram: ${promoResult.promotedNames.join(', ')}`
    });
  } else if (promoResult.userRelegated) {
    keyMoments.unshift({
      week: 48,
      headline: `⬇️ Rebaixado para a Série B após terminar na ${leaguePosition}ª posição da Série A.`,
      isHighlight: true,
      scoreStr: 'SÉRIE B',
      opponentName: 'Rebaixamento (Z-4)',
      playerContribution: `Caíram: ${promoResult.relegatedNames.join(', ')}`
    });
  }

  // New Save
  const nextYear = career.currentYear + 1;
  const updatedCareer: CareerSave = {
    ...career,
    currentYear: nextYear,
    currentWeek: 1,
    totalSeasonsPlayed: career.totalSeasonsPlayed + 1,
    player: tempPlayer,
    leagueStandings: updatedStandings.map(s => ({
      ...s,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0
    })),
    history: [completedSeasonStats, ...career.history],
    trophyCabinet: newTrophies,
    awardsCabinet: newAwards,
    activeOffers: freshOffers,
    seasonMatchResults: [],
    clubLeagueOverrides: promoResult.updatedOverrides,
    lastPromotionRelegation: {
      seasonYear: career.currentYear,
      promotedToSerieA: promoResult.promotedNames,
      relegatedToSerieB: promoResult.relegatedNames,
      userPromoted: promoResult.userPromoted,
      userRelegated: promoResult.userRelegated
    },
    news: promotionNews
      ? [promotionNews, promoResult.newsItem, seasonNews, ...career.news.slice(0, 15)]
      : [promoResult.newsItem, seasonNews, ...career.news.slice(0, 15)],
    socialPosts: [
      {
        id: 'tweet_season_' + Date.now(),
        authorHandle: `@${currentClub.shortName}Oficial`,
        authorName: currentClub.name,
        authorAvatar: '🛡️',
        content: `Encerrada a temporada ${career.currentYear}! Obrigado pelo apoio incondicional da torcida e parabéns a ${tempPlayer.shirtName} pela grande entrega em campo! ⚽👏`,
        likes: 1240,
        retweets: 380,
        sentiment: 'positive',
        timestamp: 'Há 1 dia'
      },
      ...career.socialPosts.slice(0, 15)
    ]
  };

  return {
    seasonYear: career.currentYear,
    club: currentClub,
    matchesPlayed: seasonMatchesPlayed,
    goalsScored: seasonGoals,
    assistsGiven: seasonAssists,
    avgRating,
    cleanSheets: seasonCleanSheets,
    teamWins,
    teamDraws,
    teamLosses,
    points: (teamWins * 3) + teamDraws,
    leaguePosition,
    trophiesWon: finalTrophies,
    awardsWon: uniqueAwards,
    transfersOffersReceived: freshOffers.length,
    trainingPointsEarned,
    keyMoments,
    updatedCareer
  };
}
