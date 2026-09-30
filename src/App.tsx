/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CareerSave, MatchSimulationResult, Club, TransferOffer, PlayedMatchRecord } from './types';
import { 
  loadCareer, 
  saveCareer, 
  getActiveSaveId, 
  setActiveSaveId,
  exportCareerToJson
} from './services/storageService';
import { INITIAL_CLUBS, INITIAL_LEAGUES } from './data/database';
import { simulateMatch } from './services/simulationEngine';
import { generateMatchNews, generateSocialMediaReactions, generateTransferRumors } from './services/newsEngine';
import { generateTransferOffers } from './services/transferEngine';
import { calculateSeasonAwards, calculateCareerGrade } from './services/awardsEngine';
import { evolvePlayerAfterMatch, evolvePlayerWeeklyTraining } from './services/progressionEngine';
import { calculateOvr, calculateMarketValue } from './utils/calculator';
import { soundFx } from './utils/audio';
import {
  getScheduledFixture,
  syncClubsWithCareer,
  applyBrazilianPromotionRelegation
} from './utils/competitionsEngine';
import { getDomesticLeagueStandings } from './utils/standingsGenerator';

import { Header } from './components/Header';
import { SavesManager } from './components/SavesManager';
import { PlayerCreator } from './components/PlayerCreator';
import { Dashboard } from './components/Dashboard';
import { MatchView } from './components/MatchView';
import { AdminPanel } from './components/AdminPanel';
import { RankingsModal } from './components/RankingsModal';
import { RetirementModal } from './components/RetirementModal';
import { PenaltyShootout } from './components/PenaltyShootout';
import { TraditionalFriendly } from './components/TraditionalFriendly';
import { MultiplayerMode } from './components/MultiplayerMode';
import { SquadEditor } from './components/SquadEditor';

