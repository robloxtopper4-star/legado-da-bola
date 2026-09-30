import React, { useState } from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  Copy, 
  Download, 
  Upload, 
  User, 
  Trophy, 
  Calendar, 
  Sparkles, 
  Shield, 
  FileText,
  Zap,
  Target,
  Flame,
  Users,
  Edit3
} from 'lucide-react';
import { SaveMetadata, getAllSaveMetadatas, duplicateCareer, deleteCareer, exportCareerToJson, importCareerFromJson, loadCareer } from '../services/storageService';
import { CareerSave } from '../types';
import { soundFx } from '../utils/audio';
import { ClubBadge } from './ClubBadge';

interface SavesManagerProps {
  onSelectCareer: (career: CareerSave) => void;
  onCreateNew: () => void;
  onOpenRankings: () => void;
  onOpenPenalties: () => void;
  onOpenFriendly?: () => void;
  onOpenMultiplayer?: () => void;
  onOpenSquadEditor?: () => void;
}

export const SavesManager: React.FC<SavesManagerProps> = ({
  onSelectCareer,
  onCreateNew,
  onOpenRankings,
  onOpenPenalties,
  onOpenFriendly,
  onOpenMultiplayer,
  onOpenSquadEditor
}) => {
  const [saves, setSaves] = useState<SaveMetadata[]>(getAllSaveMetadatas());
  const [importError, setImportError] = useState<string | null>(null);

  const handleContinue = (id: string) => {
    soundFx.playWhistle();
    const career = loadCareer(id);
    if (career) {
      onSelectCareer(career);
    }
  };

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClick();
    duplicateCareer(id);
    setSaves(getAllSaveMetadatas());
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Tem certeza de que deseja apagar permanentemente este save de carreira?')) {
      soundFx.playClick();
      deleteCareer(id);
      setSaves(getAllSaveMetadatas());
    }
  };

  const handleExport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClick();
    const career = loadCareer(id);
    if (career) {
      exportCareerToJson(career);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const text = evt.target?.result as string;
        const imported = importCareerFromJson(text);
        if (imported) {
          soundFx.playFanfare();
          setSaves(getAllSaveMetadatas());
          onSelectCareer(imported);
        } else {
          setImportError('Arquivo de save corrompido ou formato incompatível.');
        }
      } catch (err) {
        setImportError('Erro ao carregar o arquivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Hero Welcome Banner */}
      <div className="text-center space-y-3 relative py-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Simulador Profissional de Carreira
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white font-heading tracking-tight">
          LEGADO DA BOLA
        </h1>

        <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Da base ao Hall da Fama mundial. Controle cada decisão, dispute campeonatos, receba propostas milionárias e grave seu nome na história.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            onClick={() => { soundFx.playWhistle(); onCreateNew(); }}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            JOGAR / NOVA CARREIRA
          </button>

          {onOpenMultiplayer && (
            <button
              onClick={() => { soundFx.playWhistle(); onOpenMultiplayer(); }}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-cyan-500/25 transition transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Users className="w-4 h-4 text-neutral-950" />
              MULTIPLAYER (ONLINE 1v1)
            </button>
          )}

          {onOpenSquadEditor && (
            <button
              onClick={() => { soundFx.playClick(); onOpenSquadEditor(); }}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-sm tracking-wide shadow-xl shadow-purple-500/25 transition transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Edit3 className="w-4 h-4 text-white" />
              EDITAR ELENCO
            </button>
          )}

          {onOpenFriendly && (
            <button
              onClick={() => { soundFx.playWhistle(); onOpenFriendly(); }}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Flame className="w-4 h-4 fill-current text-neutral-950" />
              AMISTOSO TRADICIONAL (2D)
            </button>
          )}

          <button
            onClick={() => { soundFx.playWhistle(); onOpenPenalties(); }}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-sm tracking-wide shadow-xl shadow-amber-500/25 transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Zap className="w-4 h-4 fill-current" />
            AMISTOSO: DISPUTA DE PÊNALTIS
          </button>

          <label className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 cursor-pointer transition">
            <Upload className="w-4 h-4 text-emerald-400" />
            Carregar Save (JSON)
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          <button
            onClick={() => { soundFx.playClick(); onOpenRankings(); }}
            className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 transition"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            Hall da Fama Global
          </button>
        </div>

        {/* Featured Amistoso Card */}
        <div className="mt-4 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-neutral-900 via-amber-950/20 to-neutral-900 border border-amber-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[10px] tracking-wider uppercase border border-amber-500/30">
                  Modo Rápido
                </span>
                <h3 className="text-white font-black text-sm sm:text-base">Amistoso • Disputa de Pênaltis</h3>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Escolha dois clubes e decida na marca da cal. Exclusivo para times do <strong>Brasileirão</strong>, <strong>Premier League</strong>, <strong>La Liga</strong> e <strong>Liga Portugal</strong>!
              </p>
            </div>
          </div>

          <button
            onClick={() => { soundFx.playWhistle(); onOpenPenalties(); }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs tracking-wider uppercase shadow transition shrink-0 flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Jogar Amistoso
          </button>
        </div>

        {importError && (
          <p className="text-xs text-red-400 font-bold mt-2">{importError}</p>
        )}
      </div>

      {/* Saved Careers List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h2 className="text-base font-extrabold text-white font-heading flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            Carreiras Salvas ({saves.length})
          </h2>
          <span className="text-xs text-neutral-500">Salvamento automático no seu navegador</span>
        </div>

        {saves.length === 0 ? (
          <div className="text-center py-14 bg-neutral-900/40 rounded-3xl border border-neutral-800 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-800/80 flex items-center justify-center text-neutral-500">
              ⚽
            </div>
            <h3 className="text-base font-bold text-neutral-300 font-heading">Nenhuma carreira em andamento</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Clique em "Criar Nova Carreira" para configurar seu primeiro futebolista e dar o pontapé inicial.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {saves.map(save => (
              <div
                key={save.id}
                onClick={() => handleContinue(save.id)}
                className="p-5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 transition cursor-pointer flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {save.photoUrl ? (
                          <img
                            src={save.photoUrl}
                            alt={save.playerName}
                            className="w-12 h-12 rounded-xl object-cover border border-emerald-500/40 shadow shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-lg shrink-0">
                            ⚽
                          </div>
                        )}
                        <div className="absolute -bottom-1.5 -right-1.5 shadow-md">
                          <ClubBadge clubId={save.clubId} name={save.clubName} size="xs" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-white group-hover:text-emerald-300 transition font-heading">
                          {save.playerName}
                        </h3>
                        <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                          {save.clubName} • {save.position}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-neutral-500 font-bold uppercase block">OVR</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono leading-none">
                        {save.ovr}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-neutral-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      Ano {save.year} (Semana {save.week})
                    </span>
                    {save.isRetired && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        Aposentado
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Continuar
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={e => handleDuplicate(save.id, e)}
                      className="p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
                      title="Duplicar Carreira"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => handleExport(save.id, e)}
                      className="p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-emerald-300 transition"
                      title="Exportar Save JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => handleDelete(save.id, e)}
                      className="p-2 rounded-lg bg-neutral-800/80 hover:bg-red-950 text-neutral-400 hover:text-red-400 transition"
                      title="Apagar Carreira"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
