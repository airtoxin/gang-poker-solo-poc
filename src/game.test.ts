import { describe, expect, test } from "vite-plus/test";
import {
  advance,
  type Card,
  confirmPlacements,
  createInitialState,
  finishRound,
  type GameState,
  isOpponentSeat,
  isPendingComplete,
  type Placement,
  type Rank,
  type Round,
  type Seat,
  type SeatId,
  type Suit,
  startPlacement,
  togglePendingPlacement,
} from "./game.ts";

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

const card = (code: string): Card => ({
  suit: SUIT_MAP[code.slice(-1)]!,
  rank: rankFromCode(code.slice(0, -1)),
});

const cardKey = (c: Card): string => `${c.suit}${c.rank}`;

// Build a state with deterministic cards; defaults are valid but can be overridden.
const makeState = (over: Partial<GameState> = {}): GameState => {
  const seats: readonly Seat[] = [
    { id: "op1", personality: "素直", holeCards: [card("AS"), card("AH")] },
    { id: "op2", personality: "分析屋", holeCards: [card("2S"), card("2H")] },
    { id: "op3", personality: "慎重", holeCards: [card("KS"), card("KH")] },
    { id: "player", holeCards: [card("QS"), card("QH")] },
  ];
  const dealtCommunity: readonly [Card, Card, Card, Card, Card] = [
    card("3D"),
    card("4D"),
    card("5D"),
    card("6D"),
    card("7D"),
  ];
  const base: GameState = {
    seats,
    dealtCommunity,
    community: [],
    currentRound: 1,
    roundPhase: "dealing",
    gamePhase: "in_progress",
    placements: [null, null, null, null],
    outputs: [null, null, null, null],
    pendingPlacements: {},
    actualPlacements: new Map<SeatId, Placement>([
      ["op1", 1],
      ["op3", 2],
      ["player", 3],
      ["op2", 4],
    ]),
    tiebreak: { op1: 0, op2: 1, op3: 2, player: 3 },
  };
  return { ...base, ...over };
};

describe("createInitialState", () => {
  test("starts at round 1, dealing phase, in_progress", () => {
    const s = createInitialState();
    expect(s.currentRound).toBe(1);
    expect(s.roundPhase).toBe("dealing");
    expect(s.gamePhase).toBe("in_progress");
  });

  test("community is empty at the start (preflop)", () => {
    expect(createInitialState().community).toEqual([]);
  });

  test("dealtCommunity has exactly 5 cards", () => {
    expect(createInitialState().dealtCommunity).toHaveLength(5);
  });

  test("all 13 dealt cards (5 community + 4×2 hole) are unique", () => {
    const s = createInitialState();
    const all: Card[] = [...s.dealtCommunity, ...s.seats.flatMap((seat) => seat.holeCards)];
    const keys = new Set(all.map(cardKey));
    expect(keys.size).toBe(13);
  });

  test("seats order is op1, op2, op3, player", () => {
    const s = createInitialState();
    expect(s.seats.map((st) => st.id)).toEqual(["op1", "op2", "op3", "player"]);
  });

  test("opponent personalities are 素直, 分析屋, 慎重 in seat order", () => {
    const s = createInitialState();
    const opponents = s.seats.filter(isOpponentSeat);
    expect(opponents.map((o) => o.personality)).toEqual(["素直", "分析屋", "慎重"]);
  });

  test("placements and outputs arrays have 4 null slots", () => {
    const s = createInitialState();
    expect(s.placements).toEqual([null, null, null, null]);
    expect(s.outputs).toEqual([null, null, null, null]);
  });

  test("actualPlacements is a 1-4 permutation over all seats", () => {
    const s = createInitialState();
    const values = [...s.actualPlacements.values()].sort((a, b) => a - b);
    expect(values).toEqual([1, 2, 3, 4]);
    expect(s.actualPlacements.size).toBe(4);
  });
});

