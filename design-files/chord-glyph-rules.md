# CLUSTER chord glyph rules

A compositional, abstract visual grammar for chord quality, built from circles.
No letters, no traditional chord symbols. Each glyph is generated from a small
set of primitives applied to a base circle. This document is the geometric
spec: precise enough to generate any chord in the book programmatically.

All coordinates below are local to a glyph, centered at `(0,0)`, before any
translation onto a hex grid or UI. Units are arbitrary SVG units; the whole
system scales linearly, so multiply every radius by a constant if you need a
bigger or smaller glyph.

---

## 1. Core constants

| Name | Value | Meaning |
|---|---|---|
| `R_base` | 14 | Radius of the main circle (the triad/quality shape) |
| `R_rim` | 14 | Radius at which suspended-tone markers sit, fused to the base circle's edge |
| `R_orbit` | 20 | Radius at which extension markers orbit, outside the base circle |
| `r_natural` | 3 | Radius of a filled "natural" marker dot |
| `r_flat_core` | 1.5 | Radius of the small filled center of a "flat" marker |
| `r_flat_ring` | 4.5 | Radius of the ring around a flat marker's core |
| `r_dblflat_ring1` | 4 | Inner ring radius for a "double flat" marker |
| `r_dblflat_ring2` | 6.5 | Outer ring radius for a "double flat" marker |
| `tick_len` | 4 | Length of the sharp marker's outward tick |
| `gap` | 4 | Standard visual gap between nested elements (e.g. inversion pointer to whatever it points past) |
| `pointer_len` | 6 | Length of the inversion pointer wedge |
| `pointer_halfwidth` | 4 | Half-width of the inversion pointer's wide (outer) edge |

---

## 2. The clock-hour convention

This is the single unifying rule of the whole system. **Every chord tone that
isn't the root or the (usually-implied) fifth gets a position on the glyph
equal to its scale-degree number read as a clock hour.** The 7th sits at 7
o'clock, the 9th at 9 o'clock, the 11th at 11 o'clock, the 2nd at 2 o'clock,
the 4th at 4 o'clock, the 6th at 6 o'clock, and so on. This is a genuine
mnemonic, not just a design choice — the number *is* the hour.

Convert a scale-degree number `h` (2, 3, 4, 5, 6, 7, 9, 11...) to an angle in
degrees, then to a position at a given radius `R`:

```
angle(h)   = -90 + 30 * h                     // degrees, SVG convention (y-axis down)
position(h, R) = ( R * cos(angle(h)),  R * sin(angle(h)) )
```

Reference table (used constantly below):

| h | angle | position at R=14 (rim) | position at R=20 (orbit) |
|---|---|---|---|
| 2 | -30° | (12.1, -7.0) | (17.3, -10.0) |
| 3 | 0° | (14.0, 0.0) | (20.0, 0.0) |
| 4 | 30° | (12.1, 7.0) | (17.3, 10.0) |
| 5 | 60° | (7.0, 12.1) | (10.0, 17.3) |
| 6 | 90° | (0.0, 14.0) | (0.0, 20.0) |
| 7 | 120° | (-7.0, 12.1) | (-10.0, 17.3) |
| 9 | 180° | (-14.0, 0.0) | (-20.0, 0.0) |
| 11 | 240° | (-7.0, -12.1) | (-10.0, -17.3) |

Two radii, two meanings:

- **`R_rim` (14):** the tone is *structural* — it replaces something that
  would otherwise be there (a suspended 2nd or 4th standing in for the third).
  The marker sits fused to the base circle's own edge.
- **`R_orbit` (20):** the tone is *added* on top of an intact triad — an
  extension or a color tone. The marker floats outside the circle,
  optionally with a thin dashed guide ring at `R_orbit` for legibility.

