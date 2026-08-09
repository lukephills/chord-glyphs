#!/usr/bin/env node
/* eslint-disable */
// Generator for CLUSTER chord glyphs, implementing the rules in
// revised-design-files/chord-glyph-rules.md.
//
// Each chord is described by a spec object:
//   {
//     name:    "Cmaj7",                  // display name
//     file:    "Cmaj7.svg",              // output filename
//     quality: "major"|"minor"|"diminished"|"augmented"|"suspended",
//     susp:    { h: 4, alt: "natural" }  // only when quality === "suspended"
//     ext:     [ { h: 7, alt: "flat" }, { h: 9, alt: "natural" }, ... ]
//     inv:     3                          // optional: bass tone hour (inversion)
//     no3:     true                       // optional: no 3rd-role tone present
//     no5:     true                       // optional: no 5th-role tone present
//     dev:     [{ h: 3, alt: "flat" }]   // optional: 3rd/5th deviation markers
//                                        //   (treated exactly like ext markers)
//     root:    { letter: "C", accidental: "flat" }   // for root-letter overlay
//     type:    "constellation"            // for scale constellations (see below)
//     notes:   [0, 386.314, ...]          // constellation cents; also used by
//                                        //   microtonal aut_classifier
//     period:  1200                       // cents per octave (constellations/
//                                        //   microtonal classifier)
//   }
//
// alt is one of: "natural" | "flat" | "sharp" | "dblflat"
//
// Microtonal chords can be described two equivalent ways:
//   (a) explicit: provide quality, optionally no3/no5, and deviation markers in
//       ext (e.g. { quality: "augmented", ext: [{h:3, alt:"flat"},
//                  {h:5, alt:"sharp"}] }).
//   (b) cents-based: provide notes (in cents) + period; the classifier rounds
//       each note to 12-TET, classifies the 3rd/5th roles, sets no3/no5 as
//       needed, and emits deviation markers automatically.

const fs = require("fs");
const path = require("path");

const FG = "#1a1a1a";

// ---- core constants (section 1) ----
const R_BASE       = 14;   // base quality circle radius (3rd + 5th both present)
const R_BASE_NO5   = 9;    // base quality circle radius when fifth is absent
const R_RIM        = 14;
const R_ORBIT      = 20;
const R_NATURAL    = 3;
const R_FLAT_RING  = 4.5;
const R_DBLFLAT_RING1 = 4;
const R_DBLFLAT_RING2 = 6.5;
const TICK_LEN     = 4;
const SPOKE_LEN    = 6;    // inversion spoke length (section 6)
const SPOKE_W      = 1.2;  // inversion spoke stroke width
const R_CONSTEL    = 18;            // constellation dot ring radius (section 9)
const R_ROOT_DOT   = 4.5;           // root emphasis dot in a constellation
const R_DOT        = 3;             // non-root constellation dot
const TET_PERIOD   = 1200;          // 12-TET cents per octave

