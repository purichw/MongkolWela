import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const outputDir = new URL("../public/images/lines/", import.meta.url);

const lineTypes = {
  life_line: {
    long_clear: "life_line_long_clear.png",
    short: "life_line_short.png",
    broken: "life_line_broken.png",
    chained: "life_line_chained.png",
    double_mars: "life_line_double_mars.png",
    branch_up: "life_line_branch_up.png",
    branch_down: "life_line_branch_down.png",
    wide_arc: "life_line_wide_arc.png",
    curves_to_moon: "life_line_curves_to_moon.png",
  },
  head_line: {
    straight_long: "head_line_straight_long.png",
    slight_curve: "head_line_slight_curve.png",
    deep_curve: "head_line_deep_curve.png",
    short: "head_line_short.png",
    double: "head_line_double.png",
    forked: "head_line_forked.png",
    broken: "head_line_broken.png",
  },
  heart_line: {
    long_curved: "heart_line_long_curved.png",
    long_straight: "heart_line_long_straight.png",
    short: "heart_line_short.png",
    wavy: "heart_line_wavy.png",
    broken: "heart_line_broken.png",
    curves_up: "heart_line_curves_up.png",
    points_jupiter: "heart_line_points_jupiter.png",
  },
  fate_line: {
    clear_from_wrist: "fate_line_clear_from_wrist.png",
    from_life_line: "fate_line_from_life_line.png",
    from_moon_mount: "fate_line_from_moon_mount.png",
    broken: "fate_line_broken.png",
    absent: "fate_line_absent.png",
    branch_jupiter: "fate_line_branch_jupiter.png",
    from_head_line: "fate_line_from_head_line.png",
    stops_at_heart: "fate_line_stops_at_heart.png",
    stops_at_head: "fate_line_stops_at_head.png",
    branch_sun: "fate_line_branch_sun.png",
  },
  sun_line: {
    clear_present: "sun_line_clear_present.png",
    short: "sun_line_short.png",
    absent: "sun_line_absent.png",
  },
  mercury_line: {
    absent: "mercury_line_absent.png",
    clear_straight: "mercury_line_clear_straight.png",
    wavy: "mercury_line_wavy.png",
  },
  marriage_line: {
    one_clear: "marriage_line_one_clear.png",
    two_separate: "marriage_line_two_separate.png",
    two_close: "marriage_line_two_close.png",
    curves_down: "marriage_line_curves_down.png",
    crosses_heart: "marriage_line_crosses_heart.png",
    curves_up: "marriage_line_curves_up.png",
  },
};

const baseGuides = {
  life: "M116 188 C88 229 87 293 124 351",
  head: "M119 205 C155 215 195 226 236 242",
  heart: "M134 169 C169 188 215 199 264 210",
  fate: "M168 352 C166 300 165 245 162 176",
  sun: "M210 322 C208 279 207 229 205 197",
  mercury: "M139 339 C168 303 202 260 241 211",
  marriage: "M246 181 C257 180 267 178 276 176",
};