describe("togglePendingPlacement", () => {
  test("assigns placement to the target seat", () => {
    const s = createInitialState();
    const next = togglePendingPlacement(s, "player", 2);
    expect(next.pendingPlacements.player).toBe(2);
  });

  test("steals the placement from any other seat that holds it", () => {
    let s = createInitialState();
    s = togglePendingPlacement(s, "op1", 1);
    s = togglePendingPlacement(s, "player", 1);
    expect(s.pendingPlacements.op1).toBeUndefined();
    expect(s.pendingPlacements.player).toBe(1);
  });

  test("reassigning the same seat overwrites its previous placement", () => {
    let s = createInitialState();
    s = togglePendingPlacement(s, "player", 1);
    s = togglePendingPlacement(s, "player", 3);
    expect(s.pendingPlacements.player).toBe(3);
  });

  test("other seats' placements are preserved when unrelated", () => {
    let s = createInitialState();
    s = togglePendingPlacement(s, "op1", 1);
    s = togglePendingPlacement(s, "op2", 2);
    s = togglePendingPlacement(s, "op3", 3);
    expect(s.pendingPlacements.op1).toBe(1);
    expect(s.pendingPlacements.op2).toBe(2);
    expect(s.pendingPlacements.op3).toBe(3);
  });

  test("does not mutate the input state", () => {
    const s = createInitialState();
    togglePendingPlacement(s, "player", 1);
    expect(s.pendingPlacements.player).toBeUndefined();
  });
});

describe("isPendingComplete", () => {
  const seats: readonly Seat[] = [
    { id: "op1", personality: "素直", holeCards: [card("AS"), card("AH")] },
    { id: "op2", personality: "分析屋", holeCards: [card("2S"), card("2H")] },
    { id: "op3", personality: "慎重", holeCards: [card("KS"), card("KH")] },
    { id: "player", holeCards: [card("QS"), card("QH")] },
  ];

  test("false when pending is empty", () => {
    expect(isPendingComplete(seats, {})).toBe(false);
  });

  test("false when any seat is unassigned", () => {
    expect(isPendingComplete(seats, { op1: 1, op2: 2, op3: 3 })).toBe(false);
  });

  test("true when all four seats have unique 1-4", () => {
    expect(isPendingComplete(seats, { op1: 1, op2: 2, op3: 3, player: 4 })).toBe(true);
  });
});

describe("confirmPlacements", () => {
  test("transitions round phase to complete", () => {
    const s = makeState({
      pendingPlacements: { op1: 1, op2: 2, op3: 3, player: 4 },
    });
    expect(confirmPlacements(s).roundPhase).toBe("complete");
  });

  test("writes pending into placements[currentRound-1]", () => {
    const s = makeState({
      pendingPlacements: { op1: 1, op2: 2, op3: 3, player: 4 },
    });
    const next = confirmPlacements(s);
    const r1 = next.placements[0]!;
    expect(r1.get("op1")).toBe(1);
    expect(r1.get("op2")).toBe(2);
    expect(r1.get("op3")).toBe(3);
    expect(r1.get("player")).toBe(4);
  });

  test("clears pendingPlacements", () => {
    const s = makeState({
      pendingPlacements: { op1: 1, op2: 2, op3: 3, player: 4 },
    });
    expect(confirmPlacements(s).pendingPlacements).toEqual({});
  });

  test("does not touch earlier rounds' placements", () => {
    const r1 = new Map<SeatId, Placement>([
      ["op1", 1],
      ["op2", 2],
      ["op3", 3],
      ["player", 4],
    ]);
    const s = makeState({
      currentRound: 2,
      placements: [r1, null, null, null],
      pendingPlacements: { op1: 4, op2: 3, op3: 2, player: 1 },
    });
    const next = confirmPlacements(s);
    expect(next.placements[0]).toBe(r1);
  });
});

describe("startPlacement", () => {
  test("transitions to placement phase", () => {
    const s = makeState({ roundPhase: "dealing" });
    expect(startPlacement(s).roundPhase).toBe("placement");
  });
});

describe("advance", () => {
  test("increments round by 1 and enters dealing phase", () => {
    const s = makeState();
    const next = advance(s);
    expect(next.currentRound).toBe(2);
    expect(next.roundPhase).toBe("dealing");
  });

  test("reveals flop (3 cards) on round 2", () => {
    expect(advance(makeState({ currentRound: 1 })).community).toHaveLength(3);
  });

  test("reveals turn (4 cards) on round 3", () => {
    expect(advance(makeState({ currentRound: 2 })).community).toHaveLength(4);
  });

  test("reveals river (5 cards) on round 4", () => {
    expect(advance(makeState({ currentRound: 3 })).community).toHaveLength(5);
  });

  test("community uses dealtCommunity prefix in order", () => {
    const s = makeState({ currentRound: 1 });
    const next = advance(s);
    expect(next.community).toEqual(s.dealtCommunity.slice(0, 3));
  });

  test("clears pendingPlacements", () => {
    const s = makeState({ pendingPlacements: { op1: 1 } });
    expect(advance(s).pendingPlacements).toEqual({});
  });
});