// ---- format / escape helpers ----
function f(n) {
  return (Math.round(n * 1000) / 1000).toString();
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- clock-hour -> angle/position (section 2) ----
function angle(h) {
  return -90 + 30 * h;
}
const D2R = Math.PI / 180;
function pos(h, R) {
  const a = angle(h) * D2R;
  return { x: R * Math.cos(a), y: R * Math.sin(a) };
}
function unit(h) {
  const a = angle(h) * D2R;
  return { x: Math.cos(a), y: Math.sin(a) };
}

// outer radius of a marker (for viewBox extent math)
function markerOuterRadius(alt) {
  switch (alt) {
    case "natural": return R_ORBIT + R_NATURAL;            // 23
    case "flat":    return R_ORBIT + R_FLAT_RING;          // 24.5
    case "dblflat": return R_ORBIT + R_DBLFLAT_RING2;      // 26.5
    case "sharp":   return R_ORBIT + R_NATURAL + TICK_LEN; // 27
    default:        return R_ORBIT;
  }
}

// Effective base radius: r=14 normally, r=9 when there's no fifth to anchor
// the full-size moon-phase shape (section 10.4).
function effectiveBaseRadius(spec) {
  return spec.no5 ? R_BASE_NO5 : R_BASE;
}

// Furthest reach of the base quality shape from the glyph center. Diminished
// and augmented crescents/gibbous subtract an offset circle whose far edge
// pokes out past R_BASE on the +x side (those subtrahends are hardcoded at
// r=14 because diminished/augmented triads require a 5th role, so no no5).
function baseExtent(spec) {
  if (!spec.no3 && !spec.no5 &&
      (spec.quality === "diminished" || spec.quality === "augmented")) {
    return spec.quality === "diminished" ? 19 : 17;
  }
  return effectiveBaseRadius(spec);
}

// Furthest point from the glyph center reached by any element of this chord
// spec. Used to size the shared viewBox so every glyph renders at the same
// visual scale.
function glyphExtent(spec) {
  let maxR = baseExtent(spec);
  if (spec.ext && spec.ext.length) {
    maxR = Math.max(maxR, ...spec.ext.map((e) => markerOuterRadius(e.alt)));
  }
  if (spec.susp) {
    const s = spec.susp;
    const r = (!s.alt || s.alt === "natural") ? R_RIM + R_NATURAL
                                              : markerOuterRadius(s.alt);
    maxR = Math.max(maxR, r);
  }
  if (spec.inv != null) {
    // spoke extends past the base circle by SPOKE_LEN, and further past any
    // marker occupying hour inv (mirrors inversionSpoke()). The ~1.5 cap plus
    // stroke half-width is folded in conservatively via the constant.
    const r0 = effectiveBaseRadius(spec);
    let rEnd = r0 + SPOKE_LEN;
    if (spec.susp && spec.susp.h === spec.inv) {
      const alt = spec.susp.alt;
      rEnd = Math.max(rEnd, ((!alt || alt === N) ? R_RIM + R_NATURAL
                                                : markerOuterRadius(alt)) + 1.5);
    }
    if (spec.ext) {
      for (const e of spec.ext) {
        if (e.h === spec.inv) rEnd = Math.max(rEnd, markerOuterRadius(e.alt) + 1.5);
      }
    }
    maxR = Math.max(maxR, rEnd + SPOKE_W / 2);
  }
  return maxR;
}

// Furthest point reached by a constellation glyph. Dots sit at R_CONSTEL with
// the largest dot r = R_ROOT_DOT.
function constellationExtent() {
  return R_CONSTEL + R_ROOT_DOT;
}

// outer-circle path data at a given radius (used for letter clip paths etc.)
function outerCircleD(R) {
  return `M${f(R)},0 A${f(R)},${f(R)} 0 1,0 ${f(-R)},0 A${f(R)},${f(R)} 0 1,0 ${f(R)},0`;
}
const OUTER_CIRCLE_D_14 = outerCircleD(R_BASE);

// path-data only describing the FILLED region of the base quality, used to
// build clip paths for the root-letter overlay.
//   major      : full disc
//   minor      : left half
//   diminished : crescent (outer circle minus offset circle on the right)
//   augmented  : gibbous (outer circle minus a small bite on the right)
//   suspended  / no3 : nothing (hollow outline -> letter renders in FG only)
function baseFillPathData(spec) {
  const R = effectiveBaseRadius(spec);
  // no-third or suspended means no fill at all (the "new moon" outline)
  if (spec.no3 || spec.quality === "suspended") return "";
  switch (spec.quality) {
    case "major":      return outerCircleD(R);
    case "minor":      return `M0,${f(-R)} A${f(R)},${f(R)} 0 0,0 0,${f(R)} Z`;
    case "diminished": return `${OUTER_CIRCLE_D_14} M19,0 A13,13 0 1,0 -7,0 A13,13 0 1,0 19,0`;
    case "augmented":  return `${OUTER_CIRCLE_D_14} M17,0 A6,6 0 1,0 5,0 A6,6 0 1,0 17,0`;
    default: throw new Error("unknown quality: " + spec.quality);
  }
}

// Page background color used for the "light" half of the root-letter overlay so
// the letter blends with whatever shows through the glyph's hollow regions.
const BG = "#fafaf7";

// ---- root-letter overlay (unchanged logic, now no5/no3 aware via path data)
function rootLetterLayer(spec, clipID) {
  const root = spec.root || { letter: "C", accidental: null };
  const letter = root.letter || "C";
  const acc = root.accidental === "flat"  ? "\u266D"
            : root.accidental === "sharp" ? "\u266F"
            : "";

  const fillD   = baseFillPathData(spec);
  const outerD  = outerCircleD(effectiveBaseRadius(spec));
  const nofillD = fillD ? `${outerD} ${fillD}` : outerD;

  const fillClipID   = `cf-${clipID}`;
  const nofillClipID = `cnf-${clipID}`;

  // an empty <path> for the hollow/suspended fill (renders nothing for BG layer)
  const fillClipEl = fillD ? `<path d="${fillD}"/>` : `<path d="M0,0 Z"/>`;

  const hasAcc = !!acc;
  const letterX = hasAcc ? -1.8 : 0;
  const letterFS = hasAcc ? 16 : 17;
  const accX = 7;
  const accFS = 9.5;
  const baseY = 0;

  function textEls(fill) {
    const t = `<text x="${f(letterX)}" y="${f(baseY)}" text-anchor="middle" dominant-baseline="central" font-size="${letterFS}" font-weight="700" font-family="'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fill="${fill}">${esc(letter)}</text>`;
    if (!hasAcc) return t;
    return t + `<text x="${f(accX)}" y="${f(baseY + 0.4)}" text-anchor="middle" dominant-baseline="central" font-size="${accFS}" font-weight="500" font-family="'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fill="${fill}">${acc}</text>`;
  }

  return `<g class="root-letter" aria-hidden="true">
    <defs>
      <clipPath id="${fillClipID}">${fillClipEl}</clipPath>
      <clipPath id="${nofillClipID}"><path d="${nofillD}" clip-rule="evenodd"/></clipPath>
    </defs>
    <g clip-path="url(#${fillClipID})">${textEls(BG)}</g>
    <g clip-path="url(#${nofillClipID})">${textEls(FG)}</g>
  </g>`;
}

// ---- base quality shapes (section 3 + 10.4 no5/no3 matrix) ----
function baseShape(spec) {
  const R = effectiveBaseRadius(spec);
  // no3 or suspended -> hollow outline (the "new moon")
  if (spec.no3 || spec.quality === "suspended") {
    return `<circle r="${f(R)}" fill="none" stroke="${FG}" stroke-width="1.5"/>`;
  }
  switch (spec.quality) {
    case "major":
      return `<circle r="${f(R)}" fill="${FG}"/>`;
    case "minor":
      return `<circle r="${f(R)}" fill="none" stroke="${FG}" stroke-width="1.5"/>\n  ` +
             `<path d="M0,${f(-R)} A${f(R)},${f(R)} 0 0,0 0,${f(R)} Z" fill="${FG}"/>`;
    case "diminished":
      return `<path d="M14,0 A14,14 0 1,0 -14,0 A14,14 0 1,0 14,0 ` +
             `M19,0 A13,13 0 1,0 -7,0 A13,13 0 1,0 19,0" fill-rule="evenodd" fill="${FG}"/>`;
    case "augmented":
      return `<path d="M14,0 A14,14 0 1,0 -14,0 A14,14 0 1,0 14,0 ` +
             `M17,0 A6,6 0 1,0 5,0 A6,6 0 1,0 17,0" fill-rule="evenodd" fill="${FG}"/>`;
    default:
      throw new Error("unknown quality: " + spec.quality);
  }
}

// ---- rim marker for suspended tones (section 4) ----
function rimMarker(susp) {
  const p = pos(susp.h, R_RIM);
  const parts = [];
  if (!susp.alt || susp.alt === "natural") {
    parts.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_NATURAL}" fill="${FG}"/>`);
  } else {
    // sharp / flat treatment shared with orbit vocabulary (section 5), but
    // placed at the rim radius.
    parts.push(...markerPartsAt(susp.h, susp.alt, R_RIM));
  }
  return parts.join("\n  ");
}

