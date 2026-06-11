#!/usr/bin/env python3
"""Generate the 45 palm-line variant illustrations for the palmistry tool.

Featured lines use a color by line type while the other major lines remain
as faint context. SVGs are written to a temporary build directory and are
converted to PNG by scripts/render-palm-lines.mjs.
"""
import json
import math
import os

VIEW_W, VIEW_H = 300, 400
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_SVG = os.path.join(REPO_ROOT, "scripts", "_palm_svg_build")
OUT_INDEX = os.path.join(REPO_ROOT, "public", "images", "lines", "index.json")

LINE_VARIANTS = {
    "life_line": [
        "long_clear", "short", "broken", "chained", "double_mars",
        "branch_up", "branch_down", "wide_arc", "curves_to_moon",
    ],
    "head_line": [
        "straight_long", "slight_curve", "deep_curve", "short",
        "double", "forked", "broken",
    ],
    "heart_line": [
        "long_curved", "long_straight", "short", "wavy",
        "broken", "curves_up", "points_jupiter",
    ],
    "fate_line": [
        "clear_from_wrist", "from_life_line", "from_moon_mount", "broken",
        "absent", "branch_jupiter", "from_head_line", "stops_at_heart",
        "stops_at_head", "branch_sun",
    ],
    "sun_line": ["clear_present", "short", "absent"],
    "mercury_line": ["absent", "clear_straight", "wavy"],
    "marriage_line": [
        "one_clear", "two_separate", "two_close",
        "curves_down", "crosses_heart", "curves_up",
    ],
}

# Per-line-type colors (from the Cowork palette)
TYPE_COLOR = {
    "life_line":     "#C0392B",  # red
    "head_line":     "#2471A3",  # blue
    "heart_line":    "#E74C3C",  # bright red
    "fate_line":     "#7D3C98",  # purple
    "sun_line":      "#D4AC0D",  # gold
    "mercury_line":  "#16A085",  # teal
    "marriage_line": "#27AE60",  # green
}

# FEATURED is reassigned per line in main(); stroke()/chained()/dot() read it live.
FEATURED = "#C0392B"
GHOST = "#C3B8A8"
SKIN = "#FCF1E8"
OUTLINE = "#C99A78"


# ---------- geometry helpers ----------

def catmull_rom(pts, samples_per_seg=30):
    """Sample a smooth curve through pts (Catmull-Rom)."""
    if len(pts) == 2:
        (x0, y0), (x1, y1) = pts
        return [(x0 + (x1 - x0) * t / samples_per_seg,
                 y0 + (y1 - y0) * t / samples_per_seg)
                for t in range(samples_per_seg + 1)]
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for j in range(samples_per_seg):
            t = j / samples_per_seg
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
                       + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
                       + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(pts[-1])
    return out


def arclens(pts):
    acc, total = [0.0], 0.0
    for i in range(1, len(pts)):
        total += math.dist(pts[i - 1], pts[i])
        acc.append(total)
    return acc, total


def clip(pts, t0, t1):
    """Sub-path between fractions t0..t1 of total arc length."""
    acc, total = arclens(pts)
    return [p for p, a in zip(pts, acc) if t0 * total <= a <= t1 * total]


def normals(pts):
    ns = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1.0
        ns.append((dy / ln, -dx / ln))
    return ns


def offset(pts, d):
    return [(p[0] + n[0] * d, p[1] + n[1] * d) for p, n in zip(pts, normals(pts))]


def wavy(pts, amp=4.0, wavelength=34.0):
    acc, _ = arclens(pts)
    ns = normals(pts)
    return [(p[0] + n[0] * amp * math.sin(2 * math.pi * a / wavelength),
             p[1] + n[1] * amp * math.sin(2 * math.pi * a / wavelength))
            for p, n, a in zip(pts, ns, acc)]


def point_at(pts, t):
    acc, total = arclens(pts)
    target = t * total
    for i in range(1, len(pts)):
        if acc[i] >= target:
            return pts[i]
    return pts[-1]


def path_d(pts):
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts)


# ---------- svg emitters ----------

def stroke(pts, color=None, w=4.0, opacity=1.0, dash=None):
    color = color or FEATURED
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<path d="{path_d(pts)}" fill="none" stroke="{color}" '
            f'stroke-width="{w}" stroke-linecap="round" '
            f'stroke-linejoin="round" opacity="{opacity}"{d}/>')


