import { PlayerProfile, Club, TransferOffer, SquadRole } from '../types';
import { INITIAL_CLUBS } from '../data/database';
import { calculateMarketValue } from '../utils/calculator';

export function checkForTransferOffers(
  player: PlayerProfile,
  currentClub: Club,
  currentWeek: number
): TransferOffer[] {
  // Transfer windows: Summer (weeks 1-8) and Winter (weeks 24-28)
  const isTransferWindow = (currentWeek >= 1 && currentWeek <= 8) || (currentWeek >= 24 && currentWeek <= 28);
  const offers: TransferOffer[] = [];

  const marketValue = calculateMarketValue(
    player.ovr,
    player.potential,
    player.age,
    player.contract.yearsRemaining
  );

  // 1. Check for contract renewal from current club
  if (player.contract.yearsRemaining <= 2 && player.coachTrust >= 50 && Math.random() < 0.4) {
    const renewalWage = Math.round(player.contract.weeklyWage * (1.2 + (player.ovr >= 80 ? 0.25 : 0.1)));
    offers.push({
      id: 'offer_renew_' + Date.now(),
      clubId: currentClub.id,
      clubName: currentClub.name,
      clubCountry: currentClub.country,
      clubPrestige: currentClub.prestige,
      type: 'renewal',
      transferFee: 0,
      offeredWage: renewalWage,
      bonusPerGoal: Math.round(renewalWage * 0.1),
      bonusPerCleanSheet: Math.round(renewalWage * 0.08),
      contractYears: 4,
      offeredRole: player.ovr >= 82 ? 'Estrela' : player.ovr >= 78 ? 'Titular' : 'Rotação',
      releaseClause: Math.round(marketValue * 1.8),
      deadlineWeek: currentWeek + 3
    });
  }

  // 2. Incoming external offers during transfer windows or if highly rated
  if (isTransferWindow || player.ovr >= 82) {
    // Filter clubs eligible for player's OVR and prestige
    const potentialSuitorClubs = INITIAL_CLUBS.filter(c => {
      if (c.id === currentClub.id) return false;
      // Club average rating
      const clubAvg = (c.attackRating + c.midfieldRating + c.defenseRating) / 3;
      // Club should fit or be slightly above/below player
      const ovrDiff = player.ovr - clubAvg;
      return ovrDiff >= -8 && ovrDiff <= 10 && c.budget >= marketValue * 0.7;
    });

    if (potentialSuitorClubs.length > 0 && (Math.random() < 0.35 + (player.agent.reputation / 200))) {
      // Pick 1 or 2 interested clubs
      const suitor = potentialSuitorClubs[Math.floor(Math.random() * potentialSuitorClubs.length)];
      const isBiggerClub = suitor.prestige >= currentClub.prestige;
      
      const isLoan = player.age <= 21 && player.ovr < 75 && Math.random() < 0.5;
      const transferFee = isLoan ? 0 : Math.round(marketValue * (0.9 + Math.random() * 0.35));

      // Wage calculation
      const wageMultiplier = isBiggerClub ? 1.4 + (player.agent.reputation * 0.005) : 1.1;
      const offeredWage = Math.round(player.contract.weeklyWage * wageMultiplier);

      let offeredRole: SquadRole = 'Rotação';
      const suitorAvg = (suitor.attackRating + suitor.midfieldRating + suitor.defenseRating) / 3;
      if (player.ovr > suitorAvg + 3) offeredRole = 'Estrela';
      else if (player.ovr >= suitorAvg - 2) offeredRole = 'Titular';
      else if (player.age <= 20) offeredRole = 'Promessa';
      else offeredRole = 'Reserva';

      offers.push({
        id: 'offer_' + Date.now() + '_' + suitor.id,
        clubId: suitor.id,
        clubName: suitor.name,
        clubCountry: suitor.country,
        clubPrestige: suitor.prestige,
        type: isLoan ? 'loan' : 'purchase',
        transferFee,
        offeredWage,
        bonusPerGoal: Math.round(offeredWage * 0.08),
        bonusPerCleanSheet: Math.round(offeredWage * 0.06),
        contractYears: isLoan ? 1 : Math.floor(3 + Math.random() * 3),
        offeredRole,
        releaseClause: Math.round(marketValue * 2.2),
        deadlineWeek: currentWeek + 2
      });
    }
  }

  return offers;
}

export function negotiateCounterOffer(
  originalOffer: TransferOffer,
  requestedWage: number,
  requestedYears: number,
  requestedRole: SquadRole,
  agentReputation: number
): { accepted: boolean; finalOffer?: TransferOffer; refusalReason?: string } {
  // Negotiation tolerance algorithm
  const wageDiffPercent = (requestedWage - originalOffer.offeredWage) / originalOffer.offeredWage;
  const agentPower = agentReputation / 100; // 0 to 1

  // Acceptable limits: club allows up to +25% + (agentPower * 25%)
  const maxAllowedWageIncrease = 0.20 + (agentPower * 0.25);

  if (wageDiffPercent > maxAllowedWageIncrease) {
    return {
      accepted: false,
      refusalReason: `A diretoria de ${originalOffer.clubName} considerou o pedido salarial fora da realidade orçamentária do clube.`
    };
  }

  // Club agrees or settles
  const agreedWage = Math.round(Math.min(requestedWage, originalOffer.offeredWage * (1 + maxAllowedWageIncrease)));

  const finalOffer: TransferOffer = {
    ...originalOffer,
    offeredWage: agreedWage,
    contractYears: requestedYears,
    offeredRole: requestedRole,
    bonusPerGoal: Math.round(agreedWage * 0.09),
    bonusPerCleanSheet: Math.round(agreedWage * 0.07)
  };

  return {
    accepted: true,
    finalOffer
  };
}

export function generateTransferOffers(player: PlayerProfile, allClubs: Club[]): TransferOffer[] {
  const currentClub = allClubs.find(c => c.id === player.contract.clubId) || allClubs[0];
  return checkForTransferOffers(player, currentClub, 1);
}