// ---- orbit markers (section 5), generalized to any radius ----
function markerPartsAt(h, alt, R) {
  const p = pos(h, R);
  const out = [];
  if (alt === "natural") {
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_NATURAL}" fill="${FG}"/>`);
  } else if (alt === "flat") {
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="1.5" fill="${FG}"/>`);
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_FLAT_RING}" fill="none" stroke="${FG}" stroke-width="1.2"/>`);
  } else if (alt === "sharp") {
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_NATURAL}" fill="${FG}"/>`);
    const u = unit(h);
    const t1 = { x: u.x * (R + 3), y: u.y * (R + 3) };
    const t2 = { x: u.x * (R + 7), y: u.y * (R + 7) };
    out.push(`<line x1="${f(t1.x)}" y1="${f(t1.y)}" x2="${f(t2.x)}" y2="${f(t2.y)}" stroke="${FG}" stroke-width="2" stroke-linecap="round"/>`);
  } else if (alt === "dblflat") {
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="1.5" fill="${FG}"/>`);
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_DBLFLAT_RING1}" fill="none" stroke="${FG}" stroke-width="1"/>`);
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_DBLFLAT_RING2}" fill="none" stroke="${FG}" stroke-width="1"/>`);
  } else {
    throw new Error("unknown alt: " + alt);
  }
  return out;
}
function orbitMarker(h, alt) {
  return markerPartsAt(h, alt, R_ORBIT).join("\n  ");
}

// ---- inversion spoke (section 6) ----
// A short black radial line ("spoke") poking out of the main quality circle at
// the clock hour of the bass tone (spec.inv). It starts at the edge of the base
// circle (R_BASE / R_BASE_NO5 depending on the chord) and extends outward by
// SPOKE_LEN along the angle(inv) direction. Drawn at the bottom of the layer
// stack so any flat/sharp marker that occupies the same hour layers on top;
// the spoke sits beside (radially beyond) those markers rather than encircling
// them, so it never conflicts visually with an orbit marker at hour inv.
function inversionSpoke(spec) {
  const inv = spec.inv;
  const r0  = effectiveBaseRadius(spec);
  // End the spoke just past whatever normally lives at hour inv, so it reads as
  // a distinct pointer rather than vanishing under a marker that happens to
  // occupy the same clock hour. Base case: r0 + SPOKE_LEN. If a rim sus marker
  // or an extension/alteration marker sits at hour inv, poke ~1.5 past its
  // outer radius instead.
  let rEnd = r0 + SPOKE_LEN;
  if (spec.susp && spec.susp.h === inv) {
    const alt = spec.susp.alt;
    rEnd = Math.max(rEnd, ((!alt || alt === N) ? R_RIM + R_NATURAL
                                              : markerOuterRadius(alt)) + 1.5);
  }
  if (spec.ext) {
    for (const e of spec.ext) {
      if (e.h === inv) rEnd = Math.max(rEnd, markerOuterRadius(e.alt) + 1.5);
    }
  }
  const u = unit(inv);
  const x1 = u.x * r0;
  const y1 = u.y * r0;
  const x2 = u.x * rEnd;
  const y2 = u.y * rEnd;
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${FG}" stroke-width="${SPOKE_W}" stroke-linecap="round"/>`;
}

// ============================================================
// Microtonal chord classification (section 10)
// ============================================================
// Round cents to the nearest 12-TET semitone; return { semi, dev } where
// `semi` is in [0, 1200) (12-TET cents) and `dev` is in (-50, +50]. Per the
// spec, the reference grid is ALWAYS 12-TET, never adapted per-scale.
function nearestSemi(c) {
  const cyc = ((c % TET_PERIOD) + TET_PERIOD) % TET_PERIOD;
  let idx = Math.round(cyc / 100);    // JS Math.round rounds half up (toward +Inf)
  let semi = idx * 100;
  if (semi >= TET_PERIOD) semi -= TET_PERIOD;
  let dev = cyc - idx * 100;
  if (dev <= -50) dev += TET_PERIOD;  // shouldn't happen with round-half-up
  if (dev >  50)  dev -= TET_PERIOD;
  return { semi, dev };
}

// Classify a triad quality from the rounded 3rd-role and 5th-role semitone
// counts. Implements section 10.3. Returns a spec fragment: { quality, no3,
// no5, susp }.
function classifyTriad(thirdSemi, fifthSemi, hasFifth) {
  if (thirdSemi === 2) return { quality: "suspended", susp: { h: 2, alt: "natural" } };
  if (thirdSemi === 5) return { quality: "suspended", susp: { h: 4, alt: "natural" } };
  if (thirdSemi === 4 && fifthSemi === 7) return { quality: "major" };
  if (thirdSemi === 3 && fifthSemi === 7) return { quality: "minor" };
  if (thirdSemi === 3 && fifthSemi === 6) return { quality: "diminished" };
  if (thirdSemi === 4 && fifthSemi === 8) return { quality: "augmented" };
  // Section 10.4: if the middle note doesn't round to 2/3/4/5, it isn't a 3rd
  // at all -> no3.
  if (![2, 3, 4, 5].includes(thirdSemi)) {
    // no3: hollow outline (visually the "new moon"). If there's a fifth, it's
    // at full radius; otherwise r=9.
    return { quality: "suspended", no3: true };
  }
  // Round 3rd to *something* but the fifth combo doesn't match a standard
  // triad. Default to major/minor on the 3rd alone; the deviation markers
  // carry the remaining nuance.
  if (thirdSemi === 3) return { quality: "minor" };
  if (thirdSemi === 4) return { quality: "major" };
  return { quality: "major" };
}

// Pick a marker alt for a deviation in cents.
//   |dev| < threshold         -> null (negligible; no marker)
//   |dev| exactly 50 (tie)    -> "dblflat"  (round-up convention, per 10.2)
//   dev < 0 (flat of nearest) -> "flat"
//   dev > 0 (sharp of nearest)-> "sharp"
function altForDev(dev, threshold) {
  if (threshold == null) threshold = 2;
  if (Math.abs(Math.abs(dev) - 50) < 0.001) return "dblflat";
  if (Math.abs(dev) < threshold) return null;
  return dev < 0 ? "flat" : "sharp";
}

