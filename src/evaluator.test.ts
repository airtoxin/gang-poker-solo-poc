import { describe, expect, test } from "vite-plus/test";
import { compareHands, evaluateHand, HAND_CATEGORY, type HandScore } from "./evaluator.ts";
import type { Card, Rank, Suit } from "./game.ts";

const SUIT_MAP: Record<string, Suit> = { S: "♠", H: "♥", D: "♦", C: "♣" };

const rankFromCode = (code: string): Rank => {
  if (code === "A") return 1;
  if (code === "K") return 13;
  if (code === "Q") return 12;
  if (code === "J") return 11;
  if (code === "T") return 10;
  const n = Number(code);
  if (!Number.isInteger(n) || n < 2 || n > 9) throw new Error(`invalid rank: ${code}`);
  return n as Rank;
};

const card = (code: string): Card => {
  const suit = SUIT_MAP[code.slice(-1)];
  if (!suit) throw new Error(`invalid suit: ${code}`);
  return { suit, rank: rankFromCode(code.slice(0, -1)) };
};

const h = (spec: string): Card[] => spec.split(" ").map(card);

const evalSpec = (spec: string): HandScore => evaluateHand(h(spec));

const score = (category: number, tiebreakers: readonly number[]): HandScore => ({
  category: category as HandScore["category"],
  tiebreakers,
});

describe("evaluateHand: 5-card classifications", () => {
  test("royal flush is a straight flush with high=14", () => {
    expect(evalSpec("AH KH QH JH TH")).toEqual(score(HAND_CATEGORY.STRAIGHT_FLUSH, [14]));
  });

  test("king-high straight flush", () => {
    expect(evalSpec("KS QS JS TS 9S")).toEqual(score(HAND_CATEGORY.STRAIGHT_FLUSH, [13]));
  });

  test("wheel (A-2-3-4-5) straight flush has high=5, not 14", () => {
    expect(evalSpec("AH 2H 3H 4H 5H")).toEqual(score(HAND_CATEGORY.STRAIGHT_FLUSH, [5]));
  });

  test("four of a kind: [quad, kicker]", () => {
    expect(evalSpec("9H 9D 9C 9S 2C")).toEqual(score(HAND_CATEGORY.QUADS, [9, 2]));
  });

  test("four of a kind with ace kicker", () => {
    expect(evalSpec("7H 7D 7C 7S AC")).toEqual(score(HAND_CATEGORY.QUADS, [7, 14]));
  });

  test("full house: [trips, pair]", () => {
    expect(evalSpec("KH KD KC 3S 3H")).toEqual(score(HAND_CATEGORY.FULL_HOUSE, [13, 3]));
  });

  test("flush: [...values desc]", () => {
    expect(evalSpec("AH QH 9H 5H 2H")).toEqual(score(HAND_CATEGORY.FLUSH, [14, 12, 9, 5, 2]));
  });

  test("ace-high broadway straight", () => {
    expect(evalSpec("AH KD QC JS TH")).toEqual(score(HAND_CATEGORY.STRAIGHT, [14]));
  });

  test("wheel straight has high=5, not 14", () => {
    expect(evalSpec("AH 2D 3C 4S 5H")).toEqual(score(HAND_CATEGORY.STRAIGHT, [5]));
  });

  test("middle straight (10-high)", () => {
    expect(evalSpec("TH 9D 8C 7S 6H")).toEqual(score(HAND_CATEGORY.STRAIGHT, [10]));
  });

  test("six-high straight (smallest non-wheel)", () => {
    expect(evalSpec("6H 5D 4C 3S 2H")).toEqual(score(HAND_CATEGORY.STRAIGHT, [6]));
  });

  test("three of a kind: [trip, kickers desc]", () => {
    expect(evalSpec("7H 7D 7C KS 2H")).toEqual(score(HAND_CATEGORY.TRIPS, [7, 13, 2]));
  });

  test("two pair: [highPair, lowPair, kicker]", () => {
    expect(evalSpec("KH KD 5C 5S 2H")).toEqual(score(HAND_CATEGORY.TWO_PAIR, [13, 5, 2]));
  });

  test("one pair: [pair, kickers desc]", () => {
    expect(evalSpec("AH AD KC 7S 2H")).toEqual(score(HAND_CATEGORY.PAIR, [14, 13, 7, 2]));
  });

  test("pair of twos with full kicker stack", () => {
    expect(evalSpec("2H 2D AC KS QC")).toEqual(score(HAND_CATEGORY.PAIR, [2, 14, 13, 12]));
  });

  test("high card: [...values desc]", () => {
    expect(evalSpec("AH KD 9C 5S 2H")).toEqual(score(HAND_CATEGORY.HIGH_CARD, [14, 13, 9, 5, 2]));
  });

  test("ace is high for high card (not 1)", () => {
    expect(evalSpec("AH 7D 5C 3S 2H").tiebreakers[0]).toBe(14);
  });
});

