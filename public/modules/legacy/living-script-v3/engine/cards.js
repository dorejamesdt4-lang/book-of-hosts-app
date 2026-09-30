// ====================================================================
// ENGINE · PLAYING CARDS — a standard 52-card deck and the hand values
// for Twenty-One & Trouble. Written fresh; pure (no DOM).
//
//   Aces count 1 or 11, whichever is best without going over 21.
//   Picture cards (J, Q, K) count 10; number cards their face value.
// ====================================================================

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function newDeck(decks = 1) {
  const cards = [];
  for (let d = 0; d < decks; d++) SUITS.forEach((suit) => RANKS.forEach((rank) => cards.push({ rank, suit })));
  return cards;
}

// Fisher–Yates, with the Stage's rng so every screen sees the same deal.
export function shuffle(cards, rng = Math.random) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardValue(card) {
  if (card.rank === 'A') return 1;
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
  return Number(card.rank);
}

// The best total: one ace counts 11 if that doesn't bust the hand.
export function handTotal(cards) {
  let total = 0;
  let aces = 0;
  cards.forEach((c) => { total += cardValue(c); if (c.rank === 'A') aces += 1; });
  return aces && total + 10 <= 21 ? total + 10 : total;
}

// Twenty-one with the first two cards.
export function isNatural(cards) {
  return cards.length === 2 && handTotal(cards) === 21;
}

export const FIVE_CARDS = 5;
export function isFiveCard(cards) {
  return cards.length >= FIVE_CARDS && handTotal(cards) <= 21;
}

// A guest's standing hand against the Keeper's (neither bust):
// 'win' or 'lose'. Higher total wins. On the same total a 5-card hand
// beats a hand of fewer cards; every other draw goes to the Keeper.
export function compare(guest, keeper) {
  const g = handTotal(guest);
  const k = handTotal(keeper);
  if (g !== k) return g > k ? 'win' : 'lose';
  return isFiveCard(guest) && !isFiveCard(keeper) ? 'win' : 'lose';
}