// Build a chord spec from a list of chord-tone cents (assumes the first one is
// the root). Resolves no3/no5, the quality, any suspended rim tone, and a set
// of deviation markers at the 3rd/5th clock positions. (Restricted to triads
// {root, mid, top}; for 4-note microtonal chords build the explicit spec
// yourself with quality + ext + dev, the way the worked example does in the
// catalogue below.)
function microtonalTriadSpec(notes, period, opts) {
  opts = opts || {};
  period = period || TET_PERIOD;
  const devThreshold = opts.deviationThreshold;

  // Normalize and sort ascending; drop duplicates within a tiny epsilon.
  const reduce = (c) => ((c % period) + period) % period;
  const sorted = notes.map(reduce).sort((a, b) => a - b)
                   .filter((c, i, a) => i === 0 || Math.abs(c - a[i - 1]) > 1e-6);

  const root = sorted[0];
  const rest = sorted.slice(1).map((c) => reduce(c - root));

  const hasThird = rest.length >= 1;
  const hasFifth = rest.length >= 2;
  const thirdCents = hasThird ? rest[0] : null;
  const fifthCents = hasFifth ? rest[1] : null;

  const { semi: thirdSemi, dev: thirdDev } =
        hasThird ? nearestSemi(thirdCents) : { semi: null, dev: 0 };
  const { semi: fifthSemi, dev: fifthDev } =
        hasFifth ? nearestSemi(fifthCents) : { semi: null, dev: 0 };

  const base = hasThird
      ? classifyTriad(thirdSemi / 100, hasFifth ? fifthSemi / 100 : null, hasFifth)
      : { quality: "suspended", no3: true };
  if (!hasFifth) base.no5 = true;

  const spec = {
    quality: base.quality,
    no3: !!base.no3,
    no5: !!base.no5,
    susp: base.susp || null,
    ext: []
  };

  // Deviation markers at h=3 / h=5, using the existing orbit vocabulary.
  if (hasThird && !spec.no3) {
    const alt = altForDev(thirdDev, devThreshold);
    if (alt) spec.ext.push({ h: 3, alt });
  }
  if (hasFifth && !spec.no5) {
    const alt = altForDev(fifthDev, devThreshold);
    if (alt) spec.ext.push({ h: 5, alt });
  }
  return spec;
}

// ============================================================
// Build a chord glyph SVG
// ============================================================
function buildChordSVG(spec, opts) {
  opts = opts || {};
  const withRootLetter = !!opts.withRootLetter;
  const layers = [];

  // 1. inversion spoke (drawn at the bottom so it sits behind everything)
  if (spec.inv != null) layers.push(inversionSpoke(spec));

  // 2. orbit guide ring (shown when there are orbit markers; behind the base
  //    so the base can sit cleanly on top of it)
  if (spec.ext && spec.ext.length) {
    layers.push(`<circle r="${R_ORBIT}" fill="none" stroke="${FG}" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.35"/>`);
  }

  // 3. base quality shape
  layers.push(baseShape(spec));

  // 4. rim marker (if suspended)
  if (spec.susp) layers.push(rimMarker(spec.susp));

  // 5. extension / alteration / deviation markers (section 5 + 10.5)
  if (spec.ext && spec.ext.length) {
    for (const e of spec.ext) layers.push(orbitMarker(e.h, e.alt));
  }

  // 6. root-letter overlay (UI overlay, above everything else). Toggled from
  //    the listing page via a body class reaching into the inlined SVG.
  if (withRootLetter) {
    layers.push(rootLetterLayer(spec, spec.file || "glyph"));
  }

  const body = layers.join("\n  ");
  return `<svg width="160" height="160" viewBox="${sharedViewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(spec.name)}">
  <title>${esc(spec.name)}</title>
  ${body}
</svg>
`;
}

// ============================================================
// Build a scale constellation glyph (section 9)
// ============================================================
// A separate glyph family from chords, for showing a full scale rather than a
// 3-4 note chord. Notes sit at proportional positions on a circle
// (angle = cents/period * 360), connected by a thin polygon outline so each
// scale gets a distinct silhouette.
function constellationPoints(notes, period, R) {
  return notes.map((c) => {
    const cyc = ((c % period) + period) % period;
    const a = (-90 + (cyc / period) * 360) * D2R;
    return { x: R * Math.cos(a), y: R * Math.sin(a) };
  });
}
function buildConstellationSVG(spec, opts) {
  opts = opts || {};
  const notes = spec.notes;
  const period = spec.period || TET_PERIOD;
  const R = R_CONSTEL;

  // ascending cents; drop duplicates within epsilon; assume root at 0.
  const reduce = (c) => ((c % period) + period) % period;
  const sorted = notes.map(reduce).sort((a, b) => a - b)
                   .filter((c, i, a) => i === 0 || Math.abs(c - a[i - 1]) > 1e-6);
  const pts = constellationPoints(sorted, period, R);
  const polyPts = pts.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");

  const layers = [];
  // dashed reference circle
  layers.push(`<circle r="${R}" fill="none" stroke="${FG}" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.35"/>`);
  // polygon silhouette through every note, closed back to the root
  layers.push(`<polygon points="${polyPts}" fill="none" stroke="${FG}" stroke-width="1" opacity="0.6"/>`);
  // root dot (always at top, since c=0 -> angle=-90deg)
  layers.push(`<circle cx="0" cy="${f(-R)}" r="${R_ROOT_DOT}" fill="${FG}"/>`);
  // remaining notes
  for (let i = 1; i < pts.length; i++) {
    layers.push(`<circle cx="${f(pts[i].x)}" cy="${f(pts[i].y)}" r="${R_DOT}" fill="${FG}"/>`);
  }
  const body = layers.join("\n  ");
  return `<svg width="160" height="160" viewBox="${sharedViewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(spec.name)}">
  <title>${esc(spec.name)}</title>
  ${body}
</svg>
`;
}

