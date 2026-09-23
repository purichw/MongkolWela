import fs from "node:fs";

const detail = "src/pages/tarot/meanings/[card].astro";
const index = "src/pages/tarot/meanings/index.astro";
for (const file of [detail, index]) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes('import { contentBinding }')) source = source.replace("---\n", '---\nimport { contentBinding } from "../../../lib/content-bindings.js";\n');
  const bind = (id, path, opts = "") => {
    const marker = `data-cms-field="${id}"`;
    if (!source.includes(`${marker} {...contentBinding`)) source = source.replace(marker, `${marker} {...contentBinding("tarot.tarotMeaningCards", card.slug, ${path}${opts})}`);
  };
  if (file === detail) {
    for (const [id, path] of [[4,"name"],[7,"image"],[8,"name"],[19,"upright"],[27,"overview"],[29,"reversed"],[33,"western"],[35,"caution"],[40,"closingSummary"]]) bind(`55ff47f2-${id}`, JSON.stringify(path), id === 7 ? ', { attr: "src" }' : "");
    bind("55ff47f2-9", '"thName"', ', { prefix: number != null ? `${number} ` : "" }');
    bind("55ff47f2-15", 'card.astrology ? "astrology" : "rulingPlanet"');
    bind("55ff47f2-17", '"keywordsUpright" in card ? "keywordsUpright" : "keywords"', ', { join: " · ", seed: keywords }');
    source = source.replace('{ label: "การงาน", text:', '{ path: "uprightDetails/career", label: "การงาน", text:').replace('{ label: "การเงิน", text:', '{ path: "uprightDetails/finance", label: "การเงิน", text:').replace('{ label: "การงานและการเงิน", text:', '{ path: "workMoney", label: "การงานและการเงิน", text:').replace('{ label: "ความรัก", text:', '{ path: "love", label: "ความรัก", text:').replace('{ label: "สุขภาพและพลังชีวิต", text:', '{ path: "health", label: "สุขภาพและพลังชีวิต", text:');
    bind("55ff47f2-24", "topic.path");
    source = source.replace('{card.keywordsReversed.join(" · ")}', '<span {...contentBinding("tarot.tarotMeaningCards", card.slug, "keywordsReversed", { join: " · ", seed: card.keywordsReversed })}>{card.keywordsReversed.join(" · ")}</span>');
    source = source.replace("card.symbolism.map(item =>", "card.symbolism.map((item, i) =>");
    bind("55ff47f2-38", '`symbolism/${i}/symbol`');
    source = source.replace('{item.meaning}</li>', '<span {...contentBinding("tarot.tarotMeaningCards", card.slug, `symbolism/${i}/meaning`)}>{item.meaning}</span></li>');
    source = source.replace("relatedCards.map(item =>", "relatedCards.map((item, i) =>");
    source = source.replace('{item.relationship}</li>', '<span {...contentBinding("tarot.tarotMeaningCards", card.slug, `relatedCards/${i}/relationship`)}>{item.relationship}</span></li>');
    source = source.replace("card.reflectionQuestions.map(question =>", "card.reflectionQuestions.map((question, i) =>");
    bind("55ff47f2-46", '`reflectionQuestions/${i}`');
  } else {
    bind("0c6c2b61-16", '"thumbImage"', ', { attr: "src" }');
    bind("0c6c2b61-17", '"name"');
    bind("0c6c2b61-18", '"thName"', ', { prefix: "number" in card && card.number != null ? `${card.number} ` : "" }');
  }
  fs.writeFileSync(file, source);
}
