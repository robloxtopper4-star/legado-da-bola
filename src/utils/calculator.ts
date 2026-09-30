import { Position, PlayerAttributes, SquadRole, MoraleLevel, Club } from '../types';

export interface TrialCalculation {
  percentage: number;
  difficulty: 'Fácil' | 'Moderada' | 'Difícil' | 'Extrema' | 'Lendária';
  difficultyColor: string;
  competitionLevel: string;
  scoutVerdict: string;
}

export function calculateTrialSuccessRate(
  playerOvr: number,
  playerPotential: number,
  playerAge: number,
  playerNationality: string,
  club: Club
): TrialCalculation {
  // Base chance from club prestige (1 to 5) and average ratings
  const clubAvg = (club.attackRating + club.midfieldRating + club.defenseRating) / 3;
  const ovrDiff = playerOvr - clubAvg; // typically between -25 and -5
  
  // Base percentage curve
  let percentage = 60 + (ovrDiff * 2.5);
  
  // Prestige penalty: higher prestige clubs have stricter academy cuts
  percentage -= (club.prestige - 2) * 9;
  
  // High potential bonus: scouts spot raw upside
  if (playerPotential >= 85) percentage += 5;
  if (playerPotential >= 90) percentage += 5;
  
  // Young player bonus (16-17 year olds are prime academy trialists)
  if (playerAge <= 17) percentage += 4;
  
  // Nationality adaptation bonus (domestic youth registration advantages)
  if (club.country === playerNationality) {
    percentage += 6;
  }
  
  // Clamp percentage between 6% and 94%
  percentage = Math.max(6, Math.min(94, Math.round(percentage)));
  
  let difficulty: 'Fácil' | 'Moderada' | 'Difícil' | 'Extrema' | 'Lendária' = 'Moderada';
  let difficultyColor = 'text-emerald-400';
  let competitionLevel = 'Moderada';
  let scoutVerdict = '';
  
  if (percentage >= 80) {
    difficulty = 'Fácil';
    difficultyColor = 'text-emerald-400';
    competitionLevel = 'Baixa Concorrência (Vaga Acessível)';
    scoutVerdict = `O ${club.name} busca reforçar a categoria de base. Com seu perfil (${playerOvr} OVR), as chances de aprovação são excelentes!`;
  } else if (percentage >= 58) {
    difficulty = 'Moderada';
    difficultyColor = 'text-teal-400';
    competitionLevel = 'Concorrência Equilibrada';
    scoutVerdict = `Boa oportunidade no ${club.name}. Se você for seguro nos testes físicos e se destacar no jogo-treino, a comissão te aprovará.`;
  } else if (percentage >= 35) {
    difficulty = 'Difícil';
    difficultyColor = 'text-amber-400';
    competitionLevel = 'Alta Concorrência (Peneira Disputada)';
    scoutVerdict = `O ${club.name} recebe centenas de garotos promissores para poucas vagas. O rigor técnico dos olheiros é elevado.`;
  } else if (percentage >= 18) {
    difficulty = 'Extrema';
    difficultyColor = 'text-orange-400';
    competitionLevel = 'Concorrência de Elite Nacional';
    scoutVerdict = `Clube gigante com categorias de base disputadíssimas. É preciso brilhar muito intensamente para ser escolhido.`;
  } else {
    difficulty = 'Lendária';
    difficultyColor = 'text-rose-400';
    competitionLevel = 'Exigência Galáctica Internacional';
    scoutVerdict = `Peneira nos maiores gigantes do futebol europeu/mundial! Pouquíssimos atletas conseguem passar de primeira.`;
  }
  
  return {
    percentage,
    difficulty,
    difficultyColor,
    competitionLevel,
    scoutVerdict
  };
}

