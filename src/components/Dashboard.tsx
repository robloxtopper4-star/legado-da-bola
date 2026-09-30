import React, { useState } from 'react';
import { 
  User, 
  Activity, 
  Calendar, 
  Award, 
  Trophy, 
  DollarSign, 
  MessageSquare, 
  Globe, 
  TrendingUp, 
  Zap, 
  Shield, 
  Sparkles, 
  ChevronRight, 
  Play, 
  Briefcase, 
  Plus, 
  CheckCircle2, 
  X,
  AlertTriangle,
  History,
  LogOut,
  ThumbsUp,
  Share2,
  FastForward,
  Camera,
  Target,
  Sliders,
  Check,
  Home,
  ArrowLeft,
  HeartPulse,
  Gamepad2
} from 'lucide-react';
import { PlayerPhotoModal } from './PlayerPhotoModal';
import { 
  CareerSave, 
  PlayerProfile, 
  PlayerAttributes, 
  TransferOffer, 
  SquadRole, 
  Agent,
  TrainingFocusConfig 
} from '../types';
import { INITIAL_CLUBS, INITIAL_AGENTS, INITIAL_LEAGUES } from '../data/database';
import { 
  getPositionPresets, 
  ATTRIBUTE_LABELS, 
  TrainingPreset, 
  getDefaultTrainingFocus 
} from '../utils/trainingPresets';
import { 
  formatCurrency, 
  formatCurrencyBRL, 
  getMoraleColor, 
  getRoleBadgeColor, 
  calculateOvr, 
  calculateMarketValue 
} from '../utils/calculator';
import { negotiateCounterOffer } from '../services/transferEngine';
import { soundFx } from '../utils/audio';
import { SeasonSimulationModal } from './SeasonSimulationModal';
import { CareerEndSimulationModal } from './CareerEndSimulationModal';
import { ClubBadge } from './ClubBadge';
import { CompetitionsStandings } from './CompetitionsStandings';
import { getClubCompetitionsOverview, getUserSeasonMatches } from '../utils/standingsGenerator';
import { syncClubsWithCareer } from '../utils/competitionsEngine';

