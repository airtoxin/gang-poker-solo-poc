import { useCallback, useEffect, useState } from "react";
import {
  advance,
  type Card,
  completeRound,
  confirmPlacements,
  createInitialState,
  type GameState,
  isOpponentSeat,
  isPendingComplete,
  isRed,
  type OpponentSeat,
  type Placement,
  PLACEMENTS,
  type PlayerSeat,
  rankLabel,
  ROUND_STREET,
  type RoundOutputs,
  type RoundPhase,
  type RoundPlacements,
  runFeedback,
  type Seat,
  type SeatId,
  togglePendingPlacement,
  TOTAL_ROUNDS,
} from "./game.ts";

const ROUND_CHIP_CLASS: readonly string[] = ["chip-r1", "chip-r2", "chip-r3", "chip-r4"];
const AUTO_ADVANCE_MS = 2000;

const PHASE_LABEL: Record<RoundPhase, string> = {
  placement: "予想フェーズ",
  dealing: "配札中",
  feedback: "宣言フェーズ",
  complete: "ラウンド終了",
};

const seatLabel = (seat: Seat): string =>
  seat.id === "player" ? "あなた" : `相手 / ${seat.personality}`;

const CardFace = ({ card }: { card: Card }) => {
  const colorClass = isRed(card.suit) ? "red" : "black";
  const label = `${rankLabel(card.rank)}${card.suit}`;
  return (
    <div className={`card face ${colorClass}`}>
      <span className="corner tl">{label}</span>
      <span className="pip">{card.suit}</span>
      <span className="corner br">{label}</span>
    </div>
  );
};

const CardBack = () => <div className="card back" aria-label="裏向き" />;

const CardEmpty = () => <div className="card empty" aria-hidden="true" />;

const HoleCards = ({ cards, faceDown }: { cards: readonly [Card, Card]; faceDown: boolean }) => {
  if (faceDown)
    return (
      <>
        <CardBack />
        <CardBack />
      </>
    );
  return (
    <>
      <CardFace card={cards[0]} />
      <CardFace card={cards[1]} />
    </>
  );
};

const placementAt = (
  placements: readonly (RoundPlacements | null)[],
  roundIdx: number,
  id: SeatId,
): number | null => placements[roundIdx]?.get(id) ?? null;