def broken(pts, **kw):
    segs = [(0.0, 0.30), (0.42, 0.68), (0.80, 1.0)]
    return "".join(stroke(clip(pts, a, b), **kw) for a, b in segs)


def chained(pts, color=None):
    color = color or FEATURED
    acc, total = arclens(pts)
    out, s = [], 6.0
    while s < total - 4:
        # find point + tangent at arc length s
        i = next(i for i in range(1, len(pts)) if acc[i] >= s)
        p = pts[i]
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        out.append(f'<ellipse cx="{p[0]:.1f}" cy="{p[1]:.1f}" rx="5.5" ry="3" '
                   f'fill="none" stroke="{color}" stroke-width="2.2" '
                   f'transform="rotate({ang:.0f} {p[0]:.1f} {p[1]:.1f})"/>')
        s += 11.0
    return "".join(out)


def absent(pts):
    return stroke(pts, w=2.5, opacity=0.45, dash="2 7")


def dot(p, r=4.0):
    return f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="{r}" fill="{FEATURED}"/>'


# Per-type lighter tint for "sister"/branch lines (double_mars inner, etc.)
SISTER = {
    "life_line": "#E67E22", "head_line": "#5499C7", "heart_line": "#F1948A",
    "fate_line": "#A569BD", "sun_line": "#F4D03F", "mercury_line": "#48C9B0",
    "marriage_line": "#52BE80",
}


# ---------- hand ----------

HAND_OUTLINE = (
    "M 86 352 "
    "C 80 332 76 310 78 290 "      # left palm edge
    "C 66 276 50 250 42 222 "      # thumb outer edge
    "C 38 208 38 192 46 184 "      # thumb tip
    "C 54 176 64 182 67 194 "      # tip -> inner edge
    "C 72 212 80 232 90 248 "      # inner thumb to web
    "C 87 220 88 192 92 166 "      # left palm edge to index base
    "C 92 130 93 92 98 56 "        # index left (slim, long)
    "C 100 47 116 47 118 56 "      # index tip (tapered)
    "C 123 92 124 130 126 158 "    # index right
    "C 128 165 132 165 134 158 "   # web index-middle
    "C 135 118 137 70 140 36 "     # middle left
    "C 142 27 158 27 160 36 "      # middle tip
    "C 163 70 165 120 166 158 "    # middle right
    "C 168 165 172 165 174 158 "   # web middle-ring
    "C 175 120 177 84 180 50 "     # ring left
    "C 182 41 196 41 198 50 "      # ring tip
    "C 201 84 203 124 204 158 "    # ring right
    "C 206 165 209 166 211 160 "   # web ring-pinky
    "C 212 134 214 106 216 82 "    # pinky left
    "C 218 73 231 73 233 82 "      # pinky tip
    "C 235 110 238 138 240 162 "   # pinky right
    "C 248 185 250 220 246 255 "   # percussion edge
    "C 242 290 232 325 220 348 "   # percussion to wrist
    "C 180 358 120 358 86 352 Z"   # wrist
)

CREASES = [
    # finger joint creases (distal + middle) for the slimmer fingers
    "M 100 100 Q 108 104 116 100", "M 99 130 Q 108 134 117 130",
    "M 142 84 Q 150 88 158 84",    "M 141 118 Q 150 122 159 118",
    "M 182 96 Q 190 100 197 96",   "M 181 126 Q 190 130 198 126",
    "M 218 116 Q 224 119 231 116",
    # finger base creases (where each finger meets the palm)
    "M 96 160 Q 109 166 124 158",  "M 136 158 Q 150 164 165 158",
    "M 176 158 Q 189 164 203 158", "M 213 160 Q 224 165 238 162",
    # thumb crease + two wrist creases
    "M 60 196 Q 66 206 70 216",
    "M 96 346 Q 150 356 214 344",  "M 100 356 Q 150 365 210 354",
]

# Fingertip nails: (cx, cy, rx, ry, rotate)
NAILS = [
    (108, 60, 7.5, 9, 0), (150, 40, 7.5, 9, 0), (189, 54, 7, 9, 0),
    (224, 88, 6.5, 8, 0), (52, 197, 7, 8, -32),
]