This is what lets `add4` and `sus4` share the same clock hour (4 o'clock)
without colliding: one is a rim marker, the other an orbit marker.

---

## 3. Base quality — the moon cycle

The base shape's *fill* encodes triad quality, from empty to full, like lunar
phases. All four are drawn at `R_base = 14`, centered at the origin.

**Major** — full circle, solid fill.
```svg
<circle r="14" fill="{{FG}}"/>
```

**Minor** — half fill (left half), outline for definition.
```svg
<circle r="14" fill="none" stroke="{{FG}}" stroke-width="1.5"/>
<path d="M0,-14 A14,14 0 0,0 0,14 Z" fill="{{FG}}"/>
```

**Diminished** — a thin crescent. Built by subtracting an offset, slightly
smaller circle from the base circle using `fill-rule="evenodd"`.
```svg
<path d="M14,0 A14,14 0 1,0 -14,0 A14,14 0 1,0 14,0
         M19,0 A13,13 0 1,0 -7,0 A13,13 0 1,0 19,0"
      fill-rule="evenodd" fill="{{FG}}"/>
```

**Augmented** — a gibbous, the opposite end of the same cycle: mostly full
with a small bite removed. Same subtraction technique, different offset
circle.
```svg
<path d="M14,0 A14,14 0 1,0 -14,0 A14,14 0 1,0 14,0
         M17,0 A6,6 0 1,0 5,0 A6,6 0 1,0 17,0"
      fill-rule="evenodd" fill="{{FG}}"/>
```

**Suspended (no third at all)** — the "new moon." Fully hollow outline, no
fill. This is the base for both sus2 and sus4; which one it is comes from the
rim marker (section 4).
```svg
<circle r="14" fill="none" stroke="{{FG}}" stroke-width="1.5"/>
```

Ordering along the cycle, for reference: **crescent (diminished) → half
(minor) → full (major) → gibbous (augmented)**, with the hollow "new moon"
(suspended) sitting outside this axis entirely, since it isn't a third at all.

---

## 4. Suspended tones — rim markers

A suspended chord uses the hollow base above, plus one filled dot at
`R_rim` (14) at the replacing tone's clock hour. No ring, no tick — sus
tones are always plain/natural in this system.

```
sus2: hollow base + dot at position(2, 14), r = r_natural
sus4: hollow base + dot at position(4, 14), r = r_natural
```

`sus#4` and `sus♭2` use the same rim position with the sharp or flat marker
treatment from section 5 instead of a plain dot (see below).

---

## 5. The marker vocabulary (extensions and alterations)

Every extension or color tone (6, 7, 9, 11, 13, and their altered forms)
uses one of four marker types, positioned at `position(h, R_orbit)` unless
otherwise noted. This is a three-state system — natural / flat / sharp —
plus a rare fourth state for the fully-diminished seventh.

**Natural** (the tone is unaltered): a plain filled dot.
```svg
<circle cx="{{x}}" cy="{{y}}" r="3" fill="{{FG}}"/>
```

**Flat** (the tone is lowered a half step): a small filled core with a ring
around it — visually "hollowed out." Nicknamed the Saturn marker.
```svg
<circle cx="{{x}}" cy="{{y}}" r="1.5" fill="{{FG}}"/>
<circle cx="{{x}}" cy="{{y}}" r="4.5" fill="none" stroke="{{FG}}" stroke-width="1.2"/>
```

**Sharp** (the tone is raised a half step): a natural dot with a short tick
flagging further outward, along the same radial line from the glyph center.
The tick runs from `R_orbit + r_natural` to that same value `+ tick_len`.
```svg
<circle cx="{{x}}" cy="{{y}}" r="3" fill="{{FG}}"/>
<line x1="{{tick_x1}}" y1="{{tick_y1}}" x2="{{tick_x2}}" y2="{{tick_y2}}"
      stroke="{{FG}}" stroke-width="2" stroke-linecap="round"/>
```
To compute the tick endpoints: take the unit vector `u = (cos(angle(h)), sin(angle(h)))`,
then `tick_start = u * 23`, `tick_end = u * 27` (i.e. radius 23 to 27).

**Double flat** (only used for the fully-diminished seventh, a whole step
below natural rather than a half step): a core with two concentric rings.
```svg
<circle cx="{{x}}" cy="{{y}}" r="1.5" fill="{{FG}}"/>
<circle cx="{{x}}" cy="{{y}}" r="4" fill="none" stroke="{{FG}}" stroke-width="1"/>
<circle cx="{{x}}" cy="{{y}}" r="6.5" fill="none" stroke="{{FG}}" stroke-width="1"/>
```

**Deliberately out of scope:** the b9/#9 enharmonic question (they're
frequently the same 12-TET pitch) is a performer/context judgment, not
something the glyph should try to resolve. Don't build a marker for it.

