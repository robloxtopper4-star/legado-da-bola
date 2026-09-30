import { PlayerProfile, NewsItem, SocialPost, MatchSimulationResult, Club } from '../types';

export function generatePostMatchNews(
  player: PlayerProfile,
  matchResult: MatchSimulationResult,
  year: number,
  week?: number
): { news: NewsItem[]; socialPosts: SocialPost[] } {
  const newsList: NewsItem[] = [];
  const socialList: SocialPost[] = [];
  const dateStr = `Temporada ${year} • Rodada ${week || 1}`;

  const userGoals = matchResult.isPlayerHome ? matchResult.homeScore : matchResult.awayScore;
  const oppGoals = matchResult.isPlayerHome ? matchResult.awayScore : matchResult.homeScore;
  const isWin = userGoals > oppGoals;
  const isDraw = userGoals === oppGoals;

  // 1. News generation (100% accurate to Win, Draw, or Loss)
  if (matchResult.injuryOccurred) {
    newsList.push({
      id: 'news_' + Date.now() + '_inj',
      dateStr,
      category: 'injury',
      headline: `PREOCUPAÇÃO NO CLUBE: ${player.shirtName.toUpperCase()} SOFRE LESÃO E DEVE FICAR FORA POR ${matchResult.injuryOccurred.weeks} SEMANAS`,
      snippet: `O departamento médico confirmou ${matchResult.injuryOccurred.name}. O jogador iniciará fisioterapia intensiva para retornar o mais rápido possível.`
    });
  } else if (isWin) {
    if (matchResult.playerGoals >= 2) {
      newsList.push({
        id: 'news_' + Date.now() + '_w1',
        dateStr,
        category: 'match',
        headline: `VITÓRIA E SHOW DO CRAQUE! ${player.shirtName.toUpperCase()} BRILHA COM ${matchResult.playerGoals} GOLS (${userGoals}x${oppGoals})`,
        snippet: `Com atuação impecável, o camisa ${player.shirtNumber} comandou a vitória da equipe por ${userGoals} a ${oppGoals} e saiu ovacionado pela torcida.`
      });
    } else if (matchResult.playerGoals === 1) {
      newsList.push({
        id: 'news_' + Date.now() + '_w2',
        dateStr,
        category: 'match',
        headline: `VITÓRIA IMPORTANTE! ${player.shirtName.toUpperCase()} MARCA E AJUDA A GARANTIR O TRIUNFO (${userGoals}x${oppGoals})`,
        snippet: `O jogador balançou a rede na vitória por ${userGoals} a ${oppGoals}. O treinador destacou a dedicação tática da equipe na coletiva pós-jogo.`
      });
    } else {
      newsList.push({
        id: 'news_' + Date.now() + '_w3',
        dateStr,
        category: 'match',
        headline: `VITÓRIA CONFIRMADA! EQUIPE VENCE POR ${userGoals} A ${oppGoals} COM BOA PARTICIPAÇÃO DE ${player.shirtName.toUpperCase()}`,
        snippet: `Três pontos garantidos na conta! ${player.shirtName} cumpriu bem seu papel tático durante a vitória por ${userGoals} a ${oppGoals}.`
      });
    }
  } else if (isDraw) {
    if (matchResult.playerGoals >= 1) {
      newsList.push({
        id: 'news_' + Date.now() + '_d1',
        dateStr,
        category: 'match',
        headline: `EMPATE MOVIMENTADO! ${player.shirtName.toUpperCase()} DEIXA SUA MARCA NO EMPATE EM ${userGoals} A ${oppGoals}`,
        snippet: `Apesar do gol de ${player.shirtName}, o confronto terminou empatado em ${userGoals} a ${oppGoals}, somando 1 ponto na competição.`
      });
    } else {
      newsList.push({
        id: 'news_' + Date.now() + '_d2',
        dateStr,
        category: 'match',
        headline: `TUDO IGUAL! PARTIDA TERMINA EMPATADA EM ${userGoals} A ${oppGoals}`,
        snippet: `Duelo equilibrado do início ao fim. As equipes empataram por ${userGoals} a ${oppGoals} e dividiram os pontos na rodada.`
      });
    }
  } else {
    // Loss (Derrota)
    if (matchResult.playerGoals >= 1) {
      newsList.push({
        id: 'news_' + Date.now() + '_l1',
        dateStr,
        category: 'match',
        headline: `DERROTA APESAR DO GOL: ${player.shirtName.toUpperCase()} MARCA, MAS EQUIPE É SUPERADA POR ${oppGoals} A ${userGoals}`,
        snippet: `${player.shirtName} balançou as redes, mas o time acabou derrotado pelo placar de ${oppGoals} a ${userGoals} e já pensa na reabilitação.`
      });
    } else {
      newsList.push({
        id: 'news_' + Date.now() + '_l2',
        dateStr,
        category: 'match',
        headline: `TROPEÇO NA RODADA: EQUIPE SOFRE DERROTA POR ${oppGoals} A ${userGoals}`,
        snippet: `Não foi o dia esperado. Após a derrota por ${oppGoals} a ${userGoals}, ${player.shirtName} e o elenco trabalharão forte para buscar a vitória no próximo jogo.`
      });
    }
  }

  // 2. Social Media (FutFeed) — also 100% accurate to Win, Draw, or Loss
  if (isWin) {
    socialList.push({
      id: 'soc_' + Date.now() + '_1',
      authorHandle: '@torcedor_fiel',
      authorName: 'Gabriel S.',
      authorAvatar: '⚽',
      content: `VITÓRIA GIGANTE (${userGoals}x${oppGoals})! O que o ${player.shirtName} jogou hoje foi demais! +3 pontos na conta! 🔥👏`,
      likes: Math.floor(120 + Math.random() * 800),
      retweets: Math.floor(30 + Math.random() * 200),
      sentiment: 'positive',
      timestamp: 'Há 12 min'
    });
  } else if (isDraw) {
    socialList.push({
      id: 'soc_' + Date.now() + '_2',
      authorHandle: '@central_do_futebol',
      authorName: 'Central da Rodada',
      authorAvatar: '⚖️',
      content: `Fim de jogo: empate em ${userGoals}x${oppGoals}. Jogo muito disputado, ${player.shirtName} buscou o jogo até o fim. Seguimos somando +1 ponto.`,
      likes: Math.floor(65 + Math.random() * 320),
      retweets: Math.floor(12 + Math.random() * 70),
      sentiment: 'neutral',
      timestamp: 'Há 15 min'
    });
  } else {
    socialList.push({
      id: 'soc_' + Date.now() + '_3',
      authorHandle: '@corneta_alvinegro',
      authorName: 'Mestre da Corneta',
      authorAvatar: '📢',
      content: `Derrota dura hoje por ${oppGoals}x${userGoals}. O time precisa reagir rápido na próxima rodada!`,
      likes: Math.floor(95 + Math.random() * 400),
      retweets: Math.floor(20 + Math.random() * 90),
      sentiment: 'negative',
      timestamp: 'Há 18 min'
    });
  }

  return { news: newsList, socialPosts: socialList };
}

