import { Club, NewsItem } from '../types';
import { INITIAL_CLUBS } from '../data/database';

// Record original default division of each club so promotion/relegation overrides can be applied cleanly
const DEFAULT_CLUB_LEAGUES: Record<string, string> = {};
INITIAL_CLUBS.forEach(c => {
  DEFAULT_CLUB_LEAGUES[c.id] = c.leagueId;
});

/**
 * Synchronizes INITIAL_CLUBS in-place with career.clubLeagueOverrides
 * so promoted (Série B -> Série A) and relegated (Série A -> Série B) clubs
 * immediately reflect their updated division everywhere in the app.
 */
export function syncClubsWithCareer(
  career?: { clubLeagueOverrides?: Record<string, string> } | null
): void {
  const overrides = career?.clubLeagueOverrides || {};
  INITIAL_CLUBS.forEach(c => {
    const baseLeague = DEFAULT_CLUB_LEAGUES[c.id] || c.leagueId;
    c.leagueId = overrides[c.id] || baseLeague;
  });
}

/**
 * Executes promotion (G-4 of Série B -> Série A) and relegation (Z-4 of Série A -> Série B)
 * at the end of a season. If the user's club finished in 1st place (or top 4) of Série B,
 * it is guaranteed to climb to Série A while 4 clubs from Série A drop to Série B!
 */