def hand_svg(body):
    creases = "".join(
        f'<path d="{d}" fill="none" stroke="{OUTLINE}" stroke-width="1.3" '
        f'opacity="0.45" stroke-linecap="round"/>' for d in CREASES)
    nails = "".join(
        f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#FFF7EF" '
        f'opacity="0.55" stroke="{OUTLINE}" stroke-width="1" '
        f'transform="rotate({rot} {cx} {cy})"/>' for cx, cy, rx, ry, rot in NAILS)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{VIEW_W}" '
            f'height="{VIEW_H}" viewBox="0 0 {VIEW_W} {VIEW_H}">'
            f'<defs>'
            f'<radialGradient id="skin" cx="46%" cy="38%" r="70%">'
            f'<stop offset="0%" stop-color="#FDEEE0"/>'
            f'<stop offset="55%" stop-color="#F7D2B5"/>'
            f'<stop offset="100%" stop-color="#EDBA94"/>'
            f'</radialGradient>'
            f'</defs>'
            f'<rect width="{VIEW_W}" height="{VIEW_H}" fill="#FFFFFF"/>'
            f'<path d="{HAND_OUTLINE}" fill="url(#skin)" stroke="{OUTLINE}" '
            f'stroke-width="2.5" stroke-linejoin="round"/>'
            f'{nails}{creases}{body}</svg>')


# ---------- base line geometry (anchor points) ----------

BASE = {
    "life_line":     [(98, 195), (90, 228), (88, 262), (98, 300), (120, 334)],
    "head_line":     [(98, 210), (140, 222), (182, 232), (218, 242)],
    "heart_line":    [(242, 205), (198, 194), (156, 184), (126, 168)],
    "fate_line":     [(152, 338), (149, 290), (146, 232), (144, 175)],
    "sun_line":      [(192, 310), (189, 255), (186, 198)],
    "mercury_line":  [(122, 330), (156, 292), (192, 248), (222, 210)],
    "marriage_line": [(246, 180), (224, 182)],
}

GHOST_SET = ["life_line", "head_line", "heart_line", "fate_line"]


def ghosts(except_type):
    out = []
    for t in GHOST_SET:
        if t == except_type:
            continue
        out.append(stroke(catmull_rom(BASE[t]), color=GHOST, w=2, opacity=0.55))
    return "".join(out)


def F(anchors):
    return catmull_rom(anchors)


# ---------- variant renderers: (line_type, characteristic_en) -> svg body ----------

def life(char):
    base = F(BASE["life_line"])
    if char == "long_clear":
        return stroke(base, w=4.5)
    if char == "short":
        return stroke(clip(base, 0, 0.45), w=4)
    if char == "broken":
        return broken(base, w=4)
    if char == "chained":
        return chained(base)
    if char == "double_mars":
        inner = clip(offset(base, 10), 0.05, 0.80)
        return stroke(base, w=4) + stroke(inner, color=SISTER["life_line"], w=3)
    if char == "branch_up":
        b1 = F([point_at(base, 0.24), (126, 178)])
        b2 = F([point_at(base, 0.45), (139, 207)])
        return stroke(base, w=4) + stroke(b1, w=3) + stroke(b2, w=3)
    if char == "branch_down":
        b1 = F([point_at(base, 0.50), (79, 296)])
        b2 = F([point_at(base, 0.68), (91, 327)])
        return stroke(base, w=4) + stroke(b1, w=3) + stroke(b2, w=3)
    if char == "wide_arc":
        alt = F([(98, 195), (112, 228), (124, 270), (145, 309), (164, 335)])
        return stroke(alt, w=4.5)
    if char == "curves_to_moon":
        alt = F([(98, 195), (91, 235), (99, 276), (145, 313), (214, 329)])
        return stroke(alt, w=4)


def head(char):
    base = F(BASE["head_line"])
    if char == "straight_long":
        return stroke(F([(98, 208), (144, 216), (190, 222), (232, 226)]), w=4.5)
    if char == "slight_curve":
        return stroke(base, w=4)
    if char == "deep_curve":
        return stroke(F([(98, 210), (135, 232), (168, 262), (195, 295)]), w=4)
    if char == "short":
        return stroke(clip(base, 0, 0.52), w=4)
    if char == "double":
        return stroke(base, w=4) + stroke(offset(base, -10), w=3)
    if char == "forked":
        stem = clip(base, 0, 0.85)
        p = stem[-1]
        return (stroke(stem, w=4)
                + stroke(F([p, (232, 230)]), w=3)
                + stroke(F([p, (224, 262)]), w=3))
    if char == "broken":
        return broken(base, w=4)


