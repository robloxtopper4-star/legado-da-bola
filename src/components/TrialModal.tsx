import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Activity, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle,
  Award,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Club, Position, PlayStyle } from '../types';
import { TrialCalculation } from '../utils/calculator';
import { soundFx } from '../utils/audio';
import { ClubBadge } from './ClubBadge';

interface TrialModalProps {
  club: Club;
  playerName: string;
  position: Position;
  playStyle: PlayStyle;
  playerOvr: number;
  calculation: TrialCalculation;
  onSuccess: (approvedClub: Club) => void;
  onReject: (rejectedClub: Club) => void;
  onTryAnotherClub: () => void;
  onRerollTrials: () => void;
  onClose: () => void;
}

type TrialStage = 'idle' | 'physical' | 'technical' | 'match' | 'verdict';

export const TrialModal: React.FC<TrialModalProps> = ({
  club,
  playerName,
  position,
  playStyle,
  playerOvr,
  calculation,
  onSuccess,
  onReject,
  onTryAnotherClub,
  onRerollTrials,
  onClose
}) => {
  const [stage, setStage] = useState<TrialStage>('idle');
  const [stageProgress, setStageProgress] = useState(0);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isPassed, setIsPassed] = useState<boolean | null>(null);
  const [scoutScore, setScoutScore] = useState<number | null>(null);

  // Run the 3-stage trial simulation
  const handleStartTrial = () => {
    soundFx.playWhistle();
    setStage('physical');
    setStageProgress(15);
    setScoutScore(null);
    setLogMessages([
      `Iniciando a bateria de testes no Centro de Treinamento do ${club.name}...`,
      'Fase 1: Tiro de 30m em velocidade e teste de resistência aeróbica em campo.'
    ]);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (stage === 'physical') {
      timer = setTimeout(() => {
        soundFx.playClick();
        setStage('technical');
        setStageProgress(50);
        setLogMessages(prev => [
          ...prev,
          `Físico concluído com empenho notável de ${playerName}!`,
          'Fase 2: Circuito técnico de domínio orientado, agilidade e finalização/passe curto sob pressão.'
        ]);
      }, 1500);
    } else if (stage === 'technical') {
      timer = setTimeout(() => {
        soundFx.playClick();
        setStage('match');
        setStageProgress(85);
        setLogMessages(prev => [
          ...prev,
          `Boas tomadas de decisão como ${position} (${playStyle}).`,
          'Fase 3: Jogo-treino oficial com a comissão técnica e olheiros anotando cada jogada.'
        ]);
      }, 1600);
    } else if (stage === 'match') {
      timer = setTimeout(() => {
        // Roll dice between 1 and 100
        const roll = Math.floor(Math.random() * 100) + 1;
        const approved = roll <= calculation.percentage;

        setScoutScore(roll);
        setIsPassed(approved);
        setStage('verdict');
        setStageProgress(100);

        if (approved) {
          soundFx.playFanfare();
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch {
            // Ignore if canvas unavailable
          }
          setLogMessages(prev => [
            ...prev,
            'Apito final no coletivo!',
            `🎲 Sorteio dos Olheiros: Tirou ${roll}/100 (Necessário ≤ ${calculation.percentage})`,
            `VEREDITO: APROVADO! O técnico da base do ${club.name} aprovou sua contratação!`
          ]);
        } else {
          soundFx.playWhistle();
          onReject(club);
          setLogMessages(prev => [
            ...prev,
            'Apito final no coletivo.',
            `🎲 Sorteio dos Olheiros: Tirou ${roll}/100 (Necessário ≤ ${calculation.percentage})`,
            `VEREDITO: NÃO APROVADO. A concorrência para ${position} foi implacável no ${club.name}.`
          ]);
        }
      }, 1800);
    }

    return () => clearTimeout(timer);
  }, [stage, calculation.percentage, club, playerName, position, playStyle, onReject]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Club Badge */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
          <div className="flex items-center gap-4">
            <ClubBadge club={club} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-bold tracking-widest text-emerald-400">
                  Avaliação Oficial de Peneira
                </span>
                <span className="text-xs text-neutral-500">•</span>
                <span className="text-xs text-neutral-400">{club.country}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-heading tracking-tight">
                {club.name}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Centro de Treinamento • Estádio {club.stadiumName}
              </p>
            </div>
          </div>

          {stage === 'idle' && (
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-800 transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* Idle Stage: Pre-Trial Presentation */}
        {stage === 'idle' && (
          <div className="space-y-6">
            {/* Probability Gauge */}
            <div className="bg-neutral-950/80 p-5 rounded-2xl border border-neutral-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs text-neutral-400 font-medium">Probabilidade de Aprovação:</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl sm:text-4xl font-black font-heading text-white">
                      {calculation.percentage}%
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border border-neutral-700 ${calculation.difficultyColor}`}>
                      Dificuldade {calculation.difficulty}
                    </span>
                  </div>
                </div>

                <div className="text-right sm:text-right text-xs text-neutral-400 space-y-0.5">
                  <p><strong className="text-neutral-200">Seu Atleta:</strong> {playerName} ({playerOvr} OVR)</p>
                  <p><strong className="text-neutral-200">Posição:</strong> {position} ({playStyle})</p>
                  <p><strong className="text-neutral-200">Concorrência:</strong> {calculation.competitionLevel}</p>
                </div>
              </div>

              {/* Progress Bar Visual */}
              <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                <div 
                  className={`h-full transition-all duration-700 ${
                    calculation.percentage >= 70
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : calculation.percentage >= 40
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-rose-500 to-orange-500'
                  }`}
                  style={{ width: `${calculation.percentage}%` }}
                />
              </div>

              {/* Scout Report */}
              <div className="bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800 text-xs text-neutral-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Parecer do Olheiro-Chefe:</strong>
                  <span>{calculation.scoutVerdict}</span>
                </div>
              </div>
            </div>

            {/* Trial Flow Explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center space-y-1">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 font-bold mx-auto flex items-center justify-center text-xs">
                  1
                </div>
                <h4 className="font-bold text-xs text-white">Testes Físicos</h4>
                <p className="text-[11px] text-neutral-400">Velocidade, impulsão e resistência em campo.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center space-y-1">
                <div className="w-8 h-8 rounded-full bg-teal-500/15 text-teal-400 font-bold mx-auto flex items-center justify-center text-xs">
                  2
                </div>
                <h4 className="font-bold text-xs text-white">Circuito Técnico</h4>
                <p className="text-[11px] text-neutral-400">Domínio, passe curto, drible e finalização.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center space-y-1">
                <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-400 font-bold mx-auto flex items-center justify-center text-xs">
                  3
                </div>
                <h4 className="font-bold text-xs text-white">Coletivo Decisivo</h4>
                <p className="text-[11px] text-neutral-400">Jogo-treino com olheiros e comissão técnica.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleStartTrial}
                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-current" />
                FAZER TESTE NA PENEIRA ({calculation.percentage}% DE CHANCE)
              </button>

              <button
                type="button"
                onClick={onTryAnotherClub}
                className="w-full sm:w-auto py-4 px-5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs transition"
              >
                Escolher Outro Clube
              </button>
            </div>
          </div>
        )}

        {/* Running Stages Simulation */}
        {(stage === 'physical' || stage === 'technical' || stage === 'match') && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-pulse">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                {stage === 'physical' && 'ETAPA 1/3: Testes de Velocidade & Resistência Física'}
                {stage === 'technical' && 'ETAPA 2/3: Circuito Técnico & Tomada de Decisão'}
                {stage === 'match' && 'ETAPA 3/3: Jogo-Treino Oficial / Coletivo da Base'}
              </div>
              <h3 className="text-xl font-bold text-white">
                Os olheiros do {club.name} estão avaliando você...
              </h3>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${stageProgress}%` }}
              />
            </div>

            {/* Live Log Terminal */}
            <div className="bg-black/70 p-4 rounded-2xl border border-neutral-800 font-mono text-xs space-y-2 max-h-48 overflow-y-auto">
              {logMessages.map((msg, i) => (
                <div key={i} className="flex items-start gap-2 text-neutral-300">
                  <span className="text-emerald-500 font-bold">›</span>
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verdict Stage */}
        {stage === 'verdict' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Scout Score & Threshold Banner */}
            {scoutScore !== null && (
              <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${
                    isPassed 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  }`}>
                    {scoutScore}
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-neutral-400 block">
                      Resultado da Avaliação (D100)
                    </span>
                    <span className="text-xs font-semibold text-white">
                      Nota dos Olheiros: <strong className="font-mono text-emerald-300">{scoutScore}</strong> / 100
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs">
                  <span className="text-neutral-400 block">Corte de Aprovação Exigido:</span>
                  <span className="font-mono font-bold text-white">
                    Tirar ≤ <span className="text-amber-400 font-black text-sm">{calculation.percentage}</span> ({calculation.percentage}% de chance)
                  </span>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    {isPassed ? `✅ ${scoutScore} ≤ ${calculation.percentage} (Aprovado!)` : `❌ ${scoutScore} > ${calculation.percentage} (Reprovado)`}
                  </p>
                </div>
              </div>
            )}

            {isPassed ? (
              // SUCCESS
              <div className="text-center space-y-4 bg-emerald-950/30 border border-emerald-500/40 p-6 rounded-2xl">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-widest font-black text-emerald-400">
                    Aprovado na Peneira!
                  </span>
                  <h3 className="text-2xl font-black text-white font-heading">
                    PARABÉNS! VOCÊ PASSOU NO TESTE DO {club.name.toUpperCase()}!
                  </h3>
                  <p className="text-xs text-neutral-300 max-w-lg mx-auto leading-relaxed pt-1">
                    A comissão técnica e os avaliadores de base ficaram impressionados com seu talento e personalidade. O seu primeiro contrato de formação está pronto para ser assinado!
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onSuccess(club)}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/30 transition transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    ASSINAR CONTRATO E INICIAR MEU LEGADO
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              // FAILED
              <div className="text-center space-y-4 bg-rose-950/30 border border-rose-500/40 p-6 rounded-2xl">
                <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
                  <XCircle className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-widest font-black text-rose-400">
                    Portas Fechadas • Não Aprovado
                  </span>
                  <h3 className="text-2xl font-black text-white font-heading">
                    Você foi reprovado nos testes do {club.name}
                  </h3>
                  <p className="text-xs text-neutral-300 max-w-lg mx-auto leading-relaxed pt-1">
                    A comissão técnica do {club.name} encerrou a avaliação e não aceita mais testes para o seu perfil no momento. Para iniciar sua carreira, você deve tentar outro clube com menor concorrência ou sortear novos clubes de base!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={onRerollTrials}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    🎲 Sortear Novas Peneiras com Outros Clubes
                  </button>

                  <button
                    type="button"
                    onClick={onTryAnotherClub}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs transition"
                  >
                    🔍 Escolher Outro Clube da Lista
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