interface DashboardProps {
  career: CareerSave;
  onStartMatch: () => void;
  onAdvanceWeek: () => void;
  onUpdateCareer: (updated: CareerSave) => void;
  onRetire: () => void;
  onGoHome?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  career,
  onStartMatch,
  onAdvanceWeek,
  onUpdateCareer,
  onRetire,
  onGoHome
}) => {
  syncClubsWithCareer(career);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'standings' | 'training' | 'transfers' | 'news' | 'national' | 'trophies' | 'history'
  >('overview');

  const p = career.player;

  // Selected offer for contract negotiation modal
  const [negotiatingOffer, setNegotiatingOffer] = useState<TransferOffer | null>(null);
  const [counterWage, setCounterWage] = useState(0);
  const [counterYears, setCounterYears] = useState(3);
  const [counterRole, setCounterRole] = useState<SquadRole>('Titular');
  const [negotiationResult, setNegotiationResult] = useState<{ accepted: boolean; message: string } | null>(null);

  // Agent selector modal
  const [isChangingAgent, setIsChangingAgent] = useState(false);

  // Full season simulation modal
  const [isSimulatingSeason, setIsSimulatingSeason] = useState(false);

  // Full career end simulation modal
  const [isSimulatingCareerEnd, setIsSimulatingCareerEnd] = useState(false);

  // Custom attribute point assignment states
  const [trainingSubTab, setTrainingSubTab] = useState<'matrix' | 'custom_input'>('custom_input');
  const [customSelectedAttr, setCustomSelectedAttr] = useState<keyof PlayerAttributes>('finalizacao');
  const [customPointsInput, setCustomPointsInput] = useState<string>('10');

  // Player photo modal
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Training drill selected
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null);
  const [isCustomFocusModalOpen, setIsCustomFocusModalOpen] = useState(false);
  const [customSelectedAttrs, setCustomSelectedAttrs] = useState<(keyof PlayerAttributes)[]>(
    p.trainingFocus?.isCustom ? p.trainingFocus.targetAttributes : []
  );

  // Calculate current season stats
  const currentSeasonStats = career.history.find(h => h.seasonYear === career.currentYear) || {
    seasonYear: career.currentYear,
    clubId: p.contract.clubId,
    clubName: p.contract.clubName,
    matches: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    avgRating: 0,
    cleanSheets: 0,
    trophiesWon: [],
    awardsWon: []
  };

  const positionPresets = getPositionPresets(p.primaryPosition);
  const currentFocus = p.trainingFocus || getDefaultTrainingFocus(p.primaryPosition);

  // Training focus change helper
  const handleSelectPreset = (preset: TrainingPreset) => {
    soundFx.playSuccess();
    const config: TrainingFocusConfig = {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      targetAttributes: preset.targetAttributes,
      isCustom: false
    };
    onUpdateCareer({
      ...career,
      player: {
        ...p,
        trainingFocus: config
      }
    });
    setTrainingMessage(`🎯 Foco de Treino Automático alterado para "${preset.name}". Próximas partidas e treinos focarão nesses fundamentos!`);
    setTimeout(() => setTrainingMessage(null), 4000);
  };

  const handleToggleCustomAttr = (attr: keyof PlayerAttributes) => {
    soundFx.playClick();
    if (customSelectedAttrs.includes(attr)) {
      setCustomSelectedAttrs(customSelectedAttrs.filter(a => a !== attr));
    } else {
      setCustomSelectedAttrs([...customSelectedAttrs, attr]);
    }
  };

  const ALL_ATTRIBUTE_CATEGORIES: {
    title: string;
    items: { key: keyof PlayerAttributes; label: string }[];
  }[] = [
    {
      title: '⚽ Finalização, Drible & Ataque',
      items: [
        { key: 'finalizacao', label: 'Finalização' },
        { key: 'chuteLonge', label: 'Chute de Longe' },
        { key: 'drible', label: 'Drible' },
        { key: 'dominio', label: 'Domínio de Bola' },
        { key: 'cabeceio', label: 'Cabeceio' },
        { key: 'posicionamento', label: 'Posicionamento Ofensivo' }
      ]
    },
    {
      title: '🎯 Passe, Criação & Bola Parada',
      items: [
        { key: 'passeCurto', label: 'Passe Curto' },
        { key: 'passeLongo', label: 'Passe Longo' },
        { key: 'cruzamento', label: 'Cruzamento' },
        { key: 'visao', label: 'Visão de Jogo' },
        { key: 'cobrancaFalta', label: 'Cobrança de Falta' },
        { key: 'penalti', label: 'Pênaltis' }
      ]
    },
    {
      title: '⚡ Atributos Físicos & Explosão',
      items: [
        { key: 'velocidade', label: 'Velocidade' },
        { key: 'aceleracao', label: 'Aceleração / Arranque' },
        { key: 'forca', label: 'Força Física' },
        { key: 'resistencia', label: 'Resistência / Fôlego' },
        { key: 'agilidade', label: 'Agilidade' },
        { key: 'equilibrio', label: 'Equilíbrio' }
      ]
    },
    {
      title: '🧠 Mentais, Táticos & Defesa',
      items: [
        { key: 'decisoes', label: 'Tomada de Decisão' },
        { key: 'compostura', label: 'Compostura / Frieza' },
        { key: 'concentracao', label: 'Concentração' },
        { key: 'lideranca', label: 'Liderança' },
        { key: 'desarme', label: 'Desarme' },
        { key: 'marcacao', label: 'Marcação' },
        { key: 'interceptacao', label: 'Interceptação' },
        { key: 'antecipacao', label: 'Antecipação' }
      ]
    },
    {
      title: '🧤 Fundamentos de Goleiro',
      items: [
        { key: 'reflexos', label: 'Reflexos' },
        { key: 'manejo', label: 'Manejo de Bola' },
        { key: 'elasticidade', label: 'Elasticidade / Mergulho' },
        { key: 'posicionamentoGol', label: 'Posicionamento no Gol' },
        { key: 'saidaGol', label: 'Saída de Gol' },
        { key: 'jogoPes', label: 'Jogo com os Pés' },
        { key: 'defesa', label: 'Defesa Geral' }
      ]
    }
  ];

  const ALL_ATTRIBUTES_FLAT = ALL_ATTRIBUTE_CATEGORIES.flatMap(c => c.items);

  const handleSaveCustomFocus = () => {
    if (customSelectedAttrs.length === 0) {
      soundFx.playClick();
      setTrainingMessage('❌ Selecione ao menos 1 atributo para o foco personalizado.');
      setTimeout(() => setTrainingMessage(null), 2500);
      return;
    }
    soundFx.playSuccess();
    const config: TrainingFocusConfig = {
      id: 'custom_focus',
      name:
        customSelectedAttrs.length >= ALL_ATTRIBUTES_FLAT.length
          ? 'Treino Completo (Todos os Atributos)'
          : `Foco Personalizado (${customSelectedAttrs.length} atrib.)`,
      description: `Evolução focada em: ${customSelectedAttrs
        .slice(0, 6)
        .map(a => ATTRIBUTE_LABELS[a] || a)
        .join(', ')}${customSelectedAttrs.length > 6 ? '...' : ''}`,
      targetAttributes: customSelectedAttrs,
      isCustom: true
    };
    onUpdateCareer({
      ...career,
      player: {
        ...p,
        trainingFocus: config
      }
    });
    setIsCustomFocusModalOpen(false);
    setTrainingMessage(`🎯 Foco Personalizado ativado com sucesso para ${customSelectedAttrs.length} atributo(s)!`);
    setTimeout(() => setTrainingMessage(null), 4000);
  };

  // Upgrade attribute helper (+1) — strictly requires at least 1 trainingPoint
  const handleUpgradeAttr = (attrKey: keyof PlayerAttributes) => {
    if (p.trainingPoints < 1) {
      soundFx.playClick();
      setTrainingMessage(
        '❌ Pontos de treino insuficientes! Você possui 0 pontos disponíveis. Jogue partidas ou avance semanas para ganhar mais pontos.'
      );
      setTimeout(() => setTrainingMessage(null), 3500);
      return;
    }
    const currentVal =
      p.attributes[attrKey] ??
      (attrKey === 'manejo' || attrKey === 'elasticidade' ? p.attributes.defesa || 65 : 50);
    if (currentVal >= 99) {
      soundFx.playClick();
      setTrainingMessage(
        `⚠️ O atributo ${ATTRIBUTE_LABELS[attrKey] || attrKey} já está no limite máximo (99)!`
      );
      setTimeout(() => setTrainingMessage(null), 2500);
      return;
    }

    soundFx.playClick();
    const newAttrs = { ...p.attributes, [attrKey]: currentVal + 1 };
    const newOvr = calculateOvr(p.primaryPosition, newAttrs);
    const newMkt = calculateMarketValue(newOvr, p.potential, p.age, p.contract.yearsRemaining);

    const updatedPlayer: PlayerProfile = {
      ...p,
      attributes: newAttrs,
      ovr: newOvr,
      marketValue: newMkt,
      trainingPoints: p.trainingPoints - 1
    };

    onUpdateCareer({
      ...career,
      player: updatedPlayer
    });

    setTrainingMessage(
      `✅ Atributo ${ATTRIBUTE_LABELS[attrKey] || attrKey} aprimorado para ${
        newAttrs[attrKey]
      } (-1 ponto de treino • Restam: ${p.trainingPoints - 1} pts)!`
    );
    setTimeout(() => setTrainingMessage(null), 2500);
  };

  // Custom points distribution handler: STRICTLY verifies that user has enough trainingPoints!
  const handleAddCustomPoints = (attrKey: keyof PlayerAttributes, pointsAmount: number) => {
    if (pointsAmount <= 0 || isNaN(pointsAmount)) {
      soundFx.playClick();
      setTrainingMessage('❌ Digite uma quantidade válida de pontos maior que zero.');
      setTimeout(() => setTrainingMessage(null), 3000);
      return;
    }

    const currentVal =
      p.attributes[attrKey] ??
      (attrKey === 'manejo' || attrKey === 'elasticidade' ? p.attributes.defesa || 65 : 50);

    if (currentVal >= 99) {
      soundFx.playClick();
      setTrainingMessage(
        `⚠️ O atributo ${ATTRIBUTE_LABELS[attrKey] || attrKey} já está no valor máximo de 99!`
      );
      setTimeout(() => setTrainingMessage(null), 2500);
      return;
    }

    // STRICT CHECK: If the user does NOT have enough points for what they requested, block it!
    if (p.trainingPoints <= 0 || pointsAmount > p.trainingPoints) {
      soundFx.playClick();
      setTrainingMessage(
        `❌ Pontos insuficientes! Você tentou colocar +${pointsAmount} ponto(s) em ${
          ATTRIBUTE_LABELS[attrKey] || attrKey
        }, mas possui apenas ${p.trainingPoints} ponto(s) de treino disponível(is).`
      );
      setTimeout(() => setTrainingMessage(null), 4000);
      return;
    }

    // Cap at 99 and only charge the exact points needed to reach targetVal
    const targetVal = Math.min(99, currentVal + pointsAmount);
    const actualPointsUsed = targetVal - currentVal;

    if (actualPointsUsed > p.trainingPoints) {
      soundFx.playClick();
      setTrainingMessage(
        `❌ Pontos insuficientes! Você precisa de ${actualPointsUsed} ponto(s), mas possui apenas ${p.trainingPoints}.`
      );
      setTimeout(() => setTrainingMessage(null), 4000);
      return;
    }

    soundFx.playSuccess();
    const newAttrs = { ...p.attributes, [attrKey]: targetVal };
    const newOvr = calculateOvr(p.primaryPosition, newAttrs);
    const newMkt = calculateMarketValue(newOvr, p.potential, p.age, p.contract.yearsRemaining);
    const updatedTrainingPoints = p.trainingPoints - actualPointsUsed;

    const updatedPlayer: PlayerProfile = {
      ...p,
      attributes: newAttrs,
      ovr: newOvr,
      marketValue: newMkt,
      trainingPoints: updatedTrainingPoints
    };

    onUpdateCareer({
      ...career,
      player: updatedPlayer
    });

    setTrainingMessage(
      `✅ ${
        ATTRIBUTE_LABELS[attrKey] || attrKey
      } elevado de ${currentVal} para ${targetVal} (-${actualPointsUsed} pt(s) • Saldo restante: ${updatedTrainingPoints} pts)!`
    );
    setTimeout(() => setTrainingMessage(null), 4000);
  };

  // Put +1 in ALL attributes at once — ONLY if the player has enough trainingPoints for all of them!
  const handleUpgradeAllAttributesByOne = () => {
    const keysBelow99 = ALL_ATTRIBUTES_FLAT.map(i => i.key).filter(k => {
      const val = p.attributes[k] ?? 50;
      return val < 99;
    });

    if (keysBelow99.length === 0) {
      soundFx.playClick();
      setTrainingMessage('⚠️ Todos os atributos já estão no nível máximo de 99!');
      setTimeout(() => setTrainingMessage(null), 3000);
      return;
    }

    const totalCost = keysBelow99.length;
    if (p.trainingPoints < totalCost) {
      soundFx.playClick();
      setTrainingMessage(
        `❌ Pontos insuficientes para colocar +1 em tudo! Você precisa de ${totalCost} pontos (1 para cada atributo abaixo de 99), mas possui apenas ${p.trainingPoints} ponto(s).`
      );
      setTimeout(() => setTrainingMessage(null), 4500);
      return;
    }

    soundFx.playFanfare();
    const newAttrs: PlayerAttributes = { ...p.attributes };
    keysBelow99.forEach(k => {
      const cur = newAttrs[k] ?? 50;
      newAttrs[k] = Math.min(99, cur + 1);
    });

    const newOvr = calculateOvr(p.primaryPosition, newAttrs);
    const newMkt = calculateMarketValue(newOvr, p.potential, p.age, p.contract.yearsRemaining);
    const remainingPts = p.trainingPoints - totalCost;

    onUpdateCareer({
      ...career,
      player: {
        ...p,
        attributes: newAttrs,
        ovr: newOvr,
        marketValue: newMkt,
        trainingPoints: remainingPts
      }
    });

    setTrainingMessage(
      `🔥 +1 aplicado em TODOS os ${totalCost} atributos! (-${totalCost} pts • Restam: ${remainingPts} pts)`
    );
    setTimeout(() => setTrainingMessage(null), 4000);
  };

  // Medical department handlers
  const handleIntensivePhysio = () => {
    if (!p.isInjured) return;
    soundFx.playSuccess();
    const remaining = Math.max(0, (p.injuryWeeksRemaining || 1) - 1);
    const healed = remaining === 0;

    const updatedPlayer: PlayerProfile = {
      ...p,
      isInjured: !healed,
      injuryWeeksRemaining: remaining,
      injuryName: healed ? undefined : p.injuryName,
      energy: Math.min(100, p.energy + 15)
    };

    onUpdateCareer({
      ...career,
      player: updatedPlayer
    });

    setTrainingMessage(
      healed 
        ? '🏥 Alta Médica! Sessão intensiva de fisioterapia concluiu seu tratamento com sucesso!' 
        : `🏥 Sessão de fisioterapia realizada! Tempo restante reduzido para ${remaining} semana(s).`
    );
    setTimeout(() => setTrainingMessage(null), 4000);
  };

  const handleInstantMedicalClearance = () => {
    soundFx.playFanfare();
    const updatedPlayer: PlayerProfile = {
      ...p,
      isInjured: false,
      injuryWeeksRemaining: 0,
      injuryName: undefined,
      energy: 100
    };

    onUpdateCareer({
      ...career,
      player: updatedPlayer
    });

    setTrainingMessage('✅ Atestado Médico Concedido: Jogador 100% liberado pelo departamento médico para jogar!');
    setTimeout(() => setTrainingMessage(null), 4000);
  };

  // Play match immediately with medical infiltration (sacrifice play)
  const handlePlayWithSacrificeAndStart = () => {
    soundFx.playFanfare();
    const updatedPlayer: PlayerProfile = {
      ...p,
      isInjured: false,
      injuryWeeksRemaining: 0,
      injuryName: undefined,
      energy: Math.max(85, p.energy)
    };

    onUpdateCareer({
      ...career,
      player: updatedPlayer
    });

    soundFx.playWhistle();
    onStartMatch();
  };

  // Negotiate offer handler
  const handleOpenNegotiate = (offer: TransferOffer) => {
    setNegotiatingOffer(offer);
    setCounterWage(offer.offeredWage);
    setCounterYears(offer.contractYears);
    setCounterRole(offer.offeredRole);
    setNegotiationResult(null);
    soundFx.playClick();
  };

  const handleSubmitCounterOffer = () => {
    if (!negotiatingOffer) return;
    soundFx.playClick();

    const res = negotiateCounterOffer(
      negotiatingOffer,
      counterWage,
      counterYears,
      counterRole,
      p.agent.reputation
    );

    if (res.accepted && res.finalOffer) {
      soundFx.playFanfare();
      // Apply contract & transfer
      const final = res.finalOffer;
      const updatedPlayer: PlayerProfile = {
        ...p,
        contract: {
          clubId: final.clubId,
          clubName: final.clubName,
          weeklyWage: final.offeredWage,
          bonusPerGoal: final.bonusPerGoal,
          bonusPerCleanSheet: final.bonusPerCleanSheet,
          releaseClause: final.releaseClause,
          yearsRemaining: final.contractYears,
          role: final.offeredRole
        },
        squadRole: final.offeredRole,
        coachTrust: 65,
        fansPopularity: Math.min(95, p.fansPopularity + 10),
        followersCount: p.followersCount + Math.floor(Math.random() * 20000)
      };

      const updatedNews = [
        {
          id: 'news_transfer_' + Date.now(),
          dateStr: `Temporada ${career.currentYear} • Semana ${career.currentWeek}`,
          headline: `OFICIAL! ${p.shirtName.toUpperCase()} É O NOVO REFORÇO DO ${final.clubName.toUpperCase()}`,
          snippet: `Negociação concluída com sucesso. O atleta assina por ${final.contractYears} anos com salário semanal de ${formatCurrency(final.offeredWage)}.`,
          category: 'transfer' as const
        },
        ...career.news
      ];

      onUpdateCareer({
        ...career,
        player: updatedPlayer,
        news: updatedNews,
        activeOffers: career.activeOffers.filter(o => o.id !== negotiatingOffer.id)
      });

      setNegotiationResult({
        accepted: true,
        message: `Acordo fechado! Você agora defende as cores do ${final.clubName}!`
      });

      setTimeout(() => {
        setNegotiatingOffer(null);
        setNegotiationResult(null);
      }, 2500);
    } else {
      setNegotiationResult({
        accepted: false,
        message: res.refusalReason || 'A contraproposta foi rejeitada pela diretoria.'
      });
    }
  };

  // Change agent handler
  const handleSelectAgent = (newAgent: Agent) => {
    soundFx.playClick();
    onUpdateCareer({
      ...career,
      player: {
        ...p,
        agent: newAgent
      }
    });
    setIsChangingAgent(false);
  };

  // Find current club details
  const currentClub = INITIAL_CLUBS.find(c => c.id === p.contract.clubId) || INITIAL_CLUBS[0];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Top Quick Navigation Bar */}
      {onGoHome && (
        <div className="flex items-center justify-between bg-neutral-900/60 p-2.5 px-4 rounded-2xl border border-neutral-800 shadow-sm">
          <button
            onClick={() => {
              soundFx.playClick();
              onUpdateCareer(career);
              onGoHome();
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-800/90 hover:bg-neutral-750 text-xs font-black text-neutral-200 hover:text-white border border-neutral-700 transition shadow-sm group"
            title="Salvar progresso e voltar ao menu principal de saves"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Voltar ao Menu Principal</span>
          </button>

          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Progresso salvo automaticamente ao sair</span>
          </div>
        </div>
      )}

      {/* Top Banner: Club & Player Quick Identity */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-950 p-6 rounded-3xl border border-neutral-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div
          className="absolute -right-10 -bottom-10 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: currentClub.primaryColor }}
        />

        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          {/* Player Photo Avatar & Club Badge */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setIsPhotoModalOpen(true)}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-neutral-950 border-2 border-emerald-500/50 hover:border-emerald-400 cursor-pointer group shadow-xl transition shrink-0"
              title="Clique para adicionar ou trocar a foto do jogador"
            >
              {p.photoUrl ? (
                <img
                  src={p.photoUrl}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-400 group-hover:text-emerald-400 transition">
                  <User className="w-8 h-8 mb-1" />
                  <span className="text-[9px] font-bold">Foto</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>

            <div className="shrink-0">
              <ClubBadge club={currentClub} size="xl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white font-heading tracking-tight">
                {p.name} {p.lastName}
              </h1>
              <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${getRoleBadgeColor(p.squadRole)}`}>
                {p.squadRole}
              </span>
              <span className="text-xs text-neutral-400 font-mono">#{p.shirtNumber}</span>
              {p.isYouthAcademy && (
                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ⭐ BASE ({p.youthCategory || (p.age <= 15 ? 'Sub-15' : 'Sub-17')})
                </span>
              )}
              {career.isRetired && (
                <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  🏆 Aposentado
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-300 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="font-semibold text-white">{p.contract.clubName || currentClub.name}</span>
              <span>•</span>
              <span>{p.primaryPosition} ({p.playStyle})</span>
              <span>•</span>
              <span>{p.age} anos {p.isYouthAcademy ? `(Profissionaliza aos 18 • faltam ${18 - p.age} ${18 - p.age > 1 ? 'anos' : 'ano'})` : ''}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(p.marketValue)}</span>
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Zap className="w-3 h-3 text-emerald-400" />
                Auto-Evolução de GERAL Ativa ({p.ovr} OVR)
              </span>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(true)}
                className="text-[11px] text-neutral-400 hover:text-emerald-400 flex items-center gap-1 transition underline decoration-dotted"
              >
                <Camera className="w-3 h-3" />
                {p.photoUrl ? 'Trocar foto' : 'Adicionar foto'}
              </button>
            </div>
          </div>
        </div>

        {/* Action Button: Disputar Próxima Partida OR Retirement Banner */}
        {career.isRetired ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-center sm:text-right space-y-2.5 max-w-md w-full sm:w-auto shadow-xl">
            <div className="flex items-center justify-center sm:justify-end gap-2 text-amber-400 font-black text-sm tracking-wide">
              <Trophy className="w-4 h-4 fill-current" />
              <span>CARREIRA ENCERRADA • LENDA ETERNIZADA</span>
            </div>
            <p className="text-xs text-neutral-300">
              Você pendurou as chuteiras com sucesso. Não é mais possível disputar partidas nesta carreira.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 pt-1">
              <button
                onClick={() => { soundFx.playFanfare(); onRetire(); }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5 fill-current" />
                Ver Hall da Fama Oficial
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {p.isInjured ? (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handlePlayWithSacrificeAndStart}
                  className="w-full sm:w-auto px-5 py-3.5 rounded-2xl font-black text-xs tracking-wide shadow-xl flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 transition transform hover:scale-[1.02] active:scale-[0.98]"
                  title="Aplica infiltração e joga a partida normalmente como titular"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  ⚡ JOGAR NO SACRIFÍCIO (INFILTRAÇÃO)
                </button>

                <button
                  onClick={() => {
                    handleInstantMedicalClearance();
                    soundFx.playWhistle();
                    onStartMatch();
                  }}
                  className="w-full sm:w-auto px-4 py-3.5 rounded-2xl font-black text-xs tracking-wide shadow-xl flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 transition transform hover:scale-[1.02] active:scale-[0.98]"
                  title="Cura 100% da lesão e inicia a partida como titular absoluto"
                >
                  <HeartPulse className="w-4 h-4 fill-current" />
                  💊 CURAR E JOGAR
                </button>

                <button
                  onClick={() => {
                    soundFx.playWhistle();
                    onStartMatch();
                  }}
                  className="w-full sm:w-auto px-3.5 py-3.5 rounded-2xl font-bold text-xs bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/40 transition flex items-center justify-center gap-1.5"
                  title="Simula a rodada enquanto você segue em tratamento fisioterápico"
                >
                  <Play className="w-3.5 h-3.5" />
                  Simular Rodada ({p.injuryWeeksRemaining} sem)
                </button>
              </div>
            ) : (
              <button
                onClick={() => { soundFx.playWhistle(); onStartMatch(); }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 shadow-emerald-500/25 transition transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-current" />
                JOGAR PRÓXIMA PARTIDA
              </button>
            )}

            <button
              onClick={() => { soundFx.playClick(); setIsSimulatingSeason(true); }}
              className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-750 text-emerald-400 border border-emerald-500/40 text-xs font-black shadow-lg transition flex items-center justify-center gap-2"
              title="Simular toda a temporada restante até a semana 48 com relatório completo"
            >
              <FastForward className="w-4 h-4 text-emerald-400" />
              Simular Temporada ⏩
            </button>

            <button
              onClick={() => { soundFx.playFanfare(); setIsSimulatingCareerEnd(true); }}
              className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/50 text-xs font-black shadow-lg transition flex items-center justify-center gap-2"
              title="Simular todas as temporadas restantes até o fim da carreira e consagração no Hall da Fama"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              Fim da Carreira 🏆
            </button>

            <button
              onClick={() => { soundFx.playClick(); onAdvanceWeek(); }}
              className="w-full sm:w-auto px-3.5 py-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-800 transition"
              title="Avançar uma semana de treinamento e descanso"
            >
              Descansar
            </button>

            {onGoHome && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  onUpdateCareer(career);
                  onGoHome();
                }}
                className="w-full sm:w-auto px-3.5 py-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold border border-neutral-800 hover:border-neutral-700 transition flex items-center justify-center gap-1.5"
                title="Salvar carreira e voltar ao Menu Principal"
              >
                <Home className="w-4 h-4 text-emerald-400" />
                <span>Menu</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Medical Department Banner if Injured */}
      {p.isInjured && (
        <div className="w-full p-4 rounded-2xl bg-red-950/40 border border-red-500/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-lg shrink-0">
              🏥
            </div>
            <div>
              <div className="text-xs font-black text-red-300 uppercase tracking-wider flex items-center gap-2">
                <span>Boletim Médico: {p.injuryName || 'Lesão no Tornozelo / Muscular'}</span>
                <span className="px-2 py-0.5 rounded bg-red-500 text-neutral-950 text-[10px] font-black">
                  {p.injuryWeeksRemaining} semana(s) restante(s)
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Você está em tratamento médico. A equipe disputa a partida normalmente sob cuidados da fisioterapia, ou você pode acelerar/conceder alta médica imediata abaixo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={handleIntensivePhysio}
              className="flex-1 md:flex-initial px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs border border-neutral-700 transition"
              title="Reduzir 1 semana de tempo de lesão"
            >
              Sessão Fisioterapia (-1 sem)
            </button>
            <button
              onClick={handleInstantMedicalClearance}
              className="flex-1 md:flex-initial px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs shadow-md transition"
              title="Receber alta médica e voltar a jogar agora"
            >
              Alta Médica Imediata ✅
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-800 gap-1 sm:gap-2 text-xs font-bold overflow-x-auto pb-1">
        <button
          onClick={() => { soundFx.playClick(); setActiveTab('overview'); }}
          className={`py-3 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-extrabold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          Visão Geral
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('standings'); }}
          className={`py-3 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'standings'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-extrabold shadow-sm'
              : 'text-amber-300/90 hover:text-amber-200 bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/20'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          Classificação & Competições (Liga / Copa do Brasil / Champions / Libertadores)
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('training'); }}
          className={`py-3 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'training'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-extrabold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Zap className="w-4 h-4" />
          Treino & Atributos
          {p.trainingPoints > 0 && (
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-neutral-950 text-[10px] font-black flex items-center justify-center">
              {p.trainingPoints}
            </span>
          )}
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('transfers'); }}
          className={`py-3 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'transfers'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-extrabold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Mercado & Agente
          {career.activeOffers.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-black flex items-center justify-center">
              {career.activeOffers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('news'); }}
          className={`py-3 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'news'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-extrabold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          FutFeed & Imprensa
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('national'); }}
          className={`py-3 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'national'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-extrabold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Globe className="w-4 h-4" />
          Seleção Nacional
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('trophies'); }}
          className={`py-3 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'trophies'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-extrabold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Troféus & Prêmios ({p.careerTrophies + career.awardsCabinet.length})
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('history'); }}
          className={`py-3 px-4 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-extrabold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <History className="w-4 h-4" />
          Histórico de Temporadas
        </button>
      </div>

      {/* TAB 1: VISÃO GERAL */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: FIFA Style Card & Core Attributes radar summary */}
            <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 flex flex-col items-center justify-between text-center relative overflow-hidden">
              {/* FIFA Card */}
              <div className="w-56 mx-auto bg-gradient-to-b from-amber-500/25 via-neutral-900 to-neutral-950 p-5 rounded-2xl border-2 border-amber-500/50 shadow-2xl relative my-2">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-left">
                    <div className="text-4xl font-black text-amber-300 font-heading leading-none">
                      {p.ovr}
                    </div>
                    <div className="text-sm font-extrabold text-neutral-200 mt-1">
                      {p.primaryPosition}
                    </div>
                  </div>
                  <ClubBadge club={currentClub} size="sm" />
                </div>

                {/* Player Photo on Card */}
                <div 
                  onClick={() => setIsPhotoModalOpen(true)}
                  className="w-24 h-28 mx-auto my-2 rounded-xl overflow-hidden bg-neutral-900/90 border border-amber-500/40 shadow-inner flex items-center justify-center relative group cursor-pointer hover:border-amber-400 transition"
                  title="Clique para alterar a foto na cartinha"
                >
                  {p.photoUrl ? (
                    <img
                      src={p.photoUrl}
                      alt={p.shirtName}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-2">
                      <Camera className="w-7 h-7 text-amber-400/70 group-hover:text-amber-300 group-hover:scale-110 transition mb-1" />
                      <span className="text-[9px] font-bold text-neutral-400 group-hover:text-amber-200 uppercase tracking-wider">
                        + Foto
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <span className="text-[10px] text-amber-200 font-bold bg-neutral-950/80 px-2 py-0.5 rounded-full border border-amber-500/50">
                      Alterar Foto
                    </span>
                  </div>
                </div>

                <div className="font-extrabold text-white text-base tracking-wider uppercase font-heading border-b border-neutral-800 pb-2">
                  {p.shirtName}
                </div>

                {/* Key stats breakdown: Goleiro (REF, MAN, ELA, POS, SAI, PES) vs Linha (FIN, VEL, PAS, DRI, DEF, FIS) */}
                {p.primaryPosition === 'GOL' ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono font-bold mt-3 text-left">
                    <div className="flex justify-between">
                      <span className="text-amber-400/90" title="Reflexos">REF</span>
                      <span className="text-white">{p.attributes.reflexos ?? 70}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-400/90" title="Manejo de Bola">MAN</span>
                      <span className="text-white">{p.attributes.manejo ?? p.attributes.defesa ?? 70}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-400/90" title="Elasticidade / Mergulho">ELA</span>
                      <span className="text-white">{p.attributes.elasticidade ?? p.attributes.defesa ?? 70}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-400/90" title="Posicionamento no Gol">POS</span>
                      <span className="text-white">{p.attributes.posicionamentoGol ?? 70}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-400/90" title="Saída de Gol">SAI</span>
                      <span className="text-white">{p.attributes.saidaGol ?? 65}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-400/90" title="Jogo com os Pés">PES</span>
                      <span className="text-white">{p.attributes.jogoPes ?? 60}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono font-bold mt-3 text-left">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">FIN</span>
                      <span className="text-white">{p.attributes.finalizacao}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">VEL</span>
                      <span className="text-white">{p.attributes.velocidade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">PAS</span>
                      <span className="text-white">{p.attributes.passeCurto}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">DRI</span>
                      <span className="text-white">{p.attributes.drible}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">DEF</span>
                      <span className="text-white">{p.attributes.desarme}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">FIS</span>
                      <span className="text-white">{p.attributes.forca}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Pills */}
              <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                  <span className="text-[10px] text-neutral-500 uppercase block font-bold">Confiança</span>
                  <span className="font-bold text-white">{p.confidence}%</span>
                </div>
                <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                  <span className="text-[10px] text-neutral-500 uppercase block font-bold">Moral</span>
                  <span className={`font-bold ${p.morale === 'Excelente' ? 'text-emerald-400' : 'text-neutral-200'}`}>
                    {p.morale}
                  </span>
                </div>
              </div>

              {/* Quick Anytime Attribute Training Shortcut */}
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setActiveTab('training');
                }}
                className="w-full mt-3 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                <span>Treinar Atributos Agora ({p.trainingPoints} pts)</span>
              </button>
            </div>

            {/* Middle Col: Season & Career Stats */}
            <div className="space-y-6">
              {/* Season Stats Card */}
              <div className="bg-neutral-900/70 p-5 rounded-3xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="font-extrabold text-sm text-white font-heading flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    Temporada {career.currentYear}
                  </h3>
                  <span className="text-xs text-neutral-400">Semana {career.currentWeek}/48</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Jogos</span>
                    <span className="text-xl font-black text-white font-heading">{currentSeasonStats.matches}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Gols</span>
                    <span className="text-xl font-black text-emerald-400 font-heading">{currentSeasonStats.goals}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Assistências</span>
                    <span className="text-xl font-black text-blue-400 font-heading">{currentSeasonStats.assists}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Nota Média</span>
                    <span className="text-xl font-black text-amber-400 font-heading">
                      {currentSeasonStats.avgRating > 0 ? currentSeasonStats.avgRating.toFixed(1) : '-'}
                    </span>
                  </div>
                </div>

                {/* Real Team W/D/L Record in Season */}
                {(() => {
                  const seasonMatches = getUserSeasonMatches(career, currentClub.id);
                  const wins = seasonMatches.filter(m => m.outcome === 'V').length;
                  const draws = seasonMatches.filter(m => m.outcome === 'E').length;
                  const losses = seasonMatches.filter(m => m.outcome === 'D').length;
                  const lastMatch = seasonMatches.length > 0 ? seasonMatches[seasonMatches.length - 1] : null;
                  const lastOpp = lastMatch
                    ? INITIAL_CLUBS.find(c => c.id === lastMatch.opponentClubId)
                    : null;

                  return (
                    <div className="pt-3 border-t border-neutral-800 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                          <span className="text-[10px] font-black uppercase text-emerald-400 block">
                            Vitórias
                          </span>
                          <span className="text-base font-black text-white font-mono">{wins}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                          <span className="text-[10px] font-black uppercase text-amber-400 block">
                            Empates
                          </span>
                          <span className="text-base font-black text-white font-mono">{draws}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                          <span className="text-[10px] font-black uppercase text-rose-400 block">
                            Derrotas
                          </span>
                          <span className="text-base font-black text-white font-mono">{losses}</span>
                        </div>
                      </div>

                      {lastMatch ? (
                        <div
                          className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col gap-1 ${
                            lastMatch.outcome === 'V'
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                              : lastMatch.outcome === 'E'
                              ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                              : 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>
                              Último Jogo:{' '}
                              <strong>
                                {lastMatch.outcome === 'V'
                                  ? '🏆 VOCÊ GANHOU!'
                                  : lastMatch.outcome === 'E'
                                  ? '⚖️ VOCÊ EMPATOU!'
                                  : '❌ VOCÊ PERDEU'}
                              </strong>
                            </span>
                            <span className="font-mono text-white font-black">
                              {currentClub.shortName} {lastMatch.userGoalsFor} x {lastMatch.userGoalsAgainst}{' '}
                              {lastOpp?.shortName || 'ADV'}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-300 font-semibold truncate">
                            Competição: {lastMatch.competitionName}
                          </span>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 text-center">
                          Ainda não disputou partidas nesta temporada (0V • 0E • 0D)
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Career Totals Card */}
              <div className="bg-neutral-900/70 p-5 rounded-3xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="font-extrabold text-sm text-white font-heading flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Totais da Carreira
                  </h3>
                  <span className="text-xs text-neutral-400 font-mono">
                    {career.totalSeasonsPlayed} temporadas concluídas
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Partidas</span>
                    <span className="text-xl font-black text-white font-mono">{p.careerMatches}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Gols</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">{p.careerGoals}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Assistências</span>
                    <span className="text-xl font-black text-blue-400 font-mono">{p.careerAssists}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Títulos</span>
                    <span className="text-xl font-black text-amber-400 font-mono">{p.careerTrophies}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Relationships & Contract */}
            <div className="space-y-6">
              <div className="bg-neutral-900/70 p-5 rounded-3xl border border-neutral-800 space-y-4">
                <h3 className="font-extrabold text-sm text-white font-heading border-b border-neutral-800 pb-3">
                  Relacionamento & Vestiário
                </h3>

                <div className="space-y-3">
                  {/* Coach Trust */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-neutral-400">Confiança do Treinador</span>
                      <span className="text-emerald-400">{p.coachTrust}%</span>
                    </div>
                    <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${p.coachTrust}%` }} />
                    </div>
                  </div>

                  {/* Fans Popularity */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-neutral-400">Apoio da Torcida</span>
                      <span className="text-amber-400">{p.fansPopularity}%</span>
                    </div>
                    <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${p.fansPopularity}%` }} />
                    </div>
                  </div>

                  {/* Teammates Harmony */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-neutral-400">Harmonia no Elenco</span>
                      <span className="text-blue-400">{p.squadRelationship}%</span>
                    </div>
                    <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${p.squadRelationship}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contract summary */}
              <div className="bg-neutral-900/70 p-5 rounded-3xl border border-neutral-800 space-y-2.5 text-xs">
                <h3 className="font-extrabold text-sm text-white font-heading border-b border-neutral-800 pb-2.5 flex items-center justify-between">
                  <span>Contrato Atual</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {formatCurrency(p.contract.weeklyWage)}/sem
                  </span>
                </h3>

                <div className="flex justify-between text-neutral-300">
                  <span>Duração Restante:</span>
                  <span className="font-bold text-white">{p.contract.yearsRemaining} anos</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Multa Rescisória:</span>
                  <span className="font-bold text-white">{formatCurrency(p.contract.releaseClause)}</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Empresário:</span>
                  <span className="font-bold text-amber-400">{p.agent.name}</span>
                </div>
              </div>

              {/* Retirement Button */}
              <button
                onClick={() => { soundFx.playClick(); onRetire(); }}
                className="w-full py-3 rounded-2xl bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-300 text-xs font-bold border border-neutral-800 hover:border-red-500/40 transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Anunciar Aposentadoria (Ver Hall da Fama)
              </button>
            </div>
          </div>

          {/* Quick Competitions & Standings Summary Card on Overview */}
          <div className="bg-neutral-900/75 p-5 sm:p-6 rounded-3xl border border-neutral-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-black text-sm sm:text-base text-white font-heading flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Classificação nas Competições (Liga, Champions League, Libertadores e Copas)</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Situação atual do <strong className="text-white">{currentClub.name}</strong> em todas as competições da temporada {career.currentYear}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setActiveTab('standings');
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 shrink-0"
              >
                <Trophy className="w-4 h-4" />
                <span>Ver Tabelas de Classificação Completas</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {getClubCompetitionsOverview(currentClub, career).map(comp => (
                <div
                  key={comp.id}
                  onClick={() => {
                    soundFx.playClick();
                    setActiveTab('standings');
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-2 ${
                    comp.isParticipating
                      ? 'bg-neutral-950/90 hover:bg-neutral-900 border-emerald-500/35'
                      : 'bg-neutral-950/50 hover:bg-neutral-900/60 border-neutral-800 opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl">{comp.badgeIcon}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider border ${
                        comp.isParticipating
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {comp.statusText}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-xs text-white font-heading">{comp.name}</h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                      {comp.reasonOrStage}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1.5: CLASSIFICAÇÕES & COMPETIÇÕES (LIGA, CHAMPIONS, LIBERTADORES, COPAS) */}
      {activeTab === 'standings' && (
        <CompetitionsStandings career={career} userClub={currentClub} />
      )}

      {/* TAB 2: TREINO & ATRIBUTOS */}
      {activeTab === 'training' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 p-6 rounded-3xl border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Centro de Treinamento
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {p.primaryPosition === 'GOL' ? 'Especialista em Goleiro' : 'Jogador de Linha'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-heading mt-1">
                Treino de Atributos & Evolução Contínua
              </h2>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
                Configure o foco do <strong className="text-emerald-400">Treino Automático</strong> para guiar seu crescimento semanal ou use seus pontos acumulados para aprimorar atributos específicos.
              </p>
            </div>

            <div className="bg-neutral-950 px-5 py-3.5 rounded-2xl border border-neutral-800 flex items-center gap-3.5 shadow-lg">
              <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Pontos Manuais</span>
                <span className="text-2xl font-black text-emerald-400 font-heading">{p.trainingPoints}</span>
              </div>
            </div>
          </div>

          {trainingMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-sm animate-fadeIn ${
                trainingMessage.startsWith('❌') || trainingMessage.startsWith('⚠️')
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <CheckCircle2
                className={`w-4 h-4 shrink-0 ${
                  trainingMessage.startsWith('❌') || trainingMessage.startsWith('⚠️')
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              />
              <span>{trainingMessage}</span>
            </div>
          )}

          {/* Sub-Tabs Selector */}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3">
            <button
              onClick={() => { soundFx.playClick(); setTrainingSubTab('custom_input'); }}
              className={`px-5 py-3 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
                trainingSubTab === 'custom_input'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow-lg shadow-amber-500/20'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Distribuir Pontos em Qualquer Atributo (Todos Liberados)</span>
            </button>

            <button
              onClick={() => { soundFx.playClick(); setTrainingSubTab('matrix'); }}
              className={`px-5 py-3 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
                trainingSubTab === 'matrix'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-neutral-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Matriz Completa & Foco de Treino Semanal</span>
            </button>
          </div>

          {/* SUB-TAB 1: DISTRIBUIR PONTOS EM QUALQUER ATRIBUTO A QUALQUER HORA */}
          {trainingSubTab === 'custom_input' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Point Distribution Card */}
              <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/30 p-6 rounded-3xl border border-amber-500/30 shadow-2xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      <h3 className="text-base sm:text-lg font-black text-white font-heading">
                        Treino Livre de Atributos (Disponível a Qualquer Momento em Tudo)
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-300 mt-1">
                      Coloque seus pontos de treino quando quiser em <strong className="text-amber-300">qualquer atributo do jogo</strong>. Cada ponto adicionado consome <strong className="text-emerald-400">1 Ponto Manual</strong> — se você não tiver pontos suficientes, o sistema bloqueia a adição.
                    </p>
                  </div>

                  <button
                    onClick={handleUpgradeAllAttributesByOne}
                    disabled={p.trainingPoints < ALL_ATTRIBUTES_FLAT.filter(i => (p.attributes[i.key] ?? 50) < 99).length}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-black text-xs shadow-lg transition flex items-center justify-center gap-2 shrink-0"
                    title="Adiciona +1 em todos os atributos (requer pontos suficientes para todos)"
                  >
                    <Plus className="w-4 h-4 text-neutral-950 stroke-[3]" />
                    <span>
                      +1 em Tudo (Custo:{' '}
                      {ALL_ATTRIBUTES_FLAT.filter(i => (p.attributes[i.key] ?? 50) < 99).length} pts)
                    </span>
                  </button>
                </div>

                {/* Input Controls */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800">
                  <div className="md:col-span-6 space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      <span>Escolha Qualquer Atributo (Todos Liberados):</span>
                    </label>
                    <select
                      value={customSelectedAttr}
                      onChange={(e) => setCustomSelectedAttr(e.target.value as keyof PlayerAttributes)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-amber-500"
                    >
                      {ALL_ATTRIBUTES_FLAT.map(item => {
                        const curVal = p.attributes[item.key] ?? 50;
                        return (
                          <option key={item.key} value={item.key}>
                            {item.label} — Atual: {curVal} / 99
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 flex items-center justify-between">
                      <span>Quantos Pontos:</span>
                      <span className="text-[10px] text-emerald-400">
                        Você tem: {p.trainingPoints} pts
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, p.trainingPoints)}
                      placeholder="Ex: 1, 5, 10"
                      value={customPointsInput}
                      onChange={(e) => setCustomPointsInput(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <button
                      onClick={() => {
                        const pts = parseInt(customPointsInput, 10);
                        handleAddCustomPoints(customSelectedAttr, pts);
                      }}
                      disabled={
                        p.trainingPoints <= 0 ||
                        isNaN(parseInt(customPointsInput, 10)) ||
                        parseInt(customPointsInput, 10) <= 0 ||
                        parseInt(customPointsInput, 10) > p.trainingPoints
                      }
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-neutral-950 font-black text-xs shadow-md transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>
                        {p.trainingPoints <= 0
                          ? 'Sem Pontos Disponíveis'
                          : parseInt(customPointsInput, 10) > p.trainingPoints
                          ? `Faltam Pontos (${p.trainingPoints} disp.)`
                          : 'Adicionar Pontos'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-neutral-400 mr-1">Atalhos rápidos:</span>
                  {[
                    { label: '+1 pt', val: 1 },
                    { label: '+2 pts', val: 2 },
                    { label: '+5 pts', val: 5 },
                    { label: '+10 pts', val: 10 },
                    { label: '+20 pts', val: 20 }
                  ].map(preset => {
                    const notEnough = p.trainingPoints < preset.val;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setCustomPointsInput(String(preset.val));
                          handleAddCustomPoints(customSelectedAttr, preset.val);
                        }}
                        disabled={notEnough}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-35 disabled:cursor-not-allowed text-neutral-200 text-xs font-bold border border-neutral-700 hover:border-amber-500/50 transition"
                        title={
                          notEnough
                            ? `Você precisa de ${preset.val} pontos (possui ${p.trainingPoints})`
                            : `Adicionar ${preset.label}`
                        }
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ALL Categorized Attributes with Direct Inline Adjusters (Every attribute available anytime!) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ALL_ATTRIBUTE_CATEGORIES.map((cat, catIdx) => (
                  <div key={catIdx} className="bg-neutral-900/80 p-5 rounded-3xl border border-neutral-800 space-y-3">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider font-heading border-b border-neutral-800 pb-2.5 flex items-center justify-between">
                      <span>{cat.title}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Saldo: {p.trainingPoints} pts
                      </span>
                    </h4>

                    <div className="space-y-2.5">
                      {cat.items.map(item => {
                        const val = p.attributes[item.key] ?? 50;
                        const pct = Math.min(100, Math.round((val / 99) * 100));
                        const neededFor99 = Math.max(0, 99 - val);
                        return (
                          <div
                            key={item.key}
                            className="p-2.5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 hover:border-neutral-700 transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{item.label}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-mono font-black text-xs ${val >= 90 ? 'text-amber-400' : val >= 80 ? 'text-emerald-400' : 'text-neutral-200'}`}>
                                  {val}
                                </span>
                                <span className="text-[10px] text-neutral-500">/99</span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  val >= 90 ? 'bg-amber-400' : val >= 80 ? 'bg-emerald-400' : 'bg-blue-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            {/* Action Buttons for this Attribute — strictly disabled if trainingPoints < amount */}
                            <div className="flex items-center justify-between gap-1.5 pt-1">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleAddCustomPoints(item.key, 1)}
                                  disabled={val >= 99 || p.trainingPoints < 1}
                                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-emerald-500 hover:text-neutral-950 text-neutral-200 text-[10px] font-bold border border-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                  title={
                                    p.trainingPoints < 1
                                      ? 'Pontos insuficientes (requer 1 ponto)'
                                      : 'Adicionar +1 ponto'
                                  }
                                >
                                  +1
                                </button>
                                <button
                                  onClick={() => handleAddCustomPoints(item.key, 5)}
                                  disabled={val >= 99 || p.trainingPoints < 5}
                                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-emerald-500 hover:text-neutral-950 text-neutral-200 text-[10px] font-bold border border-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                  title={
                                    p.trainingPoints < 5
                                      ? `Pontos insuficientes (requer 5 pontos, você tem ${p.trainingPoints})`
                                      : 'Adicionar +5 pontos'
                                  }
                                >
                                  +5
                                </button>
                                <button
                                  onClick={() => handleAddCustomPoints(item.key, 10)}
                                  disabled={val >= 99 || p.trainingPoints < 10}
                                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-emerald-500 hover:text-neutral-950 text-neutral-200 text-[10px] font-bold border border-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                  title={
                                    p.trainingPoints < 10
                                      ? `Pontos insuficientes (requer 10 pontos, você tem ${p.trainingPoints})`
                                      : 'Adicionar +10 pontos'
                                  }
                                >
                                  +10
                                </button>
                              </div>

                              <button
                                onClick={() => handleAddCustomPoints(item.key, neededFor99)}
                                disabled={val >= 99 || p.trainingPoints < neededFor99}
                                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-black border border-amber-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                title={
                                  val >= 99
                                    ? 'Já está no máximo (99)'
                                    : p.trainingPoints < neededFor99
                                    ? `Faltam pontos: requer ${neededFor99} pts para chegar a 99 (você tem ${p.trainingPoints})`
                                    : `Usar ${neededFor99} pts para chegar a 99`
                                }
                              >
                                {val >= 99 ? 'MAX 99' : `99 (${neededFor99}p)`}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: FOCO AUTOMÁTICO & MATRIZ TRADICIONAL */}
          {trainingSubTab === 'matrix' && (
            <div className="space-y-6 animate-fadeIn">
          {/* SECTION 1: TREINO AUTOMÁTICO - ESCOLHA DE FOCO */}
          <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-base font-black text-white font-heading">
                    Treino Automático: Escolha o que você quer treinar
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Seus treinos rotineiros da semana e desempenhos em campo priorizam automaticamente os fundamentos abaixo.
                </p>
              </div>

              {/* Current Active Badge & Custom Trigger */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-bold text-emerald-300">
                    Foco Ativo: {currentFocus.name}
                  </span>
                </div>

                <button
                  onClick={() => setIsCustomFocusModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 flex items-center gap-1.5 transition"
                  title="Criar foco com atributos personalizados"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Personalizar</span>
                </button>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              {positionPresets.map(preset => {
                const isActive = currentFocus.id === preset.id && !currentFocus.isCustom;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                      isActive
                        ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/50'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{preset.icon}</span>
                          <h4 className={`text-xs font-extrabold font-heading ${isActive ? 'text-emerald-300' : 'text-white'}`}>
                            {preset.name}
                          </h4>
                        </div>
                        {isActive ? (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" /> Ativo
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-neutral-500 group-hover:text-emerald-400 uppercase transition">
                            Selecionar
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-2 border-t border-neutral-800/80">
                      {preset.targetAttributes.map(attr => (
                        <span
                          key={attr}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                          }`}
                        >
                          {ATTRIBUTE_LABELS[attr] || attr}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: MATRIZ COMPLETA DE ATRIBUTOS (TODOS LIBERADOS) */}
          <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-4">
            <div className="border-b border-neutral-800 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-white font-heading">
                  Matriz Completa de Atributos (Todos os Fundamentos Liberados)
                </h3>
                <p className="text-xs text-neutral-400">
                  Coloque seus pontos quando quiser em qualquer fundamento técnico, físico, mental, defensivo ou de goleiro.
                </p>
              </div>
              <span className="text-[11px] font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-xl border border-neutral-800">
                Geral Atual: <strong className="text-amber-300">{p.ovr}</strong> | Potencial: <strong className="text-emerald-400">{p.potential}</strong> | Pontos: <strong className="text-emerald-400">{p.trainingPoints}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ALL_ATTRIBUTE_CATEGORIES.map((cat, idx) => (
                <div key={idx} className="bg-neutral-950/60 p-5 rounded-2xl border border-neutral-800 space-y-3">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider font-heading border-b border-neutral-800 pb-2 flex items-center justify-between">
                    <span>{cat.title}</span>
                    <span className="text-[10px] text-neutral-500">1-99</span>
                  </h4>

                  <div className="space-y-2">
                    {cat.items.map(item => {
                      const val = p.attributes[item.key] ?? 50;
                      return (
                        <div key={item.key} className="flex items-center justify-between text-xs py-1 hover:bg-neutral-900/40 px-1 rounded transition">
                          <span className="text-neutral-300 font-medium">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white w-6 text-right">{val}</span>
                            <button
                              onClick={() => handleUpgradeAttr(item.key)}
                              disabled={p.trainingPoints <= 0 || val >= 99}
                              className="w-6 h-6 rounded-lg bg-neutral-800 hover:bg-emerald-500 hover:text-neutral-950 text-neutral-300 font-bold flex items-center justify-center text-xs transition disabled:opacity-30 disabled:cursor-not-allowed"
                              title={
                                p.trainingPoints <= 0
                                  ? 'Pontos insuficientes (0 pts)'
                                  : 'Aprimorar +1 (-1 pt)'
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Custom Training Focus */}
      {isCustomFocusModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Customização Livre do Treino Automático
                </span>
                <h3 className="text-lg font-black text-white font-heading mt-0.5">
                  Selecione Quaisquer Atributos (Sem Limite)
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Escolha quantos atributos quiser (ou marque todos) para evoluir automaticamente a qualquer hora.
                </p>
              </div>
              <button
                onClick={() => setIsCustomFocusModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setCustomSelectedAttrs(ALL_ATTRIBUTES_FLAT.map(i => i.key));
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black transition"
              >
                ✅ Selecionar Tudo ({ALL_ATTRIBUTES_FLAT.length} Atributos)
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setCustomSelectedAttrs([]);
                }}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition"
              >
                Limpar Seleção
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
              {ALL_ATTRIBUTES_FLAT.map(item => {
                const attrKey = item.key;
                const isChecked = customSelectedAttrs.includes(attrKey);
                return (
                  <label
                    key={attrKey}
                    onClick={() => handleToggleCustomAttr(attrKey)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                      isChecked
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                        : 'bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:bg-neutral-800/40'
                    }`}
                  >
                    <span className="text-xs font-semibold">
                      {item.label} ({p.attributes[attrKey] ?? 50}/99)
                    </span>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                        isChecked
                          ? 'bg-emerald-500 border-emerald-400 text-neutral-950'
                          : 'border-neutral-700 bg-neutral-900'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-xs">
              <span className="text-neutral-400">
                Selecionados: <strong className="text-emerald-400">{customSelectedAttrs.length}</strong> atributo(s)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCustomFocusModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCustomFocus}
                  disabled={customSelectedAttrs.length === 0}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-neutral-950 font-bold transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Salvar Foco
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MERCADO & AGENTE */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          {/* Agent Card */}
          <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-heading text-xl">
                👔
              </div>
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                  Seu Representante / Empresário
                </span>
                <h3 className="text-lg font-black text-white font-heading">{p.agent.name}</h3>
                <p className="text-xs text-neutral-400 mt-0.5 max-w-md">
                  {p.agent.description} • Comissão: <strong>{p.agent.feePercentage}%</strong> • Reputação: <strong>{p.agent.reputation}/100</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsChangingAgent(true)}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 border border-neutral-700 transition shrink-0"
            >
              Trocar de Empresário
            </button>
          </div>

          {/* Active Offers */}
          <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-black text-base text-white font-heading flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  Propostas Ativas na Mesa ({career.activeOffers.length})
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Clubes interessados em contar com o seu futebol.
                </p>
              </div>
            </div>

            {career.activeOffers.length === 0 ? (
              <div className="text-center py-10 text-xs text-neutral-500">
                Nenhuma proposta oficial no momento. Continue jogando bem para atrair o interesse dos clubes!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {career.activeOffers.map(offer => (
                  <div
                    key={offer.id}
                    className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <ClubBadge clubId={offer.clubId} name={offer.clubName} size="sm" />
                          <span className="font-extrabold text-sm text-white font-heading">{offer.clubName}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {offer.type === 'renewal' ? 'Renovação' : offer.type === 'loan' ? 'Empréstimo' : 'Compra'}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400">
                        {offer.clubCountry} • Prestígio: {'★'.repeat(offer.clubPrestige)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-neutral-900 font-mono">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Salário Semanal:</span>
                        <span className="text-emerald-400 font-bold">{formatCurrency(offer.offeredWage)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Duração:</span>
                        <span className="text-white font-bold">{offer.contractYears} anos</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Papel Oferecido:</span>
                        <span className="text-amber-300 font-bold">{offer.offeredRole}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Valor Transferência:</span>
                        <span className="text-white font-bold">{formatCurrency(offer.transferFee)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenNegotiate(offer)}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs transition shadow-md shadow-emerald-500/20"
                    >
                      Abrir Mesa de Negociação
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: NOTÍCIAS & FUTFEED */}
      {activeTab === 'news' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Press Headlines */}
            <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-4">
              <h3 className="font-black text-sm text-white font-heading border-b border-neutral-800 pb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                Manchetes da Imprensa Esportiva
              </h3>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {career.news.map(n => (
                  <div key={n.id} className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 space-y-1.5">
                    <span className="text-[10px] font-mono text-neutral-500">{n.dateStr}</span>
                    <h4 className="font-extrabold text-xs text-amber-300 tracking-tight leading-snug">
                      {n.headline}
                    </h4>
                    <p className="text-xs text-neutral-300 leading-relaxed">{n.snippet}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Media Feed (FutFeed) */}
            <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="font-black text-sm text-white font-heading flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  FutFeed (Rede Social do Jogo)
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {p.followersCount.toLocaleString()} seguidores
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {career.socialPosts.map(post => (
                  <div key={post.id} className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{post.authorAvatar}</span>
                        <div>
                          <span className="font-bold text-xs text-white block leading-none">{post.authorName}</span>
                          <span className="text-[10px] text-neutral-500">{post.authorHandle}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-500">{post.timestamp}</span>
                    </div>

                    <p className="text-xs text-neutral-200 leading-relaxed">{post.content}</p>

                    <div className="flex items-center gap-4 text-[11px] text-neutral-400 font-mono pt-1">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-emerald-400" /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3 text-blue-400" /> {post.retweets}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SELEÇÃO NACIONAL */}
      {activeTab === 'national' && (
        <div className="space-y-6">
          <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Defendendo a Pátria
                </span>
                <h2 className="text-xl font-black text-white font-heading mt-0.5">
                  Seleção Nacional ({p.nationality})
                </h2>
              </div>

              <div className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                p.isNationalTeamCalled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                {p.isNationalTeamCalled ? 'CONVOCADO ATUALMENTE' : 'AGUARDANDO OPORTUNIDADE'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Jogos pela Seleção</span>
                <span className="text-3xl font-black text-white font-mono">{p.nationalCaps}</span>
              </div>
              <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Gols Internacionais</span>
                <span className="text-3xl font-black text-emerald-400 font-mono">{p.nationalGoals}</span>
              </div>
              <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Assistências</span>
                <span className="text-3xl font-black text-blue-400 font-mono">{p.nationalAssists}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-300 leading-relaxed">
              {p.ovr >= 78 ? (
                <span>
                  O comitê técnico da Seleção ({p.nationality}) acompanha seus jogos atentamente. Com seu OVR atual de <strong>{p.ovr}</strong>, suas chances de disputar a próxima <strong>Copa do Mundo</strong> ou torneio continental são altíssimas.
                </span>
              ) : (
                <span>
                  Para ser convocado para a Seleção Nacional, continue evoluindo seu OVR acima de <strong>78</strong> e mantendo médias de nota superiores a 7.2 nas competições de clubes.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TROFÉUS & PRÊMIOS */}
      {activeTab === 'trophies' && (
        <div className="space-y-6">
          {/* Trophy Cabinet */}
          <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-4">
            <h3 className="font-black text-base text-white font-heading border-b border-neutral-800 pb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Galeria de Títulos Coletivos ({career.trophyCabinet.length})
            </h3>

            {career.trophyCabinet.length === 0 ? (
              <div className="text-center py-10 text-xs text-neutral-500">
                Sua sala de troféus aguarda a primeira grande conquista. Conquiste ligas e copas para preencher a galeria!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {career.trophyCabinet.map((t, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center gap-3">
                    <span className="text-2xl">{t.icon || '🏆'}</span>
                    <div>
                      <span className="font-bold text-xs text-white block">{t.name}</span>
                      <span className="text-[10px] text-neutral-400">{t.club} • Ano {t.year}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Awards Cabinet */}
          <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-4">
            <h3 className="font-black text-base text-white font-heading border-b border-neutral-800 pb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              Prêmios Individuais & Honrarias ({career.awardsCabinet.length})
            </h3>

            {career.awardsCabinet.length === 0 ? (
              <div className="text-center py-10 text-xs text-neutral-500">
                Bolas de Ouro, Chuteiras de Ouro e prêmios de Melhor Jogador aparecerão aqui conforme seu desempenho estelar.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {career.awardsCabinet.map((a, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center gap-3">
                    <span className="text-2xl">⭐</span>
                    <div>
                      <span className="font-bold text-xs text-amber-300 block">{a.name}</span>
                      <span className="text-[10px] text-neutral-400">Ano {a.year} • {a.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: HISTÓRICO DE TEMPORADAS */}
      {activeTab === 'history' && (
        <div className="bg-neutral-900/70 p-6 rounded-3xl border border-neutral-800 space-y-4">
          <h3 className="font-black text-base text-white font-heading border-b border-neutral-800 pb-3 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            Histórico Temporada a Temporada
          </h3>

          {career.history.length === 0 ? (
            <div className="text-center py-10 text-xs text-neutral-500">
              Você está disputando a sua primeira temporada ({career.currentYear}). As estatísticas completas serão arquivadas ao final de cada ano.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Temporada</th>
                    <th className="py-2.5 px-3">Clube</th>
                    <th className="py-2.5 px-3">Jogos</th>
                    <th className="py-2.5 px-3">Gols</th>
                    <th className="py-2.5 px-3">Assist.</th>
                    <th className="py-2.5 px-3">Nota Média</th>
                    <th className="py-2.5 px-3">Títulos Conquistados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {career.history.map((h, i) => (
                    <tr key={i} className="hover:bg-neutral-950/50">
                      <td className="py-3 px-3 font-bold text-white">{h.seasonYear}</td>
                      <td className="py-3 px-3 text-neutral-300 font-sans font-semibold">{h.clubName}</td>
                      <td className="py-3 px-3">{h.matches}</td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">{h.goals}</td>
                      <td className="py-3 px-3 text-blue-400">{h.assists}</td>
                      <td className="py-3 px-3 text-amber-400 font-bold">{h.avgRating.toFixed(2)}</td>
                      <td className="py-3 px-3 font-sans text-neutral-300">
                        {h.trophiesWon.length > 0 ? h.trophiesWon.join(', ') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Negotiation Table */}
      {negotiatingOffer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-black text-lg text-white font-heading">
                  Negociação com {negotiatingOffer.clubName}
                </h3>
                <span className="text-xs text-neutral-400">Ajuste os termos do seu novo contrato</span>
              </div>
              <button
                onClick={() => setNegotiatingOffer(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Salário Semanal Desejado: <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(counterWage)}</strong>
                </label>
                <input
                  type="range"
                  min={Math.round(negotiatingOffer.offeredWage * 0.8)}
                  max={Math.round(negotiatingOffer.offeredWage * 1.6)}
                  step={500}
                  value={counterWage}
                  onChange={e => setCounterWage(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Duração do Contrato: <strong className="text-white">{counterYears} anos</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={counterYears}
                  onChange={e => setCounterYears(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Papel no Elenco Exigido:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Rotação', 'Titular', 'Estrela'] as SquadRole[]).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setCounterRole(role)}
                      className={`py-2 rounded-xl border text-xs font-bold transition ${
                        counterRole === role
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {negotiationResult && (
                <div className={`p-3 rounded-xl border text-xs font-bold ${
                  negotiationResult.accepted
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-500/20 border-red-500/40 text-red-300'
                }`}>
                  {negotiationResult.message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setNegotiatingOffer(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition"
              >
                Recusar Proposta
              </button>
              <button
                type="button"
                onClick={handleSubmitCounterOffer}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition shadow-lg shadow-emerald-500/20"
              >
                Enviar Contraproposta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change Agent */}
      {isChangingAgent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-black text-lg text-white font-heading">
                Selecione seu Novo Agente
              </h3>
              <button onClick={() => setIsChangingAgent(false)} className="text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {INITIAL_AGENTS.map(ag => (
                <button
                  key={ag.id}
                  onClick={() => handleSelectAgent(ag)}
                  className={`w-full p-4 rounded-2xl border text-left transition flex items-center justify-between gap-4 ${
                    p.agent.id === ag.id
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-neutral-950/80 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white">{ag.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-amber-300">
                        {ag.tier}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">{ag.description}</p>
                  </div>
                  <div className="text-right font-mono text-xs shrink-0">
                    <span className="text-[10px] text-neutral-500 block">Comissão</span>
                    <span className="font-bold text-amber-400">{ag.feePercentage}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Season Simulation Modal */}
      {isSimulatingSeason && (
        <SeasonSimulationModal
          career={career}
          allClubs={INITIAL_CLUBS}
          onFinishSimulation={(updated) => {
            onUpdateCareer(updated);
            setIsSimulatingSeason(false);
          }}
          onClose={() => setIsSimulatingSeason(false)}
        />
      )}

      {/* Career End Simulation Modal */}
      {isSimulatingCareerEnd && (
        <CareerEndSimulationModal
          career={career}
          allClubs={INITIAL_CLUBS}
          onFinishSimulation={(updated) => {
            onUpdateCareer(updated);
            setIsSimulatingCareerEnd(false);
          }}
          onClose={() => setIsSimulatingCareerEnd(false)}
          onOpenRetirement={() => {
            setIsSimulatingCareerEnd(false);
            onRetire();
          }}
        />
      )}

      {/* Player Photo Modal */}
      <PlayerPhotoModal
        isOpen={isPhotoModalOpen}
        currentPhotoUrl={p.photoUrl}
        playerName={`${p.name} ${p.lastName}`}
        position={p.primaryPosition}
        shirtNumber={p.shirtNumber}
        onSavePhoto={(url) => {
          onUpdateCareer({
            ...career,
            player: {
              ...p,
              photoUrl: url
            }
          });
        }}
        onClose={() => setIsPhotoModalOpen(false)}
      />
    </div>
  );
};
