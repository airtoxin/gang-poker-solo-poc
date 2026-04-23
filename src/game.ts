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

export type OpponentSeatId = "op1" | "op2" | "op3";
export type SeatId = OpponentSeatId | "player";

export type OpponentSeat = {
  readonly id: OpponentSeatId;
  readonly personality: Personality;
  readonly holeCards: readonly [Card, Card];
};

export type PlayerSeat = {
  readonly id: "player";
  readonly holeCards: readonly [Card, Card];
};

export type Seat = OpponentSeat | PlayerSeat;

export type OpponentOutput = {
  readonly declared: Placement;
  readonly trend: HandTrend | null;
};

export type RoundPlacements = ReadonlyMap<SeatId, Placement>;
export type RoundOutputs = ReadonlyMap<OpponentSeatId, OpponentOutput>;

export type RoundPhase = "placement" | "dealing" | "feedback" | "complete";
export type GamePhase = "in_progress" | "showdown" | "finished";

export type GameState = {
  readonly seats: readonly Seat[];
  readonly community: readonly Card[];
  readonly currentRound: Round;
  readonly roundPhase: RoundPhase;
  readonly gamePhase: GamePhase;
  readonly placements: readonly (RoundPlacements | null)[];
  readonly outputs: readonly (RoundOutputs | null)[];
  readonly pendingPlacements: Readonly<Partial<Record<SeatId, Placement>>>;
};

export const isOpponentSeat = (seat: Seat): seat is OpponentSeat => seat.id !== "player";

export const createInitialState = (): GameState => {
  const deck = shuffle(createDeck());
  const take = (): Card => deck.shift()!;
  const pair = (): readonly [Card, Card] => [take(), take()];

  const seats: readonly Seat[] = [
    { id: "op1", personality: "素直", holeCards: pair() },
    { id: "op2", personality: "分析屋", holeCards: pair() },
    { id: "op3", personality: "慎重", holeCards: pair() },
    { id: "player", holeCards: pair() },
  ];

  const round1Placements: RoundPlacements = new Map<SeatId, Placement>([
    ["op1", 2],
    ["op2", 4],
    ["op3", 3],
    ["player", 1],
  ]);

  const round1Outputs: RoundOutputs = new Map<OpponentSeatId, OpponentOutput>([
    ["op1", { declared: 1, trend: null }],
    ["op2", { declared: 3, trend: null }],
    ["op3", { declared: 4, trend: null }],
  ]);

  const placements: readonly (RoundPlacements | null)[] = [round1Placements, null, null, null];
  const outputs: readonly (RoundOutputs | null)[] = [round1Outputs, null, null, null];

  return {
    seats,
    community: [],
    currentRound: 1,
    roundPhase: "complete",
    gamePhase: "in_progress",
    placements,
    outputs,
    pendingPlacements: {},
  };
};
