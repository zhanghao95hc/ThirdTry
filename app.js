const CARD_TYPES = {
  attack: {
    name: "进攻",
    mark: "攻",
    className: "type-attack",
    desc: "未被防住时造成 1 + 蓄力伤害。"
  },
  defense: {
    name: "普通防御",
    mark: "防",
    className: "type-defense",
    desc: "挡住普通攻击，但会被 3 层蓄力突破。"
  },
  absolute: {
    name: "绝对防御",
    mark: "绝",
    className: "type-absolute",
    desc: "整副牌唯一一张，可以挡住任何攻击。"
  },
  charge: {
    name: "蓄力",
    mark: "蓄",
    className: "type-charge",
    desc: "未撞上进攻时，本回合蓄力 +1。"
  }
};

const PHASES = {
  layout: {
    title: "布置阶段",
    hint: "从你的手牌中选择 2 张置入出牌区。确认后，AI 会同时完成布置。",
    action: "确认布置"
  },
  reveal: {
    title: "对战阶段：翻开一张",
    hint: "选择你出牌区的一张牌翻开。确认后，AI 也会翻开一张。",
    action: "确认翻牌"
  },
  choose: {
    title: "对战阶段：选择打出",
    hint: "从已翻开和未翻开的两张牌中选择 1 张。确认后，AI 同时选择并结算。",
    action: "同时打出"
  },
  discard: {
    title: "回合结束：弃牌",
    hint: "抽 10 张后，你的手牌为 12 张。请选择 2 张弃掉，AI 会自动弃牌。",
    action: "确认弃牌"
  },
  gameover: {
    title: "游戏结束",
    hint: "胜负已经结算，可以重新开始一局。",
    action: "再来一局"
  }
};

const HUMAN = 0;
const AI = 1;
let nextCardId = 0;

const state = {
  phase: "layout",
  round: 1,
  duel: 1,
  players: [],
  setupSelection: new Set(),
  discardSelection: new Set(),
  log: []
};

const defaultConfigs = [
  { attack: 8, defense: 11 },
  { attack: 9, defense: 10 }
];

const deckBuilders = document.querySelector("#deckBuilders");
const startGameButton = document.querySelector("#startGame");
const setupPanel = document.querySelector("#setupPanel");
const gameTable = document.querySelector("#gameTable");
const roundStatus = document.querySelector("#roundStatus");
const phaseTitle = document.querySelector("#phaseTitle");
const phaseHint = document.querySelector("#phaseHint");
const mainAction = document.querySelector("#mainAction");
const restart = document.querySelector("#restart");
const battleLog = document.querySelector("#battleLog");
const playerTemplate = document.querySelector("#playerTemplate");

function makeCard(type, owner, index) {
  nextCardId += 1;
  return {
    id: `${owner}-${type}-${index}-${nextCardId}`,
    type,
    revealed: false
  };
}

function buildDeck(config, owner) {
  const cards = [];
  const counts = {
    attack: config.attack,
    defense: config.defense,
    absolute: 1,
    charge: 29 - config.attack - config.defense
  };

  Object.entries(counts).forEach(([type, count]) => {
    for (let i = 0; i < count; i += 1) {
      cards.push(makeCard(type, owner, i));
    }
  });

  return shuffle(cards);
}

function shuffle(cards) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function draw(player, count) {
  const drawn = player.deck.splice(0, count);
  player.hand.push(...drawn);
}

function makePlayer(name, config, index, isAi = false) {
  const deck = buildDeck(config, index);
  const player = {
    name,
    isAi,
    hp: 10,
    deck,
    discard: [],
    hand: [],
    staged: [null, null],
    revealChoice: null,
    playChoice: null,
    charge: 0,
    config
  };
  draw(player, 10);
  return player;
}

function getConfig(index) {
  const builder = deckBuilders.querySelector(`[data-builder="${index}"]`);
  return {
    attack: Number(builder.querySelector('[data-field="attack"]').value),
    defense: Number(builder.querySelector('[data-field="defense"]').value)
  };
}