export function calculateOvr(position: Position, attrs: PlayerAttributes): number {
  let score = 70;

  switch (position) {
    case 'GOL': {
      const ref = attrs.reflexos ?? 70;
      const man = attrs.manejo ?? attrs.defesa ?? 70;
      const ela = attrs.elasticidade ?? attrs.defesa ?? 70;
      const pos = attrs.posicionamentoGol ?? 70;
      const def = attrs.defesa ?? 70;
      const pes = attrs.jogoPes ?? 60;
      const sai = attrs.saidaGol ?? 65;
      score = (
        ref * 0.25 +
        man * 0.22 +
        ela * 0.20 +
        pos * 0.15 +
        def * 0.08 +
        pes * 0.05 +
        sai * 0.05
      );
      break;
    }

    case 'ZAG':
      score = (
        attrs.desarme * 0.25 +
        attrs.marcacao * 0.20 +
        attrs.forca * 0.15 +
        attrs.cabeceio * 0.15 +
        attrs.interceptacao * 0.15 +
        attrs.posicionamento * 0.10
      );
      break;

    case 'LD':
    case 'LE':
      score = (
        attrs.velocidade * 0.20 +
        attrs.cruzamento * 0.20 +
        attrs.desarme * 0.15 +
        attrs.resistencia * 0.15 +
        attrs.passeCurto * 0.15 +
        attrs.agilidade * 0.15
      );
      break;

    case 'VOL':
      score = (
        attrs.desarme * 0.20 +
        attrs.passeCurto * 0.20 +
        attrs.resistencia * 0.15 +
        attrs.interceptacao * 0.15 +
        attrs.forca * 0.15 +
        attrs.visao * 0.15
      );
      break;

    case 'MC':
      score = (
        attrs.passeCurto * 0.25 +
        attrs.visao * 0.20 +
        attrs.passeLongo * 0.15 +
        attrs.dominio * 0.15 +
        attrs.resistencia * 0.15 +
        attrs.drible * 0.10
      );
      break;

    case 'MEI':
      score = (
        attrs.visao * 0.25 +
        attrs.drible * 0.20 +
        attrs.passeCurto * 0.20 +
        attrs.finalizacao * 0.15 +
        attrs.chuteLonge * 0.10 +
        attrs.agilidade * 0.10
      );
      break;

    case 'PE':
    case 'PD':
      score = (
        attrs.velocidade * 0.25 +
        attrs.drible * 0.25 +
        attrs.aceleracao * 0.15 +
        attrs.finalizacao * 0.15 +
        attrs.agilidade * 0.10 +
        attrs.cruzamento * 0.10
      );
      break;

    case 'ATA':
      score = (
        attrs.finalizacao * 0.30 +
        attrs.posicionamento * 0.20 +
        attrs.chuteLonge * 0.10 +
        attrs.cabeceio * 0.15 +
        attrs.velocidade * 0.15 +
        attrs.compostura * 0.10
      );
      break;
  }

  return Math.max(45, Math.min(99, Math.round(score)));
}

export function calculateMarketValue(ovr: number, potential: number, age: number, contractYears: number): number {
  // Base exponential value based on OVR
  let baseVal = Math.pow(ovr / 40, 4.8) * 100000;

  // Youth & Potential multiplier
  if (age <= 21) {
    const potentialBonus = Math.max(0, potential - ovr) * 0.08;
    baseVal *= (1.5 + potentialBonus);
  } else if (age <= 25) {
    baseVal *= 1.3;
  } else if (age <= 29) {
    baseVal *= 1.1;
  } else if (age <= 33) {
    baseVal *= 0.65;
  } else {
    baseVal *= 0.35;
  }

  // Contract multiplier
  if (contractYears >= 4) baseVal *= 1.25;
  else if (contractYears <= 1) baseVal *= 0.7;

  return Math.round(baseVal / 50000) * 50000;
}

