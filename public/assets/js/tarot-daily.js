import { getCardArtClass, tarotCards } from "./tarot-data.js?v=20260609-1";

const selectors = {
  deck: "[data-tarot-deck]",
  form: "[data-tarot-form]",
  shuffle: "[data-tarot-shuffle]",
  cut: "[data-tarot-cut]",
  read: "[data-tarot-read]",
  status: "[data-tarot-status]",
  hidden: "[data-tarot-selected]",
  count: "[data-tarot-count]",
};

let deck = shuffleCards([...tarotCards]);
let selectedCard;
let isAnimating = false;
const text = {
  chooseCard: (index) => `เลือกไพ่ใบที่ ${index + 1}`,
  shuffled: "ไพ่ถูกสับใหม่แล้ว ตั้งจิตให้สงบ แล้วเลือกไพ่ 1 ใบ",
  cut: "ตัดไพ่เรียบร้อยแล้ว เลือกไพ่ที่เรียกสายตาหรือใจของคุณ",
  pickFirst: "กรุณาเลือกไพ่ 1 ใบก่อนรับคำทำนาย",
  selected: (card) => `คุณเลือก ${card.thName} แล้ว คลิกปุ่ม "ทำนาย" เพื่ออ่านคำพยากรณ์`,
  ready: "ตั้งจิตให้สงบ สับไพ่หรือตัดไพ่ แล้วเลือกไพ่ 1 ใบ",
  shuffling: "กำลังสับไพ่...",
  cutting: "กำลังตัดไพ่...",
};

export function initDailyTarot() {
  const deckElement = document.querySelector(selectors.deck);
  const form = document.querySelector(selectors.form);
  const shuffleButton = document.querySelector(selectors.shuffle);
  const cutButton = document.querySelector(selectors.cut);
  const readButton = document.querySelector(selectors.read);

  if (!deckElement || !form || !shuffleButton || !cutButton || !readButton) return;

  renderDeck(deckElement);
  resetReading();

  deckElement.addEventListener("click", (event) => {
    const cardButton = event.target.closest("[data-card-id]");
    if (!cardButton || selectedCard || isAnimating) return;

    selectedCard = deck.find((card) => card.id === cardButton.dataset.cardId);
    if (!selectedCard) return;

    revealPickedCard(deckElement, cardButton, selectedCard);
    updateReadingState();
  });

  shuffleButton.addEventListener("click", () => {
    animateDeck(deckElement, "is-shuffling", () => {
      deck = shuffleCards(deck);
      resetReading();
      renderDeck(deckElement);
      updateStatus(text.shuffled);
    });
  });

  cutButton.addEventListener("click", () => {
    animateDeck(deckElement, "is-cutting", () => {
      deck = cutDeck(deck);
      resetReading();
      renderDeck(deckElement);
      updateStatus(text.cut);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedCard) {
      updateStatus(text.pickFirst);
      return;
    }

    const reading = {
      cardId: selectedCard.id,
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
    };

    localStorage.setItem("monkolDailyTarot", JSON.stringify(reading));
    window.location.href = `./result/?card=${encodeURIComponent(selectedCard.id)}&date=${reading.date}`;
  });
}

function renderDeck(deckElement) {
  deckElement.classList.toggle("has-selection", Boolean(selectedCard));
  deckElement.innerHTML = deck.map((card, index) => renderCardButton(card, index)).join("");
}

function renderCardButton(card, index) {
  const isSelected = selectedCard?.id === card.id;
  const isDisabled = Boolean(selectedCard) && !isSelected;
  const label = isSelected ? `${card.thName} ${card.name}` : text.chooseCard(index);
  const position = getCardPosition(index, deck.length);

  return `
    <button class="tarot-card-pick${isSelected ? " is-selected is-revealed" : ""}" type="button" data-card-id="${card.id}" aria-label="${label}" style="${position}"${isDisabled || isSelected ? " disabled" : ""}>
      <span class="tarot-card-inner">
        ${renderCardBack(index)}
        ${isSelected ? renderCardFace(card, "small") : ""}
      </span>
    </button>
  `;
}

function getCardPosition(index, total) {
  const isMobile = window.matchMedia("(max-width: 720px)").matches;
  const columns = Math.min(total, isMobile ? 8 : total <= 22 ? 11 : 13);
  const rows = Math.ceil(total / columns);
  const row = Math.floor(index / columns);
  const column = index % columns;
  const x = columns === 1 ? 50 : 9 + (column / (columns - 1)) * 82;
  const y = rows === 1 ? 50 : 24 + (row / (rows - 1)) * 58;
  const rotation = ((column % 5) - 2) * 2.4 + (row - (rows - 1) / 2) * 1.2;
  const layer = 1000 + row * columns + column;

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
      <span class="tarot-card-label" aria-hidden="true">${card.name}</span>
    </span>
  `;
}

function revealPickedCard(deckElement, cardButton, card) {
  deckElement.querySelectorAll("[data-card-id]").forEach((button) => {
    if (button !== cardButton) button.disabled = true;
  });

  const inner = cardButton.querySelector(".tarot-card-inner");
  if (inner && !inner.querySelector(".tarot-card-face")) inner.insertAdjacentHTML("beforeend", renderCardFace(card, "small"));

  cardButton.disabled = true;
  cardButton.classList.add("is-selected");
  window.setTimeout(() => cardButton.classList.add("is-revealed"), 420);
}

function updateReadingState() {
  const readButton = document.querySelector(selectors.read);
  const hiddenInput = document.querySelector(selectors.hidden);
  const countInput = document.querySelector(selectors.count);

  if (readButton) {
    readButton.disabled = false;
    readButton.classList.remove("btn-disable");
  }

  if (hiddenInput) hiddenInput.value = selectedCard?.id ?? "";
  if (countInput) countInput.value = selectedCard ? "1" : "0";

  if (selectedCard) {
    updateStatus(text.selected(selectedCard));
  }
}

function resetReading() {
  selectedCard = undefined;

  const readButton = document.querySelector(selectors.read);
  const hiddenInput = document.querySelector(selectors.hidden);
  const countInput = document.querySelector(selectors.count);

  if (readButton) {
    readButton.disabled = true;
    readButton.classList.add("btn-disable");
  }

  if (hiddenInput) hiddenInput.value = "";
  if (countInput) countInput.value = "0";

  updateStatus(text.ready);
}

function updateStatus(message) {
  const status = document.querySelector(selectors.status);
  if (status) status.textContent = message;
}

function animateDeck(deckElement, className, afterAnimation) {
  if (isAnimating) return;

  isAnimating = true;
  deckElement.classList.add(className);
  updateStatus(className === "is-shuffling" ? text.shuffling : text.cutting);

  window.setTimeout(() => {
    afterAnimation();
    deckElement.classList.remove(className);
    isAnimating = false;
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

initDailyTarot();
