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
export type Round = 1 | 2 | 3 | 4;
export type Placement = 1 | 2 | 3 | 4;
export type HandTrend = "+" | "·";

export const TOTAL_ROUNDS = 4;

export const ROUND_STREET: Record<Round, string> = {
  1: "プリフロップ",
  2: "フロップ",
  3: "ターン",
  4: "リバー",
};

export type OpponentRoundData = {
  readonly placement: Placement | null;
  readonly declared: Placement | null;
  readonly trend: HandTrend | null;
};

export type PlayerRoundData = {
  readonly placement: Placement | null;
};

export type Opponent = {
  readonly id: string;
  readonly personality: Personality;
  readonly holeCards: readonly [Card, Card];
  readonly rounds: readonly OpponentRoundData[];
};

export type Player = {
  readonly holeCards: readonly [Card, Card];
  readonly rounds: readonly PlayerRoundData[];
};

export type GameState = {
  readonly opponents: readonly Opponent[];
  readonly player: Player;
  readonly community: readonly Card[];
  readonly currentRound: Round;
};

const emptyOpponentRounds = (): readonly OpponentRoundData[] =>
  Array.from({ length: TOTAL_ROUNDS }, () => ({
    placement: null,
    declared: null,
    trend: null,
  }));

const emptyPlayerRounds = (): readonly PlayerRoundData[] =>
  Array.from({ length: TOTAL_ROUNDS }, () => ({ placement: null }));

export const createInitialState = (): GameState => {
  const deck = shuffle(createDeck());
  const take = (): Card => deck.shift()!;
  const pair = (): [Card, Card] => [take(), take()];

  const fill = <T>(base: T[], entry: T, idx: number): T[] => {
    const copy = base.slice();
    copy[idx] = entry;
    return copy;
  };

  return {
    opponents: [
      {
        id: "op1",
        personality: "素直",
        holeCards: pair(),
        rounds: fill(emptyOpponentRounds().slice(), { placement: 2, declared: 1, trend: null }, 0),
      },
      {
        id: "op2",
        personality: "分析屋",
        holeCards: pair(),
        rounds: fill(emptyOpponentRounds().slice(), { placement: 4, declared: 3, trend: null }, 0),
      },
      {
        id: "op3",
        personality: "慎重",
        holeCards: pair(),
        rounds: fill(emptyOpponentRounds().slice(), { placement: 3, declared: 4, trend: null }, 0),
      },
    ],
    player: {
      holeCards: pair(),
      rounds: fill(emptyPlayerRounds().slice(), { placement: 1 }, 0),
    },
    community: [],
    currentRound: 1,
  };
};