**Unresolved / needs testing:** "no5" (the fifth omitted entirely, common
in extended jazz voicings) doesn't yet have a marker. Silence at 5 o'clock
currently means "ordinary perfect fifth, present as normal" — it cannot
currently also mean "absent." Needs a fifth visual state or a different
solution before the book can represent no5 chords.

---

## 6. Inversions

A small outward-pointing wedge shows which chord tone is in the bass. No
marker at all means root position (the default, unmarked case).

The wedge template, unrotated, represents 3 o'clock (since `angle(3) = 0`):

```svg
<polygon points="24,-4 18,0 24,4" fill="{{FG}}"/>
```

To point at any other clock hour `h`, rotate the whole polygon by `angle(h)`
degrees around the glyph's origin:

```svg
<g transform="rotate({{angle(h)}})">
  <polygon points="24,-4 18,0 24,4" fill="{{FG}}"/>
</g>
```

The tip points *inward* toward the circle with a 4-unit gap before it; the
wide edge faces outward. Don't reverse this — an outward-pointing tip reads
as a compass needle, not an indicator.

### Collision rule: nesting past an occupied slot

If the bass tone's clock hour is *also* occupied by an extension or
alteration marker (e.g. the 7th is in the bass **and** there's a 7th
extension dot already sitting at 7 o'clock), the pointer must nest just
outside whatever's already there rather than overlapping it:

```
occupied_radius = outer edge of whatever's at that hour:
  - nothing present           → R_base (14)
  - sus/rim marker present    → R_rim + r_natural = 17
  - natural/flat orbit marker → R_orbit + 3 = 23
  - flat (ring) orbit marker  → R_orbit + 4.5 = 24.5
  - double-flat orbit marker  → R_orbit + 6.5 = 26.5
  - sharp orbit marker        → R_orbit + 7 = 27

tip_radius  = occupied_radius + gap        (gap = 4)
base_radius = tip_radius + pointer_len     (pointer_len = 6)
```

Then use the same rotated-polygon technique, substituting `tip_radius` and
`base_radius` for the fixed values 18 and 24 in the template above.

This rule has been verified for the 7th-in-bass case. It has **not** been
visually verified at 5 o'clock, where it would need to coexist with a b5/#5
alteration marker — flag this for testing before relying on it in the book.

---

## 7. Assembly order

When generating a chord glyph, layer elements in this order (later = drawn
on top):

1. Base quality shape (section 3)
2. Rim marker, if suspended (section 4)
3. Orbit guide ring, optional, `<circle r="20" fill="none" stroke-dasharray="2 2" stroke="{{FG}}" opacity="0.3"/>` — helps legibility when multiple orbit markers are present, can be omitted at small sizes
4. Extension/alteration markers (section 5), one per active clock hour
5. Inversion pointer, if not root position (section 6)

---

## 8. Worked example — C7♭9 with the 7th in the bass

To make the assembly order concrete:

1. Base: major (dominant chords are built on a major triad) → filled circle
2. No suspension → skip
3. Extension at h=7 (the dominant 7th, always flat in this system) → flat
   marker at `position(7, 20)` = `(-10, 17.3)`
4. Extension at h=9, flattened → flat marker at `position(9, 20)` = `(-20, 0)`
5. Inversion: 7th in the bass. h=7 is already occupied by a flat marker
   (outer edge = `20 + 4.5 = 24.5`), so:
   `tip_radius = 24.5 + 4 = 28.5`, `base_radius = 28.5 + 6 = 34.5`.
   Rotate the pointer template by `angle(7) = 120°`, using these radii
   instead of 18/24.

Full glyph = filled base circle + flat marker at (-10, 17.3) + flat marker
at (-20, 0) + rotated pointer at radii 28.5/34.5, angle 120°.

---

## 9. Color and theming

All example SVGs in this package use a single foreground color (`{{FG}}` in
the templates above, `#1a1a1a` in the exported files) on a transparent
background. Production use should swap this for whatever the app's active
theme requires — the geometry doesn't care about color, only fill vs. no-fill,
so recoloring is a find-and-replace, not a redesign.
