import { Club } from '../types';
import { getClub2DRoster } from '../components/Interactive2DPitch';

export type SquadPositionCategory =
  | 'Goleiro'
  | 'Zagueiro'
  | 'Lateral'
  | 'Meio-campo'
  | 'Atacante';

export type PitchSlotPosition =
  | 'GK'
  | 'RB'
  | 'CB1'
  | 'CB2'
  | 'LB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'RW'
  | 'LW'
  | 'ST';

export interface CustomRosterPlayer {
  id: string;
  number: number;
  name: string;
  positionCategory: SquadPositionCategory;
}

export interface CustomSquad {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  players: CustomRosterPlayer[];
}

const STORAGE_KEY = 'legado_da_bola_custom_squads_v1';

const POSITION_SORT_ORDER: Record<SquadPositionCategory, number> = {
  Goleiro: 1,
  Zagueiro: 2,
  Lateral: 3,
  'Meio-campo': 4,
  Atacante: 5
};

const DEFAULT_EXAMPLE_SQUADS: CustomSquad[] = [
  {
    id: 'squad_brasil_2026',
    name: 'Brasil 2026',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [
      { id: 'p1', number: 1, name: 'João Silva', positionCategory: 'Goleiro' },
      { id: 'p2', number: 2, name: 'Danilo', positionCategory: 'Lateral' },
      { id: 'p3', number: 3, name: 'Lucas', positionCategory: 'Zagueiro' },
      { id: 'p4', number: 4, name: 'Marquinhos', positionCategory: 'Zagueiro' },
      { id: 'p5', number: 6, name: 'Guilherme Arana', positionCategory: 'Lateral' },
      { id: 'p6', number: 5, name: 'Bruno Guimarães', positionCategory: 'Meio-campo' },
      { id: 'p7', number: 8, name: 'Pedro', positionCategory: 'Meio-campo' },
      { id: 'p8', number: 10, name: 'Neymar Jr.', positionCategory: 'Meio-campo' },
      { id: 'p9', number: 11, name: 'Rodrygo', positionCategory: 'Atacante' },
      { id: 'p10', number: 7, name: 'Vini Jr.', positionCategory: 'Atacante' },
      { id: 'p11', number: 9, name: 'Gabriel', positionCategory: 'Atacante' }
    ]
  }
];

export function sortPlayersByPosition(players: CustomRosterPlayer[]): CustomRosterPlayer[] {
  return [...players].sort((a, b) => {
    const orderDiff =
      (POSITION_SORT_ORDER[a.positionCategory] || 99) -
      (POSITION_SORT_ORDER[b.positionCategory] || 99);
    if (orderDiff !== 0) return orderDiff;
    return a.number - b.number;
  });
}

export function loadCustomSquads(): CustomSquad[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EXAMPLE_SQUADS));
      return DEFAULT_EXAMPLE_SQUADS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_EXAMPLE_SQUADS;
    return parsed;
  } catch {
    return DEFAULT_EXAMPLE_SQUADS;
  }
}

export function saveCustomSquads(squads: CustomSquad[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(squads));
  } catch (err) {
    console.error('Erro ao salvar elencos personalizados:', err);
  }
}

export function upsertCustomSquad(squad: CustomSquad): CustomSquad[] {
  const current = loadCustomSquads();
  const sortedPlayers = sortPlayersByPosition(squad.players);
  const normalized: CustomSquad = {
    ...squad,
    updatedAt: Date.now(),
    players: sortedPlayers
  };
  const existsIdx = current.findIndex(s => s.id === squad.id);
  let next: CustomSquad[];
  if (existsIdx >= 0) {
    next = [...current];
    next[existsIdx] = normalized;
  } else {
    next = [normalized, ...current];
  }
  saveCustomSquads(next);
  return next;
}

export function deleteCustomSquad(squadId: string): CustomSquad[] {
  const current = loadCustomSquads();
  const next = current.filter(s => s.id !== squadId);
  saveCustomSquads(next);
  return next;
}