describe("finishRound: phase transitions", () => {
  test("round 4 transitions directly to showdown", () => {
    const s = makeState({ currentRound: 4 as Round });
    const next = finishRound(s);
    expect(next.gamePhase).toBe("showdown");
  });

  test("rounds 1-3 transition to feedback", () => {
    for (const round of [1, 2, 3] as Round[]) {
      const s = makeState({
        currentRound: round,
        community: round === 1 ? [] : [card("3D"), card("4D"), card("5D")].slice(0, round - 1),
        placements: [
          new Map<SeatId, Placement>([
            ["op1", 1],
            ["op2", 4],
            ["op3", 2],
            ["player", 3],
          ]),
          null,
          null,
          null,
        ],
      });
      expect(finishRound(s).roundPhase).toBe("feedback");
    }
  });

  test("feedback for the current round contains all 3 opponents", () => {
    const s = makeState();
    const next = finishRound(s);
    const r1 = next.outputs[0]!;
    expect(r1.size).toBe(3);
    expect(r1.has("op1")).toBe(true);
    expect(r1.has("op2")).toBe(true);
    expect(r1.has("op3")).toBe(true);
  });

  test("declared values are always in 1-4", () => {
    const s = makeState();
    const next = finishRound(s);
    const r1 = next.outputs[0]!;
    for (const [, output] of r1) {
      expect(output.declared).toBeGreaterThanOrEqual(1);
      expect(output.declared).toBeLessThanOrEqual(4);
    }
  });

  test("round 1 trends are null (no previous round)", () => {
    const s = makeState();
    const next = finishRound(s);
    for (const [, out] of next.outputs[0]!) {
      expect(out.trend).toBeNull();
    }
  });

  test("round 2+ trends are either + or ·", () => {
    const s = makeState({
      currentRound: 2,
      community: [card("3D"), card("4D"), card("5D")],
    });
    const next = finishRound(s);
    for (const [, out] of next.outputs[1]!) {
      expect(out.trend === "+" || out.trend === "·").toBe(true);
    }
  });
});

describe("finishRound: personality — 素直 (strict)", () => {
  test("declares exactly the hand-strength rank", () => {
    // Preflop ranks for makeState():
    //   op1 AA (pair 14) → 1st
    //   op3 KK (pair 13) → 2nd
    //   player QQ (pair 12) → 3rd
    //   op2 22 (pair 2) → 4th
    const s = makeState();
    const next = finishRound(s);
    const op1Out = next.outputs[0]!.get("op1")!;
    expect(op1Out.declared).toBe(1);
  });
});

describe("finishRound: personality — 慎重 (shifts toward player bet when divergent)", () => {
  // Preflop hand-strength rank for op3 (KK) is 2 in the default makeState.
  const playerBetCases: ReadonlyArray<readonly [number, number, string]> = [
    [1, 2, "diff -1: no shift"],
    [2, 2, "diff 0: no shift"],
    [3, 2, "diff +1: no shift"],
    [4, 3, "diff +2: shift +1 toward 4"],
  ];

  for (const [bet, expected, label] of playerBetCases) {
    test(`player bet ${bet} for op3 → declared ${expected} (${label})`, () => {
      const s = makeState({
        placements: [
          new Map<SeatId, Placement>([
            ["op1", 1],
            ["op2", 4],
            ["op3", bet as Placement],
            ["player", [1, 2, 3, 4].filter((x) => ![1, 4, bet].includes(x))[0]! as Placement],
          ]),
          null,
          null,
          null,
        ],
      });
      const next = finishRound(s);
      const op3Out = next.outputs[0]!.get("op3")!;
      expect(op3Out.declared).toBe(expected);
    });
  }

  test("falls back to straight rank when player has no bet for this opponent", () => {
    // Construct a placements[0] missing "op3"
    const s = makeState({
      placements: [
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 4],
          ["player", 3],
          // op3 missing
        ]),
        null,
        null,
        null,
      ],
    });
    const next = finishRound(s);
    const op3Out = next.outputs[0]!.get("op3")!;
    expect(op3Out.declared).toBe(2);
  });
});

