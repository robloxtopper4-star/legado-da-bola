import { PlayerProfile, SeasonStats, CareerSave } from '../types';

export interface EndOfSeasonEvaluation {
  trophiesWon: string[];
  awardsWon: string[];
  nationalTeamNews?: string;
  seasonSummary: string;
}

export function evaluateEndOfSeason(
  player: PlayerProfile,
  seasonStats: SeasonStats,
  clubLeagueTier: number,
  leagueName: string,
  year: number
): EndOfSeasonEvaluation {
  const trophiesWon: string[] = [];
  const awardsWon: string[] = [];
  let nationalTeamNews: string | undefined = undefined;

  // 1. Club Trophy probability based on team ranking and player contribution
  const trophyRoll = Math.random();
  if (player.ovr >= 80 && seasonStats.avgRating >= 7.2) {
    if (trophyRoll < 0.45) {
      trophiesWon.push(`Campeão do(a) ${leagueName}`);
    }
    if (Math.random() < 0.35) {
      trophiesWon.push('Campeão da Copa Nacional');
    }
    if (player.ovr >= 86 && Math.random() < 0.25) {
      trophiesWon.push('Campeão Continental (Champions League / Libertadores)');
    }
  } else if (seasonStats.avgRating >= 6.8 && trophyRoll < 0.2) {
    trophiesWon.push('Campeão da Copa Nacional');
  }

  // 2. Individual Awards
  if (seasonStats.goals >= 25) {
    awardsWon.push('Chuteira de Ouro (Artilheiro da Temporada)');
  }
  if (seasonStats.assists >= 15) {
    awardsWon.push('Rei das Assistências da Liga');
  }
  if (player.age <= 21 && seasonStats.avgRating >= 7.3 && seasonStats.matches >= 20) {
    awardsWon.push('Prêmio Golden Boy (Melhor Jogador Jovem do Ano)');
  }
  if (player.primaryPosition === 'GOL' && seasonStats.cleanSheets >= 12 && seasonStats.avgRating >= 7.2) {
    awardsWon.push('Prêmio Luva de Ouro (Melhor Goleiro)');
  }
  if (seasonStats.avgRating >= 7.5 && seasonStats.matches >= 25) {
    awardsWon.push(`Craque do Ano do(a) ${leagueName}`);
    awardsWon.push('Integrante da Seleção da Temporada (Team of the Season)');
  }
  if (player.ovr >= 88 && seasonStats.avgRating >= 7.7 && (seasonStats.goals + seasonStats.assists >= 30 || trophiesWon.length >= 2)) {
    awardsWon.push('🏆 BOLA DE OURO (Melhor Jogador do Mundo)');
  }

  // 3. National Team Call-up Evaluation
  if (player.ovr >= 78 && seasonStats.avgRating >= 7.0) {
    if (!player.isNationalTeamCalled) {
      nationalTeamNews = `CONVOCAÇÃO HISTÓRICA! O técnico da Seleção convocou ${player.shirtName} para os próximos compromissos internacionais!`;
    } else {
      nationalTeamNews = `Convocação mantida: ${player.shirtName} segue como peça de confiança na Seleção Nacional.`;
    }
  }

  const seasonSummary = `Temporada ${year} finalizada: ${seasonStats.matches} jogos disputados, ${seasonStats.goals} gols, ${seasonStats.assists} assistências e nota média de ${seasonStats.avgRating.toFixed(2)}.`;

  return {
    trophiesWon,
    awardsWon,
    nationalTeamNews,
    seasonSummary
  };
}

export function calculateSeasonAwards(
  player: PlayerProfile,
  year: number
): { name: string; year: number; description: string }[] {
  const awards: { name: string; year: number; description: string }[] = [];

  if (player.ovr >= 88 && player.careerGoals >= 15) {
    awards.push({
      name: '🏆 BOLA DE OURO (Melhor Jogador do Mundo)',
      year,
      description: 'Eleito o maior futebolista do planeta em votação mundial de capitães e jornalistas.'
    });
  }

  if (player.careerGoals >= 20) {
    awards.push({
      name: 'Chuteira de Ouro',
      year,
      description: 'Artilheiro máximo das competições nacionais na temporada.'
    });
  }

  if (player.age <= 21 && player.ovr >= 76) {
    awards.push({
      name: 'Golden Boy Mundial',
      year,
      description: 'Melhor atleta sub-21 em atividade.'
    });
  }

  if (player.ovr >= 80) {
    awards.push({
      name: 'Seleção do Ano (FIFA/FIFPRO)',
      year,
      description: 'Escalado entre os 11 melhores jogadores do ano na sua posição.'
    });
  }

  return awards;
}

export function calculateCareerGrade(career: CareerSave): { score: number; title: string; description: string } {
  const p = career.player;

  let score = 50;

  // Games & Goals
  score += Math.min(15, p.careerMatches * 0.025);
  score += Math.min(15, p.careerGoals * 0.04);
  score += Math.min(10, p.careerAssists * 0.03);

  // Trophies
  score += Math.min(12, p.careerTrophies * 1.5);

  // Peak OVR
  score += Math.max(0, (p.ovr - 70) * 0.4);

  // Awards (Ballon d'Or gives big boost)
  const ballonDors = career.awardsCabinet.filter(a => a.name.includes('BOLA DE OURO')).length;
  score += ballonDors * 5;
  score += Math.min(8, career.awardsCabinet.length * 1.0);

  // National Caps
  score += Math.min(6, p.nationalCaps * 0.1);

  // Round to nearest integer and cap at 99
  const finalScore = Math.max(50, Math.min(99, Math.round(score)));

  let title = 'Carreira Profissional Respeitável';
  let description = 'Cumpriu anos de dedicação nos gramados com atuações sólidas.';

  if (finalScore >= 96) {
    title = '97 — Um dos Maiores de Todos os Tempos';
    description = 'Imortalidade futebolística. O seu nome está gravado para sempre ao lado das maiores lendas da história do esporte mundial.';
  } else if (finalScore >= 90) {
    title = '91 — Carreira Lendária';
    description = 'Uma trajetória extraordinária, repleta de títulos memoráveis, prêmios individuais e idolatria eterna por onde passou.';
  } else if (finalScore >= 80) {
    title = '82 — Excelente Carreira';
    description = 'Jogador de primeiro escalão, campeão respeitado por torcedores e companheiros de profissão.';
  } else if (finalScore >= 70) {
    title = '72 — Boa Carreira';
    description = 'Carreira profissional digna, com momentos de brilho em clubes importantes.';
  }

  return {
    score: finalScore,
    title,
    description
  };
}
