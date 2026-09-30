import React, { useState } from 'react';
import { 
  X, 
  Shield, 
  Lock, 
  Check, 
  Plus, 
  Edit3, 
  FileText, 
  Zap, 
  Sliders, 
  Download, 
  Upload, 
  AlertCircle,
  ArrowRightLeft,
  Search,
  HeartPulse
} from 'lucide-react';
import { Club, League, CareerSave, LicenseStatus, SquadRole } from '../types';
import { INITIAL_CLUBS, INITIAL_LEAGUES } from '../data/database';
import { soundFx } from '../utils/audio';
import { ClubBadge } from './ClubBadge';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeCareer: CareerSave | null;
  onUpdateCareer?: (career: CareerSave) => void;
  onTriggerEvent?: (type: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  activeCareer,
  onUpdateCareer,
  onTriggerEvent
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  const [activeTab, setActiveTab] = useState<'career' | 'clubs' | 'licenses' | 'events'>('career');

  // Local clubs state for editing
  const [clubsList, setClubsList] = useState<Club[]>(INITIAL_CLUBS);
  const [selectedClub, setSelectedClub] = useState<Club | null>(INITIAL_CLUBS[0]);

  // New club form
  const [isAddingClub, setIsAddingClub] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubShort, setNewClubShort] = useState('');
  const [newClubCountry, setNewClubCountry] = useState('Brasil');

  // Career transfer states
  const [careerClubSearch, setCareerClubSearch] = useState('');
  const [careerCountryFilter, setCareerCountryFilter] = useState('ALL');
  const [transferSuccessMsg, setTransferSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTransferCareerClub = (targetClub: Club) => {
    if (!activeCareer || !onUpdateCareer) return;
    const oldClubName = activeCareer.player.contract.clubName;
    const wageMultiplier = targetClub.prestige >= 9 ? 2.5 : targetClub.prestige >= 7 ? 1.5 : 1.0;
    const newWeeklyWage = Math.round(Math.max(15000, activeCareer.player.contract.weeklyWage * wageMultiplier));
    
    const updatedPlayer = {
      ...activeCareer.player,
      coachTrust: 90,
      contract: {
        ...activeCareer.player.contract,
        clubId: targetClub.id,
        clubName: targetClub.name,
        weeklyWage: newWeeklyWage,
        role: 'Titular Absoluto' as SquadRole
      }
    };

    const transferNews = {
      id: 'news_admin_transfer_' + Date.now(),
      dateStr: `Ano ${activeCareer.currentYear} - Sem ${activeCareer.currentWeek}`,
      headline: `🚨 BOMBA NO MERCADO: ${updatedPlayer.name} é o novo reforço do ${targetClub.name}!`,
      snippet: `Transferência autorizada pela diretoria! O craque deixa o ${oldClubName} e assina com o ${targetClub.name} como Titular Absoluto. A torcida festeja a chegada do jogador.`,
      category: 'transfer' as const
    };

    const updatedCareer: CareerSave = {
      ...activeCareer,
      player: updatedPlayer,
      news: [transferNews, ...(activeCareer.news || [])]
    };

    onUpdateCareer(updatedCareer);
    soundFx.playFanfare();
    setTransferSuccessMsg(`✅ Jogador transferido com sucesso para o ${targetClub.name}! Você já é Titular Absoluto.`);
    setTimeout(() => setTransferSuccessMsg(null), 5000);
  };

  const handleHealPlayer = () => {
    if (!activeCareer || !onUpdateCareer) return;
    const updated: CareerSave = {
      ...activeCareer,
      player: {
        ...activeCareer.player,
        isInjured: false,
        injuryName: undefined,
        injuryWeeksRemaining: 0,
        energy: 100
      }
    };
    onUpdateCareer(updated);
    soundFx.playFanfare();
    setTransferSuccessMsg('✅ Jogador 100% curado e liberado pelo departamento médico com energia cheia!');
    setTimeout(() => setTransferSuccessMsg(null), 4000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default password "admin123" or empty for instant developer access
    if (password.toLowerCase() === 'admin123' || password === 'admin' || password === '') {
      setIsAuthenticated(true);
      setAuthError(false);
      soundFx.playClick();
    } else {
      setAuthError(true);
    }
  };

  const handleUpdateSelectedClub = (field: keyof Club, value: any) => {
    if (!selectedClub) return;
    const updated = { ...selectedClub, [field]: value };
    setSelectedClub(updated);
    setClubsList(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="font-extrabold text-base text-white tracking-tight font-heading">
              Painel Administrativo & Gestão de Licenciamento
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Admin Seguro
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isAuthenticated ? (
          <div className="p-8 max-w-md mx-auto my-auto text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white font-heading">Acesso Restrito ao Administrador</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Insira a senha de controle administrativo (padrão: <strong className="text-amber-400">admin123</strong>)
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Digite admin123"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 text-center font-mono"
              />

              {authError && (
                <p className="text-xs text-red-400 font-medium">Senha incorreta. Tente admin123.</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition"
              >
                Entrar no Painel
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Nav Tabs */}
            <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-6 gap-2 text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setActiveTab('career')}
                className={`py-3 px-3.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'career' ? 'border-amber-400 text-amber-400 font-black' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <span>🎮 Escolher Time para Jogar</span>
                {activeCareer && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                    {activeCareer.player.contract.clubName}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('clubs')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'clubs' ? 'border-amber-400 text-amber-400' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                Clubes & Força
              </button>
              <button
                onClick={() => setActiveTab('licenses')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'licenses' ? 'border-amber-400 text-amber-400' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                Licenciamento & Direitos
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === 'events' ? 'border-amber-400 text-amber-400' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                Gerador de Eventos
              </button>
            </div>

            {/* Tab 1: Clubs Manager */}
            {activeTab === 'clubs' && (
              <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Clubs list */}
                <div className="border border-neutral-800 rounded-xl p-3 bg-neutral-950/50 space-y-2 max-h-96 overflow-y-auto">
                  <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider pb-1">
                    Clubes Cadastrados ({clubsList.length})
                  </div>
                  {clubsList.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClub(c)}
                      className={`w-full p-2.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition ${
                        selectedClub?.id === c.id
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-[10px] font-mono text-neutral-500">{c.country}</span>
                    </button>
                  ))}
                </div>

                {/* Club Editor */}
                {selectedClub && (
                  <div className="md:col-span-2 border border-neutral-800 rounded-xl p-5 bg-neutral-950/50 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-white font-heading">{selectedClub.name}</h4>
                        <span className="text-xs text-neutral-400">Editando parâmetros técnicos e licença</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                        selectedClub.licenseStatus === 'licensed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : selectedClub.licenseStatus === 'original'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}>
                        {selectedClub.licenseStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Nome do Clube</label>
                        <input
                          type="text"
                          value={selectedClub.name}
                          onChange={e => handleUpdateSelectedClub('name', e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Sigla / Abreviação</label>
                        <input
                          type="text"
                          value={selectedClub.shortName}
                          onChange={e => handleUpdateSelectedClub('shortName', e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Estádio</label>
                        <input
                          type="text"
                          value={selectedClub.stadiumName}
                          onChange={e => handleUpdateSelectedClub('stadiumName', e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Status de Licença</label>
                        <select
                          value={selectedClub.licenseStatus}
                          onChange={e => handleUpdateSelectedClub('licenseStatus', e.target.value as LicenseStatus)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        >
                          <option value="original">Original (Criado pelo Jogo)</option>
                          <option value="licensed">Oficial / Licenciado</option>
                          <option value="generic">Genérico Editável</option>
                        </select>
                      </div>
                    </div>

                    {/* Ratings */}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Ataque ({selectedClub.attackRating})</label>
                        <input
                          type="range"
                          min="50"
                          max="99"
                          value={selectedClub.attackRating}
                          onChange={e => handleUpdateSelectedClub('attackRating', Number(e.target.value))}
                          className="w-full accent-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Meio ({selectedClub.midfieldRating})</label>
                        <input
                          type="range"
                          min="50"
                          max="99"
                          value={selectedClub.midfieldRating}
                          onChange={e => handleUpdateSelectedClub('midfieldRating', Number(e.target.value))}
                          className="w-full accent-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Defesa ({selectedClub.defenseRating})</label>
                        <input
                          type="range"
                          min="50"
                          max="99"
                          value={selectedClub.defenseRating}
                          onChange={e => handleUpdateSelectedClub('defenseRating', Number(e.target.value))}
                          className="w-full accent-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Licenses & Legal Architecture */}
            {activeTab === 'licenses' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-5">
                <div className="bg-amber-950/20 border border-amber-500/40 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200 leading-relaxed">
                    <strong>Estrutura de Propriedade Intelectual & Licenciamento:</strong>
                    <p className="mt-1 text-amber-300/80">
                      O simulador respeita integralmente as normas de direitos autorais e marcas registradas. Por padrão, todos os dados são classificados como <strong>"Conteúdo Original do Jogo"</strong> ou <strong>"Genérico Customizável"</strong>. Nenhum clube ou competição é exibido como licenciado sem expressa autorização ou importação de pacote aprovado.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      Exportar Pacote de Dados
                    </h4>
                    <p className="text-xs text-neutral-400">
                      Exporte o banco atual de clubes, ligas e configurações para backup ou edição externa.
                    </p>
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify({ clubs: clubsList, leagues: INITIAL_LEAGUES }, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'pacote_licenciamento_legado.json';
                        a.click();
                      }}
                      className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 transition"
                    >
                      Baixar Arquivo JSON
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-400" />
                      Importar Pacote de Licenças
                    </h4>
                    <p className="text-xs text-neutral-400">
                      Importe dados de pacotes personalizados com escudos, nomes e configurações autorizadas.
                    </p>
                    <input
                      type="file"
                      accept=".json"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = evt => {
                            try {
                              const parsed = JSON.parse(evt.target?.result as string);
                              if (parsed.clubs) setClubsList(parsed.clubs);
                              alert('Pacote importado com sucesso!');
                            } catch {
                              alert('Erro ao ler arquivo JSON.');
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Events Trigger */}
            {activeTab === 'events' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="text-xs text-neutral-400 mb-2">
                  Dispare acontecimentos dramáticos na carreira do jogador para testes ou criar histórias especiais:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => { onTriggerEvent?.('real_madrid_offer'); soundFx.playFanfare(); }}
                    className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500 text-left transition space-y-1"
                  >
                    <span className="text-amber-400 font-bold text-xs block">Proposta Galáctica</span>
                    <span className="text-white text-xs block">Forçar proposta milionária de um gigante europeu</span>
                  </button>

                  <button
                    onClick={() => { onTriggerEvent?.('national_callup'); soundFx.playFanfare(); }}
                    className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500 text-left transition space-y-1"
                  >
                    <span className="text-emerald-400 font-bold text-xs block">Convocação da Seleção</span>
                    <span className="text-white text-xs block">Receber convocação imediata para a Seleção Nacional</span>
                  </button>

                  <button
                    onClick={() => { onTriggerEvent?.('heal_injury'); soundFx.playClick(); }}
                    className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-blue-500 text-left transition space-y-1"
                  >
                    <span className="text-blue-400 font-bold text-xs block">Milagre Médico</span>
                    <span className="text-white text-xs block">Curar imediatamente qualquer lesão e restaurar energia</span>
                  </button>

                  <button
                    onClick={() => { onTriggerEvent?.('bonus_training'); soundFx.playClick(); }}
                    className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-purple-500 text-left transition space-y-1"
                  >
                    <span className="text-purple-400 font-bold text-xs block">Bônus de Treinamento</span>
                    <span className="text-white text-xs block">Adicionar +25 Pontos de Treinamento ao jogador</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 4: Active Career inspection & Club Switcher */}
            {activeTab === 'career' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-5">
                {transferSuccessMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between">
                    <span>{transferSuccessMsg}</span>
                  </div>
                )}

                {activeCareer ? (
                  <>
                    {/* Player status banner */}
                    <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <ClubBadge 
                          clubId={activeCareer.player.contract.clubId}
                          name={activeCareer.player.contract.clubName}
                          size="md"
                        />
                        <div>
                          <div className="text-white font-extrabold text-sm flex items-center gap-2">
                            <span>{activeCareer.player.name} {activeCareer.player.lastName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                              OVR {activeCareer.player.ovr}
                            </span>
                            {activeCareer.player.isInjured && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                                🏥 Lesionado ({activeCareer.player.injuryWeeksRemaining} sem)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Clube Atual: <strong className="text-emerald-400">{activeCareer.player.contract.clubName}</strong> • {activeCareer.player.contract.role}
                          </p>
                        </div>
                      </div>

                      {activeCareer.player.isInjured && (
                        <button
                          onClick={handleHealPlayer}
                          className="px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-neutral-950 font-black text-xs shadow transition flex items-center gap-1.5"
                        >
                          <HeartPulse className="w-4 h-4" />
                          Curar Lesão Agora
                        </button>
                      )}
                    </div>

                    {/* Section: Escolha o Time que Você Vai Jogar */}
                    <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                        <div>
                          <h4 className="font-extrabold text-sm text-white flex items-center gap-2 font-heading">
                            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                            Escolher o Time que Você Vai Jogar (Transferência Instantânea)
                          </h4>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Selecione qualquer clube do simulador para ser transferido imediatamente sem custo ou burocracia.
                          </p>
                        </div>
                      </div>

                      {/* Filters and search */}
                      <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <div className="relative flex-1 w-full">
                          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Buscar clube por nome (ex: Real Madrid, Flamengo, Liverpool, Coritiba)..."
                            value={careerClubSearch}
                            onChange={e => setCareerClubSearch(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        {/* Country filter */}
                        <select
                          value={careerCountryFilter}
                          onChange={e => setCareerCountryFilter(e.target.value)}
                          className="w-full sm:w-auto bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        >
                          <option value="ALL">Todos os Países</option>
                          <option value="Brasil">Brasil</option>
                          <option value="Espanha">Espanha</option>
                          <option value="Inglaterra">Inglaterra</option>
                          <option value="Itália">Itália</option>
                          <option value="Alemanha">Alemanha</option>
                          <option value="França">França</option>
                          <option value="Portugal">Portugal</option>
                          <option value="Argentina">Argentina</option>
                        </select>
                      </div>

                      {/* Clubs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                        {INITIAL_CLUBS
                          .filter(c => {
                            const matchesSearch = !careerClubSearch || 
                              c.name.toLowerCase().includes(careerClubSearch.toLowerCase()) || 
                              c.shortName.toLowerCase().includes(careerClubSearch.toLowerCase());
                            const matchesCountry = careerCountryFilter === 'ALL' || c.country === careerCountryFilter;
                            return matchesSearch && matchesCountry;
                          })
                          .map(club => {
                            const isCurrent = activeCareer.player.contract.clubId === club.id;
                            return (
                              <div
                                key={club.id}
                                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                                  isCurrent
                                    ? 'bg-amber-500/15 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                                    : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <ClubBadge club={club} size="sm" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-white truncate">{club.name}</div>
                                    <div className="text-[10px] text-neutral-400">{club.country} • {club.stadiumName}</div>
                                  </div>
                                </div>

                                {isCurrent ? (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-amber-500 text-neutral-950 shrink-0">
                                    Atual
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleTransferCareerClub(club)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-[11px] shadow transition shrink-0 whitespace-nowrap"
                                    title={`Transferir para ${club.name}`}
                                  >
                                    Jogar Aqui
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 text-xs text-neutral-500">
                    Nenhuma carreira ativa carregada no momento.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
