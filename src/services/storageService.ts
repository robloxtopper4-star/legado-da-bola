import { CareerSave } from '../types';

const STORAGE_KEY_PREFIX = 'legado_da_bola_career_';
const ACTIVE_CAREER_KEY = 'legado_da_bola_active_id';
const CAREER_INDEX_KEY = 'legado_da_bola_index';

export interface SaveMetadata {
  id: string;
  saveName: string;
  playerName: string;
  clubName: string;
  clubId?: string;
  photoUrl?: string;
  ovr: number;
  position: string;
  year: number;
  week: number;
  updatedAt: string;
  isRetired: boolean;
}

export function getAllSaveMetadatas(): SaveMetadata[] {
  try {
    const raw = localStorage.getItem(CAREER_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SaveMetadata[];
  } catch {
    return [];
  }
}

export function loadCareer(id: string): CareerSave | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as CareerSave;
  } catch {
    return null;
  }
}

export function saveCareer(career: CareerSave): void {
  try {
    career.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_PREFIX + career.id, JSON.stringify(career));

    // Update index
    const index = getAllSaveMetadatas().filter(m => m.id !== career.id);
    index.unshift({
      id: career.id,
      saveName: career.saveName,
      playerName: `${career.player.name} ${career.player.lastName}`,
      clubName: career.player.contract.clubName,
      clubId: career.player.contract.clubId,
      photoUrl: career.player.photoUrl,
      ovr: career.player.ovr,
      position: career.player.primaryPosition,
      year: career.currentYear,
      week: career.currentWeek,
      updatedAt: career.updatedAt,
      isRetired: career.isRetired
    });

    localStorage.setItem(CAREER_INDEX_KEY, JSON.stringify(index));
    localStorage.setItem(ACTIVE_CAREER_KEY, career.id);
  } catch (err) {
    console.error('Falha ao salvar carreira:', err);
  }
}

export function deleteCareer(id: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
    const index = getAllSaveMetadatas().filter(m => m.id !== id);
    localStorage.setItem(CAREER_INDEX_KEY, JSON.stringify(index));
    const activeId = localStorage.getItem(ACTIVE_CAREER_KEY);
    if (activeId === id) {
      localStorage.removeItem(ACTIVE_CAREER_KEY);
    }
  } catch (err) {
    console.error('Falha ao apagar carreira:', err);
  }
}

export function duplicateCareer(id: string): CareerSave | null {
  const original = loadCareer(id);
  if (!original) return null;

  const newId = 'career_' + Date.now();
  const copy: CareerSave = {
    ...original,
    id: newId,
    saveName: `${original.saveName} (Cópia)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  saveCareer(copy);
  return copy;
}

export function exportCareerToJson(career: CareerSave): void {
  const jsonStr = JSON.stringify(career, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Carreira_${career.player.shirtName}_${career.currentYear}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importCareerFromJson(jsonString: string): CareerSave | null {
  try {
    const data = JSON.parse(jsonString) as CareerSave;
    if (!data.id || !data.player) {
      throw new Error('Arquivo de carreira inválido');
    }
    data.id = 'career_' + Date.now();
    data.saveName = `${data.saveName} (Importado)`;
    saveCareer(data);
    return data;
  } catch (err) {
    console.error('Erro ao importar carreira:', err);
    return null;
  }
}

export function getActiveSaveId(): string | null {
  return localStorage.getItem(ACTIVE_CAREER_KEY);
}

export function setActiveSaveId(id: string): void {
  localStorage.setItem(ACTIVE_CAREER_KEY, id);
}

// Global simulated rankings for competitive motivation
export interface GlobalRankUser {
  id: string;
  playerName: string;
  nationality: string;
  position: string;
  ovr: number;
  goals: number;
  assists: number;
  trophies: number;
  ballonDors: number;
  marketValue: number;
  careerScore: number;
  userHandle: string;
  category: 'daily' | 'weekly' | 'monthly' | 'allTime';
}

export const SIMULATED_GLOBAL_RANKINGS: GlobalRankUser[] = [
  {
    id: 'rank_1',
    playerName: 'Gabriel Menino de Ouro',
    nationality: 'Brasil',
    position: 'ATA',
    ovr: 96,
    goals: 780,
    assists: 230,
    trophies: 28,
    ballonDors: 5,
    marketValue: 240000000,
    careerScore: 98,
    userHandle: '@fenomeno_gamer',
    category: 'allTime'
  },
  {
    id: 'rank_2',
    playerName: 'Thiago Valente',
    nationality: 'Brasil',
    position: 'MEI',
    ovr: 94,
    goals: 340,
    assists: 410,
    trophies: 24,
    ballonDors: 3,
    marketValue: 195000000,
    careerScore: 96,
    userHandle: '@mestre_do_passe',
    category: 'allTime'
  },
  {
    id: 'rank_3',
    playerName: 'Matheus Cobra',
    nationality: 'Argentina',
    position: 'PE',
    ovr: 93,
    goals: 510,
    assists: 190,
    trophies: 21,
    ballonDors: 2,
    marketValue: 170000000,
    careerScore: 94,
    userHandle: '@puntero_10',
    category: 'monthly'
  },
  {
    id: 'rank_4',
    playerName: 'Lucas Paredão',
    nationality: 'Brasil',
    position: 'GOL',
    ovr: 92,
    goals: 1,
    assists: 8,
    trophies: 19,
    ballonDors: 0,
    marketValue: 90000000,
    careerScore: 91,
    userHandle: '@goleirao_br',
    category: 'weekly'
  },
  {
    id: 'rank_5',
    playerName: 'Enzo Castilho',
    nationality: 'Espanha',
    position: 'MC',
    ovr: 91,
    goals: 120,
    assists: 280,
    trophies: 18,
    ballonDors: 1,
    marketValue: 125000000,
    careerScore: 89,
    userHandle: '@tiki_taka_pro',
    category: 'daily'
  }
];
