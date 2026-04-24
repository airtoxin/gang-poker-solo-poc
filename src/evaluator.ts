import type { Card, Rank } from "./game.ts";

export const HAND_CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

export type HandCategory = (typeof HAND_CATEGORY)[keyof typeof HAND_CATEGORY];

export type HandScore = {
  readonly category: HandCategory;
  readonly tiebreakers: readonly number[];
};

const toValue = (r: Rank): number => (r === 1 ? 14 : r);

const lexCompare = (a: readonly number[], b: readonly number[]): number => {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
};

export const compareHands = (a: HandScore, b: HandScore): number => {
  if (a.category !== b.category) return a.category - b.category;
  return lexCompare(a.tiebreakers, b.tiebreakers);
};

const evaluate5 = (cards: readonly Card[]): HandScore => {
  const values = cards.map((c) => toValue(c.rank)).sort((x, y) => y - x);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;
  const uniq = new Set(values);
  if (uniq.size === 5 && values[0]! - values[4]! === 4) {
    isStraight = true;
    straightHigh = values[0]!;
  } else if (values.join(",") === "14,5,4,3,2") {
    isStraight = true;
    straightHigh = 5;
  }

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const byCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const p0 = byCount[0]!;
  const p1 = byCount[1];

  if (isStraight && isFlush)
    return { category: HAND_CATEGORY.STRAIGHT_FLUSH, tiebreakers: [straightHigh] };
  if (p0[1] === 4) return { category: HAND_CATEGORY.QUADS, tiebreakers: [p0[0], p1![0]] };
  if (p0[1] === 3 && p1?.[1] === 2)
    return { category: HAND_CATEGORY.FULL_HOUSE, tiebreakers: [p0[0], p1[0]] };
  if (isFlush) return { category: HAND_CATEGORY.FLUSH, tiebreakers: values };
  if (isStraight) return { category: HAND_CATEGORY.STRAIGHT, tiebreakers: [straightHigh] };
  if (p0[1] === 3)
    return {
      category: HAND_CATEGORY.TRIPS,
      tiebreakers: [p0[0], byCount[1]![0], byCount[2]![0]],
    };
  if (p0[1] === 2 && p1?.[1] === 2)
    return {
      category: HAND_CATEGORY.TWO_PAIR,
      tiebreakers: [p0[0], p1[0], byCount[2]![0]],
    };
  if (p0[1] === 2)
    return {
      category: HAND_CATEGORY.PAIR,
      tiebreakers: [p0[0], byCount[1]![0], byCount[2]![0], byCount[3]![0]],
    };
  return { category: HAND_CATEGORY.HIGH_CARD, tiebreakers: values };
};

const bestOf = (cards: readonly Card[]): HandScore => {
  if (cards.length === 5) return evaluate5(cards);
  let best: HandScore | null = null;
  const combo: Card[] = [];
  const pick = (start: number): void => {
    if (combo.length === 5) {
      const score = evaluate5(combo);
      if (best == null || compareHands(score, best) > 0) best = score;
      return;
    }
    const need = 5 - combo.length;
    for (let i = start; i <= cards.length - need; i++) {
      combo.push(cards[i]!);
      pick(i + 1);
      combo.pop();
    }
  };
  pick(0);
  return best!;
};

// 0-4 card inputs: detect pair/trips/quads/two-pair with kickers. Straights,
// flushes, full houses and straight flushes require 5 cards so are never
// possible here. Kickers use whatever cards remain.
const evaluatePartial = (cards: readonly Card[]): HandScore => {
  const values = cards.map((c) => toValue(c.rank)).sort((a, b) => b - a);
  if (values.length === 0) return { category: HAND_CATEGORY.HIGH_CARD, tiebreakers: [] };

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const byCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const primary = byCount[0]!;
  const kickers = byCount.slice(1).map((e) => e[0]);

  if (primary[1] === 4)
    return { category: HAND_CATEGORY.QUADS, tiebreakers: [primary[0], ...kickers] };
  if (primary[1] === 3)
    return { category: HAND_CATEGORY.TRIPS, tiebreakers: [primary[0], ...kickers] };
  if (primary[1] === 2 && byCount[1]?.[1] === 2) {
    const extra = byCount.slice(2).map((e) => e[0]);
    return {
      category: HAND_CATEGORY.TWO_PAIR,
      tiebreakers: [primary[0], byCount[1]![0], ...extra],
    };
  }
  if (primary[1] === 2)
    return { category: HAND_CATEGORY.PAIR, tiebreakers: [primary[0], ...kickers] };
  return { category: HAND_CATEGORY.HIGH_CARD, tiebreakers: values };
};

export const evaluateHand = (cards: readonly Card[]): HandScore => {
  if (cards.length < 5) return evaluatePartial(cards);
  return bestOf(cards);
};