export default function App() {
  // Navigation & screens: 'saves' | 'creator' | 'dashboard' | 'match' | 'penalties' | 'friendly' | 'multiplayer' | 'squad_editor'
  const [screen, setScreen] = useState<'saves' | 'creator' | 'dashboard' | 'match' | 'penalties' | 'friendly' | 'multiplayer' | 'squad_editor'>('saves');
  const [returnFromSquadEditor, setReturnFromSquadEditor] = useState<'saves' | 'multiplayer'>('saves');
  const [penaltyClubs, setPenaltyClubs] = useState<{ homeClubId?: string; awayClubId?: string } | null>(null);

  // Active Career state
  const [career, setCareer] = useState<CareerSave | null>(null);

  // Active Match state for simulation screen
  const [activeMatchData, setActiveMatchData] = useState<{
    userClub: Club;
    opponentClub: Club;
    competitionName: string;
    tournamentId: string;
    tournamentCategory: 'friendly' | 'state' | 'league' | 'cup' | 'continental' | 'world';
    isHome: boolean;
    simResult: MatchSimulationResult;
  } | null>(null);

  // Modals state
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isRankingsOpen, setIsRankingsOpen] = useState(false);
  const [isRetirementOpen, setIsRetirementOpen] = useState(false);

  // Ensure existing saves have a clean seasonMatchResults array and valid tournament tags per week
  const sanitizeLoadedCareer = (saved: CareerSave): CareerSave => {
    syncClubsWithCareer(saved);
    const userClub =
      INITIAL_CLUBS.find(c => c.id === saved.player.contract.clubId) || INITIAL_CLUBS[0];

    let workingSave: CareerSave = { ...saved };
    let needsSave = false;

    // Retroactive fix: if user already won Série B or completed a season with a Série B club before promotion was added
    if (
      workingSave.clubLeagueOverrides === undefined &&
      userClub.leagueId === 'br_b' &&
      (workingSave.totalSeasonsPlayed > 0 ||
        workingSave.currentYear > 2025 ||
        (workingSave.trophyCabinet || []).some(t =>
          t.name.toLowerCase().includes('série b')
        ))
    ) {
      const promo = applyBrazilianPromotionRelegation(
        workingSave.clubLeagueOverrides,
        workingSave.currentYear - 1,
        userClub.id,
        1
      );
      workingSave = {
        ...workingSave,
        clubLeagueOverrides: promo.updatedOverrides,
        lastPromotionRelegation: {
          seasonYear: workingSave.currentYear - 1,
          promotedToSerieA: promo.promotedNames,
          relegatedToSerieB: promo.relegatedNames,
          userPromoted: promo.userPromoted,
          userRelegated: promo.userRelegated
        },
        news: [promo.newsItem, ...(workingSave.news || [])]
      };
      needsSave = true;
    }

    if (workingSave.seasonMatchResults !== undefined) {
      let changed = false;
      const fixedMatches = workingSave.seasonMatchResults.map(m => {
        if (m.tournamentCategory === 'friendly' || !m.tournamentId || !m.tournamentCategory) {
          changed = true;
          const sched = getScheduledFixture(userClub, m.week || 1);
          return {
            ...m,
            tournamentId: sched.tournament.id,
            tournamentCategory: sched.tournament.category,
            competitionName: sched.competitionName
          };
        }
        return m;
      });
      if (changed || needsSave) {
        const updatedSave: CareerSave = {
          ...workingSave,
          seasonMatchResults: fixedMatches
        };
        saveCareer(updatedSave);
        return updatedSave;
      }
      return workingSave;
    }

    const cleanedNews = (workingSave.news || []).filter(n => n.category !== 'match');
    const cleaned: CareerSave = {
      ...workingSave,
      news: cleanedNews,
      seasonMatchResults: []
    };
    saveCareer(cleaned);
    return cleaned;
  };

  // Initial load: check active save
  useEffect(() => {
    const activeId = getActiveSaveId();
    if (activeId) {
      const saved = loadCareer(activeId);
      if (saved) {
        setCareer(sanitizeLoadedCareer(saved));
        setScreen('dashboard');
      }
    }
  }, []);

  // Save changes handler
  const handleUpdateCareer = (updated: CareerSave) => {
    syncClubsWithCareer(updated);
    setCareer(updated);
    saveCareer(updated);
  };

  // Start new career creator
  const handleCreateNew = () => {
    setScreen('creator');
  };

  // Callback when player is created
  const handleCareerCreated = (newSave: CareerSave) => {
    const initialized = { ...newSave, seasonMatchResults: [] };
    setCareer(initialized);
    saveCareer(initialized);
    setActiveSaveId(initialized.id);
    setScreen('dashboard');
  };

  // Select save from list
  const handleSelectCareer = (selected: CareerSave) => {
    const sanitized = sanitizeLoadedCareer(selected);
    setCareer(sanitized);
    setActiveSaveId(sanitized.id);
    setScreen('dashboard');
  };

  // Setup and begin match
  const handleStartMatch = () => {
    if (!career || career.isRetired) return;
    const p = career.player;

    const userClub = INITIAL_CLUBS.find(c => c.id === p.contract.clubId) || INITIAL_CLUBS[0];
    
    // Use authentic competition and fixture schedule (Brasileirão, Champions League, Copa do Brasil, Amistosos, etc.)
    const fixture = getScheduledFixture(userClub, career.currentWeek);
    const opponentClub = fixture.opponent;
    const isHome = fixture.isHome;
    const competition = fixture.competitionName;

    const simResult = simulateMatch(
      p,
      userClub,
      opponentClub,
      competition,
      isHome,
      fixture.isDecisive
    );

    setActiveMatchData({
      userClub,
      opponentClub,
      competitionName: competition,
      tournamentId: fixture.tournament.id,
      tournamentCategory: fixture.tournament.category,
      isHome,
      simResult
    });

    setScreen('match');
  };

  // Finish match post-summary
  const handleFinishMatch = (result: MatchSimulationResult) => {
    if (!career || !activeMatchData) return;
    const p = career.player;

    // Apply match effects
    const wasInjured = p.isInjured;
    const newMatches = wasInjured && result.playerMinutes === 0 ? p.careerMatches : p.careerMatches + 1;
    const newGoals = p.careerGoals + result.playerGoals;
    const newAssists = p.careerAssists + result.playerAssists;
    const newEnergy = wasInjured 
      ? Math.min(100, p.energy + 20) 
      : Math.max(20, p.energy - result.playerEnergyCost);
    const earnedBonus = (result.playerGoals * p.contract.bonusPerGoal) + p.contract.weeklyWage;
    const newEarnings = p.careerEarnings + earnedBonus;

    // Morale & Confidence progression
    let newConfidence = p.confidence;
    let newMorale = p.morale;
    if (result.playerRating >= 7.5) {
      newConfidence = Math.min(100, newConfidence + 4);
      newMorale = 'Excelente';
    } else if (result.playerRating > 0 && result.playerRating < 6.0) {
      newConfidence = Math.max(30, newConfidence - 3);
      newMorale = 'Baixa';
    }

    // Training points gain based on match rating or recovery effort
    const ptsGained = wasInjured ? 1 : result.playerRating >= 8.0 ? 3 : result.playerRating >= 7.0 ? 2 : 1;
    const newTrainingPoints = p.trainingPoints + ptsGained;

    // Check injury progression
    let isInjured = wasInjured;
    let injuryWeeks = p.injuryWeeksRemaining || 0;
    let injuryName = p.injuryName;

    if (wasInjured) {
      injuryWeeks = Math.max(0, injuryWeeks - 1);
      if (injuryWeeks === 0) {
        isInjured = false;
        injuryName = undefined;
      }
    } else if (result.injuryOccurred) {
      isInjured = true;
      injuryWeeks = result.injuryOccurred.weeks;
      injuryName = result.injuryOccurred.name;
    }

    // Base match updated player
    const updatedPlayer: typeof p = {
      ...p,
      careerMatches: newMatches,
      careerGoals: newGoals,
      careerAssists: newAssists,
      careerEarnings: newEarnings,
      energy: newEnergy,
      confidence: newConfidence,
      morale: newMorale,
      trainingPoints: newTrainingPoints,
      isInjured,
      injuryWeeksRemaining: injuryWeeks,
      injuryName
    };

    // Automatic OVR and Attribute progression based on real match performance
    const progression = evolvePlayerAfterMatch(
      updatedPlayer,
      result.playerRating,
      result.playerGoals,
      result.playerAssists,
      result.playerMinutes
    );
    const evolvedPlayer = progression.updatedPlayer;

    if (progression.ovrGained > 0) {
      soundFx.playFanfare();
    }

    // Generate News and Tweets
    let matchNews = generateMatchNews(
      result,
      evolvedPlayer,
      activeMatchData.userClub,
      activeMatchData.opponentClub,
      activeMatchData.competitionName,
      career.currentYear,
      career.currentWeek
    );

    const socialTweets = generateSocialMediaReactions(
      result,
      evolvedPlayer,
      activeMatchData.userClub
    );

    // Record exact match result for standings (V = Vitória, E = Empate, D = Derrota)
    const userGoalsFor = activeMatchData.isHome ? result.homeScore : result.awayScore;
    const userGoalsAgainst = activeMatchData.isHome ? result.awayScore : result.homeScore;
    const matchOutcome: 'V' | 'E' | 'D' =
      userGoalsFor > userGoalsAgainst
        ? 'V'
        : userGoalsFor === userGoalsAgainst
        ? 'E'
        : 'D';

    const playedRecord: PlayedMatchRecord = {
      id: 'mrec_' + Date.now(),
      seasonYear: career.currentYear,
      week: career.currentWeek,
      tournamentId: activeMatchData.tournamentId,
      tournamentCategory: activeMatchData.tournamentCategory,
      competitionName: activeMatchData.competitionName,
      userClubId: activeMatchData.userClub.id,
      opponentClubId: activeMatchData.opponentClub.id,
      isHome: activeMatchData.isHome,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      userGoalsFor,
      userGoalsAgainst,
      outcome: matchOutcome
    };

    let updatedSeasonMatches = [...(career.seasonMatchResults || []), playedRecord];

    // Advance week & check season rollover
    let nextWeek = career.currentWeek + 1;
    let nextYear = career.currentYear;
    let newHistory = [...career.history];
    let newTrophies = [...career.trophyCabinet];
    let newAwards = [...career.awardsCabinet];
    let totalSeasons = career.totalSeasonsPlayed;
    let newOffers = [...career.activeOffers];

    // Update current season live stats in history
    const existingSeasonIdx = newHistory.findIndex(h => h.seasonYear === career.currentYear);
    if (existingSeasonIdx >= 0) {
      const prevS = newHistory[existingSeasonIdx];
      const totalM = prevS.matches + (result.playerMinutes > 0 ? 1 : 0);
      const newAvgRating =
        totalM > 0 && result.playerMinutes > 0
          ? Number(
              (
                (prevS.avgRating * prevS.matches + result.playerRating) /
                totalM
              ).toFixed(2)
            )
          : prevS.avgRating;
      newHistory[existingSeasonIdx] = {
        ...prevS,
        clubId: activeMatchData.userClub.id,
        clubName: activeMatchData.userClub.name,
        matches: totalM,
        starts: prevS.starts + (result.playerStarted ? 1 : 0),
        minutes: prevS.minutes + result.playerMinutes,
        goals: prevS.goals + result.playerGoals,
        assists: prevS.assists + result.playerAssists,
        yellowCards: prevS.yellowCards + result.playerYellowCards,
        redCards: prevS.redCards + result.playerRedCards,
        avgRating: newAvgRating
      };
    } else {
      newHistory.unshift({
        seasonYear: career.currentYear,
        clubId: activeMatchData.userClub.id,
        clubName: activeMatchData.userClub.name,
        matches: result.playerMinutes > 0 ? 1 : 0,
        starts: result.playerStarted ? 1 : 0,
        minutes: result.playerMinutes,
        goals: result.playerGoals,
        assists: result.playerAssists,
        yellowCards: result.playerYellowCards,
        redCards: result.playerRedCards,
        avgRating: result.playerMinutes > 0 ? result.playerRating : 0,
        cleanSheets: 0,
        trophiesWon: [],
        awardsWon: []
      });
    }

    // Check if end of season (week 48)
    let nextClubLeagueOverrides = career.clubLeagueOverrides;
    let nextLastPromotionRelegation = career.lastPromotionRelegation;
    let extraSeasonNews = [...career.news];

    if (nextWeek > 48) {
      const finishedYear = nextYear;
      // Compute final standings of Série A and Série B BEFORE resetting seasonMatchResults
      const tempCareerWithLastMatch: CareerSave = {
        ...career,
        seasonMatchResults: updatedSeasonMatches
      };
      const finalSerieAStandings = getDomesticLeagueStandings(
        'br_a',
        activeMatchData.userClub,
        tempCareerWithLastMatch
      );
      const finalSerieBStandings = getDomesticLeagueStandings(
        'br_b',
        activeMatchData.userClub,
        tempCareerWithLastMatch
      );
      const userMyLeagueStandings = getDomesticLeagueStandings(
        activeMatchData.userClub.leagueId,
        activeMatchData.userClub,
        tempCareerWithLastMatch
      );
      const userFinalRow = userMyLeagueStandings.find(
        r => r.club.id === activeMatchData.userClub.id
      );
      const userFinalPos = userFinalRow?.position;

      // Award National League trophy if user finished 1st in their league
      if (userFinalPos === 1) {
        const lgObj = INITIAL_LEAGUES.find(l => l.id === activeMatchData.userClub.leagueId);
        newTrophies.unshift({
          id: 'trophy_league_' + finishedYear + '_' + Date.now(),
          name: `${lgObj?.name || 'Campeonato Nacional'} ${finishedYear}`,
          year: finishedYear,
          club: activeMatchData.userClub.name,
          importance: activeMatchData.userClub.leagueId === 'br_b' ? 'B' : 'A',
          icon: '🏆'
        });
      }

      // Execute official promotion (G-4 Série B -> Série A) and relegation (Z-4 Série A -> Série B)
      const promoResult = applyBrazilianPromotionRelegation(
        career.clubLeagueOverrides,
        finishedYear,
        activeMatchData.userClub.id,
        userFinalPos,
        finalSerieAStandings.map(r => r.club.id),
        finalSerieBStandings.map(r => r.club.id)
      );
      nextClubLeagueOverrides = promoResult.updatedOverrides;
      nextLastPromotionRelegation = {
        seasonYear: finishedYear,
        promotedToSerieA: promoResult.promotedNames,
        relegatedToSerieB: promoResult.relegatedNames,
        userPromoted: promoResult.userPromoted,
        userRelegated: promoResult.userRelegated
      };
      extraSeasonNews = [promoResult.newsItem, ...extraSeasonNews];

      nextWeek = 1;
      nextYear += 1;
      totalSeasons += 1;
      updatedSeasonMatches = [];

      // Calculate awards
      const seasonAwards = calculateSeasonAwards(evolvedPlayer, nextYear - 1);
      newAwards = [...seasonAwards, ...newAwards];

      // Add championship trophy if won final
      if (matchOutcome === 'V' && activeMatchData.tournamentCategory !== 'league') {
        newTrophies.unshift({
          id: 'trophy_' + Date.now(),
          name: `${activeMatchData.competitionName} ${nextYear - 1}`,
          year: nextYear - 1,
          club: activeMatchData.userClub.name,
          importance: 'A',
          icon: '🏆'
        });
      }

      // Age progression & contract year tick
      evolvedPlayer.age += 1;

      if (evolvedPlayer.isYouthAcademy) {
        if (evolvedPlayer.age >= 18) {
          evolvedPlayer.isYouthAcademy = false;
          evolvedPlayer.youthCategory = undefined;
          evolvedPlayer.contract.clubName = evolvedPlayer.contract.clubName.replace(/\s*\(BASE\)/gi, '').trim();
          evolvedPlayer.contract.weeklyWage = Math.max(evolvedPlayer.contract.weeklyWage * 3, 2500);
          evolvedPlayer.squadRole = evolvedPlayer.ovr >= 74 ? 'Titular' : 'Rotação';
          matchNews = {
            id: 'news_pro_promo_' + Date.now(),
            dateStr: `Temporada ${nextYear} • Início`,
            headline: `PROFISSIONALIZOU! ${evolvedPlayer.shirtName.toUpperCase()} COMPLETA 18 ANOS E SOBE AO ELENCO PRINCIPAL!`,
            snippet: `Com a maioridade de 18 anos atingida, a jovem promessa deixou as Categorias de Base e se torna jogador profissional oficial do ${evolvedPlayer.contract.clubName}!`,
            category: 'award'
          };
        } else {
          evolvedPlayer.youthCategory = evolvedPlayer.age <= 15 ? 'Sub-15' : 'Sub-17';
        }
      }

      if (evolvedPlayer.contract.yearsRemaining > 0) {
        evolvedPlayer.contract.yearsRemaining -= 1;
      }

      // Generate transfer offers for new season
      newOffers = generateTransferOffers(evolvedPlayer, INITIAL_CLUBS);
    }

    const updatedCareer: CareerSave = {
      ...career,
      currentWeek: nextWeek,
      currentYear: nextYear,
      totalSeasonsPlayed: totalSeasons,
      player: evolvedPlayer,
      news: [matchNews, ...extraSeasonNews],
      socialPosts: [...socialTweets, ...career.socialPosts.slice(0, 15)],
      history: newHistory,
      trophyCabinet: newTrophies,
      awardsCabinet: newAwards,
      activeOffers: newOffers,
      seasonMatchResults: updatedSeasonMatches,
      clubLeagueOverrides: nextClubLeagueOverrides,
      lastPromotionRelegation: nextLastPromotionRelegation
    };

    handleUpdateCareer(updatedCareer);
    setActiveMatchData(null);
    setScreen('dashboard');
  };

  // Advance week manually (rest, recover stamina, and natural training evolution)
  const handleAdvanceWeek = () => {
    if (!career || career.isRetired) return;
    const p = career.player;

    const recoveredEnergy = Math.min(100, p.energy + 35);
    const newInjuryWeeks = Math.max(0, (p.injuryWeeksRemaining || 0) - 1);
    const isStillInjured = newInjuryWeeks > 0;

    let nextWeek = career.currentWeek + 1;
    let nextYear = career.currentYear;
    let nextClubLeagueOverrides = career.clubLeagueOverrides;
    let nextLastPromotionRelegation = career.lastPromotionRelegation;
    let updatedNews = career.news;
    let updatedSeasonMatchResults = career.seasonMatchResults;

    if (nextWeek > 48) {
      const userClub =
        INITIAL_CLUBS.find(c => c.id === p.contract.clubId) || INITIAL_CLUBS[0];
      const finalSerieAStandings = getDomesticLeagueStandings('br_a', userClub, career);
      const finalSerieBStandings = getDomesticLeagueStandings('br_b', userClub, career);
      const myStandings = getDomesticLeagueStandings(userClub.leagueId, userClub, career);
      const userFinalPos = myStandings.find(r => r.club.id === userClub.id)?.position;

      const promoResult = applyBrazilianPromotionRelegation(
        career.clubLeagueOverrides,
        nextYear,
        userClub.id,
        userFinalPos,
        finalSerieAStandings.map(r => r.club.id),
        finalSerieBStandings.map(r => r.club.id)
      );
      nextClubLeagueOverrides = promoResult.updatedOverrides;
      nextLastPromotionRelegation = {
        seasonYear: nextYear,
        promotedToSerieA: promoResult.promotedNames,
        relegatedToSerieB: promoResult.relegatedNames,
        userPromoted: promoResult.userPromoted,
        userRelegated: promoResult.userRelegated
      };
      updatedNews = [promoResult.newsItem, ...career.news];
      updatedSeasonMatchResults = [];
      nextWeek = 1;
      nextYear += 1;
    }

    // Occasional transfer offers while advancing
    let offers = career.activeOffers;
    if (Math.random() > 0.6 && offers.length < 3) {
      offers = generateTransferOffers(p, INITIAL_CLUBS);
    }

    // Automatic weekly evolution of player attributes and OVR
    const weeklyProg = evolvePlayerWeeklyTraining({
      ...p,
      energy: recoveredEnergy,
      isInjured: isStillInjured,
      injuryWeeksRemaining: newInjuryWeeks,
      trainingPoints: p.trainingPoints + 1
    });

    const updated: CareerSave = {
      ...career,
      currentWeek: nextWeek,
      currentYear: nextYear,
      player: weeklyProg.updatedPlayer,
      activeOffers: offers,
      news: updatedNews,
      seasonMatchResults: updatedSeasonMatchResults,
      clubLeagueOverrides: nextClubLeagueOverrides,
      lastPromotionRelegation: nextLastPromotionRelegation
    };

    handleUpdateCareer(updated);
  };

  // Official retirement handler: permanently ends the career
  const handleConfirmRetirement = () => {
    if (!career) return;
    const grade = calculateCareerGrade(career);

    const retirementNewsItem = {
      id: 'news_retire_' + Date.now(),
      dateStr: `Ano ${career.currentYear}`,
      headline: `OFICIAL: ${career.player.name} ${career.player.lastName} anuncia aposentadoria definitiva dos gramados!`,
      snippet: `Após ${career.player.careerMatches} partidas oficiais e ${career.player.careerGoals} gols na carreira, o craque pendurou as chuteiras. Sua trajetória lendária ingressa para sempre no Hall da Fama mundial (${grade.title})!`,
      category: 'award' as const
    };

    const updatedCareer: CareerSave = {
      ...career,
      isRetired: true,
      finalCareerGrade: grade,
      news: [retirementNewsItem, ...career.news]
    };

    handleUpdateCareer(updatedCareer);
    soundFx.playFanfare();
  };

  // Admin event triggers
  const handleAdminTriggerEvent = (type: string) => {
    if (!career) return;
    const p = career.player;

    if (type === 'real_madrid_offer') {
      const realMadrid = INITIAL_CLUBS.find(c => c.name.includes('Madrid') || c.shortName === 'RMA') || INITIAL_CLUBS[4];
      const bigOffer: TransferOffer = {
        id: 'offer_madrid_' + Date.now(),
        clubId: realMadrid.id,
        clubName: realMadrid.name,
        clubCountry: realMadrid.country,
        clubPrestige: 5,
        type: 'purchase',
        offeredWage: 185000,
        contractYears: 4,
        offeredRole: 'Estrela',
        bonusPerGoal: 20000,
        bonusPerCleanSheet: 15000,
        releaseClause: 350000000,
        transferFee: 145000000,
        deadlineWeek: career.currentWeek + 4
      };
      handleUpdateCareer({
        ...career,
        activeOffers: [bigOffer, ...career.activeOffers]
      });
      alert(`Proposta galáctica recebida do ${realMadrid.name}! Veja na aba Mercado & Agente.`);
    } else if (type === 'national_callup') {
      handleUpdateCareer({
        ...career,
        player: {
          ...p,
          isNationalTeamCalled: true,
          nationalCaps: p.nationalCaps + 1
        }
      });
      alert(`Convocação oficializada para a Seleção Nacional de ${p.nationality}!`);
    } else if (type === 'heal_injury') {
      handleUpdateCareer({
        ...career,
        player: {
          ...p,
          isInjured: false,
          injuryWeeksRemaining: 0,
          energy: 100
        }
      });
      alert('Lesão curada com sucesso e energia totalmente restaurada!');
    } else if (type === 'bonus_training') {
      handleUpdateCareer({
        ...career,
        player: {
          ...p,
          trainingPoints: p.trainingPoints + 25
        }
      });
      alert('+25 Pontos de Treinamento adicionados!');
    }
  };

  const handleGoHome = () => {
    if (career) {
      handleUpdateCareer(career);
    }
    setScreen('saves');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-emerald-500 selection:text-neutral-950">
      {/* Top Header */}
      <Header
        player={career?.player || null}
        currentYear={career?.currentYear || 2026}
        currentWeek={career?.currentWeek || 1}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenRankings={() => setIsRankingsOpen(true)}
        onOpenPenalties={() => {
          setPenaltyClubs(null);
          setScreen('penalties');
        }}
        onOpenFriendly={() => setScreen('friendly')}
        onOpenMultiplayer={() => setScreen('multiplayer')}
        onOpenSquadEditor={() => {
          setReturnFromSquadEditor(screen === 'multiplayer' ? 'multiplayer' : 'saves');
          setScreen('squad_editor');
        }}
        onManualSave={career ? () => handleUpdateCareer(career) : undefined}
        onGoHome={handleGoHome}
        currentScreen={screen}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1 pb-16">
        {screen === 'saves' && (
          <SavesManager
            onSelectCareer={handleSelectCareer}
            onCreateNew={handleCreateNew}
            onOpenRankings={() => setIsRankingsOpen(true)}
            onOpenPenalties={() => {
              setPenaltyClubs(null);
              setScreen('penalties');
            }}
            onOpenFriendly={() => setScreen('friendly')}
            onOpenMultiplayer={() => setScreen('multiplayer')}
            onOpenSquadEditor={() => {
              setReturnFromSquadEditor('saves');
              setScreen('squad_editor');
            }}
          />
        )}

        {screen === 'multiplayer' && (
          <MultiplayerMode
            onBackToMenu={handleGoHome}
            onOpenSquadEditor={() => {
              setReturnFromSquadEditor('multiplayer');
              setScreen('squad_editor');
            }}
          />
        )}

        {screen === 'squad_editor' && (
          <SquadEditor
            onBackToMenu={() => setScreen(returnFromSquadEditor)}
          />
        )}

        {screen === 'friendly' && (
          <TraditionalFriendly
            onBackToMenu={handleGoHome}
            onOpenPenalties={(homeClubId, awayClubId) => {
              setPenaltyClubs({ homeClubId, awayClubId });
              setScreen('penalties');
            }}
          />
        )}

        {screen === 'penalties' && (
          <PenaltyShootout
            onBackToMenu={handleGoHome}
            onBack={handleGoHome}
            initialHomeClubId={penaltyClubs?.homeClubId}
            initialAwayClubId={penaltyClubs?.awayClubId}
          />
        )}

        {screen === 'creator' && (
          <PlayerCreator
            onCareerCreated={handleCareerCreated}
            onCancel={handleGoHome}
          />
        )}

        {screen === 'dashboard' && career && (
          <Dashboard
            career={career}
            onStartMatch={handleStartMatch}
            onAdvanceWeek={handleAdvanceWeek}
            onUpdateCareer={handleUpdateCareer}
            onRetire={() => setIsRetirementOpen(true)}
            onGoHome={handleGoHome}
          />
        )}

        {screen === 'match' && activeMatchData && career && (
          <MatchView
            player={career.player}
            userClub={activeMatchData.userClub}
            opponentClub={activeMatchData.opponentClub}
            competitionName={activeMatchData.competitionName}
            isHome={activeMatchData.isHome}
            matchResult={activeMatchData.simResult}
            onFinishMatch={handleFinishMatch}
          />
        )}
      </main>

      {/* Modals */}
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        activeCareer={career}
        onUpdateCareer={handleUpdateCareer}
        onTriggerEvent={handleAdminTriggerEvent}
      />

      <RankingsModal
        isOpen={isRankingsOpen}
        onClose={() => setIsRankingsOpen(false)}
        currentPlayer={career?.player || null}
      />

      {career && (
        <RetirementModal
          isOpen={isRetirementOpen}
          career={career}
          onClose={() => setIsRetirementOpen(false)}
          onExport={() => exportCareerToJson(career)}
          onConfirmRetirement={handleConfirmRetirement}
          onGoToSaves={() => {
            setIsRetirementOpen(false);
            setScreen('saves');
          }}
          onCreateNewCareer={() => {
            setIsRetirementOpen(false);
            setScreen('creator');
          }}
        />
      )}
    </div>
  );
}
