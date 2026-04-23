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

export type HandRank =
  | "royal-flush"
  | "straight-flush"
  | "four-of-a-kind"
  | "full-house"
  | "flush"
  | "straight"
  | "three-of-a-kind"
  | "two-pair"
  | "jacks-or-better"
  | "nothing";

export const HAND_LABEL: Record<HandRank, string> = {
  "royal-flush": "ロイヤルフラッシュ",
  "straight-flush": "ストレートフラッシュ",
  "four-of-a-kind": "フォーカード",
  "full-house": "フルハウス",
  flush: "フラッシュ",
  straight: "ストレート",
  "three-of-a-kind": "スリーカード",
  "two-pair": "ツーペア",
  "jacks-or-better": "ジャック以上のペア",
  nothing: "役なし",
};

export const PAYOUT: Record<HandRank, number> = {
  "royal-flush": 250,
  "straight-flush": 50,
  "four-of-a-kind": 25,
  "full-house": 9,
  flush: 6,
  straight: 4,
  "three-of-a-kind": 3,
  "two-pair": 2,
  "jacks-or-better": 1,
  nothing: 0,
};

export const PAYOUT_TABLE: readonly HandRank[] = [
  "royal-flush",
  "straight-flush",
  "four-of-a-kind",
  "full-house",
  "flush",
  "straight",
  "three-of-a-kind",
  "two-pair",
  "jacks-or-better",
];

const countByRank = (cards: readonly Card[]): Map<Rank, number> => {
  const map = new Map<Rank, number>();
  for (const c of cards) map.set(c.rank, (map.get(c.rank) ?? 0) + 1);
  return map;
};

const isFlush = (cards: readonly Card[]): boolean => cards.every((c) => c.suit === cards[0]!.suit);

const isStraight = (cards: readonly Card[]): { straight: boolean; high: number } => {
  const ranks = cards.map((c) => (c.rank === 1 ? 14 : c.rank)).sort((a, b) => a - b);
  const lowRanks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const seq = (rs: number[]) => rs.every((r, i) => i === 0 || r === rs[i - 1]! + 1);
  if (seq(ranks)) return { straight: true, high: ranks[4]! };
  if (seq(lowRanks)) return { straight: true, high: lowRanks[4]! };
  return { straight: false, high: 0 };
};

export const evaluate = (cards: readonly Card[]): HandRank => {
  if (cards.length !== 5) return "nothing";
  const counts = [...countByRank(cards).values()].sort((a, b) => b - a);
  const flush = isFlush(cards);
  const { straight, high } = isStraight(cards);

  if (flush && straight && high === 14) return "royal-flush";
  if (flush && straight) return "straight-flush";
  if (counts[0] === 4) return "four-of-a-kind";
  if (counts[0] === 3 && counts[1] === 2) return "full-house";
  if (flush) return "flush";
  if (straight) return "straight";
  if (counts[0] === 3) return "three-of-a-kind";
  if (counts[0] === 2 && counts[1] === 2) return "two-pair";

  const rankCounts = countByRank(cards);
  for (const [rank, n] of rankCounts) {
    if (n === 2 && (rank === 1 || rank >= 11)) return "jacks-or-better";
  }
  return "nothing";
};

export type Phase = "betting" | "holding" | "result" | "gameover";

export type GameState = {
  credits: number;
  bet: number;
  deck: Card[];
  hand: Card[];
  held: boolean[];
  phase: Phase;
  lastResult: HandRank | null;
  lastWin: number;
};

export const INITIAL_CREDITS = 100;
export const MIN_BET = 1;
export const MAX_BET = 5;

export const createInitialState = (): GameState => ({
  credits: INITIAL_CREDITS,
  bet: 1,
  deck: [],
  hand: [],
  held: [false, false, false, false, false],
  phase: "betting",
  lastResult: null,
  lastWin: 0,
});

export const deal = (state: GameState): GameState => {
  if (state.phase !== "betting") return state;
  if (state.credits < state.bet) return state;
  const deck = shuffle(createDeck());
  const hand = deck.splice(0, 5);
  return {
    ...state,
    credits: state.credits - state.bet,
    deck,
    hand,
    held: [false, false, false, false, false],
    phase: "holding",
    lastResult: null,
    lastWin: 0,
  };
};

export const toggleHold = (state: GameState, index: number): GameState => {
  if (state.phase !== "holding") return state;
  const held = state.held.slice();
  held[index] = !held[index];
  return { ...state, held };
};

export const draw = (state: GameState): GameState => {
  if (state.phase !== "holding") return state;
  const deck = state.deck.slice();
  const hand = state.hand.map((card, i) => (state.held[i] ? card : deck.shift()!));
  const result = evaluate(hand);
  const payout = PAYOUT[result] * state.bet;
  const credits = state.credits + payout;
  const phase: Phase = credits <= 0 && payout === 0 ? "gameover" : "result";
  return {
    ...state,
    deck,
    hand,
    phase,
    lastResult: result,
    lastWin: payout,
    credits,
  };
};

export const nextRound = (state: GameState): GameState => {
  if (state.phase !== "result") return state;
  const bet = Math.min(state.bet, Math.max(MIN_BET, state.credits));
  return {
    ...state,
    bet,
    hand: [],
    held: [false, false, false, false, false],
    phase: state.credits <= 0 ? "gameover" : "betting",
    lastResult: state.lastResult,
  };
};

export const setBet = (state: GameState, bet: number): GameState => {
  if (state.phase !== "betting") return state;
  const clamped = Math.max(MIN_BET, Math.min(MAX_BET, Math.min(bet, state.credits)));
  return { ...state, bet: clamped };
};

export const restart = (): GameState => createInitialState();
