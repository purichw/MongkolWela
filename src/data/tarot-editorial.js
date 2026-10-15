import content from "./tarot-editorial-content.json" with { type: "json" };

const byId = new Map(content.map(card => [card.id, card]));
/** @template T @param {T[]} current @param {T[]} replacement */
const retainSlots = (current = [], replacement = []) => [...replacement, ...current.slice(replacement.length)];

/** @template {{ id: string }} T @param {T} card */
export function withReadingEditorial(card) {
  const editorial = byId.get(card.id);
  if (!editorial) throw new Error(`Missing Tarot editorial: ${card.id}`);
  const { daily, ...contexts } = editorial.contexts;
  return { ...card, theme: editorial.keywords[0], interpretation: daily.reading, advice: daily.advice, caution: daily.caution, contexts };
}

/**
 * @template {{ id: string, keywords?: string[], keywordsUpright?: string[], symbolism?: { symbol: string, meaning: string }[], relatedCards?: { card_id: string, relationship: string }[], uprightDetails?: Object<string, string>, reversedDetails?: Object<string, string> }} T
 * @param {T} card
 */
export function withMeaningEditorial(card) {
  const editorial = byId.get(card.id);
  if (!editorial) throw new Error(`Missing Tarot editorial: ${card.id}`);
  const { love, money, career, daily } = editorial.contexts;
  // Existing indexed CMS paths remain valid, including older extended symbolism.
  const relatedCards = (card.relatedCards || []).map(related => editorial.relatedCards.find(item => item.card_id === related.card_id) || related);
  relatedCards.push(...editorial.relatedCards.filter(item => !relatedCards.some(related => related.card_id === item.card_id)));
  return {
    ...card,
    theme: editorial.keywords[0], overview: editorial.summary, upright: editorial.upright, reversed: editorial.reversed,
    love: love.reading, workMoney: `การงาน: ${career.reading} การเงิน: ${money.reading}`,
    uprightDetails: { ...card.uprightDetails, general: editorial.upright, love: love.reading, career: career.reading, finance: money.reading },
    ...(card.reversedDetails ? { reversedDetails: { ...card.reversedDetails, general: editorial.reversed } } : {}),
    keywords: retainSlots(card.keywords, editorial.keywords),
    keywordsUpright: retainSlots(card.keywordsUpright, editorial.keywords),
    symbolism: retainSlots(card.symbolism, editorial.symbolism),
    relatedCards,
    advice: daily.advice, caution: daily.caution,
  };
}

export function readingForContext(card, context = "daily") {
  // Daily keeps its original CMS paths so existing published edits still win.
  if (context === "daily") return { reading: card.interpretation, advice: card.advice, caution: card.caution };
  if (!card.contexts?.[context]) throw new Error(`Unsupported Tarot context: ${context}`);
  return card.contexts[context];
}