def heart(char):
    base = F(BASE["heart_line"])
    if char == "long_curved":
        return stroke(base, w=4.5)
    if char == "long_straight":
        return stroke(F([(242, 203), (198, 198), (152, 194), (110, 190)]), w=4.5)
    if char == "short":
        return stroke(clip(base, 0, 0.5), w=4)
    if char == "wavy":
        return stroke(wavy(base), w=3.5)
    if char == "broken":
        return broken(base, w=4)
    if char == "curves_up":
        return stroke(F([(242, 205), (202, 195), (166, 182), (140, 156)]), w=4)
    if char == "points_jupiter":
        return stroke(F([(242, 205), (199, 194), (158, 181), (118, 158)]), w=4.5)


def fate(char):
    base = F(BASE["fate_line"])
    if char == "clear_from_wrist":
        return stroke(base, w=4.5)
    if char == "from_life_line":
        return stroke(F([(92, 268), (118, 236), (136, 206), (144, 178)]), w=4)
    if char == "from_moon_mount":
        return stroke(F([(206, 312), (182, 266), (162, 222), (146, 180)]), w=4)
    if char == "broken":
        return broken(base, w=4)
    if char == "absent":
        return absent(base)
    if char == "branch_jupiter":
        p = point_at(base, 0.73)
        return stroke(base, w=4) + stroke(F([p, (118, 160)]), w=3)
    if char == "from_head_line":
        return stroke(F([(146, 232), (145, 203), (144, 175)]), w=4)
    if char == "stops_at_heart":
        stem = clip(base, 0, 0.82)
        return stroke(stem, w=4) + dot(stem[-1])
    if char == "stops_at_head":
        stem = clip(base, 0, 0.64)
        return stroke(stem, w=4) + dot(stem[-1])
    if char == "branch_sun":
        p = point_at(base, 0.72)
        return stroke(base, w=4) + stroke(F([p, (184, 190)]), w=3)


def sun(char):
    base = F(BASE["sun_line"])
    if char == "clear_present":
        return stroke(base, w=4.5)
    if char == "short":
        return stroke(clip(base, 0.58, 1.0), w=4)
    if char == "absent":
        return absent(base)


def mercury(char):
    base = F(BASE["mercury_line"])
    if char == "absent":
        return absent(base)
    if char == "clear_straight":
        return stroke(base, w=4.5)
    if char == "wavy":
        return stroke(wavy(base, amp=4.5, wavelength=40), w=3.5)


def marriage(char):
    if char == "one_clear":
        return stroke(F([(244, 182), (220, 184)]), w=4.5)
    if char == "two_separate":
        return (stroke(F([(244, 172), (222, 174)]), w=4)
                + stroke(F([(244, 194), (222, 196)]), w=4))
    if char == "two_close":
        return (stroke(F([(244, 179), (222, 181)]), w=4)
                + stroke(F([(244, 188), (222, 190)]), w=4))
    if char == "curves_down":
        return stroke(F([(244, 178), (232, 182), (224, 196)]), w=4)
    if char == "crosses_heart":
        return stroke(F([(246, 177), (232, 187), (216, 203), (201, 217)]), w=4)
    if char == "curves_up":
        return stroke(F([(244, 188), (232, 183), (224, 168)]), w=4)


RENDER = {
    "life_line": life, "head_line": head, "heart_line": heart,
    "fate_line": fate, "sun_line": sun, "mercury_line": mercury,
    "marriage_line": marriage,
}


def main():
    os.makedirs(OUT_SVG, exist_ok=True)
    made = []
    index = {}
    global FEATURED
    for t, variants in LINE_VARIANTS.items():
        for c in variants:
            FEATURED = TYPE_COLOR[t]
            body = RENDER[t](c)
            if body is None:
                raise SystemExit(f"no renderer for {t}/{c}")
            name = f"{t}_{c}"
            with open(f"{OUT_SVG}/{name}.svg", "w") as f:
                f.write(hand_svg(ghosts(t) + body))
            made.append(name)
            index.setdefault(t, {})[c] = f"{name}.png"
    with open(OUT_INDEX, "w") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {len(made)} svgs to {OUT_SVG}")


if __name__ == "__main__":
    main()
