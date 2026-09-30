import { PlayerProfile, PlayerAttributes, Position } from '../types';
import { calculateOvr, calculateMarketValue } from '../utils/calculator';

// Attribute keys relevant for each position to guide natural growth
const POSITION_KEY_ATTRIBUTES: Record<Position, (keyof PlayerAttributes)[]> = {
  ATA: ['finalizacao', 'chuteLonge', 'posicionamento', 'compostura', 'velocidade', 'drible', 'cabeceio'],
  PE: ['velocidade', 'aceleracao', 'drible', 'cruzamento', 'finalizacao', 'agilidade'],
  PD: ['velocidade', 'aceleracao', 'drible', 'cruzamento', 'finalizacao', 'agilidade'],
  MEI: ['passeCurto', 'passeLongo', 'visao', 'dominio', 'drible', 'agilidade', 'resistencia'],
  MC: ['passeCurto', 'passeLongo', 'visao', 'resistencia', 'desarme', 'dominio', 'decisoes'],
  VOL: ['desarme', 'interceptacao', 'marcacao', 'forca', 'resistencia', 'passeCurto', 'antecipacao'],
  LE: ['cruzamento', 'velocidade', 'aceleracao', 'resistencia', 'desarme', 'passeCurto', 'drible'],
  LD: ['cruzamento', 'velocidade', 'aceleracao', 'resistencia', 'desarme', 'passeCurto', 'drible'],
  ZAG: ['desarme', 'marcacao', 'forca', 'cabeceio', 'interceptacao', 'antecipacao', 'equilibrio'],
  GOL: ['reflexos', 'manejo', 'elasticidade', 'posicionamentoGol', 'saidaGol', 'jogoPes', 'defesa', 'concentracao']
};

export interface MatchProgressionResult {
  updatedPlayer: PlayerProfile;
  ovrGained: number;
  attributesGrown: Partial<Record<keyof PlayerAttributes, number>>;
  narrative?: string;
}

/**
 * Automatically evolves the player's attributes and GERAL (OVR) after a match.
 * Factors:
 * - Match rating (>= 7.0 gains solid XP; >= 8.0 gains huge XP; goals/assists give direct skill boosts)
 * - Player Age (16-22 = exponential prodigy growth, 23-28 = steady prime growth, 29-33 = mature stability, 34+ = natural stamina decline)
 * - Distance to potential ceiling
 */
