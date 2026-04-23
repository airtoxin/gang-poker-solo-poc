export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type Card = {
  readonly suit: Suit;
  readonly rank: Rank;
};

export const SUITS: readonly Suit[] = ["♠", "♥", "♦", "♣"];

export const rankLabel = (rank: Rank): string => {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
};

export const isRed = (suit: Suit): boolean => suit === "♥" || suit === "♦";

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let r = 1; r <= 13; r++) {
      deck.push({ suit, rank: r as Rank });
    }
  }
  return deck;
};

export const shuffle = <T>(arr: readonly T[]): T[] => {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

export type Personality = "素直" | "分析屋" | "慎重";

export type ChipStack = {
  readonly white: number;
  readonly yellow: number;
  readonly orange: number;
  readonly red: number;
};

export const CHIP_VALUE: Record<keyof ChipStack, number> = {
  white: 1,
  yellow: 5,
  orange: 25,
  red: 100,
};

export const chipTotal = (s: ChipStack): number =>
  s.white * CHIP_VALUE.white +
  s.yellow * CHIP_VALUE.yellow +
  s.orange * CHIP_VALUE.orange +
  s.red * CHIP_VALUE.red;

export type Opponent = {
  readonly id: string;
  readonly personality: Personality;
  readonly holeCards: readonly [Card, Card] | null;
  readonly chips: ChipStack;
  readonly folded: boolean;
};

export type Player = {
  readonly holeCards: readonly [Card, Card] | null;
  readonly chips: ChipStack;
};

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export type GameState = {
  readonly opponents: readonly Opponent[];
  readonly player: Player;
  readonly community: readonly Card[];
  readonly pot: number;
  readonly street: Street;
};

export const createInitialState = (): GameState => {
  const deck = shuffle(createDeck());
  const take = (): Card => deck.shift()!;
  const pair = (): [Card, Card] => [take(), take()];
  return {
    opponents: [
      {
        id: "op1",
        personality: "素直",
        holeCards: pair(),
        chips: { white: 3, yellow: 1, orange: 1, red: 4 },
        folded: false,
      },
      {
        id: "op2",
        personality: "分析屋",
        holeCards: pair(),
        chips: { white: 1, yellow: 4, orange: 4, red: 1 },
        folded: false,
      },
      {
        id: "op3",
        personality: "慎重",
        holeCards: pair(),
        chips: { white: 2, yellow: 3, orange: 3, red: 3 },
        folded: false,
      },
    ],
    player: {
      holeCards: pair(),
      chips: { white: 4, yellow: 2, orange: 2, red: 2 },
    },
    community: [],
    pot: 0,
    street: "preflop",
  };
};
