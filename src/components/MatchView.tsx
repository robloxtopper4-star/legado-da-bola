import React, { useState } from 'react';
import {
  Trophy,
  Clock,
  Zap,
  ArrowRight,
  AlertTriangle,
  FastForward,
  Gamepad2,
  Eye
} from 'lucide-react';
import { PlayerProfile, Club, MatchSimulationResult, MatchEvent } from '../types';
import { soundFx } from '../utils/audio';
import { ClubBadge } from './ClubBadge';
import { Interactive2DPitch, Pitch2DEvent, Pitch2DStats } from './Interactive2DPitch';
import confetti from 'canvas-confetti';

interface MatchViewProps {
  player: PlayerProfile;
  userClub: Club;
  opponentClub: Club;
  competitionName: string;
  isHome: boolean;
  matchResult: MatchSimulationResult;
  onFinishMatch: (result: MatchSimulationResult) => void;
}

export const MatchView: React.FC<MatchViewProps> = ({
  player,
  userClub,
  opponentClub,
  competitionName,
  isHome,
  matchResult,
  onFinishMatch
}) => {
  // Pre-match mode selection or live 2D match or post-match summary
  const [stage, setStage] = useState<'select_mode' | 'live_2d' | 'summary'>('select_mode');
  const [initial2DMode, setInitial2DMode] = useState<'play' | 'watch'>('play');

  const [liveHomeScore, setLiveHomeScore] = useState<number>(0);
  const [liveAwayScore, setLiveAwayScore] = useState<number>(0);
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([]);
  const [finalResult, setFinalResult] = useState<MatchSimulationResult>(matchResult);

  const homeTeam = isHome ? userClub : opponentClub;
  const awayTeam = isHome ? opponentClub : userClub;
  const userTeamSide: 'home' | 'away' = isHome ? 'home' : 'away';

  // Start the 2D match in either 'play' (control your player button) or 'watch' (spectator 2D)
  const handleStart2DMatch = (mode: 'play' | 'watch') => {
    soundFx.playWhistle();
    setInitial2DMode(mode);
    setLiveHomeScore(0);
    setLiveAwayScore(0);
    setVisibleEvents([]);
    setStage('live_2d');
  };

  // Synchronize live 2D pitch events with MatchView feed
  const handlePitchEvent = (
    evt: Pitch2DEvent,
    scores: { homeScore: number; awayScore: number },
    _stats: Pitch2DStats
  ) => {
    setLiveHomeScore(scores.homeScore);
    setLiveAwayScore(scores.awayScore);

    const isUserTeamEvt = evt.team === userTeamSide;
    const mappedEvent: MatchEvent = {
      minute: evt.minute,
      type:
        evt.type === 'goal'
          ? isUserTeamEvt
            ? 'goal'
            : 'opponent_goal'
          : evt.type === 'save'
          ? 'save'
          : 'great_play',
      description: `${evt.minute}' — ${evt.text}`,
      isPlayerInvolved: Boolean(evt.isUserPlayer || evt.isUserAssist)
    };

    setVisibleEvents(prev => [mappedEvent, ...prev]);
  };

  // Finalize 2D match when 90' is reached
  const handlePitchFullTime = (finalData: {
    homeScore: number;
    awayScore: number;
    events: Pitch2DEvent[];
    stats: Pitch2DStats;
  }) => {
    const userTeamGoals = isHome ? finalData.homeScore : finalData.awayScore;
    const oppTeamGoals = isHome ? finalData.awayScore : finalData.homeScore;
    const pGoals = finalData.stats.userGoals;
    const pAssists = finalData.stats.userAssists;

    // Calculate realistic match rating (6.0 to 10.0) based on actual 2D match performance
    let rating = 6.5;
    rating += pGoals * 1.4;
    rating += pAssists * 0.9;
    rating += Math.min(0.6, finalData.stats.userPassesCompleted * 0.08);
    if (userTeamGoals > oppTeamGoals) rating += 0.5;
    else if (userTeamGoals < oppTeamGoals) rating -= 0.3;
    rating = Math.max(5.0, Math.min(10.0, Math.round(rating * 10) / 10));

    let summaryNarrative = '';
    if (userTeamGoals > oppTeamGoals) {
      if (pGoals >= 2) {
        summaryNarrative = `VITÓRIA DO ${userClub.name.toUpperCase()} (${userTeamGoals}x${oppTeamGoals})! Atuação de gala de ${player.shirtName} com ${pGoals} gols marcados em campo!`;
      } else if (pGoals === 1) {
        summaryNarrative = `VITÓRIA DO ${userClub.name.toUpperCase()} (${userTeamGoals}x${oppTeamGoals})! ${player.shirtName} balançou a rede e ajudou a garantir o triunfo!`;
      } else if (pAssists >= 1) {
        summaryNarrative = `VITÓRIA DO ${userClub.name.toUpperCase()} (${userTeamGoals}x${oppTeamGoals})! ${player.shirtName} deu ${pAssists} assistência(s) decisiva(s) na partida.`;
      } else {
        summaryNarrative = `VITÓRIA DO ${userClub.name.toUpperCase()} por ${userTeamGoals} a ${oppTeamGoals} com participação tática sólida de ${player.shirtName} durante os 90 minutos.`;
      }
    } else if (userTeamGoals === oppTeamGoals) {
      if (pGoals >= 1) {
        summaryNarrative = `EMPATE EM ${userTeamGoals} A ${oppTeamGoals}! ${player.shirtName} marcou ${pGoals} gol(s), e a partida terminou empatada.`;
      } else if (pAssists >= 1) {
        summaryNarrative = `EMPATE EM ${userTeamGoals} A ${oppTeamGoals}! ${player.shirtName} contribuiu com ${pAssists} assistência(s) no confronto equilibrado.`;
      } else {
        summaryNarrative = `EMPATE EM ${userTeamGoals} A ${oppTeamGoals}! Partida equilibrada entre ${userClub.name} e ${opponentClub.name}, somando 1 ponto.`;
      }
    } else {
      if (pGoals >= 1) {
        summaryNarrative = `DERROTA POR ${oppTeamGoals} A ${userTeamGoals}. Apesar do(s) ${pGoals} gol(s) de ${player.shirtName}, o ${userClub.name} foi superado pelo ${opponentClub.name}.`;
      } else {
        summaryNarrative = `DERROTA POR ${oppTeamGoals} A ${userTeamGoals}. O ${userClub.name} foi superado pelo ${opponentClub.name} e buscará a recuperação na próxima rodada.`;
      }
    }

    const updatedResult: MatchSimulationResult = {
      ...matchResult,
      homeScore: finalData.homeScore,
      awayScore: finalData.awayScore,
      playerStarted: true,
      playerMinutes: 90,
      playerGoals: pGoals,
      playerAssists: pAssists,
      playerRating: rating,
      summaryNarrative
    };

    setLiveHomeScore(finalData.homeScore);
    setLiveAwayScore(finalData.awayScore);
    setFinalResult(updatedResult);
    setStage('summary');

    if (userTeamGoals > oppTeamGoals) {
      try {
        confetti({
          particleCount: 55,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {
        // Ignore confetti error
      }
    }
  };

  // Skip/finish match — when called from inside the 2D pitch, preserve the exact 2D score!
  const handleSkipToEnd = (current2DData?: {
    minute: number;
    homeScore: number;
    awayScore: number;
    events: Pitch2DEvent[];
    stats: Pitch2DStats;
  }) => {
    soundFx.playWhistle();

    if (current2DData) {
      handlePitchFullTime({
        homeScore: current2DData.homeScore,
        awayScore: current2DData.awayScore,
        events: current2DData.events,
        stats: current2DData.stats
      });
      return;
    }

    // Direct quick simulation from pre-match screen
    setLiveHomeScore(matchResult.homeScore);
    setLiveAwayScore(matchResult.awayScore);
    setVisibleEvents(matchResult.events);
    setFinalResult({
      ...matchResult,
      playerMinutes: Math.max(75, matchResult.playerMinutes || 90),
      playerRating: Math.max(6.5, matchResult.playerRating || 7.0)
    });
    setStage('summary');
  };

  return (
    <div className="max-w-6xl mx-auto py-4 px-4 space-y-6">
      {/* Match Header / Scoreboard Banner */}
      <div className="bg-neutral-900/90 p-4 sm:p-5 rounded-3xl border border-neutral-800 text-center relative overflow-hidden shadow-xl">
        <div className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1.5 mb-2">
          <Trophy className="w-3.5 h-3.5" />
          <span>{competitionName}</span>
        </div>

        {/* Stadium & Status */}
        <div className="flex items-center justify-between text-xs text-neutral-400 max-w-md mx-auto px-2">
          <span>Estádio {homeTeam.stadiumName}</span>
          <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {stage === 'summary' ? "FIM DE JOGO (90')" : 'AO VIVO EM CAMPO'}
          </span>
          <span>{homeTeam.stadiumCapacity.toLocaleString()} torcedores</span>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 my-4">
          {/* Home Team */}
          <div className="flex flex-col items-center w-32 sm:w-44 text-center">
            <ClubBadge club={homeTeam} size="lg" className="mb-2" />
            <span className="font-bold text-sm sm:text-base text-white truncate max-w-full">
              {homeTeam.name}
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              Mandante {isHome ? '• Seu Time' : ''}
            </span>
          </div>

          {/* Score Numbers */}
          <div className="flex items-center gap-3 bg-neutral-950/90 px-6 py-3 rounded-2xl border border-neutral-800 font-heading shadow-inner">
            <span className="text-3xl sm:text-5xl font-black text-white font-mono">
              {stage === 'summary' ? finalResult.homeScore : liveHomeScore}
            </span>
            <span className="text-2xl text-neutral-600 font-bold">:</span>
            <span className="text-3xl sm:text-5xl font-black text-white font-mono">
              {stage === 'summary' ? finalResult.awayScore : liveAwayScore}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center w-32 sm:w-44 text-center">
            <ClubBadge club={awayTeam} size="lg" className="mb-2" />
            <span className="font-bold text-sm sm:text-base text-white truncate max-w-full">
              {awayTeam.name}
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              Visitante {!isHome ? '• Seu Time' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* STAGE 1: CHOOSE HOW TO PLAY OR WATCH THE MATCH */}
      {/* ================================================================= */}
      {stage === 'select_mode' && (
        <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 sm:p-8 rounded-3xl border border-neutral-800 shadow-2xl space-y-6 animate-fadeIn">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider">
              Escolha Como Disputar a Partida
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-heading">
              Pronto para entrar em campo, {player.shirtName} #{player.shirtNumber}?
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Você pode controlar o botãozinho do seu jogador no gramado 2D em tempo real, assistir à transmissão 2D ou simular direto para o resultado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* OPTION 1: JOGAR PARTIDA (CONTROL YOUR PLAYER BUTTON) */}
            <button
              type="button"
              onClick={() => handleStart2DMatch('play')}
              className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-emerald-950/30 to-neutral-950 hover:from-emerald-500/30 border-2 border-emerald-500/70 hover:border-emerald-400 text-left transition transform hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between gap-4 shadow-xl shadow-emerald-500/10 group"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-lg">
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                    Modo Interativo • Recomendado
                  </span>
                  <h3 className="text-lg font-black text-white font-heading mt-0.5">
                    🎮 Jogar Partida 2D
                  </h3>
                  <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                    Controle exclusivamente o botão do seu jogador (<strong>#{player.shirtNumber} {player.shirtName}</strong>) em campo!
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-emerald-500/20 text-[11px] text-neutral-300">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Drible Girinho (+ Passinho):</span>
                    <kbd className="px-2 py-0.5 rounded bg-cyan-400 text-neutral-950 font-black text-[10px]">
                      TECLA Q
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Roubar Bola (3s Cooldown):</span>
                    <kbd className="px-2 py-0.5 rounded bg-rose-500 text-white font-black text-[10px]">
                      TECLA E
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Pedir a Bola:</span>
                    <kbd className="px-2 py-0.5 rounded bg-emerald-500 text-neutral-950 font-black text-[10px]">
                      ESPAÇO
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Chutar pro Gol:</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-neutral-950 font-black text-[10px]">
                      BOTÃO ESQUERDO MOUSE
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Fazer um Passe:</span>
                    <span className="px-2 py-0.5 rounded bg-sky-400 text-neutral-950 font-black text-[10px]">
                      BOTÃO DIREITO MOUSE
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full py-3 rounded-xl bg-emerald-500 group-hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider text-center shadow-md transition">
                Entrar e Jogar Agora ▶
              </div>
            </button>

            {/* OPTION 2: ASSISTIR JOGO 2D */}
            <button
              type="button"
              onClick={() => handleStart2DMatch('watch')}
              className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/15 via-neutral-900 to-neutral-950 hover:from-amber-500/25 border-2 border-amber-500/50 hover:border-amber-400 text-left transition transform hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between gap-4 shadow-xl group"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                    Transmissão no Gramado
                  </span>
                  <h3 className="text-lg font-black text-white font-heading mt-0.5">
                    👁️ Assistir Jogo 2D
                  </h3>
                  <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                    Assista à movimentação tática dos 22 jogadores em campo com a bola colada no pé e possibilidade de assumir o controle a qualquer momento.
                  </p>
                </div>
              </div>

              <div className="w-full py-3 rounded-xl bg-amber-500 group-hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider text-center shadow-md transition">
                Assistir Partida 2D 👁️
              </div>
            </button>

            {/* OPTION 3: SIMULAR DIRETO */}
            <button
              type="button"
              onClick={() => handleSkipToEnd()}
              className="p-6 rounded-3xl bg-neutral-900/90 hover:bg-neutral-800/90 border border-neutral-700 hover:border-neutral-500 text-left transition transform hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between gap-4 shadow-xl group"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 text-emerald-400 flex items-center justify-center shadow-lg">
                  <FastForward className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                    Resultado Instantâneo
                  </span>
                  <h3 className="text-lg font-black text-white font-heading mt-0.5">
                    ⚡ Simular Rápido
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Pula diretamente para o apito final dos 90 minutos e calcula a nota, gols e evolução do seu jogador.
                  </p>
                </div>
              </div>

              <div className="w-full py-3 rounded-xl bg-neutral-800 group-hover:bg-neutral-700 text-white font-black text-xs uppercase tracking-wider text-center border border-neutral-700 transition">
                Pular para o Final ⏩
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STAGE 2: LIVE 2D INTERACTIVE MATCH */}
      {/* ================================================================= */}
      {stage === 'live_2d' && (
        <div className="space-y-5">
          <Interactive2DPitch
            homeClub={homeTeam}
            awayClub={awayTeam}
            userTeamSide={userTeamSide}
            careerPlayer={player}
            initialMode={initial2DMode}
            competitionName={competitionName}
            onMatchEvent={handlePitchEvent}
            onFullTime={handlePitchFullTime}
            onSkipToEnd={currentData => handleSkipToEnd(currentData)}
          />

          {/* Live Events Log */}
          {visibleEvents.length > 0 && (
            <div className="bg-neutral-900/70 p-4 rounded-2xl border border-neutral-800 space-y-2.5">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                <span>Lances Importantes da Partida</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {visibleEvents.length} lances
                </span>
              </h3>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {visibleEvents.map((evt, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border text-xs flex items-center gap-3 ${
                      evt.isPlayerInvolved
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 font-bold'
                        : 'bg-neutral-950/80 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-neutral-900 text-amber-300 border border-neutral-700">
                      {evt.minute}'
                    </span>
                    <span>{evt.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* STAGE 3: POST-MATCH SUMMARY CARD (FULL TIME) */}
      {/* ================================================================= */}
      {stage === 'summary' && (() => {
        const userScore = isHome ? finalResult.homeScore : finalResult.awayScore;
        const oppScore = isHome ? finalResult.awayScore : finalResult.homeScore;
        const isWin = userScore > oppScore;
        const isDraw = userScore === oppScore;

        return (
        <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 rounded-3xl border border-neutral-800 space-y-5 animate-fadeIn shadow-2xl">
          {/* EXPLICIT OUTCOME BANNER: VITÓRIA / EMPATE / DERROTA */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isWin
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                : isDraw
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                : 'bg-rose-500/20 border-rose-500/60 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {isWin ? '🏆' : isDraw ? '⚖️' : '❌'}
              </span>
              <div>
                <h4 className="font-black text-base sm:text-lg uppercase tracking-wider text-white">
                  {isWin
                    ? `VITÓRIA DO ${userClub.name.toUpperCase()}! (${finalResult.homeScore} x ${finalResult.awayScore})`
                    : isDraw
                    ? `EMPATE! (${finalResult.homeScore} x ${finalResult.awayScore})`
                    : `DERROTA DO ${userClub.name.toUpperCase()} (${finalResult.homeScore} x ${finalResult.awayScore})`}
                </h4>
                <p className="text-xs opacity-90">
                  {isWin
                    ? 'Você ganhou a partida! (+3 pontos na classificação)'
                    : isDraw
                    ? 'A partida terminou empatada! (+1 ponto na classificação)'
                    : 'Sua equipe foi superada nesta rodada (0 pontos somados).'}
                </p>
              </div>
            </div>

            <span
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shrink-0 ${
                isWin
                  ? 'bg-emerald-500 text-neutral-950'
                  : isDraw
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {isWin ? 'RESULTADO: VITÓRIA (+3 PTS)' : isDraw ? 'RESULTADO: EMPATE (+1 PT)' : 'RESULTADO: DERROTA (0 PTS)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                Relatório Oficial de Desempenho
              </span>
              <h3 className="text-xl font-black text-white font-heading mt-0.5">
                Atuação de {player.name} {player.lastName} (#{player.shirtNumber})
              </h3>
            </div>

            {/* Match Rating */}
            <div className="flex items-center gap-2 bg-neutral-950 px-4 py-2 rounded-xl border border-neutral-700">
              <span className="text-xs text-neutral-400 font-bold uppercase">Nota da Partida</span>
              <span
                className={`text-2xl font-black font-mono ${
                  finalResult.playerRating >= 7.5
                    ? 'text-emerald-400'
                    : finalResult.playerRating >= 6.5
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {finalResult.playerRating > 0 ? finalResult.playerRating.toFixed(1) : '-'}
              </span>
            </div>
          </div>

          {/* Individual Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">
                Gols Marcados
              </span>
              <span className="text-2xl font-black text-emerald-400 font-heading">
                {finalResult.playerGoals}
              </span>
            </div>
            <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">
                Assistências
              </span>
              <span className="text-2xl font-black text-sky-400 font-heading">
                {finalResult.playerAssists}
              </span>
            </div>
            <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">
                Minutos em Campo
              </span>
              <span className="text-2xl font-black text-white font-heading">
                {finalResult.playerMinutes}'
              </span>
            </div>
            <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">
                Desgaste Físico
              </span>
              <span className="text-2xl font-black text-amber-400 font-heading">
                -{finalResult.playerEnergyCost}%
              </span>
            </div>
          </div>

          {/* Press / Manager Narrative Quote */}
          <div className="bg-neutral-950/80 p-4 rounded-xl border border-neutral-800 text-xs text-neutral-300 italic leading-relaxed">
            "{finalResult.summaryNarrative}"
          </div>

          {/* Injury warning if happened */}
          {finalResult.injuryOccurred && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 flex items-center gap-3 text-xs text-red-200">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>
                <strong>Aviso Médico:</strong> {player.shirtName} sofreu{' '}
                {finalResult.injuryOccurred.name} e desfalcará a equipe por{' '}
                {finalResult.injuryOccurred.weeks} semanas.
              </span>
            </div>
          )}

          {/* Action button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onFinishMatch(finalResult)}
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/20 transition"
            >
              <span>Concluir Rodada & Ver Repercussão</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