// ============================================================
// Chord catalogue
// ============================================================
// Conventions used (consistent with the rules doc):
//   - dominant 7th is a FLAT 7 on a MAJOR triad
//   - maj7 is a NATURAL 7 on a major triad
//   - fully-diminished 7th uses the DOUBLE-FLAT 7 marker
//   - half-diminished (m7b5) is minor triad + flat7 + flat5
//   - 9,11,13 are natural at their clock hours
//   - "b5"/"#5" are flat/sharp markers at hour 5
//   - aug triad already encodes #5; the aug family uses natural/flat 7

const N = "natural";
const F = "flat";
const S = "sharp";
const DF = "dblflat";

const chords = [
  // ---- triads (the moon cycle + suspended) ----
  { name: "C (major)",           file: "C-major.svg",        quality: "major" },
  { name: "Cm (minor)",          file: "Cm.svg",             quality: "minor" },
  { name: "Cdim (diminished)",   file: "Cdim.svg",           quality: "diminished" },
  { name: "Caug (augmented)",    file: "Caug.svg",           quality: "augmented" },
  { name: "Csus2",               file: "Csus2.svg",          quality: "suspended", susp: { h: 2, alt: N } },
  { name: "Csus4",               file: "Csus4.svg",          quality: "suspended", susp: { h: 4, alt: N } },
  { name: "Csus\u266f4",         file: "Csus-sharp4.svg",    quality: "suspended", susp: { h: 4, alt: S } },
  { name: "Csusb2",              file: "Csus-flat2.svg",     quality: "suspended", susp: { h: 2, alt: F } },

  // ---- add-tone chords (intact triad + one color tone) ----
  { name: "Cadd2",               file: "Cadd2.svg",          quality: "major", ext: [{ h: 2, alt: N }] },
  { name: "Cadd4",               file: "Cadd4.svg",          quality: "major", ext: [{ h: 4, alt: N }] },
  { name: "Cadd#4",              file: "Cadd-sharp4.svg",    quality: "major", ext: [{ h: 4, alt: S }] },
  { name: "Cadd6",               file: "Cadd6.svg",          quality: "major", ext: [{ h: 6, alt: N }] },
  { name: "Cadd9",               file: "Cadd9.svg",          quality: "major", ext: [{ h: 9, alt: N }] },
  { name: "Cmadd9",              file: "Cm-add9.svg",        quality: "minor", ext: [{ h: 9, alt: N }] },

  // ---- sixth chords ----
  { name: "C6",                  file: "C6.svg",             quality: "major", ext: [{ h: 6, alt: N }] },
  { name: "Cm6",                 file: "Cm6.svg",            quality: "minor", ext: [{ h: 6, alt: N }] },
  { name: "C6/9",                file: "C6-9.svg",           quality: "major", ext: [{ h: 6, alt: N }, { h: 9, alt: N }] },

  // ---- seventh chords ----
  { name: "Cmaj7",               file: "Cmaj7.svg",          quality: "major", ext: [{ h: 7, alt: N }] },
  { name: "C7 (dominant)",       file: "C7.svg",             quality: "major", ext: [{ h: 7, alt: F }] },
  { name: "Cm7",                file: "Cm7.svg",            quality: "minor", ext: [{ h: 7, alt: F }] },
  { name: "Cm(maj7)",            file: "Cm-maj7.svg",        quality: "minor", ext: [{ h: 7, alt: N }] },
  { name: "Cdim7",               file: "Cdim7.svg",          quality: "diminished", ext: [{ h: 7, alt: DF }] },
  { name: "Cm7\u266d5 (half-dim)", file: "Cm7b5.svg",       quality: "minor", ext: [{ h: 7, alt: F }, { h: 5, alt: F }] },
  { name: "C7\u266d5",           file: "C7b5.svg",          quality: "major", ext: [{ h: 7, alt: F }, { h: 5, alt: F }] },
  { name: "Caugmaj7",            file: "Caug-maj7.svg",      quality: "augmented", ext: [{ h: 7, alt: N }] },
  { name: "Caug7 (C+7)",         file: "Caug7.svg",          quality: "augmented", ext: [{ h: 7, alt: F }] },

  // ---- ninth chords ----
  { name: "C9",                  file: "C9.svg",            quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }] },
  { name: "Cmaj9",               file: "Cmaj9.svg",         quality: "major", ext: [{ h: 7, alt: N }, { h: 9, alt: N }] },
  { name: "Cm9",                 file: "Cm9.svg",           quality: "minor", ext: [{ h: 7, alt: F }, { h: 9, alt: N }] },
  { name: "C7\u266d9",            file: "C7b9.svg",          quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: F }] },
  { name: "C7\u266f9",            file: "C7-sharp9.svg",     quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: S }] },
  { name: "Cdim7\u266d9",        file: "Cdim7b9.svg",       quality: "diminished", ext: [{ h: 7, alt: DF }, { h: 9, alt: F }] },

  // ---- eleventh chords ----
  { name: "C11",                 file: "C11.svg",          quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }] },
  { name: "Cmaj11",              file: "Cmaj11.svg",        quality: "major", ext: [{ h: 7, alt: N }, { h: 9, alt: N }, { h: 11, alt: N }] },
  { name: "Cm11",                file: "Cm11.svg",         quality: "minor", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }] },
  { name: "C7\u266f11",           file: "C7-sharp11.svg",    quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: S }] },

  // ---- thirteenth chords ----
  { name: "C13",                 file: "C13.svg",          quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }, { h: 13, alt: N }] },
  { name: "Cmaj13",             file: "Cmaj13.svg",        quality: "major", ext: [{ h: 7, alt: N }, { h: 9, alt: N }, { h: 11, alt: N }, { h: 13, alt: N }] },
  { name: "Cm13",                file: "Cm13.svg",         quality: "minor", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }, { h: 13, alt: N }] },

  // ---- suspended with extensions ----
  { name: "Csus2 (add9 feel)",  file: "Csus2-9.svg",      quality: "suspended", susp: { h: 2, alt: N }, ext: [{ h: 9, alt: N }] },
  { name: "C7sus4",             file: "C7sus4.svg",       quality: "suspended", susp: { h: 4, alt: N }, ext: [{ h: 7, alt: F }] },
  { name: "C9sus4",             file: "C9sus4.svg",       quality: "suspended", susp: { h: 4, alt: N }, ext: [{ h: 7, alt: F }, { h: 9, alt: N }] },
  { name: "C11sus4",            file: "C11sus4.svg",      quality: "suspended", susp: { h: 4, alt: N }, ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }] },

  // ---- no-fifth and no-third (section 10.4 matrix) ----
  // Per the rules, no rim marker is added in the no3 case unless an actual
  // 2nd or 4th is replacing the third (which would be a normal sus chord,
  // not no3). A power chord (root + 5th only) is therefore visually identical
  // to "C (no3)"; that's intentional, not a duplication.
  { name: "C (no3) \u2014 fifth only (power chord)", file: "C-no3.svg",       quality: "major", no3: true },
  { name: "C (no5) \u2014 third only",               file: "C-no5.svg",       quality: "major", no5: true },
  { name: "Cm (no5) \u2014 minor no5",              file: "Cm-no5.svg",      quality: "minor", no5: true },
  { name: "C (no3, no5)",                            file: "C-no3-no5.svg",   quality: "major", no3: true, no5: true },

  // ---- inversions (examples) — now using the SPOKE marker (section 6) ----
  { name: "C / E (1st inv)",           file: "C-1st-inv.svg",      quality: "major", inv: 3 },
  { name: "C / G (2nd inv)",           file: "C-2nd-inv.svg",      quality: "major", inv: 5 },
  { name: "Cmaj7 1st inv",            file: "Cmaj7-1st-inv.svg",  quality: "major", ext: [{ h: 7, alt: N }], inv: 3 },
  { name: "C7 3rd inv (7 in bass)",    file: "C7-3rd-inv.svg",     quality: "major", ext: [{ h: 7, alt: F }], inv: 7 },
  { name: "C7\u266d9 7th-in-bass",     file: "C7b9-7-in-bass.svg", quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: F }], inv: 7 },
  { name: "C9 9th in bass",            file: "C9-9-in-bass.svg",   quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }], inv: 9 },

  // ---- microtonal chords (section 10 worked examples) ----
  // Hexany chord built from degrees {1, 2, 5} of the hexany scale
  // {0, 386.314, 498.045, 701.955, 813.686}: middle note rounds to 400
  // (major 3rd) with -13.7c dev -> flat marker at h=3; top note rounds to
  // 800 (aug 5th) with +13.7c dev -> sharp marker at h=5; base = augmented
  // gibbous. Renders identically to the reference SVG
  // revised-design-files/microtonal-chord-deviation-markers.svg.
  { name: "Hexany 1,2,5 (augmented, microtonal)",
    file: "microtonal-hexany-125.svg",
    quality: "augmented",
    ext: [{ h: 3, alt: F }, { h: 5, alt: S }] },

  // Harmonic-series triad 4:5:6 = {0, 386.314, 701.955}. Middle rounds to 400
  // (major 3rd) with -13.7c dev -> flat at h=3; top rounds to 700 (perfect
  // 5th) with +2.0c dev -> negligible, no marker. Base = major.
  { name: "Harmonic series 4:5:6 (just major, microtonal)",
    file: "microtonal-harmonic-456.svg",
    quality: "major",
    ext: [{ h: 3, alt: F }] },

  // Hexany chord {0, 498.045, 701.955}: middle rounds to 500 (sus 4 /
  // 5 semitones in the 3rd-role slot) with -2c -> no marker; top rounds to
  // 700 (perfect 5th) with +2c -> no marker. Base = sus4.
  { name: "Hexany 1,3,5 (sus, microtonal)",
    file: "microtonal-hexany-135.svg",
    quality: "suspended",
    susp: { h: 4, alt: N } },

  // 24-EDO mid-tie chord to demonstrate the 50-cent double-flat convention.
  // {0, 400, 750} -> 3rd role is 400 (major 3rd), 5th-role note is at 750c
  // -> exactly 50c below 800, ties between 700 and 800 -> round UP to 800 and
  // mark with the double-flat marker per section 10.2.
  { name: "24-EDO mid-tie (double-flat 5th)",
    file: "microtonal-24edo-midtie.svg",
    quality: "augmented",
    ext: [{ h: 5, alt: DF }] },
];

