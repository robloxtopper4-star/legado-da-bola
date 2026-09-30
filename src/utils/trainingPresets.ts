import { PlayerAttributes, Position, TrainingFocusConfig } from '../types';

export interface TrainingPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  targetAttributes: (keyof PlayerAttributes)[];
}

export const ATTRIBUTE_LABELS: Record<keyof PlayerAttributes, string> = {
  // Goleiro
  reflexos: 'Reflexos',
  manejo: 'Manejo de Bola',
  elasticidade: 'Elasticidade / Mergulho',
  posicionamentoGol: 'Posicionamento no Gol',
  saidaGol: 'Saída de Gol',
  jogoPes: 'Jogo com os Pés',
  defesa: 'Defesa & Segurança',

  // Técnicos
  finalizacao: 'Finalização',
  chuteLonge: 'Chute de Longe',
  passeCurto: 'Passe Curto',
  passeLongo: 'Passe Longo',
  drible: 'Drible',
  dominio: 'Domínio de Bola',
  cruzamento: 'Cruzamento',
  cobrancaFalta: 'Cobrança de Falta',
  penalti: 'Pênaltis',
  cabeceio: 'Cabeceio',

  // Físicos
  velocidade: 'Velocidade',
  aceleracao: 'Aceleração',
  forca: 'Força Física',
  resistencia: 'Resistência / Fôlego',
  agilidade: 'Agilidade',
  equilibrio: 'Equilíbrio',

  // Mentais
  visao: 'Visão de Jogo',
  posicionamento: 'Posicionamento Tático',
  decisoes: 'Tomada de Decisão',
  compostura: 'Compostura / Frieza',
  lideranca: 'Liderança',
  concentracao: 'Concentração',

  // Defensivos
  desarme: 'Desarme',
  interceptacao: 'Interceptação',
  marcacao: 'Marcação',
  antecipacao: 'Antecipação'
};

export const GK_PRESETS: TrainingPreset[] = [
  {
    id: 'gk_handling',
    name: 'Manejo & Firmeza de Mãos',
    description: 'Foco prioritário em agarrar a bola, evitar rebotes e segurança absoluta.',
    icon: '🧤',
    targetAttributes: ['manejo', 'defesa', 'concentracao', 'posicionamentoGol']
  },
  {
    id: 'gk_reflexes',
    name: 'Reflexos & Elasticidade',
    description: 'Defesas puras no reflexo à queima-roupa, elasticidade e saídas de gol.',
    icon: '⚡',
    targetAttributes: ['reflexos', 'elasticidade', 'saidaGol', 'agilidade']
  },
  {
    id: 'gk_positioning',
    name: 'Posicionamento & Saída de Gol',
    description: 'Fechamento de ângulos, leitura de jogadas aéreas e antecipação.',
    icon: '📐',
    targetAttributes: ['posicionamentoGol', 'saidaGol', 'antecipacao', 'decisoes']
  },
  {
    id: 'gk_feet',
    name: 'Goleiro Moderno (Jogo com os Pés)',
    description: 'Iniciação de jogadas ofensivas, passes sob pressão e visão panorâmica.',
    icon: '⚽',
    targetAttributes: ['jogoPes', 'passeCurto', 'passeLongo', 'visao']
  },
  {
    id: 'gk_physical',
    name: 'Impulsão & Força Física',
    description: 'Salto vertical explosivo para cortar cruzamentos e imponência na área.',
    icon: '🏋️',
    targetAttributes: ['elasticidade', 'forca', 'resistencia', 'agilidade']
  },
  {
    id: 'gk_balanced',
    name: 'Equilibrado Geral de Goleiro',
    description: 'Evolução harmoniosa de todos os fundamentos essenciais de um goleiro.',
    icon: '🔄',
    targetAttributes: ['reflexos', 'manejo', 'elasticidade', 'posicionamentoGol', 'saidaGol', 'jogoPes', 'defesa']
  }
];

export const OUTFIELD_PRESETS: TrainingPreset[] = [
  {
    id: 'attack_finishing',
    name: 'Finalização & Chute Clínico',
    description: 'Precisão na cara do gol, chutes potentes de longe e frieza no arremate.',
    icon: '🎯',
    targetAttributes: ['finalizacao', 'chuteLonge', 'posicionamento', 'compostura']
  },
  {
    id: 'attack_dribble',
    name: 'Drible & Velocidade Explosiva',
    description: 'Arrancadas fulminantes, drible no 1 contra 1 e agilidade.',
    icon: '⚡',
    targetAttributes: ['drible', 'velocidade', 'aceleracao', 'agilidade', 'dominio']
  },
  {
    id: 'midfield_playmaker',
    name: 'Passe & Criação de Jogadas',
    description: 'Visão de jogo periférica, passes milimétricos e tomadas de decisão.',
    icon: '🪄',
    targetAttributes: ['passeCurto', 'passeLongo', 'visao', 'decisoes', 'dominio']
  },
  {
    id: 'defense_tackling',
    name: 'Desarme & Marcação Firme',
    description: 'Botes precisos no chão, combate corpo a corpo e interceptação.',
    icon: '🛡️',
    targetAttributes: ['desarme', 'marcacao', 'interceptacao', 'antecipacao', 'forca']
  },
  {
    id: 'physical_stamina',
    name: 'Físico & Fôlego de Aço',
    description: 'Resistência para aguentar 90 minutos em alto ritmo e força muscular.',
    icon: '🏃',
    targetAttributes: ['resistencia', 'forca', 'velocidade', 'equilibrio']
  },
  {
    id: 'outfield_balanced',
    name: 'Equilibrado da Posição',
    description: 'Treinamento completo dos principais fundamentos da sua posição.',
    icon: '🔄',
    targetAttributes: ['finalizacao', 'passeCurto', 'drible', 'velocidade', 'desarme', 'resistencia']
  }
];

export function getPositionPresets(position: Position): TrainingPreset[] {
  if (position === 'GOL') {
    return GK_PRESETS;
  }
  return OUTFIELD_PRESETS;
}

export function getDefaultTrainingFocus(position: Position): TrainingFocusConfig {
  if (position === 'GOL') {
    const p = GK_PRESETS[0];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      targetAttributes: p.targetAttributes
    };
  }
  const p = OUTFIELD_PRESETS[0];
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    targetAttributes: p.targetAttributes
  };
}
