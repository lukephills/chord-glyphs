#!/usr/bin/env node
/* eslint-disable */
// Generator for CLUSTER chord glyphs, implementing the rules in
// design-files/chord-glyph-rules.md.
//
// Each chord is described by a spec object:
//   {
//     name:   "Cmaj7",                  // display name
//     file:   "Cmaj7.svg",              // output filename
//     quality:"major"|"minor"|"diminished"|"augmented"|"suspended",
//     susp:   { h: 4, alt: "natural" }  // only when quality === "suspended"
//     ext:    [ { h: 7, alt: "flat" }, { h: 9, alt: "natural" }, ... ]
//     inv:    3                          // optional: bass tone hour (inversion)
//   }
//
// alt is one of: "natural" | "flat" | "sharp" | "dblflat"

const fs = require("fs");
const path = require("path");

const FG = "#1a1a1a";

// ---- core constants (section 1) ----
const R_BASE = 14;
const R_RIM = 14;
const R_ORBIT = 20;
const R_NATURAL = 3;
const R_FLAT_RING = 4.5;
const R_DBLFLAT_RING1 = 4;
const R_DBLFLAT_RING2 = 6.5;
const TICK_LEN = 4; // length of sharp tick
const GAP = 4; // gap before inversion pointer
const POINTER_LEN = 6; // length of inversion pointer
const POINTER_HW = 4; // half-width of pointer wide edge

