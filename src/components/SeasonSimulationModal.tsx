import React, { useState, useEffect } from 'react';
import { 
  FastForward, 
  Trophy, 
  Award, 
  Sparkles, 
  TrendingUp, 
  Briefcase, 
  CheckCircle2, 
  ArrowRight, 
  Calendar,
  Activity,
  Flame,
  ShieldCheck,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CareerSave, Club } from '../types';
import { simulateFullSeason, FullSeasonSimulationSummary } from '../services/simulationEngine';
import { soundFx } from '../utils/audio';
import { ClubBadge } from './ClubBadge';

interface SeasonSimulationModalProps {
  career: CareerSave;
  allClubs: Club[];
  onFinishSimulation: (updatedCareer: CareerSave) => void;
  onClose: () => void;
}

export const SeasonSimulationModal: React.FC<SeasonSimulationModalProps> = ({
  career,
  allClubs,
  onFinishSimulation,
  onClose
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [simulatedWeek, setSimulatedWeek] = useState(career.currentWeek);
  const [summary, setSummary] = useState<FullSeasonSimulationSummary | null>(null);
  const [simMode, setSimMode] = useState<'dynamic' | 'instant'>('dynamic');
  const [liveHighlights, setLiveHighlights] = useState<string[]>([]);

  const club = allClubs.find(c => c.id === career.player.contract.clubId) || allClubs[0];

  const handleStartSimulation = () => {
    soundFx.playClick();
    setIsSimulating(true);

    // Run the engine
    const result = simulateFullSeason(career, allClubs);

    if (simMode === 'instant') {
      setProgressPercent(100);
      setSimulatedWeek(48);
      setSummary(result);
      setIsSimulating(false);
      soundFx.playFanfare();
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {
        // Ignore if unavailable
      }
    } else {
      // Dynamic mode: iterate with interval
      let currentW = career.currentWeek;
      const endW = 48;
      const totalSteps = endW - currentW + 1;
      let stepCount = 0;

      const interval = setInterval(() => {
        stepCount++;
        currentW = Math.min(endW, currentW + 2);
        setSimulatedWeek(currentW);
        const pct = Math.min(100, Math.round((stepCount / (totalSteps / 2)) * 100));
        setProgressPercent(pct);

        // Find highlights up to this week
        const found = result.keyMoments.filter(m => m.week <= currentW);
        if (found.length > 0) {
          const latest = found[found.length - 1];
          setLiveHighlights(prev => [
            `Semana ${latest.week}: ${latest.headline} (${latest.scoreStr})`,
            ...prev.slice(0, 3)
          ]);
        }

        if (currentW >= endW) {
          clearInterval(interval);
          setSummary(result);
          setIsSimulating(false);
          soundFx.playFanfare();
          try {
            confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
          } catch {
            // Ignore
          }
        }
      }, 140);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 w-full max-w-3xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
          <div className="flex items-center gap-4">
            <ClubBadge club={club} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-bold tracking-widest text-emerald-400">
                  Simulação de Temporada Completa
                </span>
                <span className="text-xs text-neutral-500">•</span>
                <span className="text-xs text-neutral-400">Ano {career.currentYear}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-heading tracking-tight">
                {club.name}
              </h2>
            </div>
          </div>

          {!isSimulating && !summary && (
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-800 transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* State 1: Configuration & Launch */}
        {!isSimulating && !summary && (
          <div className="space-y-6">
            <div className="bg-neutral-950/80 p-5 rounded-2xl border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">
                    Simular da Semana {career.currentWeek} até o Fim do Ano (Semana 48)
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                    Todas as partidas restantes do calendário serão simuladas de acordo com o seu nível técnico ({career.player.ovr} OVR), táticas do time e adversários da liga.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-2xl font-black font-heading text-emerald-400">
                    {Math.max(1, 48 - career.currentWeek + 1)}
                  </span>
                  <p className="text-[10px] text-neutral-500 uppercase font-bold">Jogos restantes</p>
                </div>
              </div>

              {/* Simulation Mode Choice */}
              <div className="pt-2 border-t border-neutral-800/80">
                <span className="text-xs font-semibold text-neutral-300 block mb-2">
                  Velocidade da Simulação:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { soundFx.playClick(); setSimMode('dynamic'); }}
                    className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                      simMode === 'dynamic'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Activity className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Dinâmica com Lances (Recomendado)</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Acompanhe o ticker de rodadas, placares e gols marcados semana a semana.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { soundFx.playClick(); setSimMode('instant'); }}
                    className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                      simMode === 'instant'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Instantânea (Flash ⚡)</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Calcula a temporada inteira em 1 segundo e vai direto aos troféus e prêmios.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* CTA button */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition"
              >
                Voltar ao Calendário Partida a Partida
              </button>

              <button
                type="button"
                onClick={handleStartSimulation}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <FastForward className="w-4 h-4 fill-current" />
                SIMULAR TEMPORADA COMPLETA ⏩
              </button>
            </div>
          </div>
        )}

        {/* State 2: Simulation In Progress */}
        {isSimulating && (
          <div className="space-y-6 py-6 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-pulse">
              <Activity className="w-4 h-4 animate-spin" />
              Simulando Rodada {simulatedWeek} de 48...
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white font-heading">
                Disputando a Temporada {career.currentYear}
              </h3>
              <p className="text-xs text-neutral-400">
                Calculando gols, assistências, resultados da liga e desenvolvimento atlético...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Live Highlights ticker */}
            <div className="bg-black/60 p-4 rounded-2xl border border-neutral-800 text-left font-mono text-xs space-y-2 min-h-24">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold block mb-1">
                Momentos Chave da Campanha:
              </span>
              {liveHighlights.length === 0 ? (
                <span className="text-neutral-500 italic">Disputando as rodadas iniciais...</span>
              ) : (
                liveHighlights.map((hl, i) => (
                  <div key={i} className="flex items-center gap-2 text-emerald-400">
                    <span>⚡</span>
                    <span>{hl}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* State 3: Season Results & Celebrations */}
        {summary && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Banner */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-neutral-950 p-5 rounded-2xl border border-emerald-500/30 text-center space-y-1">
              <span className="text-xs uppercase tracking-widest font-black text-emerald-400">
                Balanço Final da Temporada {summary.seasonYear}
              </span>
              <h3 className="text-2xl font-black text-white font-heading">
                Temporada Concluída com Sucesso! 🎉
              </h3>
              <p className="text-xs text-neutral-300">
                {summary.club.name} terminou na <strong className="text-white">{summary.leaguePosition}ª posição</strong> ({summary.teamWins}V, {summary.teamDraws}E, {summary.teamLosses}D).
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800 text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Jogos</span>
                <span className="text-2xl font-black font-heading text-white">{summary.matchesPlayed}</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">Partidas</span>
              </div>

              <div className="bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Gols</span>
                <span className="text-2xl font-black font-heading text-emerald-400">{summary.goalsScored}</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">Marcados</span>
              </div>

              <div className="bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800 text-center">
                <span className="text-[10px] uppercase font-bold text-teal-400 block mb-1">Assistências</span>
                <span className="text-2xl font-black font-heading text-teal-400">{summary.assistsGiven}</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">Passes a Gol</span>
              </div>

              <div className="bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Nota Média</span>
                <span className="text-2xl font-black font-heading text-amber-400">{summary.avgRating.toFixed(1)}</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">Avaliação</span>
              </div>
            </div>

            {/* Trophies & Awards Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Trophies */}
              <div className="bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Trophy className="w-4 h-4" />
                  <span>Títulos Conquistados ({summary.trophiesWon.length})</span>
                </div>
                {summary.trophiesWon.length > 0 ? (
                  <div className="space-y-1.5">
                    {summary.trophiesWon.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-neutral-200">
                        <span className="text-amber-400">🏆</span>
                        <span className="font-semibold">{t}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 italic">
                    Nenhum troféu nesta temporada. Foco total na próxima!
                  </p>
                )}
              </div>

              {/* Individual Awards */}
              <div className="bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <Award className="w-4 h-4" />
                  <span>Prêmios Individuais ({summary.awardsWon.length})</span>
                </div>
                {summary.awardsWon.length > 0 ? (
                  <div className="space-y-1.5">
                    {summary.awardsWon.map((a, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-neutral-200">
                        <span className="text-emerald-400">🎖️</span>
                        <span className="font-semibold">{a}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 italic">
                    Continue evoluindo seus atributos para entrar na disputa das honrarias.
                  </p>
                )}
              </div>
            </div>

            {/* Evolution and Transfer Offers note */}
            <div className="bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-neutral-200 font-bold block">
                    Idade: {summary.updatedCareer.player.age} anos • OVR Atual: {summary.updatedCareer.player.ovr}
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    +{summary.trainingPointsEarned} Pontos de Treino adquiridos para distribuir nos atributos.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-amber-300 font-bold">
                  {summary.transfersOffersReceived} Nova(s) Proposta(s) na Janela
                </span>
              </div>
            </div>

            {/* Final CTA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onFinishSimulation(summary.updatedCareer)}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                AVANÇAR PARA A TEMPORADA {summary.seasonYear + 1} ⚽
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
