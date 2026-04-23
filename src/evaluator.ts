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

const toValue = (r: Rank): number => (r === 1 ? 14 : r);

export const compareHands = (a: readonly number[], b: readonly number[]): number => {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
};

const evaluate5 = (cards: readonly Card[]): number[] => {
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

  if (isStraight && isFlush) return [HAND_CATEGORY.STRAIGHT_FLUSH, straightHigh];
  if (p0[1] === 4) return [HAND_CATEGORY.QUADS, p0[0], p1![0]];
  if (p0[1] === 3 && p1?.[1] === 2) return [HAND_CATEGORY.FULL_HOUSE, p0[0], p1[0]];
  if (isFlush) return [HAND_CATEGORY.FLUSH, ...values];
  if (isStraight) return [HAND_CATEGORY.STRAIGHT, straightHigh];
  if (p0[1] === 3) return [HAND_CATEGORY.TRIPS, p0[0], byCount[1]![0], byCount[2]![0]];
  if (p0[1] === 2 && p1?.[1] === 2) return [HAND_CATEGORY.TWO_PAIR, p0[0], p1[0], byCount[2]![0]];
  if (p0[1] === 2)
    return [HAND_CATEGORY.PAIR, p0[0], byCount[1]![0], byCount[2]![0], byCount[3]![0]];
  return [HAND_CATEGORY.HIGH_CARD, ...values];
};

const bestOf = (cards: readonly Card[]): number[] => {
  if (cards.length === 5) return evaluate5(cards);
  let best: number[] | null = null;
  const combo: Card[] = [];
  const pick = (start: number): void => {
    if (combo.length === 5) {
      const score = evaluate5(combo);
      if (best == null || compareHands(score, best) > 0) best = [...score];
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

const evaluatePartial = (cards: readonly Card[]): number[] => {
  const values = cards.map((c) => toValue(c.rank)).sort((a, b) => b - a);
  if (values.length >= 2 && values[0] === values[1]) {
    return [HAND_CATEGORY.PAIR, values[0]!];
  }
  return [HAND_CATEGORY.HIGH_CARD, ...values];
};

export const evaluateHand = (cards: readonly Card[]): number[] => {
  if (cards.length < 5) return evaluatePartial(cards);
  return bestOf(cards);
};