// ---- clock-hour -> angle/position (section 2) ----
function angle(h) {
  return -90 + 30 * h; // degrees, SVG y-down
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

// outer radius of a marker (for inversion nesting, section 6)
function markerOuterRadius(alt) {
  switch (alt) {
    case "natural": return R_ORBIT + R_NATURAL; // 23
    case "flat": return R_ORBIT + R_FLAT_RING; // 24.5
    case "dblflat": return R_ORBIT + R_DBLFLAT_RING2; // 26.5
    case "sharp": return R_ORBIT + R_NATURAL + TICK_LEN; // 27
    default: return R_ORBIT;
  }
}

// Furthest reach of the base quality shape from the glyph center.
// Most qualities are bounded by R_BASE, but the diminished and augmented
// crescent/gibbous are built by subtracting an offset circle whose far
// edge sticks out past R_BASE on the +x side (see section 3 paths).
//   diminished: subtrahend circle  center (6,0) r13 -> right edge x=19
//   augmented:  subtrahend circle  center (11,0) r6 -> right edge x=17
function baseExtent(quality) {
  switch (quality) {
    case "diminished": return 19;
    case "augmented":  return 17;
    default:            return R_BASE; // major, minor, suspended
  }
}

// Furthest point from the glyph center reached by any element of this spec.
// Used to size the viewBox. Every glyph shares one viewBox so the base
// circle (r=14) renders at an identical pixel size across the catalogue,
// making a major triad visually the same size as a fully-loaded 13th.
function glyphExtent(spec) {
  let maxR = baseExtent(spec.quality);
  if (spec.ext && spec.ext.length) maxR = Math.max(maxR, ...spec.ext.map((e) => markerOuterRadius(e.alt)));
  if (spec.susp) {
    const s = spec.susp;
    const r = (!s.alt || s.alt === "natural") ? R_RIM + R_NATURAL : markerOuterRadius(s.alt);
    maxR = Math.max(maxR, r);
  }
  if (spec.inv != null) {
    let occupied = baseExtent(spec.quality);
    if (spec.susp && spec.susp.h === spec.inv) {
      occupied = (!spec.susp.alt || spec.susp.alt === "natural") ? R_RIM + R_NATURAL : markerOuterRadius(spec.susp.alt);
    }
    const extAtHour = (spec.ext || []).find((e) => e.h === spec.inv);
    if (extAtHour) occupied = markerOuterRadius(extAtHour.alt);
    // the pointer's outer corner reaches sqrt(baseRadius^2 + halfwidth^2)
    const baseR = occupied + GAP + POINTER_LEN;
    maxR = Math.max(maxR, Math.sqrt(baseR * baseR + POINTER_HW * POINTER_HW));
  }
  return maxR;
}

// path-data only (no markup) describing the *filled* region of the base
// quality, used to build clip paths for the root-letter overlay.
//   major      : full r=14 circle
//   minor      : left half
//   diminished : crescent (outer circle minus an offset circle on the right)
//   augmented  : gibbous (outer circle minus a small bite on the right)
//   suspended  : nothing (hollow outline)
const OUTER_CIRCLE_D = "M14,0 A14,14 0 1,0 -14,0 A14,14 0 1,0 14,0";
function baseFillPathData(quality) {
  switch (quality) {
    case "major":      return OUTER_CIRCLE_D;
    case "minor":      return "M0,-14 A14,14 0 0,0 0,14 Z";
    case "diminished": return `${OUTER_CIRCLE_D} M19,0 A13,13 0 1,0 -7,0 A13,13 0 1,0 19,0`;
    case "augmented":  return `${OUTER_CIRCLE_D} M17,0 A6,6 0 1,0 5,0 A6,6 0 1,0 17,0`;
    case "suspended":  return "";
    default: throw new Error("unknown quality: " + quality);
  }
}

// Background (page) color used for the "light" variant of the letter. Must
// match the body background so the letter blends with whatever shows through
// the hollow parts of the glyph.
const BG = "#fafaf7";

// ---- root-letter overlay ----
// Renders the root note (letter + optional accidental glyph) in the middle
// of the glyph, twice: once in page-background color (visible only where
// the base quality is filled dark), and once in foreground color (visible
// only where the base quality is hollow). Each copy is clipped to its
// region, so on a minor chord the letter automatically splits:
//   white half of the letter sits over the black (filled) side,
//   black half of the letter sits over the white (hollow) side.
// An empty fillD (suspended) yields an empty fill clip -> the white copy
// renders nothing, so the letter is single-color dark on the hollow center.
function rootLetterLayer(spec, clipID) {
  const root = spec.root || { letter: "C", accidental: null };
  const letter = root.letter || "C";
  const acc = root.accidental === "flat"  ? "\u266D"  // ♭
            : root.accidental === "sharp" ? "\u266F"  // ♯
            : "";

  const fillD = baseFillPathData(spec.quality);
  const nofillD = fillD ? `${OUTER_CIRCLE_D} ${fillD}` : OUTER_CIRCLE_D;

  const fillClipID    = `cf-${clipID}`;
  const nofillClipID  = `cnf-${clipID}`;

  // an empty <path> for the suspended fill (renders nothing)
  const fillClipEl = fillD ? `<path d="${fillD}"/>` : `<path d="M0,0 Z"/>`;

  // letter positioning. When there's an accidental, nudge the letter left
  // a hair so the pair looks optically centered; place the accidental just
  // to the right of the letter, slightly smaller.
  const hasAcc = !!acc;
  const letterX = hasAcc ? -1.8 : 0;
  const letterFS = hasAcc ? 16 : 17;
  const accX = 7;
  const accFS = 9.5;
  const baseY = 0; // optical centering tweak for "central" baseline

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

// ---- base quality shapes (section 3) ----
function baseShape(quality) {
  switch (quality) {
    case "major":
      return `<circle r="${R_BASE}" fill="${FG}"/>`;
    case "minor":
      return `<circle r="${R_BASE}" fill="none" stroke="${FG}" stroke-width="1.5"/>\n  ` +
             `<path d="M0,-14 A14,14 0 0,0 0,14 Z" fill="${FG}"/>`;
    case "diminished":
      return `<path d="M14,0 A14,14 0 1,0 -14,0 A14,14 0 1,0 14,0 ` +
             `M19,0 A13,13 0 1,0 -7,0 A13,13 0 1,0 19,0" fill-rule="evenodd" fill="${FG}"/>`;
    case "augmented":
      return `<path d="M14,0 A14,14 0 1,0 -14,0 A14,14 0 1,0 14,0 ` +
             `M17,0 A6,6 0 1,0 5,0 A6,6 0 1,0 17,0" fill-rule="evenodd" fill="${FG}"/>`;
    case "suspended":
      return `<circle r="${R_BASE}" fill="none" stroke="${FG}" stroke-width="1.5"/>`;
    default:
      throw new Error("unknown quality: " + quality);
  }
}

// ---- rim marker for suspended tones (section 4) ----
function rimMarker(susp) {
  const p = pos(susp.h, R_RIM);
  const parts = [];
  if (susp.alt === "natural" || !susp.alt) {
    parts.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_NATURAL}" fill="${FG}"/>`);
  } else {
    // sharp / flat treatment shared with orbit vocabulary (section 5)
    parts.push(...orbitMarkerParts(susp.h, susp.alt));
  }
  return parts.join("\n  ");
}

// ---- orbit markers (section 5) ----
function orbitMarkerParts(h, alt) {
  const p = pos(h, R_ORBIT);
  const out = [];
  if (alt === "natural") {
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_NATURAL}" fill="${FG}"/>`);
  } else if (alt === "flat") {
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="1.5" fill="${FG}"/>`);
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_FLAT_RING}" fill="none" stroke="${FG}" stroke-width="1.2"/>`);
  } else if (alt === "sharp") {
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${R_NATURAL}" fill="${FG}"/>`);
    const u = unit(h);
    const t1 = { x: u.x * 23, y: u.y * 23 };
    const t2 = { x: u.x * 27, y: u.y * 27 };
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
  return orbitMarkerParts(h, alt).join("\n  ");
}

