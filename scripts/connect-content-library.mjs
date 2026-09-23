import fs from "node:fs/promises";
import ts from "typescript";

const groups = [
  ["src/scripts/seamsi-data.js", "seamsi", "เซียมซี", ["/horoscope/seamsi/"], { seamsiCategories: "หมวดคำถาม", seamsiFortunes: "ใบเซียมซี" }],
  ["src/scripts/tarot-data.js", "tarot", "ไพ่ยิปซี", ["/tarot/"], { tarotCards: "คำทำนายไพ่ 78 ใบ" }],
  ["src/data/tarot-meanings.js", "tarot", "ไพ่ยิปซี", ["/tarot/meanings/"], { tarotMeaningCards: "สารานุกรมไพ่ 78 ใบ" }],
  ["src/data/tarot-topic-pages.js", "tarot", "ไพ่ยิปซี", ["/tarot/"], { tarotIntentTopics: "หัวข้อการอ่านไพ่" }],
  ["src/scripts/life-graph-data.js", "lifeGraph", "กราฟชีวิต", ["/horoscope/life-graph/"], { lifeHouses: "คำอ่านภพ", levelBands: "ชื่อระดับกราฟ" }],
  ["src/scripts/thai-astrology-data.js", "thaiAstrology", "โหราศาสตร์ไทย", ["/horoscope/thai-astrology/"], { zodiacSigns: "ราศี", houses: "ภพ", planetMeanings: "ความหมายดาว" }],
];

// Extract the data actually consumed by the palm reader, not the unused legacy corpus.
const palmPath = "src/components/PalmLineWidget.astro";
let palm = await fs.readFile(palmPath, "utf8");
if (!palm.includes('from "../data/palm-reader-content.js"')) {
  const start = palm.indexOf("const LINE_TYPES =");
  const end = palm.indexOf("const COMPARISON_PROFILES =", start);
  const data = palm.slice(start, end).replace(/^const (LINE_TYPES|IMG_INDEX|READINGS|CATEGORIES|GROUP_LABELS) =/gm, "export const $1 =");
  await fs.writeFile("src/data/palm-reader-content.js", data);
  palm = palm.slice(0, start) + 'import { LINE_TYPES, IMG_INDEX, READINGS, CATEGORIES, GROUP_LABELS } from "../data/palm-reader-content.js";\n\n' + palm.slice(end);
  await fs.writeFile(palmPath, palm);
}
groups.push(["src/data/palm-reader-content.js", "palmistry", "ลายมือ", ["/horoscope/palmistry/"], { LINE_TYPES: "เส้นและลักษณะมือ", READINGS: "คำอ่านลายมือ", CATEGORIES: "หมวดคำอ่าน" }]);

for (const [file, group, label, routes, bindings] of groups) {
  let source = await fs.readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edits = [];
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const variable of statement.declarationList.declarations) {
      const name = variable.name.getText(ast);
      if (!bindings[name] || !variable.initializer || variable.initializer.getText(ast).startsWith("managedContent(")) continue;
      const metadata = JSON.stringify({ title: bindings[name], group: label, routes });
      edits.push({ start: variable.initializer.getStart(ast), end: variable.initializer.end, text: `managedContent("${group}.${name}", ${variable.initializer.getText(ast)}, ${metadata})` });
    }
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  if (!source.includes('import { managedContent }')) source = 'import { managedContent } from "../lib/managed-content.js";\n' + source;
  await fs.writeFile(file, source);
}
