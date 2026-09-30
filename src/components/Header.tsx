import React, { useState } from 'react';
import { Volume2, VolumeX, Save, Shield, Award, Trophy, User, Calendar, Zap, Heart, Home, ArrowLeft, Flame, Users, Edit3 } from 'lucide-react';
import { PlayerProfile } from '../types';
import { soundFx } from '../utils/audio';
import { getMoraleColor, formatCurrency } from '../utils/calculator';
import { ClubBadge } from './ClubBadge';

interface HeaderProps {
  player: PlayerProfile | null;
  currentYear: number;
  currentWeek: number;
  onOpenAdmin: () => void;
  onOpenRankings: () => void;
  onOpenPenalties?: () => void;
  onOpenFriendly?: () => void;
  onOpenMultiplayer?: () => void;
  onOpenSquadEditor?: () => void;
  onManualSave?: () => void;
  onGoHome?: () => void;
  currentScreen?: 'saves' | 'creator' | 'dashboard' | 'match' | 'penalties' | 'friendly' | 'multiplayer' | 'squad_editor';
}

export const Header: React.FC<HeaderProps> = ({
  player,
  currentYear,
  currentWeek,
  onOpenAdmin,
  onOpenRankings,
  onOpenPenalties,
  onOpenFriendly,
  onOpenMultiplayer,
  onOpenSquadEditor,
  onManualSave,
  onGoHome,
  currentScreen
}) => {
  const [isMuted, setIsMuted] = useState(soundFx.getMuted());
  const [savedBadge, setSavedBadge] = useState(false);

  const handleToggleSound = () => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
    if (!muted) soundFx.playClick();
  };

  const handleSave = () => {
    if (onManualSave) {
      onManualSave();
      soundFx.playClick();
      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Game Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onGoHome} title="Ir para o menu principal">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-emerald-500 to-emerald-700 flex items-center justify-center font-extrabold text-neutral-950 shadow-lg shadow-emerald-500/20 text-lg tracking-wider">
            LB
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white font-heading">
                LEGADO DA BOLA
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-medium">Carreira Profissional Realista</p>
          </div>
        </div>

        {/* Live Player Info Bar (if active player exists) */}
        {player && (
          <div className="hidden md:flex items-center gap-3 bg-neutral-950/80 px-3 py-1.5 rounded-xl border border-neutral-800 text-xs">
            {/* OVR Badge */}
            <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-700/80">
              <span className="text-[10px] text-neutral-400 font-bold uppercase">OVR</span>
              <span className="text-sm font-extrabold text-emerald-400">{player.ovr}</span>
            </div>

            {/* Player photo & details */}
            <div className="flex items-center gap-2.5">
              {player.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt={player.name}
                  className="w-8 h-8 rounded-full object-cover border border-emerald-500/40 shadow shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs shrink-0">
                  ⚽
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-bold text-neutral-100 flex items-center gap-1.5">
                  {player.shirtName} #{player.shirtNumber} ({player.primaryPosition})
                </span>
                <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                  <ClubBadge clubId={player.contract.clubId} name={player.contract.clubName} size="xs" />
                  <span>{player.contract.clubName}</span>
                  {player.isYouthAcademy && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[9px] border border-amber-500/40 uppercase">
                      BASE {player.youthCategory || ''}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="h-6 w-[1px] bg-neutral-800" />

            {/* Week & Year */}
            <div className="flex items-center gap-1.5 text-neutral-300">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Semana {currentWeek}/48 • {currentYear}</span>
            </div>

            <div className="h-6 w-[1px] bg-neutral-800" />

            {/* Energy */}
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <div className="w-16 bg-neutral-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    player.energy > 60 ? 'bg-emerald-500' : player.energy > 30 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${player.energy}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-neutral-400">{player.energy}%</span>
            </div>

            <div className="h-6 w-[1px] bg-neutral-800" />

            {/* Morale */}
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getMoraleColor(player.morale)}`}>
              {player.morale}
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Menu Principal / Voltar ao Início */}
          {onGoHome && currentScreen !== 'saves' && (
            <button
              onClick={() => { soundFx.playClick(); onGoHome(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 transition shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              title="Voltar para o Menu Principal (Saves & Início)"
            >
              <Home className="w-3.5 h-3.5 text-emerald-400" />
              <span>Menu Principal</span>
            </button>
          )}

          {/* Multiplayer 1v1 */}
          {onOpenMultiplayer && (
            <button
              onClick={() => { soundFx.playClick(); onOpenMultiplayer(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition shadow-sm"
              title="Modo Multiplayer Online 1v1"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Multiplayer</span>
            </button>
          )}

          {/* Editar Elenco */}
          {onOpenSquadEditor && (
            <button
              onClick={() => { soundFx.playClick(); onOpenSquadEditor(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition shadow-sm"
              title="Editor de Elencos Personalizados"
            >
              <Edit3 className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Editar Elenco</span>
            </button>
          )}

          {/* Amistoso Tradicional: 2D Field Match */}
          {onOpenFriendly && (
            <button
              onClick={() => { soundFx.playClick(); onOpenFriendly(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition shadow-sm"
              title="Amistoso Tradicional com Bolinhas em Campo"
            >
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Amistoso Tradicional</span>
            </button>
          )}

          {/* Amistoso: Disputa de Pênaltis */}
          {onOpenPenalties && (
            <button
              onClick={() => { soundFx.playClick(); onOpenPenalties(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition shadow-sm"
              title="Amistoso: Disputa de Pênaltis"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Amistoso Pênaltis</span>
            </button>
          )}

          {/* Global Rankings */}
          <button
            onClick={() => { soundFx.playClick(); onOpenRankings(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 transition"
            title="Ranking Global de Jogadores"
          >
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span className="hidden sm:inline">Rankings</span>
          </button>

          {/* Manual Save */}
          {player && onManualSave && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
              title="Salvar Carreira Agora"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>{savedBadge ? 'Salvo!' : 'Salvar'}</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 transition"
            title={isMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-neutral-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Admin Panel */}
          <button
            onClick={() => { soundFx.playClick(); onOpenAdmin(); }}
            className="p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 border border-neutral-700 transition"
            title="Painel Administrativo & Licenciamento"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