describe("rankSeats: tiebreak with shared community hand", () => {
  test("when board straight flush dominates, hole card values break the tie strictly", () => {
    // Community is a straight flush 3D-7D. None of the hole cards below can
    // extend it (no 2D/8D) or form anything stronger, so every player's
    // best-5 is the identical community straight flush. The winning order
    // must therefore fall back to hole-card magnitude (desc).
    const seats: readonly Seat[] = [
      { id: "op1", personality: "素直", holeCards: [card("AS"), card("AH")] },
      { id: "op2", personality: "分析屋", holeCards: [card("KS"), card("QS")] },
      { id: "op3", personality: "慎重", holeCards: [card("JC"), card("TH")] },
      { id: "player", holeCards: [card("9C"), card("9H")] },
    ];
    const dealtCommunity: readonly [Card, Card, Card, Card, Card] = [
      card("3D"),
      card("4D"),
      card("5D"),
      card("6D"),
      card("7D"),
    ];
    // Use a tiebreak that would *invert* seat order if it were consulted;
    // the assertion below only passes when hole-card comparison does the work.
    const s = makeState({
      seats,
      dealtCommunity,
      currentRound: 3,
      community: [card("3D"), card("4D"), card("5D"), card("6D"), card("7D")],
      tiebreak: { op1: 3, op2: 2, op3: 1, player: 0 },
      placements: [
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 2],
          ["op3", 3],
          ["player", 4],
        ]),
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 2],
          ["op3", 3],
          ["player", 4],
        ]),
        null,
        null,
      ],
    });
    const next = finishRound(s);
    // 素直 reports the hand-strength rank. Hole values desc:
    //   op1 AA    → [14, 14]
    //   op2 KQ    → [13, 12]
    //   op3 JT    → [11, 10]
    //   player 99 → [9, 9]
    // → op1=1, op2=2, op3=3, player=4
    expect(next.outputs[2]!.get("op1")!.declared).toBe(1);
    expect(next.outputs[2]!.get("op2")!.declared).toBe(2);
    expect(next.outputs[2]!.get("op3")!.declared).toBe(3);
  });

  test("tiebreak field is only consulted when hole cards also tie", () => {
    // Construct a state where seats' best-5 AND hole-card values are identical,
    // forcing the random tiebreak to determine order deterministically.
    // Two-seat test via hole = [A, 2] and [A, 2] with different suits on a
    // non-pair/non-flush board. Extend to 4 seats with dummy distinct holes
    // that rank lower so they don't interfere.
    const seats: readonly Seat[] = [
      { id: "op1", personality: "素直", holeCards: [card("AS"), card("2H")] },
      { id: "op2", personality: "分析屋", holeCards: [card("AC"), card("2D")] },
      { id: "op3", personality: "慎重", holeCards: [card("3S"), card("4S")] },
      { id: "player", holeCards: [card("5C"), card("6D")] },
    ];
    const dealtCommunity: readonly [Card, Card, Card, Card, Card] = [
      card("9H"),
      card("TH"),
      card("JD"),
      card("QS"),
      card("7C"),
    ];
    // op1 / op2 both: A-high, 2 as lowest. Best-5 uses A + board top 4.
    // Hole values desc identical: [14, 2].
    // With tiebreak op1=0, op2=1 → op1 wins.
    const s1 = makeState({
      seats,
      dealtCommunity,
      currentRound: 3,
      community: dealtCommunity,
      tiebreak: { op1: 0, op2: 1, op3: 2, player: 3 },
      placements: [
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 2],
          ["op3", 3],
          ["player", 4],
        ]),
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 2],
          ["op3", 3],
          ["player", 4],
        ]),
        null,
        null,
      ],
    });
    const r1 = finishRound(s1).outputs[2]!;
    expect(r1.get("op1")!.declared).toBe(1);
    expect(r1.get("op2")!.declared).toBe(2);

    // Flip the tiebreak → outcome flips.
    const s2 = { ...s1, tiebreak: { op1: 1, op2: 0, op3: 2, player: 3 } };
    const r2 = finishRound(s2).outputs[2]!;
    expect(r2.get("op2")!.declared).toBe(1);
    expect(r2.get("op1")!.declared).toBe(2);
  });
});

