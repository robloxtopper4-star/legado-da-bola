import React, { useEffect } from 'react';
import { Trophy, Award, Star, CheckCircle, Share2, Download, ArrowRight, Heart, User, LogOut, Plus, FolderOpen } from 'lucide-react';
import { CareerSave } from '../types';
import { calculateCareerGrade } from '../services/awardsEngine';
import { formatCurrency, formatCurrencyBRL } from '../utils/calculator';
import { soundFx } from '../utils/audio';
import { ClubBadge } from './ClubBadge';
import confetti from 'canvas-confetti';

interface RetirementModalProps {
  isOpen: boolean;
  career: CareerSave;
  onClose: () => void;
  onExport: () => void;
  onConfirmRetirement?: () => void;
  onGoToSaves?: () => void;
  onCreateNewCareer?: () => void;
}

export const RetirementModal: React.FC<RetirementModalProps> = ({
  isOpen,
  career,
  onClose,
  onExport,
  onConfirmRetirement,
  onGoToSaves,
  onCreateNewCareer
}) => {
  const p = career.player;
  const grade = calculateCareerGrade(career);

  useEffect(() => {
    if (isOpen) {
      soundFx.playFanfare();
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Derive club with most goals
  const clubGoalsMap: Record<string, number> = {};
  career.history.forEach(h => {
    clubGoalsMap[h.clubName] = (clubGoalsMap[h.clubName] || 0) + h.goals;
  });
  let topClub = p.contract.clubName;
  let maxClubGoals = p.careerGoals;
  for (const club in clubGoalsMap) {
    if (clubGoalsMap[club] > maxClubGoals) {
      maxClubGoals = clubGoalsMap[club];
      topClub = club;
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-700 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-auto p-6 sm:p-8 space-y-6 animate-fadeIn">
        {/* Top Trophy Banner with Player Photo */}
        <div className="text-center space-y-3 border-b border-neutral-800 pb-6">
          <div className="relative inline-block mx-auto">
            {p.photoUrl ? (
              <img
                src={p.photoUrl}
                alt={p.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-amber-500 shadow-2xl shadow-amber-500/30 mx-auto"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-neutral-950 border-4 border-amber-500 flex items-center justify-center text-4xl shadow-2xl shadow-amber-500/30 mx-auto">
                ⚽
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 p-1.5 bg-amber-500 text-neutral-950 rounded-xl shadow-lg">
              <Trophy className="w-5 h-5 fill-current" />
            </div>
          </div>

          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-amber-400 block mb-1">
              HOMENAGEM DE APOSENTADORIA & HALL DA FAMA
            </span>

            <h2 className="text-3xl sm:text-4xl font-black text-white font-heading tracking-tight">
              {p.name} {p.lastName}
            </h2>

            <p className="text-xs text-neutral-400 flex items-center justify-center gap-2 mt-1">
              <ClubBadge clubId={p.contract.clubId} name={p.contract.clubName} size="xs" />
              <span>Último clube: {p.contract.clubName}</span>
              <span>•</span>
              <span>Posição: {p.primaryPosition}</span>
              <span>•</span>
              <span>#{p.shirtNumber}</span>
            </p>
          </div>

          {career.isRetired ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40">
              <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
              Carreira Oficialmente Encerrada
            </div>
          ) : (
            <div className="p-3.5 bg-red-950/40 border border-red-500/40 rounded-2xl max-w-md mx-auto text-xs text-red-200 flex flex-col items-center gap-2.5 shadow-lg">
              <p className="text-center font-medium">Ao confirmar sua aposentadoria, sua carreira será permanentemente encerrada e você não poderá mais jogar partidas.</p>
              {onConfirmRetirement && (
                <button
                  onClick={() => {
                    soundFx.playWhistle();
                    onConfirmRetirement();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Confirmar Aposentadoria Definitiva
                </button>
              )}
            </div>
          )}
        </div>

        {/* Big Career Grade Badge */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 p-6 rounded-2xl border border-amber-500/40 text-center space-y-2">
          <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">
            Nota Final da Carreira
          </span>
          <div className="text-4xl sm:text-5xl font-black text-amber-300 font-heading">
            {grade.title}
          </div>
          <p className="text-xs text-neutral-300 max-w-xl mx-auto leading-relaxed">
            {grade.description}
          </p>
        </div>

        {/* Complete Career Stat Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 text-center">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Partidas Oficiais</span>
            <span className="text-2xl font-black text-white font-mono">{p.careerMatches}</span>
          </div>
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 text-center">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Gols na Carreira</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{p.careerGoals}</span>
          </div>
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 text-center">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Assistências</span>
            <span className="text-2xl font-black text-blue-400 font-mono">{p.careerAssists}</span>
          </div>
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 text-center">
            <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Títulos Coletivos</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{p.careerTrophies}</span>
          </div>
        </div>

        {/* Secondary Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-400">Total de Temporadas:</span>
              <span className="text-white font-bold">{career.totalSeasonsPlayed + 1} temporadas</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Clube com Mais Gols:</span>
              <span className="text-white font-bold">{topClub}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Maior OVR Atingido:</span>
              <span className="text-emerald-400 font-bold font-mono">{p.ovr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Pico de Valor de Mercado:</span>
              <span className="text-white font-bold">{formatCurrency(p.marketValue)}</span>
            </div>
          </div>

          <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-400">Jogos pela Seleção:</span>
              <span className="text-white font-bold">{p.nationalCaps} convocações</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Gols pela Seleção:</span>
              <span className="text-white font-bold">{p.nationalGoals} gols</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Prêmios Individuais:</span>
              <span className="text-amber-400 font-bold">{career.awardsCabinet.length} honrarias</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Ganhos Salariais Totais:</span>
              <span className="text-emerald-400 font-bold">{formatCurrencyBRL(p.careerEarnings)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 border border-neutral-700 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Baixar Certificado JSON
            </button>

            {onGoToSaves && (
              <button
                onClick={onGoToSaves}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 border border-neutral-700 transition cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-blue-400" />
                Meus Saves
              </button>
            )}

            {onCreateNewCareer && (
              <button
                onClick={onCreateNewCareer}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs font-bold text-emerald-400 border border-emerald-500/40 hover:border-emerald-500/80 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nova Carreira
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs tracking-wide transition shadow-lg shadow-amber-500/20 cursor-pointer ml-auto"
          >
            {career.isRetired ? 'Fechar Resumo' : 'Fechar Janela'}
          </button>
        </div>
      </div>
    </div>
  );
};
