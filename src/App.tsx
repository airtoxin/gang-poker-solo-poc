import { useState } from "react";
import {
  type Card,
  type OpponentSeat,
  type PlayerSeat,
  type RoundPlacements,
  ROUND_STREET,
  type SeatId,
  TOTAL_ROUNDS,
  createInitialState,
  isOpponentSeat,
  isRed,
  rankLabel,
} from "./game.ts";

const ROUND_CHIP_CLASS: readonly string[] = ["chip-r1", "chip-r2", "chip-r3", "chip-r4"];

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
  outputs: ReturnType<typeof createInitialState>["outputs"];
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
}: {
  seat: OpponentSeat;
  placements: readonly (RoundPlacements | null)[];
  outputs: ReturnType<typeof createInitialState>["outputs"];
}) => (
  <section className="seat opponent" aria-label="対戦相手">
    <header className="seat-head">
      <span className="seat-label">
        性格<strong>{seat.personality}</strong>
      </span>
    </header>
    <div className="seat-body">
      <div className="hole">
        <HoleCards cards={seat.holeCards} faceDown={true} />
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

export const App = () => {
  const [state] = useState(createInitialState);
  const street = ROUND_STREET[state.currentRound];
  const opponents = state.seats.filter(isOpponentSeat);
  const player = state.seats.find((s): s is PlayerSeat => s.id === "player")!;

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
        </div>
      </header>
      <div className="table-grid">
        <div className="opponents">
          {opponents.map((seat) => (
            <Opponent
              seat={seat}
              placements={state.placements}
              outputs={state.outputs}
              key={seat.id}
            />
          ))}
        </div>
        <div className="center">
          <Community community={state.community} />
          <Player seat={player} placements={state.placements} />
        </div>
      </div>
      <p className="hint">
        4ラウンドを通じて全員のハンド順位(1〜4)を推理 — リバーでの予想が完全一致すれば勝利
      </p>
    </main>
  );
};