const OpponentTrack = ({
  seatId,
  placements,
  outputs,
}: {
  seatId: SeatId;
  placements: readonly (RoundPlacements | null)[];
  outputs: readonly (RoundOutputs | null)[];
}) => (
  <div className="round-track" aria-label="ラウンド別予想と宣言">
    {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
      const round = i + 1;
      const chipClass = ROUND_CHIP_CLASS[i];
      const placement = placementAt(placements, i, seatId);
      const output = seatId === "player" ? null : (outputs[i]?.get(seatId) ?? null);
      return (
        <div className="round-cell" data-round={round} key={round}>
          <div className="feedback">
            {output == null ? (
              <span className="fb-empty" aria-hidden="true">
                —
              </span>
            ) : (
              <span className="fb-declared" aria-label={`宣言順位 ${output.declared}`}>
                {output.declared}
              </span>
            )}
            {output == null || output.trend == null ? (
              <span className="fb-trend empty" aria-hidden="true" />
            ) : (
              <span
                className={`fb-trend ${output.trend === "+" ? "up" : "flat"}`}
                aria-label={`役の変化 ${output.trend}`}
              >
                {output.trend}
              </span>
            )}
          </div>
          {placement == null ? (
            <div className={`chip empty ${chipClass}`} aria-label={`ラウンド${round} 未配分`} />
          ) : (
            <div className={`chip ${chipClass}`} aria-label={`ラウンド${round} 配分 ${placement}`}>
              <span>{placement}</span>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const PlayerTrack = ({ placements }: { placements: readonly (RoundPlacements | null)[] }) => (
  <div className="round-track" aria-label="自分の予想履歴">
    {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
      const round = i + 1;
      const chipClass = ROUND_CHIP_CLASS[i];
      const placement = placementAt(placements, i, "player");
      return (
        <div className="round-cell" data-round={round} key={round}>
          {placement == null ? (
            <div className={`chip empty ${chipClass}`} aria-label={`ラウンド${round} 未配分`} />
          ) : (
            <div className={`chip ${chipClass}`} aria-label={`ラウンド${round} 配分 ${placement}`}>
              <span>{placement}</span>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const Opponent = ({
  seat,
  placements,
  outputs,
  faceDown,
}: {
  seat: OpponentSeat;
  placements: readonly (RoundPlacements | null)[];
  outputs: readonly (RoundOutputs | null)[];
  faceDown: boolean;
}) => (
  <section className="seat opponent" aria-label="対戦相手">
    <header className="seat-head">
      <span className="seat-label">
        性格<strong>{seat.personality}</strong>
      </span>
    </header>
    <div className="seat-body">
      <div className="hole">
        <HoleCards cards={seat.holeCards} faceDown={faceDown} />
      </div>
      <OpponentTrack seatId={seat.id} placements={placements} outputs={outputs} />
    </div>
  </section>
);

const Deck = () => (
  <div className="deck" aria-hidden="true">
    <div className="card back" />
    <div className="card back" />
    <div className="card back" />
  </div>
);

const Community = ({ community }: { community: readonly Card[] }) => (
  <section className="community" aria-label="コミュニティカード">
    <Deck />
    <div className="board">
      {Array.from({ length: 5 }, (_, i) => {
        const card = community[i];
        return card ? <CardFace card={card} key={i} /> : <CardEmpty key={i} />;
      })}
    </div>
  </section>
);

const Player = ({
  seat,
  placements,
}: {
  seat: PlayerSeat;
  placements: readonly (RoundPlacements | null)[];
}) => (
  <section className="player-area" aria-label="あなた">
    <PlayerTrack placements={placements} />
    <div className="hole player-hole">
      <HoleCards cards={seat.holeCards} faceDown={false} />
    </div>
  </section>
);

const PlacementPanel = ({
  seats,
  pending,
  onToggle,
  onConfirm,
  ready,
  round,
}: {
  seats: readonly Seat[];
  pending: Readonly<Partial<Record<SeatId, Placement>>>;
  onToggle: (seatId: SeatId, placement: Placement) => void;
  onConfirm: () => void;
  ready: boolean;
  round: number;
}) => (
  <section className="placement-panel" aria-label="順位予想">
    <h2 className="panel-title">ラウンド{round} — 全員の順位を予想(1〜4を1席ずつ)</h2>
    <div className="placement-rows">
      {seats.map((seat) => (
        <div className="placement-row" key={seat.id}>
          <span className="placement-seat">{seatLabel(seat)}</span>
          <div className="placement-buttons">
            {PLACEMENTS.map((n) => (
              <button
                type="button"
                key={n}
                className={`placement-btn ${ROUND_CHIP_CLASS[n - 1]} ${
                  pending[seat.id] === n ? "selected" : ""
                }`}
                onClick={() => onToggle(seat.id, n)}
                aria-pressed={pending[seat.id] === n}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
    <button type="button" className="confirm-btn" disabled={!ready} onClick={onConfirm}>
      確定
    </button>
  </section>
);

const ShowdownPanel = ({ state, onRestart }: { state: GameState; onRestart: () => void }) => {
  const finalPred = state.placements[TOTAL_ROUNDS - 1];
  const actual = state.actualPlacements;
  const correct =
    finalPred != null && state.seats.every((s) => finalPred.get(s.id) === actual.get(s.id));
  return (
    <section className="showdown-panel" aria-label="ショウダウン結果">
      <h2 className="panel-title">ショウダウン</h2>
      <p className={`showdown-result ${correct ? "win" : "lose"}`}>
        {correct ? "完全一致!勝利" : "ハズレ"}
      </p>
      <table className="showdown-table">
        <thead>
          <tr>
            <th>席</th>
            <th>予想</th>
            <th>実際</th>
          </tr>
        </thead>
        <tbody>
          {state.seats.map((s) => {
            const pred = finalPred?.get(s.id) ?? null;
            const real = actual.get(s.id) ?? null;
            const hit = pred != null && pred === real;
            return (
              <tr key={s.id} className={hit ? "hit" : "miss"}>
                <td>{seatLabel(s)}</td>
                <td>{pred ?? "—"}</td>
                <td>{real ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="restart-btn" onClick={onRestart}>
        もう一度
      </button>
    </section>
  );
};

export const App = () => {
  const [state, setState] = useState(createInitialState);

  const handleToggle = useCallback((seatId: SeatId, placement: Placement) => {
    setState((s) =>
      s.roundPhase === "placement" ? togglePendingPlacement(s, seatId, placement) : s,
    );
  }, []);

  const handleConfirm = useCallback(() => {
    setState((s) =>
      s.roundPhase === "placement" && isPendingComplete(s.seats, s.pendingPlacements)
        ? confirmPlacements(s)
        : s,
    );
  }, []);

  const handleRestart = useCallback(() => {
    setState(createInitialState());
  }, []);

  useEffect(() => {
    if (state.gamePhase !== "in_progress") return;
    if (state.roundPhase === "placement") return;

    const id = window.setTimeout(() => {
      setState((s) => {
        if (s.gamePhase !== "in_progress") return s;
        switch (s.roundPhase) {
          case "dealing":
            return runFeedback(s);
          case "feedback":
            return completeRound(s);
          case "complete":
            return advance(s);
          default:
            return s;
        }
      });
    }, AUTO_ADVANCE_MS);

    return () => {
      window.clearTimeout(id);
    };
  }, [state.gamePhase, state.roundPhase, state.currentRound]);

  const street = ROUND_STREET[state.currentRound];
  const opponents = state.seats.filter(isOpponentSeat);
  const player = state.seats.find((s): s is PlayerSeat => s.id === "player")!;
  const revealOpponents = state.gamePhase === "showdown";

  return (
    <main className="table">
      <header className="table-header">
        <h1>
          Gang Poker <span className="subtitle">Solo</span>
        </h1>
        <div className="round-indicator">
          <span className="round-label">ROUND</span>
          <span className="round-value">
            <strong>{state.currentRound}</strong> / {TOTAL_ROUNDS}
          </span>
          <span className="round-street">{street}</span>
          {state.gamePhase === "in_progress" && (
            <span className="round-phase">{PHASE_LABEL[state.roundPhase]}</span>
          )}
        </div>
      </header>
      <div className="table-grid">
        <div className="opponents">
          {opponents.map((seat) => (
            <Opponent
              seat={seat}
              placements={state.placements}
              outputs={state.outputs}
              faceDown={!revealOpponents}
              key={seat.id}
            />
          ))}
        </div>
        <div className="center">
          <Community community={state.community} />
          <Player seat={player} placements={state.placements} />
        </div>
      </div>
      {state.gamePhase === "in_progress" && state.roundPhase === "placement" && (
        <PlacementPanel
          seats={state.seats}
          pending={state.pendingPlacements}
          onToggle={handleToggle}
          onConfirm={handleConfirm}
          ready={isPendingComplete(state.seats, state.pendingPlacements)}
          round={state.currentRound}
        />
      )}
      {state.gamePhase === "showdown" && <ShowdownPanel state={state} onRestart={handleRestart} />}
      <p className="hint">
        4ラウンドを通じて全員のハンド順位(1〜4)を推理 — リバーでの予想が完全一致すれば勝利
      </p>
    </main>
  );
};
