import React, { useState } from 'react';
import { Trophy, Award, Flame, X, User, ArrowUpRight, Star } from 'lucide-react';
import { SIMULATED_GLOBAL_RANKINGS, GlobalRankUser } from '../services/storageService';
import { PlayerProfile } from '../types';
import { formatCurrency } from '../utils/calculator';
import { soundFx } from '../utils/audio';

interface RankingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayer: PlayerProfile | null;
}

export const RankingsModal: React.FC<RankingsModalProps> = ({
  isOpen,
  onClose,
  currentPlayer
}) => {
  const [filter, setFilter] = useState<'allTime' | 'monthly' | 'weekly'>('allTime');
  const [sortBy, setSortBy] = useState<'careerScore' | 'ovr' | 'goals' | 'trophies' | 'ballonDors'>('careerScore');

  if (!isOpen) return null;

  // Merge current player into rankings if available
  const list: GlobalRankUser[] = [...SIMULATED_GLOBAL_RANKINGS];
  if (currentPlayer) {
    list.push({
      id: 'current_user',
      playerName: `${currentPlayer.name} ${currentPlayer.lastName} (Você)`,
      nationality: currentPlayer.nationality,
      position: currentPlayer.primaryPosition,
      ovr: currentPlayer.ovr,
      goals: currentPlayer.careerGoals,
      assists: currentPlayer.careerAssists,
      trophies: currentPlayer.careerTrophies,
      ballonDors: currentPlayer.careerAwards,
      marketValue: currentPlayer.marketValue,
      careerScore: Math.round(currentPlayer.ovr + (currentPlayer.careerGoals * 0.05) + (currentPlayer.careerTrophies * 1.2)),
      userHandle: '@voce_jogador',
      category: 'allTime'
    });
  }

  // Sort list
  list.sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="font-extrabold text-base text-white tracking-tight font-heading">
              Hall da Fama & Ranking Global de Carreiras
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sort Bar */}
        <div className="px-6 py-3 bg-neutral-950/40 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-neutral-400">Ordenar por:</span>
            <button
              onClick={() => setSortBy('careerScore')}
              className={`px-3 py-1 rounded-lg border transition ${
                sortBy === 'careerScore' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
              }`}
            >
              Pontuação Histórica
            </button>
            <button
              onClick={() => setSortBy('ovr')}
              className={`px-3 py-1 rounded-lg border transition ${
                sortBy === 'ovr' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
              }`}
            >
              Maior OVR
            </button>
            <button
              onClick={() => setSortBy('goals')}
              className={`px-3 py-1 rounded-lg border transition ${
                sortBy === 'goals' ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
              }`}
            >
              Mais Gols
            </button>
            <button
              onClick={() => setSortBy('trophies')}
              className={`px-3 py-1 rounded-lg border transition ${
                sortBy === 'trophies' ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
              }`}
            >
              Títulos
            </button>
          </div>

          <span className="text-[11px] text-neutral-500">
            Sincronizado automaticamente com os servidores da comunidade
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {list.map((item, idx) => {
            const isMe = item.id === 'current_user';
            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
                  isMe
                    ? 'bg-emerald-500/15 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : idx === 0
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black font-mono text-sm ${
                    idx === 0 ? 'bg-amber-400 text-neutral-950' : idx === 1 ? 'bg-neutral-300 text-neutral-950' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                      <span>{item.playerName}</span>
                      <span className="text-[10px] font-mono font-normal text-neutral-400">{item.userHandle}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                      <span>{item.nationality}</span>
                      <span>•</span>
                      <span className="font-semibold text-neutral-300">{item.position}</span>
                      <span>•</span>
                      <span>{formatCurrency(item.marketValue)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right font-mono">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase block">OVR</span>
                    <span className="font-bold text-emerald-400">{item.ovr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase block">Gols</span>
                    <span className="font-bold text-white">{item.goals}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase block">Títulos</span>
                    <span className="font-bold text-amber-300">{item.trophies}</span>
                  </div>
                  <div className="bg-neutral-900 px-3 py-1 rounded-lg border border-neutral-700">
                    <span className="text-[9px] text-neutral-400 uppercase block">Nota</span>
                    <span className="font-black text-amber-400 text-sm">{item.careerScore}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