describe("evaluateHand: near-miss detection", () => {
  test("four cards of a suit + one off-suit is not a flush", () => {
    expect(evalSpec("AH KH QH JH 2D").category).not.toBe(HAND_CATEGORY.FLUSH);
  });

  test("gutshot (T-9-8-6-2) is not a straight", () => {
    expect(evalSpec("TH 9D 8C 6S 2H").category).not.toBe(HAND_CATEGORY.STRAIGHT);
  });

  test("A-2-3-4-6 is not a wheel (missing 5)", () => {
    expect(evalSpec("AH 2D 3C 4S 6H").category).not.toBe(HAND_CATEGORY.STRAIGHT);
  });

  test("K-Q-J-T-2 is not a straight (broadway needs A)", () => {
    expect(evalSpec("KH QD JC TS 2H").category).not.toBe(HAND_CATEGORY.STRAIGHT);
  });

  test("pair-looking ranks with suited spread is a pair, not flush", () => {
    expect(evalSpec("AH AD 9H 5H 2H").category).toBe(HAND_CATEGORY.PAIR);
  });

  test("straight flush is recognized as straight flush, not just flush", () => {
    expect(evalSpec("9H 8H 7H 6H 5H").category).toBe(HAND_CATEGORY.STRAIGHT_FLUSH);
  });

  test("straight flush is recognized as straight flush, not just straight", () => {
    expect(evalSpec("9H 8H 7H 6H 5H").category).not.toBe(HAND_CATEGORY.STRAIGHT);
  });
});

describe("evaluateHand: category priority (poker hand ranking)", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["straight flush beats four of a kind", "9S 8S 7S 6S 5S", "AH AD AC AS 2H"],
    ["four of a kind beats full house", "2H 2D 2C 2S KH", "AH AD AC KS KH"],
    ["full house beats flush", "2H 2D 2C 3S 3H", "AH QH 9H 5H 2H"],
    ["flush beats straight", "2H 5H 9H JH KH", "6H 5D 4C 3S 2H"],
    ["straight beats three of a kind", "6H 5D 4C 3S 2H", "AH AD AC KS QH"],
    ["three of a kind beats two pair", "7H 7D 7C 2S 3H", "KH KD QC QS 2H"],
    ["two pair beats one pair", "2H 2D 3C 3S 4H", "AH AD KC QS JH"],
    ["one pair beats high card", "2H 2D 3C 4S 5H", "AH KD QC JS 9H"],
  ];

  for (const [label, higher, lower] of cases) {
    test(label, () => {
      expect(compareHands(evalSpec(higher), evalSpec(lower))).toBeGreaterThan(0);
    });
  }
});