function renderDeckBuilders() {
  deckBuilders.innerHTML = "";
  const labels = ["玩家牌组", "AI 牌组"];
  defaultConfigs.forEach((config, index) => {
    const builder = document.createElement("article");
    builder.className = "deck-builder";
    builder.dataset.builder = index;
    builder.innerHTML = `
      <h3>${labels[index]}</h3>
      <label class="builder-row">
        <span>进攻</span>
        <input data-field="attack" type="range" min="0" max="10" value="${config.attack}" />
        <strong data-value="attack">${config.attack}</strong>
      </label>
      <label class="builder-row">
        <span>普通防御</span>
        <input data-field="defense" type="range" min="0" max="${29 - config.attack}" value="${config.defense}" />
        <strong data-value="defense">${config.defense}</strong>
      </label>
      <div class="builder-total">
        <span class="tiny-pill" data-total></span>
        <span class="tiny-pill">绝对防御 1</span>
        <span class="tiny-pill" data-charge></span>
      </div>
    `;
    deckBuilders.appendChild(builder);
  });

  updateBuilders();
}

function handleBuilderInput(event) {
  if (!event.target.matches("input")) return;
  const builder = event.target.closest(".deck-builder");
  const attack = builder.querySelector('[data-field="attack"]');
  const defense = builder.querySelector('[data-field="defense"]');

  if (event.target === attack) {
    defense.max = String(29 - Number(attack.value));
    if (Number(defense.value) > Number(defense.max)) {
      defense.value = defense.max;
    }
  }

  updateBuilders();
}

function updateBuilders() {
  deckBuilders.querySelectorAll(".deck-builder").forEach((builder) => {
    const attack = Number(builder.querySelector('[data-field="attack"]').value);
    const defense = Number(builder.querySelector('[data-field="defense"]').value);
    const charge = 29 - attack - defense;
    const total = attack + defense + charge + 1;

    builder.querySelector('[data-value="attack"]').textContent = attack;
    builder.querySelector('[data-value="defense"]').textContent = defense;
    builder.querySelector("[data-charge]").textContent = `蓄力 ${charge}`;
    builder.querySelector("[data-total]").textContent = `总数 ${total}/30`;
  });
}

function startGame() {
  nextCardId = 0;
  state.round = 1;
  state.duel = 1;
  state.phase = "layout";
  state.setupSelection = new Set();
  state.discardSelection = new Set();
  state.log = ["你和 AI 洗牌，各抽 10 张，第一回合开始。"];
  state.players = [
    makePlayer("玩家", getConfig(HUMAN), HUMAN),
    makePlayer("AI 对手", getConfig(AI), AI, true)
  ];
  setupPanel.hidden = true;
  gameTable.hidden = false;
  render();
}

function restartGame() {
  setupPanel.hidden = false;
  gameTable.hidden = true;
  roundStatus.textContent = "准备组牌";
  state.players = [];
  state.log = [];
  renderDeckBuilders();
}

function resetDuelChoices() {
  state.setupSelection = new Set();
  state.players.forEach((player) => {
    player.staged = [null, null];
    player.revealChoice = null;
    player.playChoice = null;
  });
}

function beginNextDuel() {
  state.duel += 1;
  state.phase = "layout";
  resetDuelChoices();
}

function beginDiscard() {
  state.phase = "discard";
  state.discardSelection = new Set();
  state.players.forEach((player) => draw(player, 10));
  state.log.unshift(`第 ${state.round} 回合结束，双方各抽 10 张。请选择 2 张弃牌。`);
}

function beginNextRound() {
  state.round += 1;
  state.duel = 1;
  state.phase = "layout";
  state.players.forEach((player) => {
    player.charge = 0;
    player.revealChoice = null;
    player.playChoice = null;
    player.staged = [null, null];
  });
  state.setupSelection = new Set();
  state.log.unshift(`第 ${state.round} 回合开始，双方蓄力次数归零。`);
}

function endByHpOrRounds() {
  const [human, ai] = state.players;
  let message = "";
  if (human.hp <= 0 || ai.hp <= 0) {
    if (human.hp <= 0 && ai.hp <= 0) {
      if (human.hp === ai.hp) message = "双方同时倒下，平局。";
      else message = human.hp > ai.hp ? "双方同时倒下，你以剩余生命优势获胜。" : "双方同时倒下，AI 以剩余生命优势获胜。";
    } else {
      message = human.hp <= 0 ? "你的生命归零，AI 获胜。" : "AI 生命归零，你获胜。";
    }
  } else if (state.round >= 3 && state.duel >= 4) {
    if (human.hp === ai.hp) message = "三个回合结束，生命值相同，平局。";
    else message = human.hp > ai.hp ? "三个回合结束，你的生命值更高，获胜。" : "三个回合结束，AI 的生命值更高，AI 获胜。";
  }

  if (!message) return false;
  state.phase = "gameover";
  state.log.unshift(message);
  return true;
}

