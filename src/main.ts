import "./style.css";
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

const root = document.querySelector<HTMLDivElement>("#app")!;
const state = createInitialState();

const ROUND_CHIP_CLASS: readonly string[] = ["chip-r1", "chip-r2", "chip-r3", "chip-r4"];

const renderCardFace = (card: Card): string => {
  const colorClass = isRed(card.suit) ? "red" : "black";
  return `<div class="card face ${colorClass}">
    <span class="corner tl">${rankLabel(card.rank)}${card.suit}</span>
    <span class="pip">${card.suit}</span>
    <span class="corner br">${rankLabel(card.rank)}${card.suit}</span>
  </div>`;
};

const renderCardBack = (): string => `<div class="card back" aria-label="裏向き"></div>`;

const renderCardEmpty = (): string => `<div class="card empty" aria-hidden="true"></div>`;

const renderHoleCards = (cards: readonly [Card, Card], faceDown: boolean): string => {
  if (faceDown) return `${renderCardBack()}${renderCardBack()}`;
  return `${renderCardFace(cards[0])}${renderCardFace(cards[1])}`;
};

const placementAt = (
  placements: readonly (RoundPlacements | null)[],
  roundIdx: number,
  id: SeatId,
): number | null => placements[roundIdx]?.get(id) ?? null;

const renderOpponentTrack = (seatId: SeatId): string => {
  const cells = Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
    const round = i + 1;
    const chipClass = ROUND_CHIP_CLASS[i];
    const placement = placementAt(state.placements, i, seatId);
    const chip =
      placement == null
        ? `<div class="chip empty ${chipClass}" aria-label="ラウンド${round} 未配分"></div>`
        : `<div class="chip ${chipClass}" aria-label="ラウンド${round} 配分 ${placement}"><span>${placement}</span></div>`;

    const output = seatId === "player" ? null : (state.outputs[i]?.get(seatId) ?? null);
    const declared =
      output == null
        ? `<span class="fb-empty" aria-hidden="true">—</span>`
        : `<span class="fb-declared" aria-label="宣言順位 ${output.declared}">${output.declared}</span>`;
    const trend =
      output == null || output.trend == null
        ? `<span class="fb-trend empty" aria-hidden="true"></span>`
        : `<span class="fb-trend ${output.trend === "+" ? "up" : "flat"}" aria-label="役の変化 ${output.trend}">${output.trend}</span>`;

    return `<div class="round-cell" data-round="${round}">
      <div class="feedback">${declared}${trend}</div>
      ${chip}
    </div>`;
  }).join("");
  return `<div class="round-track" aria-label="ラウンド別予想と宣言">${cells}</div>`;
};

const renderPlayerTrack = (): string => {
  const cells = Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
    const round = i + 1;
    const chipClass = ROUND_CHIP_CLASS[i];
    const placement = placementAt(state.placements, i, "player");
    const chip =
      placement == null
        ? `<div class="chip empty ${chipClass}" aria-label="ラウンド${round} 未配分"></div>`
        : `<div class="chip ${chipClass}" aria-label="ラウンド${round} 配分 ${placement}"><span>${placement}</span></div>`;
    return `<div class="round-cell" data-round="${round}">${chip}</div>`;
  }).join("");
  return `<div class="round-track" aria-label="自分の予想履歴">${cells}</div>`;
};

const renderOpponent = (seat: OpponentSeat): string => `
  <section class="seat opponent" aria-label="対戦相手">
    <header class="seat-head">
      <span class="seat-label">性格<strong>${seat.personality}</strong></span>
    </header>
    <div class="seat-body">
      <div class="hole">${renderHoleCards(seat.holeCards, true)}</div>
      ${renderOpponentTrack(seat.id)}
    </div>
  </section>
`;

const renderDeck = (): string =>
  `<div class="deck" aria-hidden="true">
    <div class="card back"></div>
    <div class="card back"></div>
    <div class="card back"></div>
  </div>`;

const renderCommunity = (community: readonly Card[]): string => {
  const slots: string[] = [];
  for (let i = 0; i < 5; i++) {
    const card = community[i];
    slots.push(card ? renderCardFace(card) : renderCardEmpty());
  }
  return `<section class="community" aria-label="コミュニティカード">
    ${renderDeck()}
    <div class="board">${slots.join("")}</div>
  </section>`;
};

const renderPlayer = (seat: PlayerSeat): string => `
  <section class="player-area" aria-label="あなた">
    ${renderPlayerTrack()}
    <div class="hole player-hole">${renderHoleCards(seat.holeCards, false)}</div>
  </section>
`;

const render = () => {
  const street = ROUND_STREET[state.currentRound];
  const opponents = state.seats.filter(isOpponentSeat);
  const player = state.seats.find((s): s is PlayerSeat => s.id === "player")!;

  root.innerHTML = `<main class="table">
    <header class="table-header">
      <h1>Gang Poker <span class="subtitle">Solo</span></h1>
      <div class="round-indicator">
        <span class="round-label">ROUND</span>
        <span class="round-value"><strong>${state.currentRound}</strong> / ${TOTAL_ROUNDS}</span>
        <span class="round-street">${street}</span>
      </div>
    </header>
    <div class="table-grid">
      <div class="opponents">
        ${opponents.map(renderOpponent).join("")}
      </div>
      <div class="center">
        ${renderCommunity(state.community)}
        ${renderPlayer(player)}
      </div>
    </div>
    <p class="hint">4ラウンドを通じて全員のハンド順位(1〜4)を推理 — リバーでの予想が完全一致すれば勝利</p>
  </main>`;
};

render();
