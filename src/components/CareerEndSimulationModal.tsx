import React, { useState } from 'react';
import { 
  Trophy, 
  Award, 
  Sparkles, 
  FastForward, 
  Activity, 
  Calendar, 
  CheckCircle2, 
  ChevronRight, 
  ShieldCheck, 
  Flame, 
  HeartHandshake,
  Star,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CareerSave, Club, SeasonStats } from '../types';
import { simulateFullSeason } from '../services/simulationEngine';
import { calculateCareerGrade } from '../services/awardsEngine';
import { soundFx } from '../utils/audio';
import { ClubBadge } from './ClubBadge';

interface CareerEndSimulationModalProps {
  career: CareerSave;
  allClubs: Club[];
  onFinishSimulation: (updatedCareer: CareerSave) => void;
  onClose: () => void;
  onOpenRetirement: () => void;
}

export const CareerEndSimulationModal: React.FC<CareerEndSimulationModalProps> = ({
  career,
  allClubs,
  onFinishSimulation,
  onClose,
  onOpenRetirement
}) => {
  const [targetRetireAge, setTargetRetireAge] = useState(38);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [simMode, setSimMode] = useState<'dynamic' | 'instant'>('dynamic');

  // Simulation progression state
  const [currentSimAge, setCurrentSimAge] = useState(career.player.age);
  const [currentSimYear, setCurrentSimYear] = useState(career.currentYear);
  const [simGoals, setSimGoals] = useState(career.player.careerGoals);
  const [simAssists, setSimAssists] = useState(career.player.careerAssists);
  const [simMatches, setSimMatches] = useState(career.player.careerMatches);
  const [simTrophies, setSimTrophies] = useState(career.trophyCabinet.length);
  const [simAwards, setSimAwards] = useState(career.awardsCabinet.length);
  const [simOvr, setSimOvr] = useState(career.player.ovr);
  const [seasonLog, setSeasonLog] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);

  const [finalCareerState, setFinalCareerState] = useState<CareerSave | null>(null);

  const seasonsToPlay = Math.max(1, targetRetireAge - career.player.age);

  const runSimulation = () => {
    soundFx.playWhistle();
    setIsSimulating(true);

    let tempCareer: CareerSave = JSON.parse(JSON.stringify(career));
    const startAge = tempCareer.player.age;
    const totalSeasons = Math.max(1, targetRetireAge - startAge);

    if (simMode === 'instant') {
      // Run all seasons synchronously
      for (let s = 0; s < totalSeasons; s++) {
        tempCareer = simulateSingleSeasonInCareer(tempCareer, allClubs);
      }

      setFinalCareerState(tempCareer);
      setCurrentSimAge(tempCareer.player.age);
      setCurrentSimYear(tempCareer.currentYear);
      setSimGoals(tempCareer.player.careerGoals);
      setSimAssists(tempCareer.player.careerAssists);
      setSimMatches(tempCareer.player.careerMatches);
      setSimTrophies(tempCareer.trophyCabinet.length);
      setSimAwards(tempCareer.awardsCabinet.length);
      setSimOvr(tempCareer.player.ovr);
      setProgressPercent(100);
      setIsSimulating(false);
      setIsFinished(true);
      soundFx.playFanfare();
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      } catch {}
    } else {
      // Dynamic mode with animated step-by-step progression
      let currentSeasonIdx = 0;

      const interval = setInterval(() => {
        if (currentSeasonIdx >= totalSeasons) {
          clearInterval(interval);
          setFinalCareerState(tempCareer);
          setIsSimulating(false);
          setIsFinished(true);
          soundFx.playFanfare();
          try {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
          } catch {}
          return;
        }

        // Simulate this season
        tempCareer = simulateSingleSeasonInCareer(tempCareer, allClubs);
        currentSeasonIdx++;

        const pct = Math.round((currentSeasonIdx / totalSeasons) * 100);
        setProgressPercent(pct);
        setCurrentSimAge(tempCareer.player.age);
        setCurrentSimYear(tempCareer.currentYear);
        setSimGoals(tempCareer.player.careerGoals);
        setSimAssists(tempCareer.player.careerAssists);
        setSimMatches(tempCareer.player.careerMatches);
        setSimTrophies(tempCareer.trophyCabinet.length);
        setSimAwards(tempCareer.awardsCabinet.length);
        setSimOvr(tempCareer.player.ovr);

        const latestHistory = tempCareer.history[0];
        if (latestHistory) {
          setSeasonLog(prev => [
            `Ano ${latestHistory.seasonYear}: ${latestHistory.goals} Gols, ${latestHistory.assists} Assist. em ${latestHistory.matches} jogos • OVR ${tempCareer.player.ovr} (${latestHistory.trophiesWon.length > 0 ? latestHistory.trophiesWon.join(', ') : 'Temporada regular'})`,
            ...prev.slice(0, 4)
          ]);
        }

        soundFx.playKick();
      }, 350);
    }
  };

  const handleFinishAndSave = () => {
    if (!finalCareerState) return;
    onFinishSimulation(finalCareerState);
    onClose();
    onOpenRetirement();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-heading">
                Simular até o Final da Carreira
              </h2>
              <span className="text-xs text-neutral-400">
                Avanço completo de todas as temporadas até a consagração no Hall da Fama
              </span>
            </div>
          </div>

          {!isSimulating && (
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {!isSimulating && !isFinished && (
            <>
              {/* Current Status Box */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ClubBadge clubId={career.player.contract.clubId} size="md" />
                  <div>
                    <div className="text-sm font-black text-white">
                      {career.player.name} {career.player.lastName}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      Idade atual: <strong className="text-white">{career.player.age} anos</strong> • Ano {career.currentYear}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-neutral-500 uppercase font-bold">OVR / Potencial</div>
                  <div className="text-sm font-mono font-bold text-amber-400">
                    {career.player.ovr} / {career.player.potential}
                  </div>
                </div>
              </div>

              {/* Configure Target Age */}
              <div className="p-5 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                <label className="block text-xs font-black text-white uppercase tracking-wider">
                  Idade Alvo de Aposentadoria
                </label>
                <div className="flex items-center gap-3">
                  {[36, 38, 40].map(age => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setTargetRetireAge(age)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-black transition ${
                        targetRetireAge === age
                          ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-lg shadow-amber-500/20'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      {age} Anos ({Math.max(1, age - career.player.age)} temporadas)
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-neutral-400">
                  O simulador jogará automaticamente todas as temporadas restantes até que o jogador atinja {targetRetireAge} anos, acumulando gols, títulos, prêmios e calculando sua nota de lenda no Hall da Fama.
                </p>
              </div>

              {/* Speed Mode */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSimMode('dynamic')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    simMode === 'dynamic'
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Simulação Dinâmica
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-1">
                    Acompanhe ano a ano os gols subindo e os troféus sendo erguidos.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimMode('instant')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    simMode === 'instant'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                    <FastForward className="w-3.5 h-3.5 text-amber-400" />
                    Simulação Instantânea
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-1">
                    Gera a carreira completa instantaneamente em 1 segundo.
                  </div>
                </button>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={runSimulation}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 transition transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Iniciar Simulação até os {targetRetireAge} Anos ({seasonsToPlay} Temporadas)
                </button>
              </div>
            </>
          )}

          {/* SIMULATION IN PROGRESS OR FINISHED */}
          {(isSimulating || isFinished) && (
            <div className="space-y-5">
              {/* Live Ticker Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase block">Idade Atual</span>
                  <span className="text-2xl font-black text-white font-heading">{currentSimAge} anos</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">Ano {currentSimYear}</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase block">Gols Totais</span>
                  <span className="text-2xl font-black text-emerald-400 font-heading">{simGoals}</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">{simAssists} Assistências</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase block">Partidas</span>
                  <span className="text-2xl font-black text-white font-heading">{simMatches}</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">Jogos Oficiais</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase block">Títulos</span>
                  <span className="text-2xl font-black text-amber-400 font-heading">{simTrophies}</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">{simAwards} Prêmios Indiv.</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-neutral-400">
                  <span>{isFinished ? 'Carreira Concluída com Glória!' : 'Simulando temporadas...'}</span>
                  <span className="font-mono text-amber-400">{progressPercent}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-neutral-950 border border-neutral-800 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Live Season Log */}
              {seasonLog.length > 0 && (
                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2 max-h-48 overflow-y-auto">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    Histórico das Temporadas Simuladas
                  </div>
                  {seasonLog.map((log, i) => (
                    <div key={i} className="text-xs text-neutral-300 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Finished Celebration Box */}
              {isFinished && (
                <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-500/20 to-neutral-950 border border-amber-500/40 text-center space-y-3 animate-fadeIn">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Trophy className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white font-heading">
                      Fim da Linha: Uma Trajetória Lendária nos Gramados!
                    </h3>
                    <p className="text-xs text-neutral-300 mt-1 max-w-md mx-auto">
                      Seu jogador completou sua jornada profissional aos {currentSimAge} anos de idade. Foram {simGoals} gols marcados, {simTrophies} taças erguidas e um legado eterno no futebol mundial.
                    </p>
                  </div>

                  <button
                    onClick={handleFinishAndSave}
                    className="px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/30 transition transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Ver Hall da Fama & Cerimônia Oficial de Aposentadoria 🏆
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper to simulate one full season and advance age/history in a single career object
function simulateSingleSeasonInCareer(career: CareerSave, allClubs: Club[]): CareerSave {
  const simResult = simulateFullSeason(career, allClubs);
  return simResult.updatedCareer;
}