function cardLabel(card) {
  return CARD_TYPES[card.type].name;
}

function isDefense(card) {
  return card.type === "defense" || card.type === "absolute";
}

function attackBlocked(attacker, defenderCard) {
  if (!isDefense(defenderCard)) return false;
  if (defenderCard.type === "absolute") return true;
  return attacker.charge < 3;
}

function resolveAttack(attackerIndex, defenderIndex, playedCards, entries) {
  const attacker = state.players[attackerIndex];
  const defender = state.players[defenderIndex];
  const attackCard = playedCards[attackerIndex];
  const defenseCard = playedCards[defenderIndex];
  if (attackCard.type !== "attack") return;

  const storedCharge = attacker.charge;
  const blocked = attackBlocked(attacker, defenseCard);
  if (blocked) {
    entries.push(`${attacker.name} 的进攻被 ${defender.name} 的${cardLabel(defenseCard)}挡住。`);
  } else {
    const damage = 1 + storedCharge;
    defender.hp -= damage;
    entries.push(`${attacker.name} 进攻命中，造成 ${damage} 点伤害。`);
  }
  attacker.charge = 0;
}

function resolveCharge(playerIndex, opponentIndex, playedCards, entries) {
  const player = state.players[playerIndex];
  if (playedCards[playerIndex].type !== "charge") return;
  if (playedCards[opponentIndex].type === "attack") {
    entries.push(`${player.name} 蓄力撞上进攻，蓄力无效。`);
    return;
  }
  player.charge += 1;
  entries.push(`${player.name} 蓄力成功，本回合蓄力为 ${player.charge}。`);
}

function resolveDuel() {
  chooseAiPlay();
  const playedCards = state.players.map((player) => player.staged[player.playChoice]);
  const entries = [
    `第 ${state.round} 回合第 ${state.duel} 对局：你打出${cardLabel(playedCards[HUMAN])}，AI 打出${cardLabel(playedCards[AI])}。`
  ];

  resolveAttack(HUMAN, AI, playedCards, entries);
  resolveAttack(AI, HUMAN, playedCards, entries);
  resolveCharge(HUMAN, AI, playedCards, entries);
  resolveCharge(AI, HUMAN, playedCards, entries);

  state.players.forEach((player) => {
    player.staged.forEach((card) => {
      card.revealed = false;
      player.discard.push(card);
    });
  });

  state.log.unshift(entries.join(" "));

  if (endByHpOrRounds()) return;
  if (state.duel < 4) {
    beginNextDuel();
  } else if (state.round < 3) {
    beginDiscard();
  } else {
    endByHpOrRounds();
  }
}

function cardScoreForAi(card, player, opponent) {
  if (card.type === "attack") {
    return 40 + player.charge * 18 + (opponent.hp <= 1 + player.charge ? 40 : 0);
  }
  if (card.type === "absolute") {
    return 34 + (player.hp <= 5 ? 24 : 0);
  }
  if (card.type === "defense") {
    return 28 + (player.hp <= 5 ? 18 : 0);
  }
  return 30 + (player.charge < 3 ? 12 : -12);
}

function chooseAiLayout() {
  const ai = state.players[AI];
  const human = state.players[HUMAN];
  const scored = ai.hand.map((card, index) => ({
    index,
    score: cardScoreForAi(card, ai, human) + Math.random() * 18
  }));
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored.slice(0, 2).map((item) => item.index).sort((a, b) => b - a);
  ai.staged = chosen.map((handIndex) => ai.hand[handIndex]).reverse();
  chosen.forEach((handIndex) => ai.hand.splice(handIndex, 1));
}

function chooseAiReveal() {
  const ai = state.players[AI];
  const betterSlot = ai.staged[0].type === "absolute" ? 0 : ai.staged[1].type === "absolute" ? 1 : Math.floor(Math.random() * 2);
  ai.revealChoice = betterSlot;
  ai.staged[betterSlot].revealed = true;
}