describe("evaluateHand: intra-category tiebreakers", () => {
  test("higher pair beats lower pair", () => {
    expect(compareHands(evalSpec("AH AD 2C 3S 5H"), evalSpec("KH KD 2C 3S 5H"))).toBeGreaterThan(0);
  });

  test("same pair: higher top kicker wins", () => {
    expect(compareHands(evalSpec("AH AD KC 3S 2H"), evalSpec("AH AD QC 3S 2H"))).toBeGreaterThan(0);
  });

  test("same pair and top kicker: middle kicker decides", () => {
    expect(compareHands(evalSpec("AH AD KC QS 2H"), evalSpec("AH AD KC JS 2H"))).toBeGreaterThan(0);
  });

  test("same pair and top two kickers: lowest kicker decides", () => {
    expect(compareHands(evalSpec("AH AD KC QS 5H"), evalSpec("AH AD KC QS 2H"))).toBeGreaterThan(0);
  });

  test("two pair: higher top pair wins regardless of other pair", () => {
    expect(compareHands(evalSpec("AH AD 2C 2S 5H"), evalSpec("KH KD QC QS 5H"))).toBeGreaterThan(0);
  });

  test("two pair: same top pair, higher bottom pair decides", () => {
    expect(compareHands(evalSpec("AH AD KC KS 5H"), evalSpec("AH AD QC QS 5H"))).toBeGreaterThan(0);
  });

  test("two pair: same pairs, higher kicker decides", () => {
    expect(compareHands(evalSpec("AH AD KC KS 6H"), evalSpec("AH AD KC KS 5H"))).toBeGreaterThan(0);
  });

  test("three of a kind: higher set wins even with worse kickers", () => {
    expect(compareHands(evalSpec("AH AD AC 3S 2H"), evalSpec("KH KD KC QS JH"))).toBeGreaterThan(0);
  });

  test("three of a kind: same set, higher kicker wins", () => {
    expect(compareHands(evalSpec("KH KD KC AS 2H"), evalSpec("KH KD KC QS 2H"))).toBeGreaterThan(0);
  });

  test("straight: higher top card wins", () => {
    expect(compareHands(evalSpec("TH 9D 8C 7S 6H"), evalSpec("9H 8D 7C 6S 5H"))).toBeGreaterThan(0);
  });

  test("six-high straight beats wheel (A-2-3-4-5)", () => {
    expect(compareHands(evalSpec("6H 5D 4C 3S 2H"), evalSpec("AH 5D 4C 3S 2H"))).toBeGreaterThan(0);
  });

  test("flush: higher top card wins", () => {
    expect(compareHands(evalSpec("AH 7H 5H 3H 2H"), evalSpec("KH 7H 5H 3H 2H"))).toBeGreaterThan(0);
  });

  test("flush: same top, higher second decides", () => {
    expect(compareHands(evalSpec("AH 7H 5H 3H 2H"), evalSpec("AH 6H 5H 3H 2H"))).toBeGreaterThan(0);
  });

  test("full house: higher trips wins regardless of pair", () => {
    expect(compareHands(evalSpec("AH AD AC 2S 2H"), evalSpec("KH KD KC AS AH"))).toBeGreaterThan(0);
  });

  test("full house: same trips, higher pair decides", () => {
    expect(compareHands(evalSpec("AH AD AC KS KH"), evalSpec("AH AD AC QS QH"))).toBeGreaterThan(0);
  });

  test("four of a kind: higher quads wins", () => {
    expect(compareHands(evalSpec("AH AD AC AS 2H"), evalSpec("KH KD KC KS AH"))).toBeGreaterThan(0);
  });

  test("four of a kind: same quads, higher kicker decides", () => {
    expect(compareHands(evalSpec("KH KD KC KS AH"), evalSpec("KH KD KC KS QH"))).toBeGreaterThan(0);
  });

  test("straight flush: higher top wins", () => {
    expect(compareHands(evalSpec("AH KH QH JH TH"), evalSpec("KS QS JS TS 9S"))).toBeGreaterThan(0);
  });

  test("high card: lex order on descending ranks", () => {
    expect(compareHands(evalSpec("AH KD QC JS 9H"), evalSpec("AH KD QC JS 8H"))).toBeGreaterThan(0);
  });

  test("same hand different suits → equal score", () => {
    expect(compareHands(evalSpec("AS KH QD JC 9S"), evalSpec("AC KD QH JS 9C"))).toBe(0);
  });

  test("same wheel different suits → equal score", () => {
    expect(compareHands(evalSpec("AH 2D 3C 4S 5H"), evalSpec("AS 2H 3D 4C 5S"))).toBe(0);
  });
});