const variantLines = {
  life_line: {
    long_clear: [{ d: baseGuides.life }],
    short: [{ d: "M117 188 C94 222 93 263 113 292" }],
    broken: [
      { d: "M116 188 C104 208 99 230 99 250" },
      { d: "M104 279 C109 307 119 333 133 351" },
    ],
    chained: [
      { d: "M116 188 C88 229 87 293 124 351", strokeWidth: 3.2, opacity: 0.62 },
      ...chainPoints([
        [115, 192],
        [108, 204],
        [103, 217],
        [99, 232],
        [97, 248],
        [98, 264],
        [101, 281],
        [106, 298],
        [113, 315],
        [122, 333],
      ]),
    ],
    double_mars: [
      { d: baseGuides.life },
      { d: "M132 199 C112 237 113 292 143 333", stroke: "#b9792d", strokeWidth: 3.6 },
    ],
    branch_up: [
      { d: baseGuides.life },
      { d: "M105 260 C133 247 150 226 160 203" },
    ],
    branch_down: [
      { d: baseGuides.life },
      { d: "M106 282 C129 304 145 325 154 351" },
    ],
    wide_arc: [{ d: "M124 184 C78 226 70 301 123 358" }],
    curves_to_moon: [{ d: "M116 188 C94 229 91 286 124 322 C144 342 174 354 209 358" }],
  },
  head_line: {
    straight_long: [{ d: "M112 205 C151 215 197 225 246 236" }],
    slight_curve: [{ d: "M114 205 C153 219 192 235 235 256" }],
    deep_curve: [{ d: "M114 205 C151 229 177 260 197 302" }],
    short: [{ d: "M116 205 C142 211 166 219 190 229" }],
    double: [
      { d: "M113 204 C153 215 195 227 237 244" },
      { d: "M119 224 C154 234 193 246 228 263", stroke: "#b9792d", strokeWidth: 3.2 },
    ],
    forked: [
      { d: "M114 205 C151 216 191 229 225 244" },
      { d: "M220 243 C236 237 249 231 260 224" },
      { d: "M220 245 C235 258 246 270 255 283" },
    ],
    broken: [
      { d: "M114 205 C138 211 158 216 176 222" },
      { d: "M199 229 C215 235 231 241 247 248" },
    ],
  },
  heart_line: {
    long_curved: [{ d: "M132 170 C169 190 217 203 264 210 C276 212 284 205 290 195" }],
    long_straight: [{ d: "M132 169 C174 181 221 190 275 198" }],
    short: [{ d: "M172 185 C205 195 235 202 260 208" }],
    wavy: [{ d: "M132 170 C153 181 173 176 194 187 C214 198 232 192 262 207" }],
    broken: [
      { d: "M133 170 C154 181 176 187 196 193" },
      { d: "M219 199 C236 204 253 207 268 210" },
    ],
    curves_up: [{ d: "M132 170 C169 189 214 200 261 207 C276 209 291 196 298 178" }],
    points_jupiter: [{ d: "M134 169 C164 183 203 195 254 205 C232 184 213 171 194 163" }],
  },
  fate_line: {
    clear_from_wrist: [{ d: baseGuides.fate }],
    from_life_line: [{ d: "M111 273 C134 257 153 226 163 176" }],
    from_moon_mount: [{ d: "M231 339 C209 306 184 257 162 176" }],
    broken: [
      { d: "M168 352 C166 318 165 290 164 266" },
      { d: "M163 238 C163 215 162 194 162 176" },
    ],
    absent: [],
    branch_jupiter: [
      { d: baseGuides.fate },
      { d: "M163 203 C143 188 131 178 119 164" },
    ],
    from_head_line: [{ d: "M166 245 C165 223 164 198 162 176" }],
    stops_at_heart: [{ d: "M168 352 C166 301 164 250 163 202" }],
    stops_at_head: [{ d: "M168 352 C166 308 165 270 164 238" }],
    branch_sun: [
      { d: baseGuides.fate },
      { d: "M164 226 C183 216 198 205 207 193", stroke: "#b9792d" },
    ],
  },
  sun_line: {
    clear_present: [{ d: baseGuides.sun }],
    short: [{ d: "M209 280 C208 247 207 220 206 200" }],
    absent: [],
  },
  mercury_line: {
    absent: [],
    clear_straight: [{ d: baseGuides.mercury }],
    wavy: [{ d: "M139 339 C163 314 157 289 184 266 C207 246 212 225 241 211" }],
  },
  marriage_line: {
    one_clear: [{ d: baseGuides.marriage }],
    two_separate: [
      { d: "M246 176 C256 175 266 173 275 171" },
      { d: "M246 187 C256 186 266 184 276 182" },
    ],
    two_close: [
      { d: "M246 178 C257 177 267 175 276 173" },
      { d: "M246 183 C257 182 267 180 276 178" },
    ],
    curves_down: [{ d: "M247 178 C261 181 272 189 279 202" }],
    crosses_heart: [
      { d: baseGuides.marriage },
      { d: "M250 177 C240 190 230 203 219 218" },
    ],
    curves_up: [{ d: "M247 181 C260 176 271 167 279 154" }],
  },
};

const rendered = [];

for (const [lineType, variants] of Object.entries(lineTypes)) {
  for (const [variant, filename] of Object.entries(variants)) {
    const svg = renderSvg(variantLines[lineType][variant] ?? []);
    const target = fileURLToPath(new URL(filename, outputDir));
    await sharp(Buffer.from(svg)).resize(300, 400, { fit: "fill" }).png({ compressionLevel: 9 }).toFile(target);
    rendered.push(filename);
  }
}

