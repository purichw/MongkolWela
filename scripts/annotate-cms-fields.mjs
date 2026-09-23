import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "@astrojs/compiler";

const eligible = new Set(["h1", "h2", "h3", "h4", "p", "li", "blockquote", "figcaption", "strong", "em", "small", "span", "a", "label", "legend", "button", "summary", "option", "dt", "dd", "img", "input", "textarea"]);
const excluded = /(?:\/admin\/|\/seller\/|\/icons\/|TempleDetail|TempleCollectionView|TempleMapOverlay|LoadingScreen|PageEntrance|CmsImage|PalmLineMap|AstrologyWheel)/;

async function files(directory) {
  return (await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : filename.endsWith(".astro") ? [filename] : [];
  }))).flat();
}

for (const file of [...await files("src/pages"), ...await files("src/components")]) {
  if (excluded.test(file)) continue;
  const source = await fs.readFile(file, "utf8");
  const { ast } = await parse(source);
  const prefix = crypto.createHash("sha256").update(file).digest("hex").slice(0, 8);
  const used = new Set([...source.matchAll(/data-cms-field="([^"]+)"/g)].map(match => match[1]));
  let sequence = 0;
  const edits = [];
  function visit(node) {
    if (["script", "style", "svg"].includes(node.name)) return;
    const hasAttribute = name => node.attributes?.some(attr => attr.name === name);
    if (node.type === "element" && eligible.has(node.name) && !hasAttribute("data-cms-field")) {
      const hasCopy = node.children?.some(child => child.type === "text" && /[\p{L}]/u.test(child.value));
      const hasValue = node.children?.some(child => child.type === "expression") || ["img", "input", "textarea"].includes(node.name);
      if (hasCopy || hasValue) {
        let id;
        do { id = `${prefix}-${++sequence}`; } while (used.has(id));
        used.add(id);
        edits.push({ offset: node.position.start.offset + 1 + Buffer.byteLength(node.name), value: ` data-cms-field="${id}"` });
      }
    }
    for (const child of node.children || []) visit(child);
  }
  visit(ast);
  let buffer = Buffer.from(source);
  for (const edit of edits.sort((a, b) => b.offset - a.offset)) buffer = Buffer.concat([buffer.subarray(0, edit.offset), Buffer.from(edit.value), buffer.subarray(edit.offset)]);
  if (edits.length) { await fs.writeFile(file, buffer); console.log(`${file}: ${edits.length}`); }
}