// ---- scale constellations (section 9) ----
const constellations = [
  { name: "Major scale",        file: "constellation-major.svg",
    notes: [0, 200, 400, 500, 700, 900, 1100],        period: 1200 },
  { name: "Natural minor scale", file: "constellation-natural-minor.svg",
    notes: [0, 200, 300, 500, 700, 800, 1000],         period: 1200 },
  { name: "Whole-tone scale (hexagon)", file: "constellation-wholetone.svg",
    notes: [0, 200, 400, 600, 800, 1000],              period: 1200 },
  { name: "Harmonic minor scale", file: "constellation-harmonic-minor.svg",
    notes: [0, 200, 300, 500, 800, 900, 1100],          period: 1200 },
  { name: "Hexany scale",       file: "constellation-hexany.svg",
    notes: [0, 386.314, 498.045, 701.955, 813.686],     period: 1200 },
  { name: "Harmonics scale (4:5:6:7)", file: "constellation-harmonics.svg",
    notes: [0, 386.314, 701.955, 968.826],              period: 1200 },
];

// ---- helper: render a root + optional accidental as a short string -------
function rootStr(root) {
  if (!root) return "C";
  const letter = root.letter || "C";
  const acc = root.accidental === "flat"  ? "\u266D"
            : root.accidental === "sharp" ? "\u266F" : "";
  return letter + acc;
}
function asciiRoot(root) {
  if (!root) return "C";
  const letter = root.letter || "C";
  const acc = root.accidental === "flat"  ? "b"
            : root.accidental === "sharp" ? "#" : "";
  return letter + acc;
}