export function generateMatchNews(
  matchResult: MatchSimulationResult,
  player: PlayerProfile,
  userClub: Club,
  opponentClub: Club,
  competitionName: string,
  year: number,
  week: number
): NewsItem {
  const dateStr = `Temporada ${year} • Rodada ${week}`;
  const userGoals = matchResult.isPlayerHome ? matchResult.homeScore : matchResult.awayScore;
  const oppGoals = matchResult.isPlayerHome ? matchResult.awayScore : matchResult.homeScore;
  const isWin = userGoals > oppGoals;
  const isDraw = userGoals === oppGoals;

  if (matchResult.injuryOccurred) {
    return {
      id: 'news_' + Date.now(),
      dateStr,
      category: 'injury',
      headline: `ALERTA NO DEPARTAMENTO MÉDICO: ${player.shirtName.toUpperCase()} SOFRE LESÃO`,
      snippet: `Após dividida diante do ${opponentClub.name}, os exames confirmaram ${matchResult.injuryOccurred.name}. O atleta ficará em recuperação por ${matchResult.injuryOccurred.weeks} semanas.`
    };
  }

  if (isWin) {
    if (matchResult.playerGoals >= 1) {
      return {
        id: 'news_' + Date.now(),
        dateStr,
        category: 'match',
        headline: `VITÓRIA DO ${userClub.name.toUpperCase()}! ${player.shirtName.toUpperCase()} MARCA E COMANDA TRIUNFO POR ${userGoals} A ${oppGoals} SOBRE O ${opponentClub.name.toUpperCase()}`,
        snippet: `Com grande atuação na ${competitionName}, ${player.shirtName} balançou as redes, recebeu nota ${matchResult.playerRating.toFixed(1)} e garantiu a vitória do ${userClub.name}!`
      };
    }
    return {
      id: 'news_' + Date.now(),
      dateStr,
      category: 'match',
      headline: `VITÓRIA! ${userClub.name.toUpperCase()} SUPERA O ${opponentClub.name.toUpperCase()} POR ${userGoals} A ${oppGoals} NA ${competitionName.toUpperCase()}`,
      snippet: `Com participação segura de ${player.shirtName} (nota ${matchResult.playerRating.toFixed(1)}), o ${userClub.name} confirmou a vitória por ${userGoals} a ${oppGoals}.`
    };
  }

  if (isDraw) {
    if (matchResult.playerGoals >= 1) {
      return {
        id: 'news_' + Date.now(),
        dateStr,
        category: 'match',
        headline: `EMPATE COM GOL DE ${player.shirtName.toUpperCase()}: ${userClub.name.toUpperCase()} E ${opponentClub.name.toUpperCase()} FICAM NO ${userGoals} A ${oppGoals}`,
        snippet: `Em duelo válido pela ${competitionName}, ${player.shirtName} deixou sua marca, e a partida terminou empatada em ${userGoals} a ${oppGoals}.`
      };
    }
    return {
      id: 'news_' + Date.now(),
      dateStr,
      category: 'match',
      headline: `TUDO IGUAL! ${userClub.name.toUpperCase()} EMPATA EM ${userGoals} A ${oppGoals} COM O ${opponentClub.name.toUpperCase()}`,
      snippet: `Em confronto equilibrado pela ${competitionName}, ${userClub.name} e ${opponentClub.name} empataram por ${userGoals} a ${oppGoals}. ${player.shirtName} atuou os 90 minutos.`
    };
  }

  // Loss (Derrota)
  if (matchResult.playerGoals >= 1) {
    return {
      id: 'news_' + Date.now(),
      dateStr,
      category: 'match',
      headline: `DERROTA APESAR DO GOL: ${player.shirtName.toUpperCase()} MARCA, MAS ${userClub.name.toUpperCase()} PERDE POR ${oppGoals} A ${userGoals} PARA O ${opponentClub.name.toUpperCase()}`,
      snippet: `Mesmo com gol de ${player.shirtName}, o ${userClub.name} foi superado pelo ${opponentClub.name} por ${oppGoals} a ${userGoals} na ${competitionName}.`
    };
  }

  return {
    id: 'news_' + Date.now(),
    dateStr,
    category: 'match',
    headline: `DERROTA: ${userClub.name.toUpperCase()} É SUPERADO PELO ${opponentClub.name.toUpperCase()} POR ${oppGoals} A ${userGoals}`,
    snippet: `O ${userClub.name} acabou derrotado por ${oppGoals} a ${userGoals} diante do ${opponentClub.name} pela ${competitionName} e buscará a recuperação na próxima rodada.`
  };
}

export function generateSocialMediaReactions(
  matchResult: MatchSimulationResult,
  player: PlayerProfile,
  _userClub: Club
): SocialPost[] {
  const result = generatePostMatchNews(player, matchResult, 2026);
  return result.socialPosts;
}

export function generateTransferRumors(player: PlayerProfile): NewsItem[] {
  return [
    {
      id: 'rumor_' + Date.now(),
      dateStr: 'Mercado da Bola',
      category: 'transfer',
      headline: `RUMOR: GRANDES DA EUROPA ENVIAM OLHEIROS PARA OBSERVAR ${player.shirtName.toUpperCase()}`,
      snippet: `Representantes e scouts de clubes de topo confirmaram presença nas próximas rodadas para avaliar o potencial do atleta.`
    }
  ];
}