function chooseAiPlay() {
  const ai = state.players[AI];
  const human = state.players[HUMAN];
  const humanVisible = human.staged[human.revealChoice];
  const slotScores = ai.staged.map((card, index) => {
    let score = cardScoreForAi(card, ai, human);
    if (humanVisible?.type === "attack" && isDefense(card)) score += card.type === "absolute" ? 55 : 40;
    if (humanVisible?.type === "charge" && card.type === "attack") score += 42;
    if (humanVisible && isDefense(humanVisible) && card.type === "charge") score += 28;
    if (card.type === "attack" && ai.charge >= 3) score += 30;
    return { index, score: score + Math.random() * 10 };
  });
  slotScores.sort((a, b) => b.score - a.score);
  ai.playChoice = slotScores[0].index;
}

function chooseAiDiscard() {
  const ai = state.players[AI];
  const human = state.players[HUMAN];
  const scored = ai.hand.map((card, index) => ({
    index,
    score: cardScoreForAi(card, ai, human) + Math.random() * 10
  }));
  scored.sort((a, b) => a.score - b.score);
  const chosen = scored.slice(0, 2).map((item) => item.index).sort((a, b) => b - a);
  chosen.forEach((handIndex) => {
    const [card] = ai.hand.splice(handIndex, 1);
    ai.discard.push(card);
  });
}

function handleCardClick(playerIndex, cardIndex) {
  if (playerIndex !== HUMAN) return;

  if (state.phase === "layout") {
    if (state.setupSelection.has(cardIndex)) {
      state.setupSelection.delete(cardIndex);
    } else if (state.setupSelection.size < 2) {
      state.setupSelection.add(cardIndex);
    }
  }

  if (state.phase === "discard") {
    if (state.discardSelection.has(cardIndex)) {
      state.discardSelection.delete(cardIndex);
    } else if (state.discardSelection.size < 2) {
      state.discardSelection.add(cardIndex);
    }
  }

  render();
}

function handleSlotClick(playerIndex, slotIndex) {
  if (playerIndex !== HUMAN) return;
  const player = state.players[playerIndex];
  if (!player.staged[slotIndex]) return;

  if (state.phase === "reveal") {
    player.revealChoice = slotIndex;
  }

  if (state.phase === "choose") {
    player.playChoice = slotIndex;
  }

  render();
}

function confirmLayout() {
  const human = state.players[HUMAN];
  const chosen = [...state.setupSelection].sort((a, b) => b - a);
  human.staged = chosen.map((handIndex) => human.hand[handIndex]).reverse();
  chosen.forEach((handIndex) => human.hand.splice(handIndex, 1));
  chooseAiLayout();
  state.phase = "reveal";
  state.setupSelection = new Set();
  state.log.unshift(`你完成布置，AI 也放下了 2 张牌。`);
}

function confirmReveal() {
  const human = state.players[HUMAN];
  human.staged[human.revealChoice].revealed = true;
  chooseAiReveal();
  state.phase = "choose";
  state.log.unshift(`双方各翻开一张牌：你翻开${cardLabel(human.staged[human.revealChoice])}，AI 翻开${cardLabel(state.players[AI].staged[state.players[AI].revealChoice])}。`);
}

function confirmDiscard() {
  const human = state.players[HUMAN];
  const chosen = [...state.discardSelection].sort((a, b) => b - a);
  chosen.forEach((handIndex) => {
    const [card] = human.hand.splice(handIndex, 1);
    human.discard.push(card);
  });
  chooseAiDiscard();
  beginNextRound();
}

function handleMainAction() {
  if (state.phase === "layout") confirmLayout();
  else if (state.phase === "reveal") confirmReveal();
  else if (state.phase === "choose") resolveDuel();
  else if (state.phase === "discard") confirmDiscard();
  else if (state.phase === "gameover") restartGame();
  render();
}

function canAct() {
  if (state.phase === "layout") return state.setupSelection.size === 2;
  if (state.phase === "reveal") return state.players[HUMAN].revealChoice !== null;
  if (state.phase === "choose") return state.players[HUMAN].playChoice !== null;
  if (state.phase === "discard") return state.discardSelection.size === 2;
  return true;
}