describe("evaluateHand: best 5 out of 6 or 7", () => {
  test("finds royal flush embedded in 7 cards", () => {
    expect(evalSpec("AH KH QH JH TH 2S 3D")).toEqual(score(HAND_CATEGORY.STRAIGHT_FLUSH, [14]));
  });

  test("prefers wheel straight flush over pair when both available", () => {
    expect(evalSpec("AH 2H 3H 4H 5H AD 2D")).toEqual(score(HAND_CATEGORY.STRAIGHT_FLUSH, [5]));
  });

  test("prefers quads over full house when quads present", () => {
    const s = evalSpec("AH AD AC AS KH KD KC");
    expect(s.category).toBe(HAND_CATEGORY.QUADS);
    expect(s.tiebreakers[0]).toBe(14);
    expect(s.tiebreakers[1]).toBe(13);
  });

  test("prefers full house over trips-and-two-pair mix", () => {
    expect(evalSpec("AH AD AC KS KH 2C 3D")).toEqual(score(HAND_CATEGORY.FULL_HOUSE, [14, 13]));
  });

  test("prefers flush over straight when both available in 7", () => {
    expect(evalSpec("AH KH 9H 5H 2H 8S 7S").category).toBe(HAND_CATEGORY.FLUSH);
  });

  test("picks best 3 kickers for pair from 7 cards", () => {
    expect(evalSpec("7H 7D AS KH QC 5S 2D")).toEqual(score(HAND_CATEGORY.PAIR, [7, 14, 13, 12]));
  });

  test("6-card best hand: two pair with correct kicker", () => {
    expect(evalSpec("AH AD KC 5S 5H 2D")).toEqual(score(HAND_CATEGORY.TWO_PAIR, [14, 5, 13]));
  });

  test("does not falsely detect straight that would cross the wheel boundary", () => {
    expect(evalSpec("KH QH JH TH 9H 2S 3D")).toEqual(score(HAND_CATEGORY.STRAIGHT_FLUSH, [13]));
  });
});

describe("compareHands: semantics", () => {
  test("equal scores → 0", () => {
    expect(
      compareHands(score(HAND_CATEGORY.PAIR, [14, 3]), score(HAND_CATEGORY.PAIR, [14, 3])),
    ).toBe(0);
  });

  test("higher category wins regardless of tiebreakers", () => {
    expect(
      compareHands(
        score(HAND_CATEGORY.PAIR, [2]),
        score(HAND_CATEGORY.HIGH_CARD, [14, 13, 12, 11, 9]),
      ),
    ).toBeGreaterThan(0);
  });

  test("lower category loses regardless of tiebreakers", () => {
    expect(
      compareHands(
        score(HAND_CATEGORY.HIGH_CARD, [14, 13, 12, 11, 9]),
        score(HAND_CATEGORY.PAIR, [2]),
      ),
    ).toBeLessThan(0);
  });

  test("same category: lex-compares tiebreakers", () => {
    expect(
      compareHands(score(HAND_CATEGORY.PAIR, [10, 5]), score(HAND_CATEGORY.PAIR, [10, 3])),
    ).toBeGreaterThan(0);
  });

  test("same category: shorter tiebreakers padded with 0 (longer wins when prefix matches)", () => {
    // A preflop-style pair [14] vs a 5-card pair [14, 13, 7, 2]: the latter
    // carries more information and is treated as stronger.
    expect(
      compareHands(score(HAND_CATEGORY.PAIR, [14, 13, 7, 2]), score(HAND_CATEGORY.PAIR, [14])),
    ).toBeGreaterThan(0);
  });

  test("empty tiebreakers on both sides → 0", () => {
    expect(
      compareHands(score(HAND_CATEGORY.HIGH_CARD, []), score(HAND_CATEGORY.HIGH_CARD, [])),
    ).toBe(0);
  });
});

