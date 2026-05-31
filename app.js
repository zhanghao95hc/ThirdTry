const CARD_TYPES = {
  attack: {
    name: "进攻",
    mark: "攻",
    className: "type-attack",
    desc: "未被防住时造成 1 + 蓄力伤害。"
  },
  absoluteAttack: {
    name: "绝对进攻",
    mark: "破",
    className: "type-absolute-attack",
    desc: "击穿普通防御；3 层蓄力时还能击穿绝对防御。"
  },
  defense: {
    name: "普通防御",
    mark: "防",
    className: "type-defense",
    desc: "挡住普通攻击；会被绝对进攻或 3 层蓄力突破。"
  },
  absolute: {
    name: "绝对防御",
    mark: "绝",
    className: "type-absolute",
    desc: "整副牌唯一一张；可挡攻击，但会被 3 层绝对进攻突破。"
  },
  charge: {
    name: "蓄力",
    mark: "蓄",
    className: "type-charge",
    desc: "未撞上进攻时，本回合蓄力 +1。"
  },
  reflect: {
    name: "反弹",
    mark: "反",
    className: "type-reflect",
    desc: "将进攻与绝对进攻的伤害反弹给攻击方。"
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
const ORDINARY_ATTACK_COUNT = 9;
const ABSOLUTE_ATTACK_COUNT = 1;
const ABSOLUTE_DEFENSE_COUNT = 1;
const REFLECT_COUNT = 2;
const FLEX_CARD_COUNT = 30 - ORDINARY_ATTACK_COUNT - ABSOLUTE_ATTACK_COUNT - ABSOLUTE_DEFENSE_COUNT - REFLECT_COUNT;
let nextCardId = 0;

const state = {
  phase: "layout",
  round: 1,
  duel: 1,
  players: [],
  setupSelection: new Set(),
  discardSelection: new Set(),
  winnerMessage: "",
  lastDuelResult: null,
  log: []
};

const defaultConfigs = [
  { defense: 10 },
  { defense: 9 }
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
const resultModal = document.querySelector("#resultModal");
const resultTitle = document.querySelector("#resultTitle");
const resultMessage = document.querySelector("#resultMessage");
const resultRestart = document.querySelector("#resultRestart");
const resultBattleLog = document.querySelector("#resultBattleLog");
const duelResult = document.querySelector("#duelResult");
const duelResultTitle = document.querySelector("#duelResultTitle");
const duelResultBody = document.querySelector("#duelResultBody");
const cardPreview = document.querySelector("#cardPreview");

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
    attack: ORDINARY_ATTACK_COUNT,
    absoluteAttack: ABSOLUTE_ATTACK_COUNT,
    defense: config.defense,
    absolute: ABSOLUTE_DEFENSE_COUNT,
    reflect: REFLECT_COUNT,
    charge: FLEX_CARD_COUNT - config.defense
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
        <span>普通防御</span>
        <input data-field="defense" type="range" min="0" max="${FLEX_CARD_COUNT}" value="${config.defense}" />
        <strong data-value="defense">${config.defense}</strong>
      </label>
      <div class="builder-total">
        <span class="tiny-pill" data-total></span>
        <span class="tiny-pill">普通进攻 ${ORDINARY_ATTACK_COUNT}</span>
        <span class="tiny-pill">绝对进攻 ${ABSOLUTE_ATTACK_COUNT}</span>
        <span class="tiny-pill">绝对防御 1</span>
        <span class="tiny-pill">反弹 ${REFLECT_COUNT}</span>
        <span class="tiny-pill" data-charge></span>
      </div>
    `;
    deckBuilders.appendChild(builder);
  });

  updateBuilders();
}

function handleBuilderInput(event) {
  if (!event.target.matches("input")) return;
  updateBuilders();
}

function updateBuilders() {
  deckBuilders.querySelectorAll(".deck-builder").forEach((builder) => {
    const defense = Number(builder.querySelector('[data-field="defense"]').value);
    const charge = FLEX_CARD_COUNT - defense;
    const total = ORDINARY_ATTACK_COUNT + ABSOLUTE_ATTACK_COUNT + defense + charge + ABSOLUTE_DEFENSE_COUNT + REFLECT_COUNT;

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
  state.winnerMessage = "";
  state.lastDuelResult = null;
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
  resultModal.hidden = true;
  roundStatus.textContent = "准备组牌";
  state.players = [];
  state.winnerMessage = "";
  state.lastDuelResult = null;
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
  state.lastDuelResult = null;
  state.players.forEach((player) => {
    player.charge = Math.min(player.charge, 1);
    player.revealChoice = null;
    player.playChoice = null;
    player.staged = [null, null];
  });
  state.setupSelection = new Set();
  state.log.unshift(`第 ${state.round} 回合开始，双方最多保留 1 层蓄力。`);
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
  state.winnerMessage = message;
  state.log.unshift(message);
  return true;
}

function cardLabel(card) {
  return CARD_TYPES[card.type].name;
}

function isAttack(card) {
  return card?.type === "attack" || card?.type === "absoluteAttack";
}

function cardArt(type) {
  const art = {
    attack: `
      <svg class="card-art-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="attackBlade" x1="18" y1="82" x2="82" y2="18">
            <stop offset="0" stop-color="#5e100d" />
            <stop offset="0.45" stop-color="#f6d0a0" />
            <stop offset="1" stop-color="#f04232" />
          </linearGradient>
        </defs>
        <path class="slash slash-a" d="M16 70 C34 55 49 39 67 17" />
        <path class="slash slash-b" d="M25 81 C43 64 62 45 84 24" />
        <path d="M21 79 L68 24 L82 18 L76 33 L31 86 Z" fill="url(#attackBlade)" />
        <path d="M19 82 L31 70 L39 78 L27 90 Z" fill="#5b2215" />
        <path d="M39 65 L51 77" stroke="#ffe6b2" stroke-width="5" stroke-linecap="round" />
      </svg>
    `,
    defense: `
      <svg class="card-art-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="defenseShield" x1="22" y1="16" x2="78" y2="90">
            <stop offset="0" stop-color="#c7ecff" />
            <stop offset="0.48" stop-color="#2e7ec2" />
            <stop offset="1" stop-color="#0d2f5f" />
          </linearGradient>
        </defs>
        <path d="M50 12 L79 25 L74 61 C70 76 59 86 50 91 C41 86 30 76 26 61 L21 25 Z" fill="url(#defenseShield)" />
        <path d="M50 20 L68 29 L64 58 C61 69 55 76 50 80 Z" fill="rgba(255,255,255,0.26)" />
        <path d="M25 35 H75 M31 60 H69" stroke="#eaf7ff" stroke-width="4" stroke-linecap="round" opacity=".72" />
      </svg>
    `,
    absolute: `
      <svg class="card-art-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="absoluteWard" cx="50%" cy="45%" r="52%">
            <stop offset="0" stop-color="#fff2ff" />
            <stop offset="0.48" stop-color="#8b61f0" />
            <stop offset="1" stop-color="#2b174f" />
          </radialGradient>
        </defs>
        <path d="M50 10 L82 26 L76 64 C71 79 59 89 50 94 C41 89 29 79 24 64 L18 26 Z" fill="url(#absoluteWard)" />
        <path d="M50 20 L70 31 L66 59 C62 70 55 78 50 82 C45 78 38 70 34 59 L30 31 Z" fill="rgba(255,255,255,.2)" />
        <circle cx="50" cy="52" r="22" fill="none" stroke="#f6ddff" stroke-width="5" />
        <path d="M34 52 H66 M50 36 V68" stroke="#f6ddff" stroke-width="4" stroke-linecap="round" />
      </svg>
    `,
    charge: `
      <svg class="card-art-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="chargeCore" cx="50%" cy="50%" r="52%">
            <stop offset="0" stop-color="#fff7b7" />
            <stop offset="0.5" stop-color="#f0b91f" />
            <stop offset="1" stop-color="#7b4200" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="35" fill="url(#chargeCore)" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="#f6d777" stroke-width="4" stroke-dasharray="10 7" />
        <path d="M57 12 L29 53 H48 L41 88 L72 42 H53 Z" fill="#fff2a1" stroke="#7b4200" stroke-width="3" stroke-linejoin="round" />
      </svg>
    `
  };
  return art[type] || "";
}

function cardBackLogo() {
  return `
    <svg class="back-logo" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="backGold" x1="15" y1="85" x2="85" y2="15">
          <stop offset="0" stop-color="#6f4b1d" />
          <stop offset="0.52" stop-color="#f2d48a" />
          <stop offset="1" stop-color="#b98734" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="36" fill="none" stroke="url(#backGold)" stroke-width="5" />
      <circle cx="50" cy="50" r="23" fill="none" stroke="url(#backGold)" stroke-width="2.5" stroke-dasharray="8 5" />
      <path d="M24 77 L76 25 M24 25 L76 77" stroke="url(#backGold)" stroke-width="7" stroke-linecap="round" />
      <path d="M71 20 L82 18 L80 29 M29 82 L18 84 L20 73 M18 18 L30 20 L21 29 M82 84 L70 82 L79 73" fill="none" stroke="url(#backGold)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <text x="50" y="55" text-anchor="middle" fill="#f6e7bd" font-size="16" font-weight="900">DUEL</text>
    </svg>
  `;
}

function cardFaceMarkup(card, options = {}) {
  const type = CARD_TYPES[card.type];
  const desc = options.compact ? "" : `<span class="card-desc">${type.desc}</span>`;
  return `
    <span class="card-corner">${type.mark}</span>
    <span class="card-title">${type.name}</span>
    ${desc}
    <span class="card-mark">${type.mark}</span>
  `;
}

function isDefense(card) {
  return card.type === "defense" || card.type === "absolute";
}

function isReflect(card) {
  return card?.type === "reflect";
}

function attackBlocked(attackCard, storedCharge, defenderCard) {
  if (!isDefense(defenderCard)) return false;
  if (attackCard.type === "absoluteAttack") {
    if (defenderCard.type === "defense") return false;
    return storedCharge < 3;
  }
  if (defenderCard.type === "absolute") return true;
  return storedCharge < 3;
}

function resolveAttack(attackerIndex, defenderIndex, playedCards, entries) {
  const attacker = state.players[attackerIndex];
  const defender = state.players[defenderIndex];
  const attackCard = playedCards[attackerIndex];
  const defenseCard = playedCards[defenderIndex];
  if (!isAttack(attackCard)) return;

  const storedCharge = attacker.charge;
  const damage = 1 + storedCharge;
  if (isReflect(defenseCard)) {
    attacker.hp -= damage;
    entries.push(`${defender.name} 的反弹触发，将 ${attacker.name} 的${cardLabel(attackCard)}伤害反弹，造成 ${damage} 点伤害。`);
  } else if (attackBlocked(attackCard, storedCharge, defenseCard)) {
    entries.push(`${attacker.name} 的${cardLabel(attackCard)}被 ${defender.name} 的${cardLabel(defenseCard)}挡住。`);
  } else {
    defender.hp -= damage;
    entries.push(`${attacker.name} 的${cardLabel(attackCard)}命中，造成 ${damage} 点伤害。`);
  }
  attacker.charge = 0;
}

function resolveCharge(playerIndex, opponentIndex, playedCards, entries) {
  const player = state.players[playerIndex];
  if (playedCards[playerIndex].type !== "charge") return;
  if (isAttack(playedCards[opponentIndex])) {
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
  const resultRound = state.round;
  const resultDuel = state.duel;

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

  const resultText = entries.join(" ");
  state.lastDuelResult = {
    title: `第 ${resultRound} 回合 · 第 ${resultDuel} 对局`,
    body: resultText
  };
  state.log.unshift(resultText);

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
  if (card.type === "attack" || card.type === "absoluteAttack") {
    const pierceBonus = card.type === "absoluteAttack" ? 24 : 0;
    return 40 + pierceBonus + player.charge * 18 + (opponent.hp <= 1 + player.charge ? 40 : 0);
  }
  if (card.type === "absolute") {
    return 34 + (player.hp <= 5 ? 24 : 0);
  }
  if (card.type === "reflect") {
    return 36 + (player.hp <= 5 ? 26 : 0);
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
  const betterSlot =
    ai.staged[0].type === "absoluteAttack" || ai.staged[0].type === "absolute"
      ? 0
      : ai.staged[1].type === "absoluteAttack" || ai.staged[1].type === "absolute"
        ? 1
        : Math.floor(Math.random() * 2);
  ai.revealChoice = betterSlot;
  ai.staged[betterSlot].revealed = true;
}

function chooseAiPlay() {
  const ai = state.players[AI];
  const human = state.players[HUMAN];
  const humanVisible = human.staged[human.revealChoice];
  const slotScores = ai.staged.map((card, index) => {
    let score = cardScoreForAi(card, ai, human);
    if (isAttack(humanVisible) && isReflect(card)) score += 64;
    if (isAttack(humanVisible) && isDefense(card)) score += card.type === "absolute" ? 55 : 32;
    if (humanVisible?.type === "charge" && isAttack(card)) score += 42;
    if (humanVisible && isDefense(humanVisible) && card.type === "charge") score += 28;
    if (isAttack(card) && ai.charge >= 3) score += 30;
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

function stageHumanCard(cardIndex) {
  const human = state.players[HUMAN];
  const emptySlot = human.staged.findIndex((card) => !card);
  if (emptySlot === -1) return;
  const [card] = human.hand.splice(cardIndex, 1);
  card.revealed = false;
  human.staged[emptySlot] = card;
  human.revealChoice = null;
  human.playChoice = null;
}

function returnHumanStagedCard(slotIndex) {
  const human = state.players[HUMAN];
  const card = human.staged[slotIndex];
  if (!card) return;
  card.revealed = false;
  human.hand.push(card);
  human.staged[slotIndex] = null;
  human.revealChoice = null;
  human.playChoice = null;
}

function handleCardClick(playerIndex, cardIndex) {
  if (playerIndex !== HUMAN) return;

  if (state.phase === "layout") {
    stageHumanCard(cardIndex);
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

  if (state.phase === "layout") {
    returnHumanStagedCard(slotIndex);
  }

  if (state.phase === "reveal") {
    player.revealChoice = slotIndex;
  }

  if (state.phase === "choose") {
    player.playChoice = slotIndex;
  }

  render();
}

function confirmLayout() {
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
  if (state.phase === "layout") return state.players[HUMAN].staged.every(Boolean);
  if (state.phase === "reveal") return state.players[HUMAN].revealChoice !== null;
  if (state.phase === "choose") return state.players[HUMAN].playChoice !== null;
  if (state.phase === "discard") return state.discardSelection.size === 2;
  return true;
}

function renderCard(card, selected, index, playerIndex) {
  const type = CARD_TYPES[card.type];
  const button = document.createElement("button");
  button.className = `card compact-card ${type.className}${selected ? " selected" : ""}`;
  button.innerHTML = cardFaceMarkup(card, { compact: true });
  button.addEventListener("click", () => handleCardClick(playerIndex, index));
  if (playerIndex === HUMAN) {
    button.addEventListener("mouseenter", (event) => showCardPreview(card, event));
    button.addEventListener("mousemove", moveCardPreview);
    button.addEventListener("mouseleave", hideCardPreview);
  }
  return button;
}

function renderHiddenHand(hand, count) {
  hand.innerHTML = `
    <div class="ai-hand">
      <div class="ai-stack">${cardBackLogo()}</div>
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
    element.innerHTML = cardFaceMarkup(slot, { compact: true });
  } else {
    element.className = "slot back";
    element.innerHTML = `${cardBackLogo()}<span class="back-label">背面朝上</span>`;
  }

  if (playerIndex === HUMAN && player.revealChoice === slotIndex && state.phase === "reveal") {
    element.classList.add("selected");
  }
  if (playerIndex === HUMAN && player.playChoice === slotIndex && state.phase === "choose") {
    element.classList.add("play-choice");
  }
  if (playerIndex === HUMAN && state.phase === "layout" && slot) {
    element.classList.add("returnable");
  }

  element.addEventListener("click", () => handleSlotClick(playerIndex, slotIndex));
  if (playerIndex === HUMAN && slot) {
    element.addEventListener("mouseenter", (event) => showCardPreview(slot, event));
    element.addEventListener("mousemove", moveCardPreview);
    element.addEventListener("mouseleave", hideCardPreview);
  }
  return element;
}

function renderPlayer(player, playerIndex) {
  const board = document.querySelector(`#player-${playerIndex + 1}`);
  board.innerHTML = "";
  const fragment = playerTemplate.content.cloneNode(true);
  const header = fragment.querySelector(".player-header");
  fragment.querySelector(".player-name").innerHTML = `<span>${player.name}</span><span class="hp-inline">HP ${Math.max(0, player.hp)}</span>`;
  fragment.querySelector(".player-meta").textContent = `牌组：普攻 ${ORDINARY_ATTACK_COUNT} / 绝攻 ${ABSOLUTE_ATTACK_COUNT} / 普防 ${player.config.defense} / 绝防 ${ABSOLUTE_DEFENSE_COUNT} / 反弹 ${REFLECT_COUNT} / 蓄力 ${
    FLEX_CARD_COUNT - player.config.defense
  }`;
  fragment.querySelector(".hp").remove();
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
    header.appendChild(hand);
  } else {
    player.hand.forEach((card, cardIndex) => {
      const selected = state.phase === "discard" && state.discardSelection.has(cardIndex);
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

function showCardPreview(card, event) {
  const type = CARD_TYPES[card.type];
  cardPreview.className = `card-preview ${type.className}`;
  cardPreview.innerHTML = cardFaceMarkup(card);
  cardPreview.hidden = false;
  moveCardPreview(event);
}

function moveCardPreview(event) {
  if (cardPreview.hidden) return;
  const offset = 18;
  const previewWidth = 176;
  const previewHeight = 252;
  let left = event.clientX + offset;
  let top = event.clientY + offset;
  if (left + previewWidth > window.innerWidth - 8) {
    left = event.clientX - previewWidth - offset;
  }
  if (top + previewHeight > window.innerHeight - 8) {
    top = window.innerHeight - previewHeight - 8;
  }
  cardPreview.style.left = `${Math.max(8, left)}px`;
  cardPreview.style.top = `${Math.max(8, top)}px`;
}

function hideCardPreview() {
  cardPreview.hidden = true;
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
  renderDuelResult();

  document.querySelector(".phase-card").classList.toggle("game-over", state.phase === "gameover");
  renderResultModal();
}

function renderDuelResult() {
  const result = state.lastDuelResult;
  duelResult.hidden = !result;
  if (!result) return;
  duelResultTitle.textContent = result.title;
  duelResultBody.textContent = result.body;
}

function renderResultModal() {
  const isGameOver = state.phase === "gameover";
  resultModal.hidden = !isGameOver;
  if (!isGameOver) return;

  const message = state.winnerMessage || "游戏结束。";
  const isTie = message.includes("平局");
  const humanWon = message.includes("你") && message.includes("获胜");
  resultTitle.textContent = isTie ? "平局" : humanWon ? "你获胜" : "AI 获胜";
  resultMessage.textContent = message;
  resultBattleLog.innerHTML = "";
  [...state.log].reverse().forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    resultBattleLog.appendChild(item);
  });
}

renderDeckBuilders();
deckBuilders.addEventListener("input", handleBuilderInput);
startGameButton.addEventListener("click", startGame);
mainAction.addEventListener("click", handleMainAction);
restart.addEventListener("click", restartGame);
resultRestart.addEventListener("click", restartGame);
