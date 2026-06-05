import { getCardArtClass, tarotCards } from "./tarot-data.js?v=20260605-2";

const selectors = {
  form: "[data-tarot-spread-form]",
  deck: "[data-tarot-deck]",
  shuffle: "[data-tarot-shuffle]",
  cut: "[data-tarot-cut]",
  read: "[data-tarot-read]",
  status: "[data-tarot-status]",
  hidden: "[data-tarot-selected]",
  count: "[data-tarot-count]",
};

const textBySpread = {
  monthly: {
    ready: "ตั้งจิตถึงเดือนนี้ แล้วเลือกไพ่ 10 ใบตามลำดับที่ใจสะดุด",
    selected: (count, required) => `เลือกแล้ว ${count}/${required} ใบ`,
    complete: "เลือกครบ 10 ใบแล้ว กดเปิดคำทำนายเพื่ออ่านภาพรวมรายเดือน",
    pickFirst: "กรุณาเลือกไพ่ให้ครบ 10 ใบก่อนเปิดคำทำนาย",
    chooseCard: (index) => `เลือกไพ่ใบที่ ${index + 1}`,
    shuffled: "ไพ่ถูกสับใหม่แล้ว ตั้งจิตถึงเดือนนี้ แล้วเลือกไพ่ 10 ใบ",
    cut: "ตัดไพ่เรียบร้อยแล้ว เลือกไพ่ 10 ใบตามความรู้สึก",
  },
  luck: {
    ready: "ตั้งคำถามเรื่องโชคลาภ แล้วเลือกไพ่ 1 ใบ",
    selected: (count, required) => `เลือกแล้ว ${count}/${required} ใบ`,
    complete: "เลือกไพ่แล้ว กดเปิดคำทำนายเพื่ออ่านจังหวะโชคลาภ",
    pickFirst: "กรุณาเลือกไพ่ 1 ใบก่อนเปิดคำทำนาย",
    chooseCard: (index) => `เลือกไพ่ใบที่ ${index + 1}`,
    shuffled: "ไพ่ถูกสับใหม่แล้ว ตั้งคำถามเรื่องโชคลาภ แล้วเลือกไพ่ 1 ใบ",
    cut: "ตัดไพ่เรียบร้อยแล้ว เลือกไพ่ที่เรียกสายตาหรือใจของคุณ",
  },
};

initTarotSpreads();

function initTarotSpreads() {
  document.querySelectorAll(selectors.form).forEach((form) => initSpreadForm(form));
}

function initSpreadForm(form) {
  const deckElement = form.querySelector(selectors.deck);
  const shuffleButton = form.querySelector(selectors.shuffle);
  const cutButton = form.querySelector(selectors.cut);
  const readButton = form.querySelector(selectors.read);
  const spreadType = form.dataset.spreadType || "monthly";
  const requiredCount = Number(form.dataset.requiredCount || "1");
  const storageKey = form.dataset.storageKey || "monkolTarotSpread";
  const spreadText = textBySpread[spreadType] || textBySpread.monthly;
  const baseDeck = spreadType === "luck" ? tarotCards.filter((card) => !card.suit) : tarotCards;
  const state = {
    deck: shuffleCards([...baseDeck]),
    selectedCards: [],
    isAnimating: false,
  };

  if (!deckElement || !shuffleButton || !cutButton || !readButton) return;

  renderDeck(deckElement, state, spreadText, requiredCount);
  resetReading(form, state, spreadText);

  deckElement.addEventListener("click", (event) => {
    const cardButton = event.target.closest("[data-card-id]");
    if (!cardButton || state.isAnimating) return;
    if (state.selectedCards.length >= requiredCount) return;

    const card = state.deck.find((item) => item.id === cardButton.dataset.cardId);
    if (!card || state.selectedCards.some((item) => item.id === card.id)) return;

    state.selectedCards.push(card);
    updateReadingState(form, state, spreadText, requiredCount);
    renderDeck(deckElement, state, spreadText, requiredCount);
  });

  shuffleButton.addEventListener("click", () => {
    animateDeck(deckElement, state, "is-shuffling", () => {
      state.deck = shuffleCards(state.deck);
      resetReading(form, state, spreadText);
      renderDeck(deckElement, state, spreadText, requiredCount);
      updateStatus(form, spreadText.shuffled);
    });
  });

  cutButton.addEventListener("click", () => {
    animateDeck(deckElement, state, "is-cutting", () => {
      state.deck = cutDeck(state.deck);
      resetReading(form, state, spreadText);
      renderDeck(deckElement, state, spreadText, requiredCount);
      updateStatus(form, spreadText.cut);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.selectedCards.length < requiredCount) {
      updateStatus(form, spreadText.pickFirst);
      return;
    }

    const cardIds = state.selectedCards.map((card) => card.id);
    const reading = {
      cardIds,
      spreadType,
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
    };

    localStorage.setItem(storageKey, JSON.stringify(reading));
    window.location.href = `./result/?cards=${encodeURIComponent(cardIds.join(","))}&date=${reading.date}`;
  });
}

function renderDeck(deckElement, state, spreadText, requiredCount) {
  const hasCompleteSelection = state.selectedCards.length >= requiredCount;
  deckElement.classList.toggle("has-selection", state.selectedCards.length > 0);
  deckElement.innerHTML = state.deck
    .map((card, index) => renderCardButton(card, index, state.deck.length, state.selectedCards, spreadText, hasCompleteSelection))
    .join("");
}

function renderCardButton(card, index, total, selectedCards, spreadText, hasCompleteSelection) {
  const selectedIndex = selectedCards.findIndex((item) => item.id === card.id);
  const isPicked = selectedIndex >= 0;
  const isDisabled = isPicked || hasCompleteSelection;
  const label = isPicked
    ? `ไพ่ลำดับที่ ${selectedIndex + 1} ${card.thName} ${card.name}`
    : spreadText.chooseCard(index);
  const position = getCardPosition(index, total, selectedCards.length, isPicked);

  return `
    <button class="tarot-card-pick${isPicked ? " is-picked" : ""}" type="button" data-card-id="${card.id}" aria-label="${label}" style="${position}"${isDisabled ? " disabled" : ""}>
      ${isPicked ? renderCardFace(card, "small") : renderCardBack(index)}
      ${isPicked ? `<span class="tarot-picked-index">${selectedIndex + 1}</span>` : ""}
    </button>
  `;
}

function getCardPosition(index, total, pickedCount, isPicked) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const x = 50 + Math.cos(angle) * 42;
  const y = 50 + Math.sin(angle) * 37;
  const rotation = (angle * 180) / Math.PI + 90;
  const pickedLayer = isPicked ? pickedCount : 0;
  const layer = Math.round(1000 + y * 10 + pickedLayer);

  return `--x:${x.toFixed(3)};--y:${y.toFixed(3)};--r:${rotation.toFixed(3)}deg;--z:${layer};`;
}

