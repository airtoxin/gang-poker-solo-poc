import "./style.css";
import {
  type Card,
  type GameState,
  HAND_LABEL,
  MAX_BET,
  MIN_BET,
  PAYOUT,
  PAYOUT_TABLE,
  createInitialState,
  deal,
  draw,
  isRed,
  nextRound,
  rankLabel,
  restart,
  setBet,
  toggleHold,
} from "./game.ts";

const root = document.querySelector<HTMLDivElement>("#app")!;
let state: GameState = createInitialState();

const renderCard = (card: Card | undefined, held: boolean, index: number): string => {
  if (!card) {
    return `<div class="slot">
      <div class="card empty" aria-hidden="true"></div>
      <span class="hold-label hidden">HOLD</span>
    </div>`;
  }
  const colorClass = isRed(card.suit) ? "red" : "black";
  const label = `${rankLabel(card.rank)}${card.suit}`;
  const disabled = state.phase !== "holding";
  return `<div class="slot">
    <div
      class="card ${colorClass} ${held ? "held" : ""}"
      role="button"
      tabindex="0"
      aria-label="${label}${held ? " ホールド中" : ""}"
      aria-pressed="${held}"
      aria-disabled="${disabled}"
      data-index="${index}"
    >
      <span class="rank">${rankLabel(card.rank)}${card.suit}</span>
      <span class="suit-big">${card.suit}</span>
      <span class="rank bottom">${rankLabel(card.rank)}${card.suit}</span>
    </div>
    <span class="hold-label ${held ? "" : "hidden"}">HOLD</span>
  </div>`;
};

const renderPayouts = (): string => {
  const highlight = state.phase === "result" ? state.lastResult : null;
  const rows = PAYOUT_TABLE.map((h) => {
    const cls = h === highlight ? "row highlight" : "row";
    return `<div class="${cls}">
      <span class="hand-name">${HAND_LABEL[h]}</span>
      <span class="payout">x${PAYOUT[h]}</span>
    </div>`;
  }).join("");
  return `<div class="payouts" aria-label="配当表">${rows}</div>`;
};

const statusText = (): { text: string; win: boolean } => {
  switch (state.phase) {
    case "betting":
      return { text: "ベットを決めて DEAL を押してください", win: false };
    case "holding":
      return { text: "残すカードをクリックして DRAW を押してください", win: false };
    case "result": {
      if (state.lastResult && state.lastWin > 0) {
        return { text: `${HAND_LABEL[state.lastResult]} — +${state.lastWin}`, win: true };
      }
      return { text: "役なし", win: false };
    }
    case "gameover":
      return { text: "GAME OVER — クレジットが尽きました", win: false };
  }
};

const renderControls = (): string => {
  if (state.phase === "betting") {
    const canDeal = state.credits >= state.bet;
    return `<div class="controls">
      <div class="bet-group">
        <button class="btn secondary" data-action="bet-down" ${state.bet <= MIN_BET ? "disabled" : ""}>−</button>
        <span class="bet-value">BET: ${state.bet}</span>
        <button class="btn secondary" data-action="bet-up" ${state.bet >= Math.min(MAX_BET, state.credits) ? "disabled" : ""}>+</button>
        <button class="btn secondary" data-action="bet-max" ${state.credits < MAX_BET ? "disabled" : ""}>MAX</button>
      </div>
      <button class="btn" data-action="deal" ${canDeal ? "" : "disabled"}>DEAL</button>
    </div>`;
  }
  if (state.phase === "holding") {
    return `<div class="controls">
      <button class="btn" data-action="draw">DRAW</button>
    </div>`;
  }
  if (state.phase === "result") {
    return `<div class="controls">
      <button class="btn" data-action="next">NEXT</button>
    </div>`;
  }
  return `<div class="controls">
    <button class="btn" data-action="restart">RESTART</button>
  </div>`;
};

const render = () => {
  const status = statusText();
  const hand = state.phase === "betting" ? Array<Card | undefined>(5).fill(undefined) : state.hand;
  const cardsHtml = hand.map((c, i) => renderCard(c, state.held[i] ?? false, i)).join("");
  root.innerHTML = `<div class="game">
    <header class="header">
      <h1 class="title">Solo Video Poker</h1>
      <div class="meta">
        <span>BET<strong>${state.bet}</strong></span>
        <span>CREDITS<strong>${state.credits}</strong></span>
      </div>
    </header>
    ${renderPayouts()}
    <div class="status ${status.win ? "win" : ""}" aria-live="polite">${status.text}</div>
    <div class="hand" role="group" aria-label="手札">${cardsHtml}</div>
    ${renderControls()}
    <div class="footer">Jacks or Better — カードをクリックでホールド</div>
  </div>`;
  attachListeners();
};

const attachListeners = () => {
  root.querySelectorAll<HTMLElement>(".card[role='button']").forEach((el) => {
    const idx = Number(el.dataset.index);
    const handle = () => {
      if (state.phase !== "holding") return;
      state = toggleHold(state, idx);
      render();
    };
    el.addEventListener("click", handle);
    el.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handle();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.dataset.action;
      switch (action) {
        case "bet-down":
          state = setBet(state, state.bet - 1);
          break;
        case "bet-up":
          state = setBet(state, state.bet + 1);
          break;
        case "bet-max":
          state = setBet(state, MAX_BET);
          break;
        case "deal":
          state = deal(state);
          break;
        case "draw":
          state = draw(state);
          break;
        case "next":
          state = nextRound(state);
          break;
        case "restart":
          state = restart();
          break;
      }
      render();
    });
  });
};

render();