export function createPlayersFromOriginalClub(club: Club): CustomRosterPlayer[] {
  const orig = getClub2DRoster(club);
  return orig.map((p, idx) => {
    let cat: SquadPositionCategory = 'Meio-campo';
    if (p.pos === 'GK') cat = 'Goleiro';
    else if (p.pos === 'CB1' || p.pos === 'CB2') cat = 'Zagueiro';
    else if (p.pos === 'RB' || p.pos === 'LB') cat = 'Lateral';
    else if (p.pos === 'CDM' || p.pos === 'CM' || p.pos === 'CAM') cat = 'Meio-campo';
    else cat = 'Atacante';

    return {
      id: `orig_${club.id}_${idx}_${Date.now()}`,
      number: p.number,
      name: p.name,
      positionCategory: cat
    };
  });
}

const PITCH_SLOTS_ORDER: PitchSlotPosition[] = [
  'GK',
  'RB',
  'CB1',
  'CB2',
  'LB',
  'CDM',
  'CM',
  'CAM',
  'RW',
  'LW',
  'ST'
];

/**
 * Converts a CustomSquad into the 11-player 2D pitch roster format.
 * Any missing positions are seamlessly filled from the club's original roster so the 11v11 pitch is always complete.
 */
export function buildPitchRosterFromCustomSquad(
  club: Club,
  customSquad?: CustomSquad | null
): { number: number; name: string; pos: PitchSlotPosition }[] {
  const fallbackOriginal = getClub2DRoster(club);
  if (!customSquad || !customSquad.players || customSquad.players.length === 0) {
    return fallbackOriginal;
  }

  const pool = [...customSquad.players];
  const takePlayerByCategories = (
    preferredCategories: SquadPositionCategory[]
  ): CustomRosterPlayer | null => {
    for (const cat of preferredCategories) {
      const idx = pool.findIndex(p => p.positionCategory === cat);
      if (idx !== -1) {
        const [picked] = pool.splice(idx, 1);
        return picked;
      }
    }
    if (pool.length > 0) {
      return pool.shift() || null;
    }
    return null;
  };

  const slotCategoryPreferences: Record<PitchSlotPosition, SquadPositionCategory[]> = {
    GK: ['Goleiro', 'Zagueiro', 'Lateral', 'Meio-campo', 'Atacante'],
    RB: ['Lateral', 'Zagueiro', 'Meio-campo', 'Atacante', 'Goleiro'],
    CB1: ['Zagueiro', 'Lateral', 'Meio-campo', 'Atacante', 'Goleiro'],
    CB2: ['Zagueiro', 'Lateral', 'Meio-campo', 'Atacante', 'Goleiro'],
    LB: ['Lateral', 'Zagueiro', 'Meio-campo', 'Atacante', 'Goleiro'],
    CDM: ['Meio-campo', 'Zagueiro', 'Lateral', 'Atacante', 'Goleiro'],
    CM: ['Meio-campo', 'Atacante', 'Lateral', 'Zagueiro', 'Goleiro'],
    CAM: ['Meio-campo', 'Atacante', 'Lateral', 'Zagueiro', 'Goleiro'],
    RW: ['Atacante', 'Meio-campo', 'Lateral', 'Zagueiro', 'Goleiro'],
    LW: ['Atacante', 'Meio-campo', 'Lateral', 'Zagueiro', 'Goleiro'],
    ST: ['Atacante', 'Meio-campo', 'Lateral', 'Zagueiro', 'Goleiro']
  };

  return PITCH_SLOTS_ORDER.map((slot, idx) => {
    const picked = takePlayerByCategories(slotCategoryPreferences[slot]);
    const orig = fallbackOriginal[idx] || { number: idx + 1, name: `Jogador ${idx + 1}`, pos: slot };
    if (picked) {
      return {
        number: picked.number || orig.number,
        name: picked.name.trim() || orig.name,
        pos: slot
      };
    }
    return {
      number: orig.number,
      name: orig.name,
      pos: slot
    };
  });
}

export function convertCustomSquadTo2DRoster(
  customSquad: CustomSquad,
  club: Club
): { number: number; name: string; pos: PitchSlotPosition }[] {
  return buildPitchRosterFromCustomSquad(club, customSquad);
}