export function evolvePlayerAfterMatch(
  player: PlayerProfile,
  matchRating: number,
  goalsScored: number,
  assistsMade: number,
  minutesPlayed: number
): MatchProgressionResult {
  const currentAttrs = { ...player.attributes };
  // Ensure goalkeeper attributes exist
  currentAttrs.manejo = currentAttrs.manejo ?? currentAttrs.defesa ?? 65;
  currentAttrs.elasticidade = currentAttrs.elasticidade ?? currentAttrs.defesa ?? 65;

  const grownAttrs: Partial<Record<keyof PlayerAttributes, number>> = {};
  const currentOvr = player.ovr;

  // Don't evolve if did not play
  if (minutesPlayed <= 0) {
    return {
      updatedPlayer: player,
      ovrGained: 0,
      attributesGrown: {}
    };
  }

  // Calculate XP points for this match
  // 16-21 years old: fast development (+20% to +50% multiplier)
  let ageMultiplier = 1.0;
  if (player.age <= 19) ageMultiplier = 1.6;
  else if (player.age <= 22) ageMultiplier = 1.35;
  else if (player.age <= 26) ageMultiplier = 1.1;
  else if (player.age <= 30) ageMultiplier = 0.85;
  else if (player.age <= 33) ageMultiplier = 0.5;
  else ageMultiplier = 0.2; // Veterans develop tactically/mentally rather than physically

  // Base progress from match rating
  let basePoints = 0;
  if (matchRating >= 8.5) basePoints = 3.5;
  else if (matchRating >= 7.8) basePoints = 2.5;
  else if (matchRating >= 7.0) basePoints = 1.8;
  else if (matchRating >= 6.0) basePoints = 1.0;
  else basePoints = 0.4;

  // Bonus for goals and assists
  basePoints += goalsScored * 0.8;
  basePoints += assistsMade * 0.5;

  const totalPoints = basePoints * ageMultiplier;

  // Potential headroom bonus: if current OVR < potential, player absorbs training like a sponge
  const potentialHeadroom = Math.max(0, player.potential - currentOvr);
  const headroomBonus = potentialHeadroom > 10 ? 1.4 : potentialHeadroom > 5 ? 1.2 : 1.0;

  const effectivePoints = totalPoints * headroomBonus;

  // Determine which attributes grow
  const keyAttrs = POSITION_KEY_ATTRIBUTES[player.primaryPosition] || POSITION_KEY_ATTRIBUTES.ATA;
  const userFocusAttrs = player.trainingFocus?.targetAttributes?.filter(a => {
    // If goalkeeper, do not allow outfield attributes in focus
    if (player.primaryPosition === 'GOL') {
      return ['reflexos', 'manejo', 'elasticidade', 'posicionamentoGol', 'saidaGol', 'jogoPes', 'defesa', 'concentracao', 'agilidade', 'forca', 'resistencia', 'visao', 'compostura'].includes(a);
    }
    return true;
  }) || [];
  
  // Chance to upgrade attributes: each point gives a probability roll to bump attributes by 1
  let upgradesRemaining = Math.floor(effectivePoints / 1.6);
  const remainderChance = (effectivePoints / 1.6) - upgradesRemaining;
  if (Math.random() < remainderChance) {
    upgradesRemaining += 1;
  }

  // Cap upgrades per single match to prevent runaway in one day, max 2-3 attribute points per match
  const maxUpgrades = player.age <= 20 ? 3 : 2;
  const actualUpgrades = Math.min(maxUpgrades, upgradesRemaining);

  for (let i = 0; i < actualUpgrades; i++) {
    // If user has set a training focus, 80% chance to upgrade focus attributes!
    let targetPool: (keyof PlayerAttributes)[];
    if (userFocusAttrs.length > 0 && Math.random() < 0.85) {
      targetPool = userFocusAttrs;
    } else {
      targetPool = keyAttrs;
    }
    const selectedAttr = targetPool[Math.floor(Math.random() * targetPool.length)];

    if (currentAttrs[selectedAttr] < 99) {
      currentAttrs[selectedAttr] += 1;
      grownAttrs[selectedAttr] = (grownAttrs[selectedAttr] || 0) + 1;
    }
  }

  // Recalculate OVR directly
  let newOvr = calculateOvr(player.primaryPosition, currentAttrs);

  // Guarantee that if player had an exceptional performance (e.g. 8.5+ rating) and has high potential headroom,
  // OVR can naturally step up if attributes pushed it near threshold
  if (newOvr < player.potential && Math.random() < 0.25 && matchRating >= 8.2 && player.age <= 24) {
    // Give one extra boost to best position attribute
    const bestKey = keyAttrs[0];
    if (currentAttrs[bestKey] < 99) {
      currentAttrs[bestKey] += 1;
      grownAttrs[bestKey] = (grownAttrs[bestKey] || 0) + 1;
      newOvr = calculateOvr(player.primaryPosition, currentAttrs);
    }
  }

  // Check natural decline for older players past 34
  if (player.age >= 34 && Math.random() < 0.1) {
    if (currentAttrs.velocidade > 60) currentAttrs.velocidade -= 1;
    if (currentAttrs.aceleracao > 60) currentAttrs.aceleracao -= 1;
    newOvr = calculateOvr(player.primaryPosition, currentAttrs);
  }

  const ovrGained = newOvr - currentOvr;
  const newMarketValue = calculateMarketValue(newOvr, player.potential, player.age, player.contract.yearsRemaining);

  let narrative: string | undefined;
  if (ovrGained > 0) {
    narrative = `🚀 EVOLUÇÃO DE GERAL! Seu OVR aumentou automaticamente de ${currentOvr} para ${newOvr} (+${ovrGained}) pelo seu rendimento em campo!`;
  } else if (Object.keys(grownAttrs).length > 0) {
    const attrNames = Object.keys(grownAttrs).join(', ');
    narrative = `📈 Crescimento Natural: Melhoria nos fundamentos técnicos (${attrNames})!`;
  }

  const updatedPlayer: PlayerProfile = {
    ...player,
    attributes: currentAttrs,
    ovr: newOvr,
    marketValue: newMarketValue,
    // Also give modest training points for manual fine-tuning
    trainingPoints: player.trainingPoints + (matchRating >= 8.0 ? 2 : 1)
  };

  return {
    updatedPlayer,
    ovrGained,
    attributesGrown: grownAttrs,
    narrative
  };
}

/**
 * Automatically evolves the player slightly when advancing a week (routine club training).
 */
export function evolvePlayerWeeklyTraining(player: PlayerProfile): { updatedPlayer: PlayerProfile; ovrGained: number } {
  const currentAttrs = { ...player.attributes };
  currentAttrs.manejo = currentAttrs.manejo ?? currentAttrs.defesa ?? 65;
  currentAttrs.elasticidade = currentAttrs.elasticidade ?? currentAttrs.defesa ?? 65;
  const currentOvr = player.ovr;

  // Young players in weekly training develop gradually
  if (player.age <= 25 && player.ovr < player.potential) {
    // 50% chance of an attribute tick during normal training week
    if (Math.random() < 0.50) {
      const keyAttrs = POSITION_KEY_ATTRIBUTES[player.primaryPosition] || POSITION_KEY_ATTRIBUTES.ATA;
      const userFocusAttrs = player.trainingFocus?.targetAttributes?.filter(a => {
        if (player.primaryPosition === 'GOL') {
          return ['reflexos', 'manejo', 'elasticidade', 'posicionamentoGol', 'saidaGol', 'jogoPes', 'defesa', 'concentracao', 'agilidade', 'forca', 'resistencia', 'visao', 'compostura'].includes(a);
        }
        return true;
      }) || [];

      const targetPool = (userFocusAttrs.length > 0 && Math.random() < 0.85) ? userFocusAttrs : keyAttrs;
      const chosenAttr = targetPool[Math.floor(Math.random() * targetPool.length)];
      if (currentAttrs[chosenAttr] < 99) {
        currentAttrs[chosenAttr] += 1;
      }
    }
  }

  const newOvr = calculateOvr(player.primaryPosition, currentAttrs);
  const ovrGained = newOvr - currentOvr;
  const newMarketValue = calculateMarketValue(newOvr, player.potential, player.age, player.contract.yearsRemaining);

  return {
    updatedPlayer: {
      ...player,
      attributes: currentAttrs,
      ovr: newOvr,
      marketValue: newMarketValue,
      trainingPoints: player.trainingPoints + 1
    },
    ovrGained
  };
}