// ---- inversion pointer (section 6) with nesting rule ----
function inversionPointer(inv, spec) {
  // determine what occupies inv hour
  let occupied = R_BASE; // nothing present
  if (spec.susp && spec.susp.h === inv) {
    // rim marker present (sus dot, plain => R_RIM + r_natural = 17)
    occupied = R_RIM + R_NATURAL;
    if (spec.susp.alt && spec.susp.alt !== "natural") {
      occupied = markerOuterRadius(spec.susp.alt);
    }
  }
  const extAtHour = (spec.ext || []).find((e) => e.h === inv);
  if (extAtHour) {
    occupied = markerOuterRadius(extAtHour.alt);
  }
  const tipRadius = occupied + GAP;
  const baseRadius = tipRadius + POINTER_LEN;
  const a = angle(inv);
  const poly = `${f(baseRadius)},${-POINTER_HW} ${f(tipRadius)},0 ${f(baseRadius)},${POINTER_HW}`;
  return `<g transform="rotate(${f(a)})">\n    <polygon points="${poly}" fill="${FG}"/>\n  </g>`;
}

// number formatter: trim insignificant noise from float rounding
function f(n) {
  return (Math.round(n * 1000) / 1000).toString();
}

// ---- assembly (section 7) ----
function buildSVG(spec, opts) {
  opts = opts || {};
  const withRootLetter = !!opts.withRootLetter;
  const layers = [];

  // 1. base quality
  layers.push(baseShape(spec.quality));

  // 2. rim marker (if suspended)
  if (spec.susp) {
    layers.push(rimMarker(spec.susp));
  }

  // 3. orbit guide ring (optional, shown when there are orbit markers)
  if (spec.ext && spec.ext.length) {
    layers.push(`<circle r="${R_ORBIT}" fill="none" stroke="${FG}" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.35"/>`);
  }

  // 4. extension/alteration markers
  if (spec.ext && spec.ext.length) {
    for (const e of spec.ext) {
      layers.push(orbitMarker(e.h, e.alt));
    }
  }

  // 5. inversion pointer
  if (spec.inv != null) {
    layers.push(inversionPointer(spec.inv, spec));
  }

  // 6. root-letter overlay (UI overlay, above the rest). Toggled from the
  //    listing page via a body class reaching into the inlined SVG.
  if (withRootLetter) {
    layers.push(rootLetterLayer(spec, spec.file || "glyph"));
  }

  const body = layers.join("\n  ");

  // <title> for accessibility / tooltip
  const title = spec.name;

  return `<svg width="160" height="160" viewBox="${sharedViewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  ${body}
</svg>
`;
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  { name: "Csus♯4",              file: "Csus-sharp4.svg",    quality: "suspended", susp: { h: 4, alt: S } },
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
  { name: "Cm7",                 file: "Cm7.svg",            quality: "minor", ext: [{ h: 7, alt: F }] },
  { name: "Cm(maj7)",            file: "Cm-maj7.svg",        quality: "minor", ext: [{ h: 7, alt: N }] },
  { name: "Cdim7",               file: "Cdim7.svg",          quality: "diminished", ext: [{ h: 7, alt: DF }] },
  { name: "Cm7♭5 (half-dim)",  file: "Cm7b5.svg",          quality: "minor", ext: [{ h: 7, alt: F }, { h: 5, alt: F }] },
  { name: "C7♭5",                file: "C7b5.svg",           quality: "major", ext: [{ h: 7, alt: F }, { h: 5, alt: F }] },
  { name: "Caugmaj7",            file: "Caug-maj7.svg",      quality: "augmented", ext: [{ h: 7, alt: N }] },
  { name: "Caug7 (C+7)",         file: "Caug7.svg",          quality: "augmented", ext: [{ h: 7, alt: F }] },

  // ---- ninth chords ----
  { name: "C9",                  file: "C9.svg",             quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }] },
  { name: "Cmaj9",               file: "Cmaj9.svg",          quality: "major", ext: [{ h: 7, alt: N }, { h: 9, alt: N }] },
  { name: "Cm9",                 file: "Cm9.svg",           quality: "minor", ext: [{ h: 7, alt: F }, { h: 9, alt: N }] },
  { name: "C7♭9",                file: "C7b9.svg",           quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: F }] },
  { name: "C7♯9",                file: "C7-sharp9.svg",      quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: S }] },
  { name: "Cdim7♭9",             file: "Cdim7b9.svg",         quality: "diminished", ext: [{ h: 7, alt: DF }, { h: 9, alt: F }] },

  // ---- eleventh chords ----
  { name: "C11",                 file: "C11.svg",            quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }] },
  { name: "Cmaj11",              file: "Cmaj11.svg",         quality: "major", ext: [{ h: 7, alt: N }, { h: 9, alt: N }, { h: 11, alt: N }] },
  { name: "Cm11",                file: "Cm11.svg",           quality: "minor", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }] },
  { name: "C7♯11",               file: "C7-sharp11.svg",     quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: S }] },

  // ---- thirteenth chords ----
  { name: "C13",                 file: "C13.svg",            quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }, { h: 13, alt: N }] },
  { name: "Cmaj13",              file: "Cmaj13.svg",         quality: "major", ext: [{ h: 7, alt: N }, { h: 9, alt: N }, { h: 11, alt: N }, { h: 13, alt: N }] },
  { name: "Cm13",                file: "Cm13.svg",           quality: "minor", ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }, { h: 13, alt: N }] },

  // ---- suspended with extensions ----
  { name: "Csus2 (add9 feel)",   file: "Csus2-9.svg",        quality: "suspended", susp: { h: 2, alt: N }, ext: [{ h: 9, alt: N }] },
  { name: "C7sus4",              file: "C7sus4.svg",         quality: "suspended", susp: { h: 4, alt: N }, ext: [{ h: 7, alt: F }] },
  { name: "C9sus4",              file: "C9sus4.svg",         quality: "suspended", susp: { h: 4, alt: N }, ext: [{ h: 7, alt: F }, { h: 9, alt: N }] },
  { name: "C11sus4",             file: "C11sus4.svg",        quality: "suspended", susp: { h: 4, alt: N }, ext: [{ h: 7, alt: F }, { h: 9, alt: N }, { h: 11, alt: N }] },

  // ---- inversions (examples) ----
  { name: "C / E (1st inv)",     file: "C-1st-inv.svg",      quality: "major", inv: 3 },
  { name: "C / G (2nd inv)",     file: "C-2nd-inv.svg",      quality: "major", inv: 5 },
  { name: "Cmaj7 1st inv",       file: "Cmaj7-1st-inv.svg",  quality: "major", ext: [{ h: 7, alt: N }], inv: 3 },
  { name: "C7 3rd inv (7 in bass)", file: "C7-3rd-inv.svg",  quality: "major", ext: [{ h: 7, alt: F }], inv: 7 },
  { name: "C7♭9 7th-in-bass (worked example)", file: "C7b9-7-in-bass.svg", quality: "major", ext: [{ h: 7, alt: F }, { h: 9, alt: F }], inv: 7 },
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
// The glyph itself is identical in each pair (the visual language only
// encodes quality, not root); the only thing that varies is the root letter
// in the center. This is the section that makes the note-letter toggle
// meaningful — you can see C, D♭, D, E♭, … B in turn. Major (full circle)
// shows the letter in solid contrast; minor (half fill) shows it split: the
// half over the black is white, the half over the hollow is dark.
const chromaticRoots = [
  { letter: "C" },
  { letter: "D", accidental: "flat" },  // D♭
  { letter: "D" },
  { letter: "E", accidental: "flat" },  // E♭
  { letter: "E" },
  { letter: "F" },
  { letter: "G", accidental: "flat" },  // G♭
  { letter: "G" },
  { letter: "A", accidental: "flat" },  // A♭
  { letter: "A" },
  { letter: "B", accidental: "flat" },  // B♭
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

// all chords (catalogue + 12-root demo) — combined for global viewBox + output
const allChords = chords.concat(acrossRoots_major, acrossRoots_minor);

// ============================================================
// Output: SVG files + index.html
// ============================================================
const OUT_DIR = __dirname;
const SVG_DIR = path.join(OUT_DIR, "svg");

if (!fs.existsSync(SVG_DIR)) fs.mkdirSync(SVG_DIR, { recursive: true });

// One shared viewBox for every glyph, sized to fit the largest chord in the
// catalogue. Using the same viewBox across all SVGs means the base circle
// (and every other primitive) renders at an identical pixel size everywhere,
// so a bare major triad and a fully-loaded 13th look visually proportional.
const PAD = 2;
const GLOBAL_HALF = Math.max(...allChords.map(glyphExtent)) + PAD;
const sharedViewBox = `${f(-GLOBAL_HALF)} ${f(-GLOBAL_HALF)} ${f(GLOBAL_HALF * 2)} ${f(GLOBAL_HALF * 2)}`;

// Standalone .svg files: emitted WITHOUT the root-letter overlay so they
// stay pure glyph references (the system's visual language is quality
// only — root isn't part of the glyph).
for (const c of allChords) {
  const svg = buildSVG(c, { withRootLetter: false });
  fs.writeFileSync(path.join(SVG_DIR, c.file), svg, "utf8");
}

// group the catalogue for the website
const groups = [
  { title: "Triads — the moon cycle", members: chords.slice(0, 8) },
  { title: "Add-tone chords",         members: chords.slice(8, 14) },
  { title: "Sixth chords",            members: chords.slice(14, 17) },
  { title: "Seventh chords",          members: chords.slice(17, 26) },
  { title: "Ninth chords",            members: chords.slice(26, 32) },
  { title: "Eleventh chords",         members: chords.slice(32, 36) },
  { title: "Thirteenth chords",       members: chords.slice(36, 39) },
  { title: "Suspended with extensions", members: chords.slice(39, 43) },
  { title: "Inversions",              members: chords.slice(43) },
  { title: "Across roots — major (12 roots, letter toggles on)",
                                   members: acrossRoots_major },
  { title: "Across roots — minor (12 roots, letter splits white/dark)",
                                   members: acrossRoots_minor },
];

// Render each card's glyph by inlining the SVG markup directly. Inlining
// (rather than <img src=...>) lets the page's CSS reach inside each SVG,
// so the "show note letter" toggle — wired to a body class — can show/hide
// the .root-letter overlay across every glyph at once without re-render.
const cards = groups.map((g) => {
  const items = g.members.map((c) => `
      <li class="card">
        <div class="glyph">${buildSVG(c, { withRootLetter: true })}</div>
        <div class="name">${esc(c.name)}</div>
      </li>`).join("");
  return `
    <section class="group">
      <h2>${esc(g.title)}</h2>
      <ul class="grid">${items}
      </ul>
    </section>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CLUSTER chord glyphs — full sight</title>
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
    font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.45;
    padding: 2.5rem 1.5rem 5rem;
  }
  header { max-width: 1100px; margin: 0 auto 2.5rem; }
  header h1 { font-size: 1.9rem; margin: 0 0 0.4rem; letter-spacing: -0.01em; }
  header p { margin: 0 0 1rem; color: var(--muted); max-width: 60ch; }
  .legend { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: center;
            font-size: 0.85rem; color: var(--muted); border-top: 1px solid var(--line);
            border-bottom: 1px solid var(--line); padding: 0.75rem 0; }
  .legend b { color: var(--fg); }
  main { max-width: 1100px; margin: 0 auto; }
  .group { margin: 0 0 2.5rem; }
  .group h2 { font-size: 1.05rem; font-weight: 600; margin: 0 0 0.9rem;
              padding-bottom: 0.4rem; border-bottom: 1px solid var(--line); }
  .grid { list-style: none; margin: 0; padding: 0;
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.5rem; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 10px;
          padding: 0.85rem 0.5rem 0.7rem; display: flex; flex-direction: column;
          align-items: center; gap: 0.55rem; transition: transform 0.08s ease, box-shadow 0.08s ease; }
  .card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
  .glyph { width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; }
  .glyph svg { width: 100%; height: 100%; display: block; }
  .name { font-size: 0.8rem; text-align: center; color: var(--fg); font-weight: 500;
          min-height: 2.4em; display: flex; align-items: center; }

  /* Root-letter overlay inside each inlined glyph: hidden by default,
     shown only when <body> has the "with-notes" class. The toggle button
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
    content: ""; position: absolute; top: 2px; left: 2px;
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
  <h1>CLUSTER chord glyphs</h1>
  <p>An abstract visual language for chord quality. Each glyph encodes a chord's
     shape and feel without letters or music-theory math. The main circle's fill
     is the triad quality (crescent&nbsp;→&nbsp;half&nbsp;→&nbsp;full&nbsp;→&nbsp;gibbous,
     like moon phases); dots around it mark extensions at their clock hours (7th at
     7&nbsp;o'clock, 9th at 9&nbsp;o'clock…).</p>
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
    <span><b>wedge</b> = inversion (tone in bass)</span>
  </div>
</header>
<main>
${cards}
</main>
<script>
  (function () {
    var btn = document.getElementById("note-toggle");
    if (!btn) return;
    function setState(on) {
      document.body.classList.toggle("with-notes", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      try { localStorage.setItem("cluster-notes", on ? "1" : "0"); } catch (e) {}
    }
    var saved = null;
    try { saved = localStorage.getItem("cluster-notes"); } catch (e) {}
    setState(saved === "1");
    btn.addEventListener("click", function () {
      setState(!document.body.classList.contains("with-notes"));
    });
  })();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), html, "utf8");

console.log(`Wrote ${allChords.length} SVGs to ${path.relative(process.cwd(), SVG_DIR)}/ and index.html`);