// ---- demonstration: the same chord quality across all 12 chromatic roots -
const chromaticRoots = [
  { letter: "C" },
  { letter: "D", accidental: "flat" },  // D\u266d
  { letter: "D" },
  { letter: "E", accidental: "flat" },  // E\u266d
  { letter: "E" },
  { letter: "F" },
  { letter: "G", accidental: "flat" },  // G\u266d
  { letter: "G" },
  { letter: "A", accidental: "flat" },  // A\u266d
  { letter: "A" },
  { letter: "B", accidental: "flat" },  // B\u266d
  { letter: "B" },
];

const acrossRoots_major = chromaticRoots.map((r) => ({
  name: rootStr(r) + " major",
  file: `root-${asciiRoot(r)}-major.svg`,
  quality: "major",
  root: r,
}));
const acrossRoots_minor = chromaticRoots.map((r) => ({
  name: rootStr(r) + " minor",
  file: `root-${asciiRoot(r)}-minor.svg`,
  quality: "minor",
  root: r,
}));

// all chords combined for shared viewBox + standalone output. Constellations
// use a different builder but share the same viewBox for visual consistency.
const allChords = chords.concat(acrossRoots_major, acrossRoots_minor);

// ============================================================
// Output: SVG files + index.html
// ============================================================
const OUT_DIR = __dirname;
const SVG_DIR = path.join(OUT_DIR, "svg");

if (!fs.existsSync(SVG_DIR)) fs.mkdirSync(SVG_DIR, { recursive: true });

// One shared viewBox for every glyph, sized to fit the largest chord in the
// catalogue. Using the same viewBox across all SVGs means the base circle
// renders at an identical pixel size everywhere, so a bare major triad and a
// fully-loaded 13th look visually proportional. Constellations are padded
// out to the same box so they render at the same scale as the chords.
const PAD = 2;
const GLOBAL_HALF = Math.max(
  Math.max(...allChords.map(glyphExtent)),
  Math.max(...constellations.map(() => constellationExtent()))
) + PAD;
const sharedViewBox = `${f(-GLOBAL_HALF)} ${f(-GLOBAL_HALF)} ${f(GLOBAL_HALF * 2)} ${f(GLOBAL_HALF * 2)}`;

// Standalone .svg files: emitted WITHOUT the root-letter overlay so they stay
// pure glyph references (the system's visual language is quality only).
for (const c of allChords) {
  const svg = buildChordSVG(c, { withRootLetter: false });
  fs.writeFileSync(path.join(SVG_DIR, c.file), svg, "utf8");
}
for (const c of constellations) {
  const svg = buildConstellationSVG(c);
  fs.writeFileSync(path.join(SVG_DIR, c.file), svg, "utf8");
}

// group the catalogue for the website. The "Inversions" and "No-fifth /
// no-third" and "Microtonal chords" indices are computed from where the
// relevant chords live inside the `chords` array.
const no3no5Start = chords.findIndex((c) => c.file === "C-no3.svg");
const invStart   = chords.findIndex((c) => c.file === "C-1st-inv.svg");
const microStart = chords.findIndex((c) => c.file === "microtonal-hexany-125.svg");

const groups = [
  { title: "Triads \u2014 the moon cycle",             members: chords.slice(0, 8) },
  { title: "Add-tone chords",                          members: chords.slice(8, 14) },
  { title: "Sixth chords",                             members: chords.slice(14, 17) },
  { title: "Seventh chords",                           members: chords.slice(17, 26) },
  { title: "Ninth chords",                             members: chords.slice(26, 32) },
  { title: "Eleventh chords",                          members: chords.slice(32, 36) },
  { title: "Thirteenth chords",                        members: chords.slice(36, 39) },
  { title: "Suspended with extensions",                members: chords.slice(39, 43) },
  { title: "No-fifth and no-third chords",
    note:  "When the third or fifth role is absent, the base circle shrinks (no5) or goes hollow (no3). The &ldquo;no3&rdquo; shape is intentionally identical to a sus chord \u2014 a chord with a fifth and no third genuinely doesn&rsquo;t tell you major or minor.",
    members: chords.slice(no3no5Start, invStart) },
  { title: "Inversions \u2014 the spoke marker",
    note:  "A short black radial line poking out of the main circle at the bass tone&rsquo;s clock hour. No spoke anywhere means root position.",
    members: chords.slice(invStart, microStart) },
  { title: "Microtonal chords",
    note:  "Round each note to the nearest 12-TET semitone, classify the base shape from the rounded 3rd/5th, then mark residual deviations with the existing natural/flat/sharp/double-flat vocabulary at h=3 and h=5. The base shape stays clean \u2014 all microtonal nuance lives in satellite markers. 50-cent ties always round up and use the double-flat marker.",
    members: chords.slice(microStart) },
  { title: "Scale constellations",
    note:  "A separate glyph family from chord glyphs \u2014 it answers &ldquo;where does this note sit&rdquo; (proportional position, cents / period \u00d7 360\u00b0), not &ldquo;what would a musician call it&rdquo; (the named-degree clock used by chord glyphs). Each dot is a note, all joined by a thin outline so each scale gets a distinct, recognizable silhouette (whole-tone = hexagon).",
    members: constellations },
  { title: "Across roots \u2014 major (12 roots, letter toggles on)",
    members: acrossRoots_major },
  { title: "Across roots \u2014 minor (12 roots, letter splits white/dark)",
    members: acrossRoots_minor },
];

