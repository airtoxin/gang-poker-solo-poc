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
export const PLACEMENTS: readonly Placement[] = [1, 2, 3, 4];

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
export type GamePhase = "in_progress" | "showdown";

export type GameState = {
  readonly seats: readonly Seat[];
  readonly dealtCommunity: readonly [Card, Card, Card, Card, Card];
  readonly community: readonly Card[];
  readonly currentRound: Round;
  readonly roundPhase: RoundPhase;
  readonly gamePhase: GamePhase;
  readonly placements: readonly (RoundPlacements | null)[];
  readonly outputs: readonly (RoundOutputs | null)[];
  readonly pendingPlacements: Readonly<Partial<Record<SeatId, Placement>>>;
  readonly actualPlacements: RoundPlacements;
};

export const isOpponentSeat = (seat: Seat): seat is OpponentSeat => seat.id !== "player";

const COMMUNITY_COUNT: Record<Round, number> = { 1: 0, 2: 3, 3: 4, 4: 5 };

export const communityForRound = (dealt: readonly Card[], round: Round): readonly Card[] =>
  dealt.slice(0, COMMUNITY_COUNT[round]);

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

  const dealtCommunity: readonly [Card, Card, Card, Card, Card] = [
    take(),
    take(),
    take(),
    take(),
    take(),
  ];

  const shuffledIds = shuffle(seats.map((s) => s.id));
  const actualPlacements: RoundPlacements = new Map(
    shuffledIds.map((id, idx) => [id, (idx + 1) as Placement]),
  );

  return {
    seats,
    dealtCommunity,
    community: [],
    currentRound: 1,
    roundPhase: "dealing",
    gamePhase: "in_progress",
    placements: [null, null, null, null],
    outputs: [null, null, null, null],
    pendingPlacements: {},
    actualPlacements,
  };
};

export const togglePendingPlacement = (
  state: GameState,
  seatId: SeatId,
  placement: Placement,
): GameState => {
  const next: Partial<Record<SeatId, Placement>> = { ...state.pendingPlacements };
  for (const id of Object.keys(next) as SeatId[]) {
    if (next[id] === placement) delete next[id];
  }
  next[seatId] = placement;
  return { ...state, pendingPlacements: next };
};

export const isPendingComplete = (
  seats: readonly Seat[],
  pending: Readonly<Partial<Record<SeatId, Placement>>>,
): boolean => {
  const used = new Set<Placement>();
  for (const seat of seats) {
    const p = pending[seat.id];
    if (p == null) return false;
    used.add(p);
  }
  return used.size === seats.length;
};

export const confirmPlacements = (state: GameState): GameState => {
  const map = new Map<SeatId, Placement>(
    Object.entries(state.pendingPlacements) as [SeatId, Placement][],
  );
  const placements = state.placements.slice();
  placements[state.currentRound - 1] = map;
  return {
    ...state,
    placements,
    pendingPlacements: {},
    roundPhase: "complete",
  };
};

const randomPlacement = (): Placement => (Math.floor(Math.random() * 4) + 1) as Placement;

const randomTrend = (): HandTrend => (Math.random() < 0.5 ? "+" : "·");

export const startPlacement = (state: GameState): GameState => ({
  ...state,
  roundPhase: "placement",
});

export const finishRound = (state: GameState): GameState => {
  if (state.currentRound === TOTAL_ROUNDS) {
    return { ...state, gamePhase: "showdown" };
  }
  const opponents = state.seats.filter(isOpponentSeat);
  const outputs: RoundOutputs = new Map(
    opponents.map((op) => [
      op.id,
      {
        declared: randomPlacement(),
        trend: state.currentRound === 1 ? null : randomTrend(),
      },
    ]),
  );
  const nextOutputs = state.outputs.slice();
  nextOutputs[state.currentRound - 1] = outputs;
  return { ...state, roundPhase: "feedback", outputs: nextOutputs };
};

export const advance = (state: GameState): GameState => {
  const nextRound = (state.currentRound + 1) as Round;
  return {
    ...state,
    currentRound: nextRound,
    roundPhase: "dealing",
    community: communityForRound(state.dealtCommunity, nextRound),
    pendingPlacements: {},
  };
};