export function applyBrazilianPromotionRelegation(
  currentOverrides: Record<string, string> | undefined,
  seasonYear: number,
  userClubId: string,
  userFinishedPosition?: number,
  orderedSerieAClubIds?: string[],
  orderedSerieBClubIds?: string[]
): {
  updatedOverrides: Record<string, string>;
  promotedNames: string[];
  relegatedNames: string[];
  userPromoted: boolean;
  userRelegated: boolean;
  newsItem: NewsItem;
} {
  const nextOverrides: Record<string, string> = { ...(currentOverrides || {}) };
  syncClubsWithCareer({ clubLeagueOverrides: nextOverrides });

  const serieAClubs = INITIAL_CLUBS.filter(c => c.leagueId === 'br_a');
  const serieBClubs = INITIAL_CLUBS.filter(c => c.leagueId === 'br_b');

  // Sort Série A clubs (either by provided final standings order or by strength)
  let sortedA = [...serieAClubs];
  if (orderedSerieAClubIds && orderedSerieAClubIds.length > 0) {
    sortedA.sort((a, b) => {
      const idxA = orderedSerieAClubIds.indexOf(a.id);
      const idxB = orderedSerieAClubIds.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  } else {
    sortedA.sort(
      (a, b) =>
        b.attackRating + b.midfieldRating + b.defenseRating -
        (a.attackRating + a.midfieldRating + a.defenseRating)
    );
  }

  // If user is in Série A and has a known final position, place user at that exact position
  if (userFinishedPosition !== undefined && sortedA.some(c => c.id === userClubId)) {
    const uClub = sortedA.find(c => c.id === userClubId)!;
    sortedA = sortedA.filter(c => c.id !== userClubId);
    const targetIdx = Math.max(0, Math.min(sortedA.length, userFinishedPosition - 1));
    sortedA.splice(targetIdx, 0, uClub);
  }

  // Sort Série B clubs (either by provided final standings order or by strength)
  let sortedB = [...serieBClubs];
  if (orderedSerieBClubIds && orderedSerieBClubIds.length > 0) {
    sortedB.sort((a, b) => {
      const idxA = orderedSerieBClubIds.indexOf(a.id);
      const idxB = orderedSerieBClubIds.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  } else {
    sortedB.sort(
      (a, b) =>
        b.attackRating + b.midfieldRating + b.defenseRating -
        (a.attackRating + a.midfieldRating + a.defenseRating)
    );
  }

  // If user is in Série B and has a known final position, place user at that exact position
  if (userFinishedPosition !== undefined && sortedB.some(c => c.id === userClubId)) {
    const uClub = sortedB.find(c => c.id === userClubId)!;
    sortedB = sortedB.filter(c => c.id !== userClubId);
    const targetIdx = Math.max(0, Math.min(sortedB.length, userFinishedPosition - 1));
    sortedB.splice(targetIdx, 0, uClub);
  }

  // Top 4 of Série B (G-4) climb to Série A; Bottom 4 of Série A (Z-4) drop to Série B
  const promotedToA = sortedB.slice(0, 4);
  const relegatedToB = sortedA.slice(-4);

  promotedToA.forEach(c => {
    nextOverrides[c.id] = 'br_a';
  });
  relegatedToB.forEach(c => {
    nextOverrides[c.id] = 'br_b';
  });

  // Apply immediately in-place to INITIAL_CLUBS
  syncClubsWithCareer({ clubLeagueOverrides: nextOverrides });

  const promotedNames = promotedToA.map(c => c.name);
  const relegatedNames = relegatedToB.map(c => c.name);
  const userPromoted = promotedToA.some(c => c.id === userClubId);
  const userRelegated = relegatedToB.some(c => c.id === userClubId);

  const headline = userPromoted
    ? `⬆️ ACESSO GARANTIDO! ${
        INITIAL_CLUBS.find(c => c.id === userClubId)?.name.toUpperCase() || 'SEU TIME'
      } SOBE PARA O BRASILEIRÃO SÉRIE A!`
    : userRelegated
    ? `⬇️ QUEDA CONFIRMADA: ${
        INITIAL_CLUBS.find(c => c.id === userClubId)?.name.toUpperCase() || 'SEU TIME'
      } CAI PARA A SÉRIE B`
    : `🔄 ACESSO E REBAIXAMENTO: ${promotedNames[0]} lidera subida à Série A; 4 clubes caem para a Série B`;

  const snippet = `Subiram para a Série A (G-4): ${promotedNames.join(
    ', '
  )}. Caíram para a Série B (Z-4): ${relegatedNames.join(', ')}.`;

  return {
    updatedOverrides: nextOverrides,
    promotedNames,
    relegatedNames,
    userPromoted,
    userRelegated,
    newsItem: {
      id: 'news_promo_rel_' + Date.now(),
      dateStr: `Fim da Temporada ${seasonYear}`,
      headline,
      snippet,
      category: 'award'
    }
  };
}

export type TournamentCategory = 'friendly' | 'state' | 'league' | 'cup' | 'continental' | 'world';

export interface TournamentDetails {
  id: string;
  name: string;
  shortName: string;
  category: TournamentCategory;
  badgeIcon: string;
  badgeColor: string;
  description: string;
}

export interface ScheduledFixture {
  week: number;
  competitionName: string;
  stageLabel: string;
  tournament: TournamentDetails;
  opponent: Club;
  isHome: boolean;
  isDecisive: boolean;
}

// Master Tournament Registry
export const TOURNAMENTS: Record<string, TournamentDetails> = {
  // Amistosos
  br_amistoso: {
    id: 'br_amistoso',
    name: 'Amistoso de Pré-Temporada',
    shortName: 'AMISTOSO',
    category: 'friendly',
    badgeIcon: '⚽',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Jogos preparatórios internacionais para aquecer o elenco e testar a tática.'
  },
  eu_amistoso: {
    id: 'eu_amistoso',
    name: 'Champions Pre-Season Tour',
    shortName: 'AMISTOSO',
    category: 'friendly',
    badgeIcon: '⚽',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Amistosos internacionais de gala pelos grandes estádios do mundo.'
  },

  // Estaduais & Regionais Brasil
  paranaense: {
    id: 'paranaense',
    name: 'Campeonato Paranaense 1XBET',
    shortName: 'PARANAENSE',
    category: 'state',
    badgeIcon: '🌲',
    badgeColor: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
    description: 'A força e tradição do futebol paranaense com os grandes clássicos Atletiba e Paratiba.'
  },
  paraense: {
    id: 'paraense',
    name: 'Campeonato Paraense - Parazão Banpará',
    shortName: 'PARAZÃO',
    category: 'state',
    badgeIcon: '👑',
    badgeColor: 'bg-sky-600/20 text-sky-300 border-sky-500/40',
    description: 'A maior paixão da Amazônia com a festa do lendário clássico Re-Pa no Mangueirão.'
  },
  paulistao: {
    id: 'paulistao',
    name: 'Campeonato Paulista - Paulistão Sicredi',
    shortName: 'PAULISTÃO',
    category: 'state',
    badgeIcon: '🏅',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'O estadual mais disputado do país com clássicos épicos e mata-mata fervilhante.'
  },
  carioca: {
    id: 'carioca',
    name: 'Campeonato Carioca Betnacional',
    shortName: 'CARIOCA',
    category: 'state',
    badgeIcon: '🏅',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    description: 'O charme do futebol carioca no templo sagrado do Maracanã.'
  },
  mineiro: {
    id: 'mineiro',
    name: 'Campeonato Mineiro',
    shortName: 'MINEIRO',
    category: 'state',
    badgeIcon: '🏅',
    badgeColor: 'bg-neutral-500/20 text-neutral-200 border-neutral-500/40',
    description: 'A rivalidade ferrenha de Minas Gerais com o clássico das multidões.'
  },
  gaucho: {
    id: 'gaucho',
    name: 'Campeonato Gaúcho - Gauchão Ipiranga',
    shortName: 'GAÚCHO',
    category: 'state',
    badgeIcon: '🏅',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'A raça do futebol sulista no tradicionalíssimo clássico Grenal.'
  },
  catarinense: {
    id: 'catarinense',
    name: 'Campeonato Catarinense Fort Atacadista',
    shortName: 'CATARINENSE',
    category: 'state',
    badgeIcon: '🏖️',
    badgeColor: 'bg-green-600/20 text-green-300 border-green-500/40',
    description: 'A acirrada disputa catarinense entre grandes forças litorâneas e do interior.'
  },
  goiano: {
    id: 'goiano',
    name: 'Campeonato Goiano',
    shortName: 'GOIANO',
    category: 'state',
    badgeIcon: '🌾',
    badgeColor: 'bg-emerald-700/20 text-emerald-300 border-emerald-600/40',
    description: 'O pulsar do futebol do Centro-Oeste com clássicos históricos em Goiânia.'
  },
  nordeste: {
    id: 'nordeste',
    name: 'Copa do Nordeste - Lampions League',
    shortName: 'NORDESTE',
    category: 'state',
    badgeIcon: '🏅',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    description: 'A competição mais vibrante e apaixonada do futebol nordestino.'
  },
  br_intertemporada: {
    id: 'br_intertemporada',
    name: 'Intertemporada Nacional • Preparação Física e Tática',
    shortName: 'INTERTEMPORADA',
    category: 'friendly',
    badgeIcon: '⚡',
    badgeColor: 'bg-neutral-600/20 text-neutral-300 border-neutral-500/40',
    description: 'Período sem disputa de estadual: foco em aprimoramento tático, físico e amistosos preparatórios.'
  },

  // Ligas Nacionais
  br_a: {
    id: 'br_a',
    name: 'Brasileirão Betano Série A',
    shortName: 'BRASILEIRÃO',
    category: 'league',
    badgeIcon: '🇧🇷',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: '38 rodadas na liga mais imprevisível e disputada do planeta futebol.'
  },
  br_b: {
    id: 'br_b',
    name: 'Brasileirão Série B',
    shortName: 'SÉRIE B',
    category: 'league',
    badgeIcon: '🇧🇷',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    description: 'A batalha ferrenha pelo cobiçado acesso à elite nacional.'
  },
  premier_league: {
    id: 'premier_league',
    name: 'Premier League',
    shortName: 'PREMIER',
    category: 'league',
    badgeIcon: '🦁',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'A liga mais rica e intensa do planeta, com os melhores atletas globais.'
  },
  la_liga: {
    id: 'la_liga',
    name: 'LaLiga EA Sports',
    shortName: 'LALIGA',
    category: 'league',
    badgeIcon: '🇪🇸',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description: 'O palco do El Clásico e do futebol técnico de alto refino mundial.'
  },
  serie_a_it: {
    id: 'serie_a_it',
    name: 'Serie A Enilive',
    shortName: 'SERIE A',
    category: 'league',
    badgeIcon: '🇮🇹',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'Tradição, tática de elite e paixão visceral no Calcio italiano.'
  },
  bundesliga: {
    id: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'BUNDESLIGA',
    category: 'league',
    badgeIcon: '🇩🇪',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    description: 'Estádios lotados, intensidade alemã e uma chuva constante de gols.'
  },
  ligue_1: {
    id: 'ligue_1',
    name: 'Ligue 1 McDonald’s',
    shortName: 'LIGUE 1',
    category: 'league',
    badgeIcon: '🇫🇷',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'A elite do futebol francês com estrelas globais e revelações velozes.'
  },
  liga_portugal: {
    id: 'liga_portugal',
    name: 'Liga Portugal Betclic',
    shortName: 'LIGA PT',
    category: 'league',
    badgeIcon: '🇵🇹',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'O celeiro de craques da Europa com a disputa acirrada dos Três Grandes.'
  },

  // Copas Nacionais
  copa_brasil: {
    id: 'copa_brasil',
    name: 'Copa Betano do Brasil',
    shortName: 'COPA BRASIL',
    category: 'cup',
    badgeIcon: '🏆',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    description: 'O torneio mais democrático e com a maior premiação milionária da América.'
  },
  fa_cup: {
    id: 'fa_cup',
    name: 'The Emirates FA Cup',
    shortName: 'FA CUP',
    category: 'cup',
    badgeIcon: '🏆',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    description: 'A competição de futebol mais antiga e lendária da história humana.'
  },
  copa_rey: {
    id: 'copa_rey',
    name: 'Copa de S.M. El Rey',
    shortName: 'COPA DEL REY',
    category: 'cup',
    badgeIcon: '🏆',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Mata-mata eliminatório espanhol com zebras históricas e decisões épicas.'
  },
  coppa_italia: {
    id: 'coppa_italia',
    name: 'Coppa Italia Frecciarossa',
    shortName: 'COPPA ITALIA',
    category: 'cup',
    badgeIcon: '🏆',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'A taça nacional da Itália decidida em jogo único no Estádio Olímpico de Roma.'
  },
  dfb_pokal: {
    id: 'dfb_pokal',
    name: 'DFB-Pokal',
    shortName: 'DFB-POKAL',
    category: 'cup',
    badgeIcon: '🏆',
    badgeColor: 'bg-neutral-500/20 text-neutral-200 border-neutral-500/40',
    description: 'A copa alemã com a mística final no Estádio Olímpico de Berlim.'
  },
  coupe_france: {
    id: 'coupe_france',
    name: 'Coupe de France',
    shortName: 'COUPE DE FRANCE',
    category: 'cup',
    badgeIcon: '🏆',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'A centenária e prestigiada copa do futebol francês no Stade de France.'
  },
  taca_portugal: {
    id: 'taca_portugal',
    name: 'Taça de Portugal Placard',
    shortName: 'TAÇA DE PORTUGAL',
    category: 'cup',
    badgeIcon: '🏆',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'A tradicionalíssima taça de Portugal com a festa mágica no Jamor.'
  },

  // Continentais
  champions_league: {
    id: 'champions_league',
    name: 'UEFA Champions League',
    shortName: 'CHAMPIONS',
    category: 'continental',
    badgeIcon: '🌟',
    badgeColor: 'bg-blue-600/30 text-blue-200 border-blue-400/50 shadow-blue-500/20',
    description: 'O ápice supremo do futebol de clubes mundial. Onde lendas nascem.'
  },
  europa_league: {
    id: 'europa_league',
    name: 'UEFA Europa League',
    shortName: 'EUROPA LEAGUE',
    category: 'continental',
    badgeIcon: '🟠',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    description: 'Duelos europeus de altíssima exigência técnica e noites inesquecíveis.'
  },
  libertadores: {
    id: 'libertadores',
    name: 'CONMEBOL Libertadores',
    shortName: 'LIBERTADORES',
    category: 'continental',
    badgeIcon: '⭐',
    badgeColor: 'bg-amber-500/25 text-amber-200 border-amber-400/50 shadow-amber-500/20',
    description: 'A Glória Eterna! O torneio mais visceral, rústico e apaixonado do continente.'
  },
  sulamericana: {
    id: 'sulamericana',
    name: 'CONMEBOL Sudamericana',
    shortName: 'SUL-AMERICANA',
    category: 'continental',
    badgeIcon: '🥈',
    badgeColor: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/40',
    description: 'A Grande Conquista continental sul-americana.'
  },

  // Mundial
  mundial_clubes: {
    id: 'mundial_clubes',
    name: 'FIFA Mundial de Clubes',
    shortName: 'MUNDIAL FIFA',
    category: 'world',
    badgeIcon: '🌍',
    badgeColor: 'bg-yellow-500/30 text-yellow-200 border-yellow-400/60 shadow-yellow-500/25',
    description: 'O confronto definitivo entre os campeões de todos os continentes do planeta.'
  }
};

/**
 * Returns the correct league tournament for any club
 */
export function getClubLeagueTournament(club: Club): TournamentDetails {
  if (club.leagueId === 'esp_1' || club.country === 'Espanha') return TOURNAMENTS.la_liga;
  if (club.leagueId === 'eng_1' || club.country === 'Inglaterra') return TOURNAMENTS.premier_league;
  if (club.leagueId === 'ita_1' || club.country === 'Itália') return TOURNAMENTS.serie_a_it;
  if (club.leagueId === 'ger_1' || club.country === 'Alemanha') return TOURNAMENTS.bundesliga;
  if (club.leagueId === 'fra_1' || club.country === 'França') return TOURNAMENTS.ligue_1;
  if (club.leagueId === 'por_1' || club.country === 'Portugal') return TOURNAMENTS.liga_portugal;
  if (club.leagueId === 'br_b') return TOURNAMENTS.br_b;
  return TOURNAMENTS.br_a;
}

/**
 * Returns the domestic cup tournament for any club
 */
export function getClubDomesticCupTournament(club: Club): TournamentDetails {
  if (club.country === 'Brasil') return TOURNAMENTS.copa_brasil;
  if (club.country === 'Inglaterra') return TOURNAMENTS.fa_cup;
  if (club.country === 'Espanha') return TOURNAMENTS.copa_rey;
  if (club.country === 'Itália') return TOURNAMENTS.coppa_italia;
  if (club.country === 'Alemanha') return TOURNAMENTS.dfb_pokal;
  if (club.country === 'França') return TOURNAMENTS.coupe_france;
  if (club.country === 'Portugal') return TOURNAMENTS.taca_portugal;
  return TOURNAMENTS.fa_cup;
}

// Brazilian clubs qualified for CONMEBOL Libertadores (Glória Eterna)
export const BRAZIL_LIBERTADORES_CLUBS = new Set([
  'flamengo',
  'palmeiras',
  'botafogo',
  'sao_paulo',
  'atletico_mg',
  'fluminense',
  'gremio',
  'internacional',
  'athletico_pr',
  'fortaleza',
  'cruzeiro',
  'corinthians'
]);

// Brazilian clubs qualified for CONMEBOL Sudamericana (Grande Conquista)
export const BRAZIL_SULAMERICANA_CLUBS = new Set([
  'red_bull_bragantino',
  'vasco',
  'bahia',
  'cuiaba',
  'vitoria',
  'juventude'
]);

// Brazilian clubs that dispute Copa Betano do Brasil
export const BRAZIL_COPA_DO_BRASIL_CLUBS = new Set([
  // Série A
  'flamengo', 'palmeiras', 'botafogo', 'sao_paulo', 'atletico_mg', 'corinthians',
  'cruzeiro', 'internacional', 'gremio', 'fluminense', 'bahia', 'fortaleza',
  'vasco', 'athletico_pr', 'red_bull_bragantino', 'juventude', 'vitoria',
  'criciuma', 'cuiaba', 'atletico_go',
  // Série B / Tradicionais
  'santos', 'sport_recife', 'coritiba', 'ceara', 'goias', 'america_mg',
  'vila_nova', 'novorizontino', 'mirassol', 'avai', 'chapecoense',
  'ponte_preta', 'guarani', 'paysandu', 'clube_do_remo', 'santa_cruz',
  'nautico', 'figueirense'
]);

export function clubHasCopaDoBrasil(club: Club): boolean {
  if (club.country !== 'Brasil') return false;
  if (club.hasCopaDoBrasil !== undefined) return club.hasCopaDoBrasil;
  return true;
}

export function clubPlaysLibertadores(club: Club): boolean {
  if (club.country !== 'Brasil') return false;
  if (club.playsLibertadores !== undefined) return club.playsLibertadores;
  return BRAZIL_LIBERTADORES_CLUBS.has(club.id);
}

/**
 * Returns the continental tournament (Champions, Europa, Libertadores, Sul-Americana, or null if not qualified)
 */
export function getClubContinentalTournament(club: Club): TournamentDetails | null {
  if (club.country === 'Brasil') {
    if (clubPlaysLibertadores(club)) {
      return TOURNAMENTS.libertadores;
    }
    if (BRAZIL_SULAMERICANA_CLUBS.has(club.id) || club.playsSulamericana) {
      return TOURNAMENTS.sulamericana;
    }
    return null; // Does not dispute continental tournament
  }

  const isSouthAmerica = ['Argentina', 'Uruguai', 'Colômbia', 'Equador', 'Chile'].includes(club.country);
  if (isSouthAmerica) {
    return club.prestige >= 4 ? TOURNAMENTS.libertadores : TOURNAMENTS.sulamericana;
  }

  if (club.prestige >= 4) {
    return TOURNAMENTS.champions_league;
  }
  if (club.prestige >= 3) {
    return TOURNAMENTS.europa_league;
  }
  return null;
}

/**
 * Returns all active tournaments a club will compete in during the year
 */
export function getActiveClubCompetitions(club: Club): TournamentDetails[] {
  const list: TournamentDetails[] = [];

  if (club.country === 'Brasil') {
    list.push(TOURNAMENTS.br_amistoso);

    // Regional / Estadual tournament (null means the state tournament is skipped)
    const stateId = getBrazilianClubStateTourney(club.id, club);
    if (stateId && TOURNAMENTS[stateId]) {
      list.push(TOURNAMENTS[stateId]);
    }
    
    // National League
    list.push(getClubLeagueTournament(club));

    // National Cup (Copa do Brasil)
    if (clubHasCopaDoBrasil(club)) {
      list.push(TOURNAMENTS.copa_brasil);
    }

    // Continental (Libertadores or Sul-Americana)
    const continental = getClubContinentalTournament(club);
    if (continental) {
      list.push(continental);
    }

    // World Cup for prestigious clubs
    if (club.prestige >= 5) {
      list.push(TOURNAMENTS.mundial_clubes);
    }
  } else {
    // European or Global Club
    list.push(TOURNAMENTS.eu_amistoso);
    list.push(getClubLeagueTournament(club));
    list.push(getClubDomesticCupTournament(club));
    const continental = getClubContinentalTournament(club);
    if (continental) {
      list.push(continental);
    }
    if (club.prestige >= 5) {
      list.push(TOURNAMENTS.mundial_clubes);
    }
  }

  return list;
}

/**
 * Returns Brazilian state tournament ID based on club ID and state.
 * Returns null if the club's state is unknown (meaning state tournament is skipped).
 */
export function getBrazilianClubStateTourney(clubId: string, club?: Club): string | null {
  const state = club?.state;
  if (state) {
    if (state === 'PR') return 'paranaense';
    if (state === 'PA') return 'paraense';
    if (state === 'SP') return 'paulistao';
    if (state === 'RJ') return 'carioca';
    if (state === 'MG') return 'mineiro';
    if (state === 'RS') return 'gaucho';
    if (state === 'SC') return 'catarinense';
    if (state === 'GO') return 'goiano';
    if (['BA', 'CE', 'PE', 'AL', 'RN', 'SE', 'PB', 'MA', 'PI'].includes(state)) return 'nordeste';
  }

  const paranaenses = [
    'athletico_pr', 'coritiba', 'parana_clube', 'operario_pr', 'londrina',
    'maringa', 'cascavel', 'cianorte', 'toledo', 'rio_branco_pr'
  ];
  const paraenses = [
    'paysandu', 'clube_do_remo', 'remo', 'aguia_maraba', 'castanhal',
    'tuna_luso', 'bragantino_pa', 'paragominas', 'cameta', 'tapajos'
  ];
  const paulistas = [
    'palmeiras', 'corinthians', 'sao_paulo', 'santos', 'red_bull_bragantino',
    'ponte_preta', 'guarani', 'mirassol', 'novorizontino', 'ituano',
    'botafogo_sp', 'sao_bernardo', 'agua_santa', 'ferroviaria', 'portuguesa',
    'santo_andre', 'inter_de_limeira', 'oeste'
  ];
  const cariocas = [
    'flamengo', 'fluminense', 'botafogo', 'vasco', 'vasco_da_gama',
    'bangu', 'madureira', 'volta_redonda', 'boavista', 'nova_iguacu', 'portuguesa_rj'
  ];
  const mineiros = [
    'atletico_mg', 'cruzeiro', 'america_mg', 'tombense', 'athletic_club',
    'villa_nova_mg', 'ipatinga', 'pouso_alegre', 'caldense'
  ];
  const gauchos = [
    'gremio', 'internacional', 'juventude', 'caxias', 'brasil_pelotas',
    'ypiranga', 'sao_jose_rs', 'novo_hamburgo'
  ];
  const catarinenses = [
    'criciuma', 'avai', 'chapecoense', 'figueirense', 'brusque',
    'joinville', 'marcilio_dias', 'hercilio_luz', 'concordia'
  ];
  const goianos = [
    'goias', 'atletico_go', 'vila_nova', 'aparecidense', 'anapolis',
    'goiania', 'crac', 'morrinhos'
  ];
  const nordestinos = [
    'bahia', 'vitoria', 'fortaleza', 'ceara', 'sport_recife', 'santa_cruz',
    'nautico', 'crb', 'csa', 'abc', 'america_rn', 'confianca', 'botafogo_pb',
    'sampaio_correa', 'ferroviario', 'moto_club', 'treze', 'campinense'
  ];

  if (paranaenses.includes(clubId)) return 'paranaense';
  if (paraenses.includes(clubId)) return 'paraense';
  if (paulistas.includes(clubId)) return 'paulistao';
  if (cariocas.includes(clubId)) return 'carioca';
  if (mineiros.includes(clubId)) return 'mineiro';
  if (gauchos.includes(clubId)) return 'gaucho';
  if (catarinenses.includes(clubId)) return 'catarinense';
  if (goianos.includes(clubId)) return 'goiano';
  if (nordestinos.includes(clubId)) return 'nordeste';

  // If state is unknown, return null to skip the state tournament
  return null;
}

/**
 * Returns the deterministic 16-club bracket seeds and group/league phase opponents for all knockout competitions
 * so that the Bracket UI (Oitavas, Quartas, Semifinal, Final) and getScheduledFixture ALWAYS use the exact same opponents.
 */
export function getCompetitionBracketSeeds(userClub: Club) {
  const userContinental = getClubContinentalTournament(userClub);
  const isUserUcl = userContinental?.id === 'champions_league';
  const isUserEuropa = userContinental?.id === 'europa_league';
  const isUserLib = userContinental?.id === 'libertadores';
  const isUserSula = userContinental?.id === 'sulamericana';
  const isUserCup = userClub.country === 'Brasil' ? clubHasCopaDoBrasil(userClub) : true;

  // Helper to pad a list of clubs up to `targetLen` without duplicates
  const buildSeededPool = (baseClubs: Club[], includeUser: boolean, targetLen: number): Club[] => {
    const list: Club[] = [];
    if (includeUser) {
      list.push(userClub);
    }
    for (const c of baseClubs) {
      if (!list.some(existing => existing.id === c.id)) {
        list.push(c);
      }
      if (list.length >= targetLen) break;
    }
    if (list.length < targetLen) {
      for (const c of INITIAL_CLUBS) {
        if (!list.some(existing => existing.id === c.id)) {
          list.push(c);
        }
        if (list.length >= targetLen) break;
      }
    }
    return list.slice(0, targetLen);
  };

  // 1. UEFA CHAMPIONS LEAGUE (24 clubs in League Phase, top 16 in Oitavas -> Quartas -> Semifinal -> Final)
  const euroElite = INITIAL_CLUBS.filter(
    c =>
      ['Inglaterra', 'Espanha', 'Itália', 'Alemanha', 'França', 'Portugal', 'Holanda'].includes(
        c.country
      ) && c.prestige >= 4
  );
  const uclPool24 = buildSeededPool(euroElite, isUserUcl, 24);
  const uclSeeds16 = uclPool24.slice(0, 16);

  // 2. UEFA EUROPA LEAGUE (16 clubs)
  const euroSecondary = INITIAL_CLUBS.filter(
    c =>
      ['Inglaterra', 'Espanha', 'Itália', 'Alemanha', 'França', 'Portugal', 'Holanda'].includes(
        c.country
      ) &&
      (c.prestige === 3 || c.prestige === 4)
  );
  const europaPool16 = buildSeededPool(euroSecondary, isUserEuropa, 16);

  // 3. CONMEBOL LIBERTADORES (16 clubs across 4 Groups A, B, C, D)
  const libCandidates = INITIAL_CLUBS.filter(
    c =>
      (c.country === 'Brasil' && BRAZIL_LIBERTADORES_CLUBS.has(c.id)) ||
      (['Argentina', 'Uruguai', 'Colômbia', 'Equador'].includes(c.country) && c.prestige >= 4)
  );
  const libPool16 = buildSeededPool(libCandidates, isUserLib, 16);
  // Knockout bracket seeds for Libertadores (User is index 0, paired against index 1 in Oitavas, index 2 in Quartas, index 4 in Semifinal, index 8 in Final)
  const libSeeds16: Club[] = [
    libPool16[0],
    libPool16[1],
    libPool16[2],
    libPool16[5],
    libPool16[3],
    libPool16[6],
    libPool16[7],
    libPool16[8],
    libPool16[4],
    libPool16[9],
    libPool16[10],
    libPool16[11],
    libPool16[12],
    libPool16[13],
    libPool16[14],
    libPool16[15]
  ];

  // 4. CONMEBOL SUL-AMERICANA (16 clubs)
  const sulaCandidates = INITIAL_CLUBS.filter(
    c =>
      (c.country === 'Brasil' && BRAZIL_SULAMERICANA_CLUBS.has(c.id)) ||
      (['Argentina', 'Uruguai', 'Colômbia', 'Equador'].includes(c.country) && c.prestige <= 4)
  );
  const sulaPool16 = buildSeededPool(sulaCandidates, isUserSula, 16);

  // 5. DOMESTIC CUP (Copa do Brasil / Copa del Rey / FA Cup / etc. - 16 clubs)
  const domesticCandidates = INITIAL_CLUBS.filter(c => c.country === userClub.country);
  const cupSeeds16 = buildSeededPool(domesticCandidates, isUserCup, 16);

  // 6. DEDICATED COPA DO BRASIL BRACKET (16 Brazilian clubs, always available on the Copa do Brasil tab)
  const isUserBrazil = userClub.country === 'Brasil';
  const brCupCandidates = INITIAL_CLUBS.filter(c => c.country === 'Brasil');
  const copaDoBrasilSeeds16 = buildSeededPool(brCupCandidates, isUserBrazil, 16);

  return {
    ucl: {
      isUserParticipating: isUserUcl,
      pool24: uclPool24,
      seeds16: uclSeeds16,
      leaguePhaseOpponents: [uclSeeds16[1], uclSeeds16[2], uclSeeds16[4], uclSeeds16[8]],
      r16Opponent: uclSeeds16[1],
      qfOpponent: uclSeeds16[2],
      sfOpponent: uclSeeds16[4],
      finalOpponent: uclSeeds16[8]
    },
    europa: {
      isUserParticipating: isUserEuropa,
      pool16: europaPool16,
      seeds16: europaPool16,
      leaguePhaseOpponents: [europaPool16[1], europaPool16[2], europaPool16[4], europaPool16[8]],
      r16Opponent: europaPool16[1],
      qfOpponent: europaPool16[2],
      sfOpponent: europaPool16[4],
      finalOpponent: europaPool16[8]
    },
    libertadores: {
      isUserParticipating: isUserLib,
      pool16: libPool16,
      seeds16: libSeeds16,
      groupStageOpponents: [libSeeds16[1], libSeeds16[2], libSeeds16[4], libSeeds16[8]],
      r16Opponent: libSeeds16[1],
      qfOpponent: libSeeds16[2],
      sfOpponent: libSeeds16[4],
      finalOpponent: libSeeds16[8]
    },
    sulamericana: {
      isUserParticipating: isUserSula,
      pool16: sulaPool16,
      seeds16: sulaPool16,
      groupStageOpponents: [sulaPool16[1], sulaPool16[2], sulaPool16[4], sulaPool16[8]],
      r16Opponent: sulaPool16[1],
      qfOpponent: sulaPool16[2],
      sfOpponent: sulaPool16[4],
      finalOpponent: sulaPool16[8]
    },
    cup: {
      isUserParticipating: isUserCup,
      seeds16: cupSeeds16,
      prelimOpponent: cupSeeds16[1],
      r16Opponent: cupSeeds16[1],
      qfOpponent: cupSeeds16[2],
      sfOpponent: cupSeeds16[4],
      finalOpponent: cupSeeds16[8]
    },
    copaDoBrasil: {
      isUserParticipating: isUserBrazil && clubHasCopaDoBrasil(userClub),
      seeds16: copaDoBrasilSeeds16,
      r16Opponent: copaDoBrasilSeeds16[1],
      qfOpponent: copaDoBrasilSeeds16[2],
      sfOpponent: copaDoBrasilSeeds16[4],
      finalOpponent: copaDoBrasilSeeds16[8]
    }
  };
}

/**
 * Determines the scheduled fixture, tournament, round label and realistic opponent for any week
 */
export function getScheduledFixture(
  userClub: Club,
  week: number
): ScheduledFixture {
  const isHome = (week % 2 === 1) || (week === 43 && userClub.prestige >= 4);
  const isBrazil = userClub.country === 'Brasil';
  const brackets = getCompetitionBracketSeeds(userClub);

  // ==========================================
  // EUROPEAN & REST OF WORLD CLUB SCHEDULE
  // ==========================================
  if (!isBrazil) {
    const leagueTourney = getClubLeagueTournament(userClub);
    const cupTourney = getClubDomesticCupTournament(userClub);
    const continentalTourney = getClubContinentalTournament(userClub);

    const leagueRivals = INITIAL_CLUBS.filter(
      c => c.id !== userClub.id && c.leagueId === userClub.leagueId
    );
    const fallbackLeagueRivals = INITIAL_CLUBS.filter(
      c => c.id !== userClub.id && c.country === userClub.country
    );
    const validLeaguePool =
      leagueRivals.length > 0
        ? leagueRivals
        : fallbackLeagueRivals.length > 0
        ? fallbackLeagueRivals
        : INITIAL_CLUBS.filter(c => c.id !== userClub.id);

    // A) UEFA CHAMPIONS LEAGUE / EUROPA LEAGUE FIXTURES (100% synchronized with Chaveamento: Oitavas -> Quartas -> Semifinal -> Final!)
    if (continentalTourney && [6, 10, 18, 22, 30, 34, 44].includes(week)) {
      const activeCont =
        continentalTourney.id === 'champions_league' ? brackets.ucl : brackets.europa;
      let stageLabel = 'Oitavas de Final';
      let isDecisive = true;
      let isFinal = false;
      let opponent = activeCont.r16Opponent;

      if (week === 6) {
        stageLabel = 'Oitavas de Final • Jogo de IDA';
        opponent = activeCont.r16Opponent;
      } else if (week === 10) {
        stageLabel = 'Oitavas de Final • Jogo de VOLTA';
        opponent = activeCont.r16Opponent;
      } else if (week === 18) {
        stageLabel = 'Quartas de Final • Jogo de IDA';
        opponent = activeCont.qfOpponent;
      } else if (week === 22) {
        stageLabel = 'Quartas de Final • Jogo de VOLTA';
        opponent = activeCont.qfOpponent;
      } else if (week === 30) {
        stageLabel = 'Semifinal • Jogo de IDA';
        opponent = activeCont.sfOpponent;
      } else if (week === 34) {
        stageLabel = 'Semifinal • Jogo de VOLTA';
        opponent = activeCont.sfOpponent;
      } else if (week === 44) {
        stageLabel = `🏆 A GRANDE FINAL DA ${continentalTourney.shortName}`;
        opponent = activeCont.finalOpponent;
        isFinal = true;
      }

      return {
        week,
        competitionName: `${continentalTourney.name} • ${stageLabel}`,
        stageLabel,
        tournament: continentalTourney,
        opponent,
        isHome: isFinal ? false : isHome,
        isDecisive
      };
    }

    // B) DOMESTIC CUP (100% synchronized with Cup Bracket: Oitavas -> Quartas -> Semifinal -> Final!)
    if ([8, 16, 24, 32, 42].includes(week)) {
      let stageLabel = 'Oitavas de Final';
      let isDecisive = true;
      let isFinal = false;
      let opponent = brackets.cup.r16Opponent;

      if (week === 8) {
        stageLabel = 'Oitavas de Final • Jogo de IDA';
        opponent = brackets.cup.r16Opponent;
      } else if (week === 16) {
        stageLabel = 'Oitavas de Final • Jogo de VOLTA';
        opponent = brackets.cup.r16Opponent;
      } else if (week === 24) {
        stageLabel = 'Quartas de Final';
        opponent = brackets.cup.qfOpponent;
      } else if (week === 32) {
        stageLabel = 'Semifinal Decisiva';
        opponent = brackets.cup.sfOpponent;
      } else if (week === 42) {
        stageLabel = `🏆 GRANDE FINAL DA ${cupTourney.shortName}`;
        opponent = brackets.cup.finalOpponent;
        isFinal = true;
      }

      return {
        week,
        competitionName: `${cupTourney.name} • ${stageLabel}`,
        stageLabel,
        tournament: cupTourney,
        opponent,
        isHome: isFinal ? false : isHome,
        isDecisive
      };
    }

    // C) FIFA MUNDIAL DE CLUBES (WEEKS 47 & 48)
    if (week === 47 || week === 48) {
      const tourney = TOURNAMENTS.mundial_clubes;
      const stageLabel =
        week === 48
          ? '👑 A GRANDE FINAL DO MUNDIAL DE CLUBES DA FIFA'
          : 'Semifinal do Mundial de Clubes da FIFA';

      const saGiants = INITIAL_CLUBS.filter(c => c.country === 'Brasil' && c.prestige >= 4);
      const opponent =
        saGiants.length > 0 ? saGiants[(week * 2) % saGiants.length] : INITIAL_CLUBS[0];

      return {
        week,
        competitionName: `${tourney.name} • ${stageLabel}`,
        stageLabel,
        tournament: tourney,
        opponent,
        isHome: false,
        isDecisive: true
      };
    }

    // D) NATIONAL LEAGUE (LaLiga / Premier League / Serie A / Bundesliga / Ligue 1 / Liga Portugal)
    const leagueWeeks = [
      1, 2, 3, 4, 5, 7, 9, 11, 12, 13, 14, 15, 17, 19, 20, 21, 23, 25, 26, 27, 28, 29, 31, 33, 35, 36, 37,
      38, 39, 40, 41, 43, 45, 46
    ];
    const leagueRoundIndex = leagueWeeks.indexOf(week);
    const roundNumber = leagueRoundIndex !== -1 ? leagueRoundIndex + 1 : Math.max(1, week);

    let stageLabel = `${roundNumber}ª Rodada`;
    let isDecisive = false;

    if (week === 45) {
      stageLabel = 'Penúltima Rodada Decisiva';
      isDecisive = true;
    } else if (week === 46) {
      stageLabel = '🏆 RODADA FINAL • DECISÃO DO TÍTULO!';
      isDecisive = true;
    }

    const opponent = validLeaguePool[(roundNumber - 1) % validLeaguePool.length];

    return {
      week,
      competitionName: `${leagueTourney.name} • ${stageLabel}`,
      stageLabel,
      tournament: leagueTourney,
      opponent,
      isHome,
      isDecisive
    };
  }

  // ==========================================
  // BRAZILIAN CLUB AUTHENTIC CALENDAR
  // ==========================================
  const continentalTourney = getClubContinentalTournament(userClub);
  const hasCopa = clubHasCopaDoBrasil(userClub);
  const stateId = getBrazilianClubStateTourney(userClub.id, userClub);
  const stateTourney = stateId && TOURNAMENTS[stateId] ? TOURNAMENTS[stateId] : null;
  const brLeagueTourney = userClub.leagueId === 'br_b' ? TOURNAMENTS.br_b : TOURNAMENTS.br_a;
  const brLeaguePool = INITIAL_CLUBS.filter(
    c => c.id !== userClub.id && c.leagueId === userClub.leagueId
  );

  // 1) CONMEBOL LIBERTADORES / SUL-AMERICANA (100% synchronized with Chaveamento: 7 & 11 = Oitavas; 18 & 24 = Quartas; 30 & 38 = Semifinal; 43 = Final)
  if (continentalTourney && [7, 11, 18, 24, 30, 38, 43].includes(week)) {
    const activeSa =
      continentalTourney.id === 'libertadores' ? brackets.libertadores : brackets.sulamericana;
    let stageLabel = 'Oitavas de Final';
    let opponent = activeSa.r16Opponent;
    let isFinal = false;

    if (week === 7) {
      stageLabel = `Oitavas de Final • Jogo de IDA (${continentalTourney.shortName})`;
      opponent = activeSa.r16Opponent;
    } else if (week === 11) {
      stageLabel = `Oitavas de Final • Jogo de VOLTA (${continentalTourney.shortName})`;
      opponent = activeSa.r16Opponent;
    } else if (week === 18) {
      stageLabel = `Quartas de Final • Jogo de IDA (${continentalTourney.shortName})`;
      opponent = activeSa.qfOpponent;
    } else if (week === 24) {
      stageLabel = `Quartas de Final • Jogo de VOLTA (${continentalTourney.shortName})`;
      opponent = activeSa.qfOpponent;
    } else if (week === 30) {
      stageLabel = `Semifinal • Jogo de IDA (${continentalTourney.shortName})`;
      opponent = activeSa.sfOpponent;
    } else if (week === 38) {
      stageLabel = `Semifinal • Jogo de VOLTA (${continentalTourney.shortName})`;
      opponent = activeSa.sfOpponent;
    } else if (week === 43) {
      stageLabel =
        continentalTourney.id === 'libertadores'
          ? '🏆 A GRANDE FINAL DA CONMEBOL LIBERTADORES (Glória Eterna)'
          : '🏆 A GRANDE FINAL DA CONMEBOL SUL-AMERICANA';
      opponent = activeSa.finalOpponent;
      isFinal = true;
    }

    return {
      week,
      competitionName: `${continentalTourney.name} • ${stageLabel}`,
      stageLabel,
      tournament: continentalTourney,
      opponent,
      isHome: isFinal ? false : isHome,
      isDecisive: true
    };
  }

  // 2) COPA BETANO DO BRASIL (Weeks 6, 10 = Oitavas; 22 = Quartas; 28, 36 = Semifinal; 44 = Final — 100% synchronized with Cup Bracket!)
  if (hasCopa && [6, 10, 22, 28, 36, 44].includes(week)) {
    const tourney = TOURNAMENTS.copa_brasil;
    let stageLabel = 'Oitavas de Final';
    let opponent = brackets.cup.r16Opponent;

    if (week === 6) {
      stageLabel = 'Oitavas de Final • Jogo de IDA';
      opponent = brackets.cup.r16Opponent;
    } else if (week === 10) {
      stageLabel = 'Oitavas de Final • Jogo de VOLTA';
      opponent = brackets.cup.r16Opponent;
    } else if (week === 22) {
      stageLabel = 'Quartas de Final';
      opponent = brackets.cup.qfOpponent;
    } else if (week === 28) {
      stageLabel = 'Semifinal • Jogo de IDA';
      opponent = brackets.cup.sfOpponent;
    } else if (week === 36) {
      stageLabel = 'Semifinal • Jogo de VOLTA';
      opponent = brackets.cup.sfOpponent;
    } else if (week === 44) {
      stageLabel = '🏆 GRANDE FINAL DA COPA BETANO DO BRASIL';
      opponent = brackets.cup.finalOpponent;
    }

    return {
      week,
      competitionName: `${tourney.name} • ${stageLabel}`,
      stageLabel,
      tournament: tourney,
      opponent,
      isHome,
      isDecisive: true
    };
  }

  // 3) CAMPEONATO ESTADUAL (Weeks 2, 4, 8, 13, 14 for clubs with Estadual)
  if (stateTourney && [2, 4, 8, 13, 14].includes(week)) {
    const estWeeks = [2, 4, 8, 13, 14];
    const estIdx = estWeeks.indexOf(week);
    const stageLabel =
      week === 14
        ? `🏆 GRANDE FINAL DO ${stateTourney.shortName}`
        : week === 13
        ? `Semifinal Decisiva do ${stateTourney.shortName}`
        : `${estIdx + 1}ª Rodada da Fase Classificatória`;

    let regionalPool = INITIAL_CLUBS.filter(c => {
      if (c.id === userClub.id || c.country !== 'Brasil') return false;
      return getBrazilianClubStateTourney(c.id, c) === stateId;
    });
    if (regionalPool.length === 0) {
      regionalPool = INITIAL_CLUBS.filter(c => c.country === 'Brasil' && c.id !== userClub.id);
    }
    const opponent = regionalPool[estIdx % regionalPool.length] || INITIAL_CLUBS[1];

    return {
      week,
      competitionName: `${stateTourney.name} • ${stageLabel}`,
      stageLabel,
      tournament: stateTourney,
      opponent,
      isHome,
      isDecisive: week >= 13
    };
  }

  // 4) WEEKS 47 - 48: FIFA MUNDIAL DE CLUBES
  if (week === 47 || week === 48) {
    const tourney = TOURNAMENTS.mundial_clubes;
    const stageLabel =
      week === 48
        ? '👑 A GRANDE FINAL DO MUNDIAL DE CLUBES DA FIFA'
        : 'Semifinal do Mundial de Clubes da FIFA';

    const europeanGiants = INITIAL_CLUBS.filter(c => c.country !== 'Brasil' && c.prestige >= 5);
    const opponent =
      europeanGiants.length > 0
        ? europeanGiants[week === 48 ? 0 : 1 % europeanGiants.length]
        : INITIAL_CLUBS.find(c => c.id === 'real_madrid') || INITIAL_CLUBS[4];

    return {
      week,
      competitionName: `${tourney.name} • ${stageLabel}`,
      stageLabel,
      tournament: tourney,
      opponent,
      isHome: false,
      isDecisive: true
    };
  }

  // 5) BRASILEIRÃO SÉRIE A / B (All remaining weeks, starting right in Week 1!)
  const roundNumber = Math.min(38, Math.max(1, week));
  const stageLabel =
    week === 46
      ? '🏆 RODADA FINAL • DECISÃO DO BRASILEIRÃO'
      : week === 45
      ? 'Penúltima Rodada Decisiva do Brasileirão'
      : `${roundNumber}ª Rodada do Brasileirão`;

  const opponent =
    brLeaguePool.length > 0
      ? brLeaguePool[(roundNumber - 1) % brLeaguePool.length]
      : INITIAL_CLUBS[1];

  return {
    week,
    competitionName: `${brLeagueTourney.name} • ${stageLabel}`,
    stageLabel,
    tournament: brLeagueTourney,
    opponent,
    isHome,
    isDecisive: week >= 45
  };
}