// Render each card's glyph by inlining the SVG markup directly. Inlining (not
// <img src=...>) lets the page's CSS reach inside each SVG, so the "show note
// letter" toggle \u2014 wired to a body class \u2014 can show/hide the
// .root-letter overlay across every glyph at once without re-render.
const cards = groups.map((g) => {
  const items = g.members.map((c) => {
    const isConstellation = (c.notes != null) && (c.quality == null);
    const svg = isConstellation
        ? buildConstellationSVG(c)
        : buildChordSVG(c, { withRootLetter: true });
    return `
      <li class="card">
        <div class="glyph">${svg}</div>
        <div class="name">${esc(c.name)}</div>
      </li>`;
  }).join("");
  const noteHTML = g.note ? `<p class="group-note">${g.note}</p>` : "";
  return `
    <section class="group">
      <h2>${esc(g.title)}</h2>${noteHTML}
      <ul class="grid">${items}
      </ul>
    </section>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CLUSTER chord glyphs \u2014 full sight</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --fg: #1a1a1a;
    --bg: #fafaf7;
    --line: #e3e2dc;
    --muted: #6b6a63;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: \"Manrope\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.45;
    padding: 2.5rem 1.5rem 5rem;
  }
  header { max-width: 1100px; margin: 0 auto 2.5rem; position: relative; }
  header h1 { font-size: 1.9rem; margin: 0 0 0.4rem; letter-spacing: -0.01em; }
  .repo-link { position: absolute; top: 0; right: 0; font-size: 0.85rem;
              color: var(--muted); text-decoration: none; border: 1px solid var(--line);
              background: #fff; padding: 0.4rem 0.85rem; border-radius: 999px;
              transition: border-color 0.12s ease, color 0.12s ease; }
  .repo-link:hover { border-color: #c8c7c0; color: var(--fg); }
  header p { margin: 0 0 1rem; color: var(--muted); max-width: 60ch; }
  .legend { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: center;
            font-size: 0.85rem; color: var(--muted); border-top: 1px solid var(--line);
            border-bottom: 1px solid var(--line); padding: 0.75rem 0; }
  .legend b { color: var(--fg); }
  main { max-width: 1100px; margin: 0 auto; }
  .group { margin: 0 0 2.5rem; }
  .group h2 { font-size: 1.05rem; font-weight: 600; margin: 0 0 0.9rem;
              padding-bottom: 0.4rem; border-bottom: 1px solid var(--line); }
  .group-note { font-size: 0.86rem; color: var(--muted); max-width: 70ch;
                margin: 0 0 0.9rem; }
  .grid { list-style: none; margin: 0; padding: 0;
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.5rem; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 10px;
          padding: 0.85rem 0.5rem 0.7rem; display: flex; flex-direction: column;
          align-items: center; gap: 0.55rem; }
  .glyph { width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; }
  .glyph svg { width: 100%; height: 100%; display: block; }
  .name { font-size: 0.8rem; text-align: center; color: var(--fg); font-weight: 500;
          min-height: 2.4em; display: flex; align-items: center; }

  /* Root-letter overlay inside each inlined glyph: hidden by default,
     shown only when <body> has the \"with-notes\" class. The toggle button
     flips that class. */
  .root-letter { display: none; }
  body.with-notes .root-letter { display: inline; }

  /* Toggle button */
  .controls { margin: 0 0 1.2rem; }
  .btn {
    appearance: none; border: 1px solid var(--line); background: #fff;
    color: var(--fg); font: inherit; font-size: 0.88rem; font-weight: 500;
    padding: 0.5rem 1rem; border-radius: 999px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 0.55rem;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease; }
  .btn:hover { border-color: #c8c7c0; }
  .btn .sw {
    width: 34px; height: 19px; border-radius: 999px; background: #d9d8d0;
    position: relative; transition: background 0.12s ease; flex: 0 0 auto; }
  .btn .sw::before {
    content: \"\"; position: absolute; top: 2px; left: 2px;
    width: 15px; height: 15px; border-radius: 50%; background: #fff;
    box-shadow: 0 1px 2px rgba(0,0,0,0.18); transition: transform 0.12s ease; }
  body.with-notes .btn { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  body.with-notes .btn .sw { background: rgba(255,255,255,0.35); }
  body.with-notes .btn .sw::before { transform: translateX(15px); }
  footer { max-width: 1100px; margin: 3rem auto 0; color: var(--muted);
           font-size: 0.8rem; border-top: 1px solid var(--line); padding-top: 1rem; }
  @media (max-width: 480px) {
    .grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
    header h1 { font-size: 1.5rem; }
  }
</style>
</head>
<body>
<header>
  <a class="repo-link" href="https://github.com/lukephills/chord-glyphs" target="_blank" rel="noopener">View on GitHub &nearr;</a>
  <h1>CLUSTER chord glyphs</h1>
  <p>An abstract visual language for chord quality. Each glyph encodes a chord&rsquo;s
     shape and feel without letters or music-theory math. The main circle&rsquo;s fill
     is the triad quality (crescent&nbsp;&rarr;&nbsp;half&nbsp;&rarr;&nbsp;full&nbsp;&rarr;&nbsp;gibbous,
     like moon phases); dots around it mark extensions at their clock hours (7th at
     7&nbsp;o&rsquo;clock, 9th at 9&nbsp;o&rsquo;clock&hellip;).</p>
  <div class="controls">
    <button type="button" id="note-toggle" class="btn" aria-pressed="false" title="Show the root note letter inside each glyph">
      <span class="sw" aria-hidden="true"></span>Show note letter
    </button>
  </div>
  <div class="legend">
    <span><b>filled dot</b> = natural</span>
    <span><b>ringed dot</b> = flat</span>
    <span><b>dot&nbsp;+&nbsp;tick</b> = sharp</span>
    <span><b>double ring</b> = double flat</span>
    <span><b>radial spoke poking out of the main circle</b> = inversion (tone in bass)</span>
    <span><b>smaller circle</b> = no fifth (no5)</span>
    <span><b>hollow circle</b> = no third (no3) or suspended</span>
  </div>
</header>
<main>
${cards}
</main>
<script>
  (function () {
    var btn = document.getElementById(\"note-toggle\");
    if (!btn) return;
    function setState(on) {
      document.body.classList.toggle(\"with-notes\", on);
      btn.setAttribute(\"aria-pressed\", on ? \"true\" : \"false\");
      try { localStorage.setItem(\"cluster-notes\", on ? \"1\" : \"0\"); } catch (e) {}
    }
    var saved = null;
    try { saved = localStorage.getItem(\"cluster-notes\"); } catch (e) {}
    setState(saved === \"1\");
    btn.addEventListener(\"click\", function () {
      setState(!document.body.classList.contains(\"with-notes\"));
    });
  })();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), html, "utf8");

console.log(`Wrote ${allChords.length} chord SVGs + ${constellations.length} constellation SVGs to ${path.relative(process.cwd(), SVG_DIR)}/ and index.html`);