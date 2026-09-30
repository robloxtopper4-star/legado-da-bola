import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Users,
  Edit3,
  CheckCircle2,
  Shield,
  ArrowUpDown,
  Sparkles,
  Copy
} from 'lucide-react';
import { INITIAL_CLUBS } from '../data/database';
import {
  CustomSquad,
  CustomRosterPlayer,
  SquadPositionCategory,
  loadCustomSquads,
  upsertCustomSquad,
  deleteCustomSquad,
  sortPlayersByPosition,
  createPlayersFromOriginalClub
} from '../services/customRostersService';
import { soundFx } from '../utils/audio';

interface SquadEditorProps {
  onBack: () => void;
}

const POSITION_CATEGORIES: SquadPositionCategory[] = [
  'Goleiro',
  'Zagueiro',
  'Lateral',
  'Meio-campo',
  'Atacante'
];

const POSITION_BADGE_STYLE: Record<SquadPositionCategory, string> = {
  Goleiro: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Zagueiro: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  Lateral: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  'Meio-campo': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Atacante: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
};

export const SquadEditor: React.FC<SquadEditorProps> = ({ onBack }) => {
  const [squads, setSquads] = useState<CustomSquad[]>(() => loadCustomSquads());
  const [selectedSquadId, setSelectedSquadId] = useState<string>(() => {
    const initial = loadCustomSquads();
    return initial[0]?.id || '';
  });

  const activeSquad = squads.find(s => s.id === selectedSquadId) || null;

  const [squadName, setSquadName] = useState<string>(() => activeSquad?.name || 'Brasil 2026');
  const [players, setPlayers] = useState<CustomRosterPlayer[]>(
    () => activeSquad?.players || []
  );

  // New player form state
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [newPlayerPosition, setNewPlayerPosition] =
    useState<SquadPositionCategory>('Atacante');
  const [newPlayerNumber, setNewPlayerNumber] = useState<string>('10');
  const [templateClubId, setTemplateClubId] = useState<string>('flamengo');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleSelectSquad = (squad: CustomSquad) => {
    soundFx.playClick();
    setSelectedSquadId(squad.id);
    setSquadName(squad.name);
    setPlayers(squad.players.map(p => ({ ...p })));
  };

  const handleCreateNewSquad = () => {
    soundFx.playSuccess();
    const newId = 'squad_' + Date.now();
    const defaultNew: CustomSquad = {
      id: newId,
      name: `Novo Elenco ${squads.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      players: [
        { id: `p_${Date.now()}_1`, number: 1, name: 'João Silva', positionCategory: 'Goleiro' },
        { id: `p_${Date.now()}_2`, number: 2, name: 'Marcos', positionCategory: 'Lateral' },
        { id: `p_${Date.now()}_3`, number: 3, name: 'Lucas', positionCategory: 'Zagueiro' },
        { id: `p_${Date.now()}_4`, number: 4, name: 'Rafael', positionCategory: 'Zagueiro' },
        { id: `p_${Date.now()}_5`, number: 6, name: 'Caio', positionCategory: 'Lateral' },
        { id: `p_${Date.now()}_6`, number: 5, name: 'André', positionCategory: 'Meio-campo' },
        { id: `p_${Date.now()}_7`, number: 8, name: 'Pedro', positionCategory: 'Meio-campo' },
        { id: `p_${Date.now()}_8`, number: 10, name: 'Matheus', positionCategory: 'Meio-campo' },
        { id: `p_${Date.now()}_9`, number: 7, name: 'Vini', positionCategory: 'Atacante' },
        { id: `p_${Date.now()}_10`, number: 11, name: 'Bruno', positionCategory: 'Atacante' },
        { id: `p_${Date.now()}_11`, number: 9, name: 'Gabriel', positionCategory: 'Atacante' }
      ]
    };

    const updated = upsertCustomSquad(defaultNew);
    setSquads(updated);
    setSelectedSquadId(defaultNew.id);
    setSquadName(defaultNew.name);
    setPlayers(defaultNew.players);
    showFeedback(`✅ Novo elenco "${defaultNew.name}" criado! Personalize os jogadores abaixo.`);
  };

  const handleSaveCurrentSquad = (
    customName = squadName,
    customPlayers = players,
    silent = false
  ) => {
    if (!selectedSquadId) return;
    const trimmedName = customName.trim() || 'Elenco Personalizado';
    const sorted = sortPlayersByPosition(customPlayers);
    const toSave: CustomSquad = {
      id: selectedSquadId,
      name: trimmedName,
      createdAt: activeSquad?.createdAt || Date.now(),
      updatedAt: Date.now(),
      players: sorted
    };
    const updatedList = upsertCustomSquad(toSave);
    setSquads(updatedList);
    setPlayers(sorted);
    if (!silent) {
      soundFx.playFanfare();
      showFeedback(`💾 Elenco "${trimmedName}" salvo com sucesso (${sorted.length} jogadores)!`);
    }
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) {
      soundFx.playClick();
      showFeedback('⚠️ Digite o nome do jogador para adicionar ao elenco.');
      return;
    }

    const parsedNum = Math.max(1, Math.min(99, parseInt(newPlayerNumber, 10) || 10));
    const newPlayer: CustomRosterPlayer = {
      id: `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      number: parsedNum,
      name: trimmed,
      positionCategory: newPlayerPosition
    };

    const nextPlayers = sortPlayersByPosition([...players, newPlayer]);
    setPlayers(nextPlayers);
    setNewPlayerName('');
    setNewPlayerNumber(String(((parsedNum % 99) + 1)));
    soundFx.playSuccess();
    handleSaveCurrentSquad(squadName, nextPlayers, true);
    showFeedback(`✅ Jogador "${trimmed}" (${newPlayerPosition}) adicionado e salvo no elenco!`);
  };

  const handleUpdatePlayerField = (
    playerId: string,
    field: 'name' | 'number' | 'positionCategory',
    value: string | number
  ) => {
    const nextPlayers = players.map(p => {
      if (p.id !== playerId) return p;
      if (field === 'name') {
        return { ...p, name: String(value) };
      }
      if (field === 'number') {
        const n = Math.max(1, Math.min(99, Number(value) || 1));
        return { ...p, number: n };
      }
      return { ...p, positionCategory: value as SquadPositionCategory };
    });
    setPlayers(nextPlayers);
    // Auto-persist changes immediately
    if (selectedSquadId) {
      const toSave: CustomSquad = {
        id: selectedSquadId,
        name: squadName.trim() || 'Elenco Personalizado',
        createdAt: activeSquad?.createdAt || Date.now(),
        updatedAt: Date.now(),
        players: nextPlayers
      };
      setSquads(upsertCustomSquad(toSave));
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    soundFx.playClick();
    const removed = players.find(p => p.id === playerId);
    const nextPlayers = players.filter(p => p.id !== playerId);
    setPlayers(nextPlayers);
    handleSaveCurrentSquad(squadName, nextPlayers, true);
    if (removed) {
      showFeedback(`🗑️ Jogador "${removed.name}" removido do elenco.`);
    }
  };

  const handleSortByPosition = () => {
    soundFx.playClick();
    const sorted = sortPlayersByPosition(players);
    setPlayers(sorted);
    handleSaveCurrentSquad(squadName, sorted, true);
    showFeedback('📋 Jogadores organizados por posição (Goleiro → Defesa → Meio-campo → Ataque)!');
  };

  const handleDeleteSquad = (id: string) => {
    soundFx.playClick();
    const updated = deleteCustomSquad(id);
    setSquads(updated);
    if (updated.length > 0) {
      setSelectedSquadId(updated[0].id);
      setSquadName(updated[0].name);
      setPlayers(updated[0].players);
    } else {
      setSelectedSquadId('');
      setSquadName('');
      setPlayers([]);
    }
    showFeedback('🗑️ Elenco excluído.');
  };

  const handleLoadFromOriginalClub = () => {
    const club = INITIAL_CLUBS.find(c => c.id === templateClubId) || INITIAL_CLUBS[0];
    const clonedPlayers = createPlayersFromOriginalClub(club);
    soundFx.playSuccess();
    setPlayers(clonedPlayers);
    handleSaveCurrentSquad(squadName, clonedPlayers, true);
    showFeedback(
      `📋 Jogadores originais do ${club.name} carregados como base! Você pode editar qualquer nome livremente.`
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* TOP HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (selectedSquadId) {
                handleSaveCurrentSquad(squadName, players, true);
              }
              soundFx.playClick();
              onBack();
            }}
            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] tracking-wider uppercase border border-emerald-500/40 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Editor de Elencos Personalizados
              </span>
              <span className="text-xs text-neutral-400 font-bold">
                • Crie, Edite Nomes e Salve Vários Elencos
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-heading mt-0.5">
              Editar Elenco (Multiplayer & Amistosos)
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCreateNewSquad}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Criar Novo Elenco</span>
          </button>

          {selectedSquadId && (
            <button
              type="button"
              onClick={() => handleSaveCurrentSquad()}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Elenco</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: SAVED SQUADS LIST */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-neutral-900/90 p-5 rounded-3xl border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wider font-heading">
                  Meus Elencos Salvos ({squads.length})
                </h2>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Salvos automaticamente para usar no Multiplayer e Amistosos.
                </p>
              </div>
            </div>

            {/* Info about Original Roster always preserved */}
            <div className="p-3.5 rounded-2xl bg-neutral-950/90 border border-emerald-500/30 space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-400">
                <Shield className="w-4 h-4" />
                <span>Elenco Original Sempre Disponível</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Na hora da partida, você sempre poderá escolher entre o <strong>Elenco Original</strong> de cada time ou qualquer um dos seus <strong>Elencos Personalizados</strong> abaixo!
              </p>
            </div>

            {squads.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <p className="text-xs text-neutral-400">
                  Nenhum elenco personalizado criado ainda.
                </p>
                <button
                  type="button"
                  onClick={handleCreateNewSquad}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-neutral-950 font-black text-xs"
                >
                  + Criar Meu Primeiro Elenco
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {squads.map(sq => {
                  const isSelected = sq.id === selectedSquadId;
                  return (
                    <div
                      key={sq.id}
                      onClick={() => handleSelectSquad(sq)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg'
                          : 'bg-neutral-950/70 hover:bg-neutral-950 border-neutral-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-white truncate">
                            {sq.name}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-black text-[9px] uppercase">
                              Editando
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400 block mt-0.5">
                          {sq.players.length} {sq.players.length === 1 ? 'jogador' : 'jogadores'} cadastrados
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteSquad(sq.id);
                        }}
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-300 border border-neutral-800 transition shrink-0"
                        title="Excluir Elenco"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE SQUAD EDITOR */}
        <div className="lg:col-span-8 space-y-5">
          {!activeSquad ? (
            <div className="bg-neutral-900/90 p-10 rounded-3xl border border-neutral-800 text-center space-y-4">
              <Users className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-black text-white">
                Selecione ou Crie um Elenco Personalizado
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Clique em "Criar Novo Elenco" para montar sua escalação personalizada com os nomes e posições que desejar.
              </p>
              <button
                type="button"
                onClick={handleCreateNewSquad}
                className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider"
              >
                + Criar Novo Elenco Agora
              </button>
            </div>
          ) : (
            <>
              {/* 1. SQUAD NAME & TEMPLATE LOADER */}
              <div className="bg-neutral-900/90 p-5 sm:p-6 rounded-3xl border border-neutral-800 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-7 space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Nome do Elenco Personalizado:</span>
                    </label>
                    <input
                      type="text"
                      value={squadName}
                      onChange={e => {
                        setSquadName(e.target.value);
                        handleSaveCurrentSquad(e.target.value, players, true);
                      }}
                      placeholder="Ex: Brasil 2026, Amigos FC, Lendas..."
                      className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm font-black text-white focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-5 space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-400 block">
                      Opcional: Preencher com base em um time:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={templateClubId}
                        onChange={e => setTemplateClubId(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-white font-semibold"
                      >
                        {INITIAL_CLUBS.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleLoadFromOriginalClub}
                        className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 shrink-0 flex items-center gap-1"
                        title="Importar os 11 jogadores deste clube para editar"
                      >
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Usar Base</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. ADD NEW PLAYER FORM */}
              <form
                onSubmit={handleAddPlayer}
                className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-emerald-950/30 p-5 sm:p-6 rounded-3xl border border-emerald-500/30 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Adicionar Jogador ao Elenco "{squadName || 'Personalizado'}"</span>
                  </h3>
                  <span className="text-[11px] text-neutral-400">
                    Defina qualquer nome e posição livremente
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-bold text-neutral-300 block">
                      Nome do Jogador:
                    </label>
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={e => setNewPlayerName(e.target.value)}
                      placeholder="Ex: João Silva, Lucas, Pedro, Gabriel..."
                      className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-bold text-neutral-300 block">
                      Posição:
                    </label>
                    <select
                      value={newPlayerPosition}
                      onChange={e =>
                        setNewPlayerPosition(e.target.value as SquadPositionCategory)
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none"
                    >
                      {POSITION_CATEGORIES.map(pos => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-neutral-300 block">
                      Camisa Nº:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={newPlayerNumber}
                      onChange={e => setNewPlayerNumber(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-white focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs shadow-md transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* 3. PLAYERS LIST & INLINE EDITING BY POSITION */}
              <div className="bg-neutral-900/90 p-5 sm:p-6 rounded-3xl border border-neutral-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white font-heading">
                      Elenco: {squadName || 'Sem Nome'} ({players.length}{' '}
                      {players.length === 1 ? 'Jogador' : 'Jogadores'})
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Clique em qualquer nome, número ou posição abaixo para editar na hora.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSortByPosition}
                      className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 transition flex items-center gap-1.5"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Organizar por Posição</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveCurrentSquad()}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar Alterações</span>
                    </button>
                  </div>
                </div>

                {players.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400">
                    Nenhum jogador neste elenco ainda. Use o formulário acima para adicionar jogadores!
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {players.map((player, idx) => (
                      <div
                        key={player.id}
                        className="p-3 rounded-2xl bg-neutral-950/90 border border-neutral-800 hover:border-neutral-700 transition flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-[11px] font-mono text-neutral-500 w-5 text-right">
                            {idx + 1}.
                          </span>

                          {/* Shirt Number Input */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-neutral-500 font-bold">#</span>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={player.number}
                              onChange={e =>
                                handleUpdatePlayerField(player.id, 'number', e.target.value)
                              }
                              className="w-14 bg-neutral-900 border border-neutral-800 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-xs font-mono font-black text-amber-300 text-center focus:outline-none"
                              title="Número da camisa"
                            />
                          </div>

                          {/* Editable Player Name */}
                          <input
                            type="text"
                            value={player.name}
                            onChange={e =>
                              handleUpdatePlayerField(player.id, 'name', e.target.value)
                            }
                            placeholder="Nome do jogador"
                            className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-white focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2.5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                              POSITION_BADGE_STYLE[player.positionCategory]
                            }`}
                          >
                            {player.positionCategory}
                          </span>

                          {/* Position Selector */}
                          <select
                            value={player.positionCategory}
                            onChange={e =>
                              handleUpdatePlayerField(
                                player.id,
                                'positionCategory',
                                e.target.value
                              )
                            }
                            className="bg-neutral-900 border border-neutral-800 focus:border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-neutral-200 focus:outline-none"
                          >
                            {POSITION_CATEGORIES.map(pos => (
                              <option key={pos} value={pos}>
                                {pos}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemovePlayer(player.id)}
                            className="p-2 rounded-xl bg-neutral-900 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-300 border border-neutral-800 transition"
                            title="Remover jogador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
