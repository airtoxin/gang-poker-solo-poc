import { compareHands, evaluateHand, type HandScore } from "./evaluator.ts";

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
  readonly tiebreak: Readonly<Record<SeatId, number>>;
};

export const isOpponentSeat = (seat: Seat): seat is OpponentSeat => seat.id !== "player";

const COMMUNITY_COUNT: Record<Round, number> = { 1: 0, 2: 3, 3: 4, 4: 5 };

export const communityForRound = (dealt: readonly Card[], round: Round): readonly Card[] =>
  dealt.slice(0, COMMUNITY_COUNT[round]);

const cardKey = (c: Card): string => `${c.suit}${c.rank}`;

const seatScore = (seat: Seat, community: readonly Card[]): HandScore =>
  evaluateHand([...seat.holeCards, ...community]);

const rankValue = (r: Rank): number => (r === 1 ? 14 : r);

// Full ranking key: the best 5-card hand score, extended with hole card values
// (desc) so that players whose best 5 ties on the community still get
// distinguished by what they're holding. Example: if community forms a
// straight flush that no hole can extend, whoever holds higher cards ranks
// ahead — no seat-order bias, no coin flip.
const seatRankingKey = (seat: Seat, community: readonly Card[]): HandScore => {
  const primary = seatScore(seat, community);
  const holeDesc = seat.holeCards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  return {
    category: primary.category,
    tiebreakers: [...primary.tiebreakers, ...holeDesc],
  };
};

const rankSeats = (
  seats: readonly Seat[],
  community: readonly Card[],
  tiebreak: Readonly<Record<SeatId, number>>,
): Map<SeatId, Placement> => {
  const entries = seats.map((s) => ({
    id: s.id,
    tb: tiebreak[s.id],
    key: seatRankingKey(s, community),
  }));
  entries.sort((a, b) => {
    const cmp = compareHands(b.key, a.key);
    if (cmp !== 0) return cmp;
    return a.tb - b.tb;
  });
  return new Map(entries.map((e, i) => [e.id, (i + 1) as Placement]));
};

const PROJECTION_SAMPLES = 80;

const projectRanking = (state: GameState): Map<SeatId, Placement> => {
  const need = 5 - state.community.length;
  if (need === 0) return rankSeats(state.seats, state.community, state.tiebreak);

  const used = new Set<string>();
  for (const s of state.seats) for (const c of s.holeCards) used.add(cardKey(c));
  for (const c of state.community) used.add(cardKey(c));
  const remaining = createDeck().filter((c) => !used.has(cardKey(c)));

  const sums = new Map<SeatId, number>();
  for (const s of state.seats) sums.set(s.id, 0);

  for (let i = 0; i < PROJECTION_SAMPLES; i++) {
    const sampled = shuffle(remaining).slice(0, need);
    const future = [...state.community, ...sampled];
    const ranking = rankSeats(state.seats, future, state.tiebreak);
    for (const [id, placement] of ranking) {
      sums.set(id, sums.get(id)! + placement);
    }
  }

  const ordered = state.seats
    .map((s) => ({
      id: s.id,
      tb: state.tiebreak[s.id],
      avg: sums.get(s.id)! / PROJECTION_SAMPLES,
    }))
    .sort((a, b) => {
      if (a.avg !== b.avg) return a.avg - b.avg;
      return a.tb - b.tb;
    });
  return new Map(ordered.map((e, i) => [e.id, (i + 1) as Placement]));
};

const clampPlacement = (n: number): Placement => {
  const x = Math.round(n);
  if (x < 1) return 1;
  if (x > 4) return 4;
  return x as Placement;
};

const declareByPersonality = (
  op: OpponentSeat,
  state: GameState,
  straightRanking: Map<SeatId, Placement>,
  projectedRanking: Map<SeatId, Placement>,
): Placement => {
  const straight = straightRanking.get(op.id)!;
  switch (op.personality) {
    case "素直":
      return straight;
    case "分析屋":
      return projectedRanking.get(op.id)!;
    case "慎重": {
      const playerBet = state.placements[state.currentRound - 1]?.get(op.id);
      if (playerBet == null) return straight;
      const diff = playerBet - straight;
      if (Math.abs(diff) <= 1) return straight;
      return clampPlacement(straight + Math.sign(diff));
    }
  }
};

const categoryOf = (score: HandScore): number => score.category;

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

  const tiebreakOrder = shuffle(seats.map((s) => s.id));
  const tiebreak: Record<SeatId, number> = {
    op1: 0,
    op2: 0,
    op3: 0,
    player: 0,
  };
  tiebreakOrder.forEach((id, idx) => {
    tiebreak[id] = idx;
  });

  const actualPlacements: RoundPlacements = rankSeats(seats, dealtCommunity, tiebreak);

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
    tiebreak,
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

export const startPlacement = (state: GameState): GameState => ({
  ...state,
  roundPhase: "placement",
});

export const finishRound = (state: GameState): GameState => {
  if (state.currentRound === TOTAL_ROUNDS) {
    return { ...state, gamePhase: "showdown" };
  }

  const opponents = state.seats.filter(isOpponentSeat);
  const straightRanking = rankSeats(state.seats, state.community, state.tiebreak);
  const needsProjection = opponents.some((o) => o.personality === "分析屋");
  const projectedRanking = needsProjection ? projectRanking(state) : straightRanking;

  const currentScores = new Map<SeatId, HandScore>(
    state.seats.map((s) => [s.id, seatScore(s, state.community)]),
  );
  const prevCommunity =
    state.currentRound === 1
      ? null
      : communityForRound(state.dealtCommunity, (state.currentRound - 1) as Round);
  const prevScores = prevCommunity
    ? new Map<SeatId, HandScore>(state.seats.map((s) => [s.id, seatScore(s, prevCommunity)]))
    : null;

  const outputs: RoundOutputs = new Map(
    opponents.map((op) => {
      const declared = declareByPersonality(op, state, straightRanking, projectedRanking);
      const trend: HandTrend | null =
        prevScores == null
          ? null
          : categoryOf(currentScores.get(op.id)!) > categoryOf(prevScores.get(op.id)!)
            ? "+"
            : "·";
      return [op.id, { declared, trend }];
    }),
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