function renderCardBack(index) {
  const variants = ["eye", "sun", "moon"];
  const variant = variants[index % variants.length];

  return `
    <span class="tarot-card-back tarot-card-back-${variant}" aria-hidden="true">
      <span class="tarot-back-corners"></span>
      <span class="tarot-back-sigil">
        <span class="tarot-back-core"></span>
      </span>
      <span class="tarot-back-stars"></span>
    </span>
  `;
}

function renderCardFace(card, size = "large") {
  return `
    <span class="tarot-card-face ${size} ${getCardArtClass(card)}">
      <img class="tarot-card-image" src="${card.image}" alt="${card.thName} (${card.name})" loading="eager" decoding="async">
    </span>
  `;
}

function updateReadingState(form, state, spreadText, requiredCount) {
  const readButton = form.querySelector(selectors.read);
  const hiddenInput = form.querySelector(selectors.hidden);
  const countInput = form.querySelector(selectors.count);
  const count = state.selectedCards.length;
  const isComplete = count >= requiredCount;

  if (readButton) {
    readButton.disabled = !isComplete;
    readButton.classList.toggle("btn-disable", !isComplete);
  }

  if (hiddenInput) hiddenInput.value = state.selectedCards.map((card) => card.id).join(",");
  if (countInput) countInput.value = String(count);

  updateStatus(form, isComplete ? spreadText.complete : spreadText.selected(count, requiredCount));
}

function resetReading(form, state, spreadText) {
  state.selectedCards = [];

  const readButton = form.querySelector(selectors.read);
  const hiddenInput = form.querySelector(selectors.hidden);
  const countInput = form.querySelector(selectors.count);

  if (readButton) {
    readButton.disabled = true;
    readButton.classList.add("btn-disable");
  }

  if (hiddenInput) hiddenInput.value = "";
  if (countInput) countInput.value = "0";

  updateStatus(form, spreadText.ready);
}

function updateStatus(form, message) {
  const status = form.querySelector(selectors.status);
  if (status) status.textContent = message;
}

function animateDeck(deckElement, state, className, afterAnimation) {
  if (state.isAnimating) return;

  state.isAnimating = true;
  deckElement.classList.add(className);
  updateStatus(deckElement.closest(selectors.form), className === "is-shuffling" ? "กำลังสับไพ่..." : "กำลังตัดไพ่...");

  window.setTimeout(() => {
    afterAnimation();
    deckElement.classList.remove(className);
    state.isAnimating = false;
  }, className === "is-shuffling" ? 980 : 820);
}

function shuffleCards(cards) {
  const nextDeck = [...cards];
  for (let index = nextDeck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextDeck[index], nextDeck[swapIndex]] = [nextDeck[swapIndex], nextDeck[index]];
  }
  return nextDeck;
}

function cutDeck(cards) {
  const cutIndex = Math.max(1, Math.floor(Math.random() * (cards.length - 2)) + 1);
  return [...cards.slice(cutIndex), ...cards.slice(0, cutIndex)];
}