await writeFile(new URL("index.json", outputDir), `${JSON.stringify(lineTypes, null, 2)}\n`);

console.log(`rendered ${rendered.length} palm-line PNGs to ${fileURLToPath(outputDir)}`);

function renderSvg(lines) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" role="img">
  <defs>
    <radialGradient id="skin" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#fff6ea"/>
      <stop offset="58%" stop-color="#f3d2af"/>
      <stop offset="100%" stop-color="#d9a277"/>
    </radialGradient>
    <linearGradient id="palmWarmth" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#fff9f0" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#dfad84" stop-opacity=".24"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="#fffdf8"/>
  <g fill="url(#skin)" stroke="#c99168" stroke-width="2.35" stroke-linejoin="round">
    <path d="M85 352 C78 330 76 307 79 286 C66 271 52 247 43 221 C38 207 39 190 48 181 C57 173 69 181 72 195 C77 215 84 233 94 250 C89 224 89 196 94 166 C94 132 95 92 100 57 C102 47 118 47 121 57 C126 93 126 130 128 158 C130 166 135 166 137 158 C138 117 140 70 144 37 C146 27 161 27 163 37 C167 71 168 121 169 158 C171 166 176 166 178 158 C179 119 181 84 184 51 C186 42 200 42 202 51 C205 84 206 124 207 158 C209 166 214 167 216 161 C217 135 219 107 221 84 C223 75 236 75 238 84 C241 111 243 139 246 164 C254 190 256 222 252 256 C248 292 237 327 224 349 C181 359 120 359 85 352 Z"/>
    <path d="M88 352 C123 360 184 361 224 349" fill="none" stroke-width="1.7"/>
  </g>
  <path d="M88 166 C115 167 138 168 169 168 C196 168 223 169 248 171" fill="none" stroke="#d8aa85" stroke-width="1.25" opacity=".42"/>
  <g fill="none" stroke="#bd875f" stroke-width="1.25" stroke-linecap="round" opacity=".52">
    <path d="M103 83 Q111 87 119 83 M103 112 Q111 116 120 112 M102 141 Q112 145 122 141"/>
    <path d="M146 68 Q154 72 162 68 M145 101 Q154 105 163 101 M145 134 Q154 138 164 134"/>
    <path d="M186 80 Q194 84 201 80 M185 111 Q194 115 202 111 M185 140 Q194 144 203 140"/>
    <path d="M223 107 Q230 111 237 107 M224 136 Q231 140 239 136"/>
    <path d="M55 202 Q64 208 70 218 M63 231 Q74 239 84 244"/>
    <path d="M98 169 Q112 176 128 166 M139 166 Q154 174 169 166 M179 166 Q194 173 208 166 M219 167 Q233 174 247 166"/>
  </g>
  <g fill="none" stroke="#d2a984" stroke-width="1.55" stroke-linecap="round" opacity=".72">
    <path d="M128 177 C155 189 206 199 245 212"/>
    <path d="M116 209 C152 218 196 230 234 244"/>
    <path d="M117 192 C101 229 101 287 126 330"/>
  </g>
  <path d="M93 354 C122 365 184 366 225 352" fill="none" stroke="#c99168" stroke-width="1.6" opacity=".55"/>
  <g fill="none" stroke="#b9352c" stroke-linecap="round" stroke-linejoin="round">
    ${lines.map(renderLine).join("\n    ")}
  </g>
  <rect width="300" height="400" fill="url(#palmWarmth)" opacity=".22"/>
</svg>`;
}

function renderLine(line) {
  if (line.kind === "circle") {
    return `<ellipse cx="${line.cx}" cy="${line.cy}" rx="${line.rx}" ry="${line.ry}" transform="rotate(${line.rotate} ${line.cx} ${line.cy})" stroke="${line.stroke ?? "#b9352c"}" stroke-width="${line.strokeWidth ?? 3}" fill="none" opacity="${line.opacity ?? 1}"/>`;
  }

  return `<path d="${line.d}" stroke="${line.stroke ?? "#b9352c"}" stroke-width="${line.strokeWidth ?? 5}" opacity="${line.opacity ?? 1}"/>`;
}

function chainPoints(points) {
  return points.map(([cx, cy], index) => ({
    kind: "circle",
    cx,
    cy,
    rx: 3.7,
    ry: 5.2,
    rotate: -20 + index * 2,
    strokeWidth: 2.4,
  }));
}