describe("finishRound: personality — 分析屋 (projection)", () => {
  test("at river (5 community) collapses to the actual hand-strength rank", () => {
    // When community has all 5 cards, projection has nothing to sample — it
    // equals the current ranking. Simulate round 3 with community already
    // holding 5 (no straight/flush on board, so hole-card pairs dominate) and
    // verify the analyst's declared matches the deterministic rank.
    const s = makeState({
      currentRound: 3,
      community: [card("3D"), card("4C"), card("5H"), card("8S"), card("JD")],
      placements: [
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 4],
          ["op3", 2],
          ["player", 3],
        ]),
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 4],
          ["op3", 2],
          ["player", 3],
        ]),
        null,
        null,
      ],
    });
    const next = finishRound(s);
    // No board-derived straight/flush; each player's best hand is their pocket
    // pair plus top-3 kickers. Rankings by pair strength: AA > KK > QQ > 22.
    //   op1 AA → 1, op3 KK → 2, player QQ → 3, op2 22 → 4
    const op2Out = next.outputs[2]!.get("op2")!;
    expect(op2Out.declared).toBe(4);
  });

  test("always returns a valid Placement (1-4) even under Monte Carlo noise", () => {
    const s = makeState();
    const next = finishRound(s);
    const op2Out = next.outputs[0]!.get("op2")!;
    expect([1, 2, 3, 4]).toContain(op2Out.declared);
  });
});

describe("finishRound: trend semantics (category-based)", () => {
  test("trend is + when hand category strictly improves", () => {
    // Round 1: op1 has AA (pair). Round 2 with community AA?? would give trips.
    // Make community = A-K-2 diamonds. op1 hole = AS AH. Best 5: AS AH AD KD 2D
    // → three aces (trips). Previous (preflop): pair.
    // Similarly all opponents may or may not improve; only op1 is guaranteed.
    const seats: readonly Seat[] = [
      { id: "op1", personality: "素直", holeCards: [card("AS"), card("AH")] },
      { id: "op2", personality: "分析屋", holeCards: [card("2S"), card("2H")] },
      { id: "op3", personality: "慎重", holeCards: [card("KS"), card("KH")] },
      { id: "player", holeCards: [card("QS"), card("QH")] },
    ];
    const dealtCommunity: readonly [Card, Card, Card, Card, Card] = [
      card("AD"),
      card("3D"),
      card("5D"),
      card("6D"),
      card("7D"),
    ];
    const s = makeState({
      seats,
      dealtCommunity,
      currentRound: 2,
      community: [card("AD"), card("3D"), card("5D")], // flop
      placements: [
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 4],
          ["op3", 2],
          ["player", 3],
        ]),
        null,
        null,
        null,
      ],
    });
    const next = finishRound(s);
    const op1Out = next.outputs[1]!.get("op1")!;
    expect(op1Out.trend).toBe("+");
  });

  test("trend is · when hand category stays the same", () => {
    // op2 (22) with community 3-5-7 of diamonds: still just a pair of twos.
    const seats: readonly Seat[] = [
      { id: "op1", personality: "素直", holeCards: [card("AS"), card("AH")] },
      { id: "op2", personality: "分析屋", holeCards: [card("2S"), card("2H")] },
      { id: "op3", personality: "慎重", holeCards: [card("KS"), card("KH")] },
      { id: "player", holeCards: [card("QS"), card("QH")] },
    ];
    const dealtCommunity: readonly [Card, Card, Card, Card, Card] = [
      card("3D"),
      card("5D"),
      card("7D"),
      card("9D"),
      card("JD"),
    ];
    const s = makeState({
      seats,
      dealtCommunity,
      currentRound: 2,
      community: [card("3D"), card("5D"), card("7D")],
      placements: [
        new Map<SeatId, Placement>([
          ["op1", 1],
          ["op2", 4],
          ["op3", 2],
          ["player", 3],
        ]),
        null,
        null,
        null,
      ],
    });
    const next = finishRound(s);
    const op2Out = next.outputs[1]!.get("op2")!;
    // op2 preflop: pair 22. At flop: still pair 22 (community has no 2).
    // Category unchanged → ·.
    expect(op2Out.trend).toBe("·");
  });
});