describe("evaluateHand: preflop (2 cards)", () => {
  test("pocket aces are classified as a pair", () => {
    expect(evalSpec("AH AD")).toEqual(score(HAND_CATEGORY.PAIR, [14]));
  });

  test("pocket twos are classified as a pair", () => {
    expect(evalSpec("2H 2D")).toEqual(score(HAND_CATEGORY.PAIR, [2]));
  });

  test("non-pair AK is high card with both values descending", () => {
    expect(evalSpec("AH KD")).toEqual(score(HAND_CATEGORY.HIGH_CARD, [14, 13]));
  });

  test("non-pair 7-2 is high card with 7 then 2", () => {
    expect(evalSpec("7H 2D")).toEqual(score(HAND_CATEGORY.HIGH_CARD, [7, 2]));
  });

  test("any pocket pair beats any high card", () => {
    expect(compareHands(evalSpec("2H 2D"), evalSpec("AH KD"))).toBeGreaterThan(0);
  });

  test("higher pocket pair > lower pocket pair", () => {
    expect(compareHands(evalSpec("AH AD"), evalSpec("KH KD"))).toBeGreaterThan(0);
  });

  test("AK off-suit > AQ off-suit (kicker)", () => {
    expect(compareHands(evalSpec("AH KD"), evalSpec("AH QD"))).toBeGreaterThan(0);
  });

  test("ace is treated as high for preflop (not 1)", () => {
    const ax = evalSpec("AH 2D");
    expect(ax.tiebreakers[0]).toBe(14);
    expect(ax.tiebreakers[1]).toBe(2);
  });
});

describe("evaluateHand: partial (3-4 cards)", () => {
  test("3 cards AAA → trips with no kicker", () => {
    expect(evalSpec("AH AD AC")).toEqual(score(HAND_CATEGORY.TRIPS, [14]));
  });

  test("3 cards AAK → pair of aces with kicker K", () => {
    expect(evalSpec("AH AD KC")).toEqual(score(HAND_CATEGORY.PAIR, [14, 13]));
  });

  test("3 cards AKQ → high card A-K-Q descending", () => {
    expect(evalSpec("AH KD QC")).toEqual(score(HAND_CATEGORY.HIGH_CARD, [14, 13, 12]));
  });

  test("4 cards AAAA → quads with no kicker", () => {
    expect(evalSpec("AH AD AC AS")).toEqual(score(HAND_CATEGORY.QUADS, [14]));
  });

  test("4 cards AAAK → trips of aces with kicker K", () => {
    expect(evalSpec("AH AD AC KS")).toEqual(score(HAND_CATEGORY.TRIPS, [14, 13]));
  });

  test("4 cards AAKK → two pair AA-KK with no kicker", () => {
    expect(evalSpec("AH AD KC KS")).toEqual(score(HAND_CATEGORY.TWO_PAIR, [14, 13]));
  });

  test("4 cards AAKQ → pair of aces with kickers K, Q", () => {
    expect(evalSpec("AH AD KC QS")).toEqual(score(HAND_CATEGORY.PAIR, [14, 13, 12]));
  });

  test("4 cards AKQJ → high card A-K-Q-J descending", () => {
    expect(evalSpec("AH KD QC JS")).toEqual(score(HAND_CATEGORY.HIGH_CARD, [14, 13, 12, 11]));
  });

  test("trips beats two pair at 4 cards", () => {
    expect(compareHands(evalSpec("AH AD AC KS"), evalSpec("AH AD KC KS"))).toBeGreaterThan(0);
  });

  test("quads beats trips at 4 cards", () => {
    expect(compareHands(evalSpec("AH AD AC AS"), evalSpec("AH AD AC KS"))).toBeGreaterThan(0);
  });
});
