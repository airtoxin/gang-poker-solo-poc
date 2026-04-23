import "./style.css";
import {
  type Card,
  CHIP_VALUE,
  type ChipStack,
  type Opponent,
  type Player,
  chipTotal,
  createInitialState,
  isRed,
  rankLabel,
} from "./game.ts";

const root = document.querySelector<HTMLDivElement>("#app")!;
const state = createInitialState();

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

const renderHoleCards = (cards: readonly [Card, Card] | null, faceDown: boolean): string => {
  if (!cards) return `${renderCardEmpty()}${renderCardEmpty()}`;
  if (faceDown) return `${renderCardBack()}${renderCardBack()}`;
  return `${renderCardFace(cards[0])}${renderCardFace(cards[1])}`;
};

const CHIP_ORDER: readonly (keyof ChipStack)[] = ["white", "yellow", "orange", "red"];

const renderChips = (chips: ChipStack): string => {
  const stacks = CHIP_ORDER.map((color) => {
    const count = chips[color];
    return `<div class="chip chip-${color}" title="${CHIP_VALUE[color]} × ${count}">
      <span>${count}</span>
    </div>`;
  }).join("");
  return `<div class="chips" aria-label="チップ: ${chipTotal(chips)}">${stacks}</div>`;
};

const renderOpponent = (op: Opponent): string => {
  return `<section class="opponent ${op.folded ? "folded" : ""}" aria-label="対戦相手">
    <header class="seat-label">性格: <strong>${op.personality}</strong></header>
    <div class="seat-row">
      <div class="hole">${renderHoleCards(op.holeCards, true)}</div>
      ${renderChips(op.chips)}
    </div>
  </section>`;
};

const renderCommunity = (community: readonly Card[]): string => {
  const slots: string[] = [];
  for (let i = 0; i < 5; i++) {
    const card = community[i];
    slots.push(card ? renderCardFace(card) : renderCardEmpty());
  }
  return `<section class="community" aria-label="コミュニティカード">
    <div class="board">${slots.join("")}</div>
    <div class="pot">POT<strong>${state.pot}</strong></div>
  </section>`;
};

const renderPlayer = (player: Player): string => {
  return `<section class="player-area" aria-label="あなた">
    ${renderChips(player.chips)}
    <div class="hole player-hole">${renderHoleCards(player.holeCards, false)}</div>
    <div class="seat-label you">YOU</div>
  </section>`;
};

const renderActions = (): string => {
  return `<section class="actions" aria-label="アクション">
    <button class="btn danger" data-action="fold">FOLD</button>
    <button class="btn" data-action="check">CHECK</button>
    <button class="btn" data-action="call">CALL</button>
    <button class="btn primary" data-action="raise">RAISE</button>
  </section>`;
};

const render = () => {
  root.innerHTML = `<main class="table">
    <header class="table-header">
      <h1>Gang Poker <span class="subtitle">Solo Texas Hold'em</span></h1>
      <div class="street">STREET<strong>${state.street.toUpperCase()}</strong></div>
    </header>
    <div class="table-grid">
      <div class="opponents">
        ${state.opponents.map(renderOpponent).join("")}
      </div>
      <div class="center">
        ${renderCommunity(state.community)}
        ${renderPlayer(state.player)}
      </div>
    </div>
    ${renderActions()}
  </main>`;
};

render();