export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `€ ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `€ ${(amount / 1000).toFixed(0)}K`;
  }
  return `€ ${amount.toLocaleString()}`;
}

export function formatCurrencyBRL(amount: number): string {
  // Euro to real approx representation
  const brl = amount * 5.8;
  if (brl >= 1000000) {
    return `R$ ${(brl / 1000000).toFixed(1)} mi`;
  }
  if (brl >= 1000) {
    return `R$ ${(brl / 1000).toFixed(0)} mil`;
  }
  return `R$ ${brl.toLocaleString()}`;
}

export function getMoraleColor(morale: MoraleLevel): string {
  switch (morale) {
    case 'Excelente': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'Boa': return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'Normal': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'Baixa': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'Péssima': return 'text-red-400 bg-red-500/10 border-red-500/30';
  }
}

export function getRoleBadgeColor(role: SquadRole): string {
  switch (role) {
    case 'Ídolo': return 'text-yellow-300 bg-yellow-500/20 border-yellow-500/40';
    case 'Capitão': return 'text-amber-300 bg-amber-500/20 border-amber-500/40';
    case 'Estrela': return 'text-purple-300 bg-purple-500/20 border-purple-500/40';
    case 'Titular': return 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
    case 'Rotação': return 'text-blue-300 bg-blue-500/20 border-blue-500/40';
    case 'Reserva': return 'text-slate-300 bg-slate-500/20 border-slate-500/40';
    case 'Promessa': return 'text-teal-300 bg-teal-500/20 border-teal-500/40';
  }
}

export function generateInitialAttributes(position: Position, ovrTarget: number): PlayerAttributes {
  // Base baseline around target
  const base = Math.max(50, Math.min(85, ovrTarget));

  const attrs: PlayerAttributes = {
    finalizacao: base - 10,
    chuteLonge: base - 12,
    passeCurto: base - 5,
    passeLongo: base - 10,
    cruzamento: base - 12,
    drible: base - 8,
    dominio: base - 6,
    cobrancaFalta: base - 15,
    penalti: base - 10,
    cabeceio: base - 10,
    velocidade: base,
    aceleracao: base,
    forca: base - 5,
    resistencia: base,
    agilidade: base,
    equilibrio: base - 5,
    visao: base - 8,
    posicionamento: base - 8,
    decisoes: base - 5,
    concentracao: base - 5,
    lideranca: 50,
    compostura: base - 10,
    desarme: base - 15,
    interceptacao: base - 15,
    marcacao: base - 15,
    antecipacao: base - 10,
    reflexos: 40,
    manejo: 40,
    elasticidade: 40,
    posicionamentoGol: 40,
    defesa: 40,
    jogoPes: 40,
    saidaGol: 40
  };

  // Position specific boosts
  if (position === 'GOL') {
    attrs.reflexos = base + 7;
    attrs.manejo = base + 6;
    attrs.elasticidade = base + 5;
    attrs.posicionamentoGol = base + 5;
    attrs.defesa = base + 5;
    attrs.saidaGol = base + 2;
    attrs.jogoPes = base - 2;
    // Goleiros não focam em atributos de linha
    attrs.finalizacao = 20;
    attrs.chuteLonge = 25;
    attrs.drible = 25;
    attrs.cruzamento = 20;
    attrs.cabeceio = 25;
    attrs.desarme = 30;
    attrs.marcacao = 25;
    attrs.penalti = 25;
  } else if (position === 'ZAG') {
    attrs.desarme = base + 6;
    attrs.marcacao = base + 5;
    attrs.forca = base + 5;
    attrs.cabeceio = base + 4;
    attrs.interceptacao = base + 4;
    attrs.velocidade = base - 4;
  } else if (position === 'LE' || position === 'LD') {
    attrs.velocidade = base + 5;
    attrs.aceleracao = base + 5;
    attrs.cruzamento = base + 4;
    attrs.resistencia = base + 6;
    attrs.desarme = base + 2;
  } else if (position === 'VOL') {
    attrs.desarme = base + 5;
    attrs.resistencia = base + 7;
    attrs.passeCurto = base + 4;
    attrs.forca = base + 3;
    attrs.interceptacao = base + 4;
  } else if (position === 'MC') {
    attrs.passeCurto = base + 6;
    attrs.visao = base + 5;
    attrs.passeLongo = base + 4;
    attrs.dominio = base + 5;
    attrs.resistencia = base + 4;
  } else if (position === 'MEI') {
    attrs.visao = base + 7;
    attrs.drible = base + 6;
    attrs.passeCurto = base + 5;
    attrs.agilidade = base + 4;
    attrs.finalizacao = base + 1;
  } else if (position === 'PE' || position === 'PD') {
    attrs.velocidade = base + 7;
    attrs.aceleracao = base + 7;
    attrs.drible = base + 6;
    attrs.agilidade = base + 5;
    attrs.finalizacao = base + 2;
  } else if (position === 'ATA') {
    attrs.finalizacao = base + 8;
    attrs.posicionamento = base + 6;
    attrs.chuteLonge = base + 3;
    attrs.cabeceio = base + 3;
    attrs.compostura = base + 3;
  }

  // Cap values 1 to 99
  for (const key in attrs) {
    const k = key as keyof PlayerAttributes;
    attrs[k] = Math.max(1, Math.min(99, Math.round(attrs[k])));
  }

  return attrs;
}