function renderCard(card, selected, index, playerIndex) {
  const type = CARD_TYPES[card.type];
  const button = document.createElement("button");
  button.className = `card ${type.className}${selected ? " selected" : ""}`;
  button.innerHTML = `
    <span>
      <span class="card-title">${type.name}</span>
      <span class="card-desc">${type.desc}</span>
    </span>
    <span class="card-mark">${type.mark}</span>
  `;
  button.addEventListener("click", () => handleCardClick(playerIndex, index));
  return button;
}

function renderHiddenHand(hand, count) {
  hand.innerHTML = `
    <div class="ai-hand">
      <div class="ai-stack"></div>
      <strong>AI 手牌隐藏</strong>
      <span>${count} 张手牌</span>
    </div>
  `;
}

function renderSlot(slot, slotIndex, player, playerIndex) {
  const element = document.createElement("button");
  element.className = "slot empty";
  element.dataset.slot = slotIndex;

  if (!slot) {
    element.textContent = "等待布置";
  } else if (slot.revealed || state.phase === "gameover") {
    const type = CARD_TYPES[slot.type];
    element.className = `slot ${type.className}`;
    element.innerHTML = `<strong>${type.name}</strong>`;
  } else {
    element.className = "slot back";
    element.textContent = "背面朝上";
  }

  if (playerIndex === HUMAN && player.revealChoice === slotIndex && state.phase === "reveal") {
    element.classList.add("selected");
  }
  if (playerIndex === HUMAN && player.playChoice === slotIndex && state.phase === "choose") {
    element.classList.add("play-choice");
  }

  element.addEventListener("click", () => handleSlotClick(playerIndex, slotIndex));
  return element;
}

function renderPlayer(player, playerIndex) {
  const board = document.querySelector(`#player-${playerIndex + 1}`);
  board.innerHTML = "";
  const fragment = playerTemplate.content.cloneNode(true);
  fragment.querySelector(".player-name").textContent = player.name;
  fragment.querySelector(".player-meta").textContent = `牌组：进攻 ${player.config.attack} / 普防 ${player.config.defense} / 绝防 1 / 蓄力 ${29 - player.config.attack - player.config.defense}`;
  fragment.querySelector(".hp").textContent = `HP ${Math.max(0, player.hp)}`;
  fragment.querySelector(".deck-count").textContent = `牌库 ${player.deck.length}`;
  fragment.querySelector(".discard-count").textContent = `弃牌 ${player.discard.length}`;
  fragment.querySelector(".hand-count").textContent = `手牌 ${player.hand.length}`;
  fragment.querySelector(".charge-count").textContent = `蓄力 ${player.charge}`;

  const playZone = fragment.querySelector(".play-zone");
  playZone.innerHTML = "";
  player.staged.forEach((slot, slotIndex) => {
    playZone.appendChild(renderSlot(slot, slotIndex, player, playerIndex));
  });

  const hand = fragment.querySelector(".hand");
  if (player.isAi && state.phase !== "gameover") {
    renderHiddenHand(hand, player.hand.length);
  } else {
    player.hand.forEach((card, cardIndex) => {
      const selected =
        state.phase === "layout"
          ? state.setupSelection.has(cardIndex)
          : state.phase === "discard" && state.discardSelection.has(cardIndex);
      hand.appendChild(renderCard(card, selected, cardIndex, playerIndex));
    });
  }

  board.appendChild(fragment);
}

function renderLog() {
  battleLog.innerHTML = "";
  state.log.slice(0, 18).forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    battleLog.appendChild(item);
  });
}

function render() {
  if (!state.players.length) return;
  const phase = PHASES[state.phase];
  document.body.dataset.phase = state.phase;
  roundStatus.textContent = state.phase === "gameover" ? "游戏结束" : `回合 ${state.round} / 对局 ${state.duel}`;
  phaseTitle.textContent = phase.title;
  phaseHint.textContent = phase.hint;
  mainAction.textContent = phase.action;
  mainAction.disabled = !canAct();

  state.players.forEach(renderPlayer);
  renderLog();

  document.querySelector(".phase-card").classList.toggle("game-over", state.phase === "gameover");
}

renderDeckBuilders();
deckBuilders.addEventListener("input", handleBuilderInput);
startGameButton.addEventListener("click", startGame);
mainAction.addEventListener("click", handleMainAction);
restart.addEventListener("click", restartGame);
