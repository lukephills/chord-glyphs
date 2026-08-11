# CLUSTER chord glyph rules

A compositional, abstract visual grammar for chord quality and scale
structure, built from circles. No letters, no traditional chord symbols.
Each glyph is generated from a small set of primitives applied to a base
circle. This document is the geometric spec: precise enough to generate any
chord or scale in the book programmatically.

All coordinates below are local to a glyph, centered at `(0,0)`, before any
translation onto a hex grid or UI. Units are arbitrary SVG units; the whole
system scales linearly, so multiply every radius by a constant if you need a
bigger or smaller glyph.

**Revision note:** this version supersedes the inversion mechanism (section
6) and adds scale constellations (section 9) and microtonal handling
(section 10). If you're regenerating previously-built chord SVGs, only the
inversion marker changed shape; everything else (sections 3–5, 7–8) is
unchanged from the original version.

---

## 1. Core constants

| Name | Value | Meaning |
|---|---|---|
| `R_base` | 14 | Radius of the main circle (the triad/quality shape), when both 3rd and 5th are present |
| `R_base_no5` | 9 | Radius of the main circle when the fifth is absent (see section 10) |
| `R_orbit` | 20 | Radius at which extension and suspended-tone markers orbit, outside the base circle. Also used for 3rd/5th deviation markers (section 10) and for scale constellation dots (section 9), independent of `R_base` |
| `R_natural` | 3 | Radius of a marker dot — used for natural (empty), flat (filled), and as the base of sharp / double-flat markers |
| `R_flat_ring` | 4.5 | Radius of the outer ring around a double-flat marker's filled dot |
| `tick_len` | 4 | Length of the sharp marker's outward tick |
| `gap` | 4 | Standard visual gap between nested elements |
| `r_halo` | 7.5 | Radius of the hollow inversion halo (section 6) |
| `r_root_marker` | 4.5 | Radius of the emphasized root dot in a pitch constellation (section 9) |
| `r_constellation_dot` | 3 | Radius of a non-root dot in a pitch constellation (section 9) |

---

## 2. The clock-hour convention

This is the single unifying rule of the chord system. **Every chord tone
that isn't the root gets a position on the glyph equal to its scale-degree
number read as a clock hour.** The 7th sits at 7 o'clock, the 9th at 9
o'clock, the 4th at 4 o'clock, and so on. This is a genuine mnemonic — the
number *is* the hour — **not** a physically accurate mapping of interval
size (see section 10 for why that distinction matters for microtonal work).

```
angle(h)   = -90 + 30 * h                     // degrees, SVG convention (y-axis down)
position(h, R) = ( R * cos(angle(h)),  R * sin(angle(h)) )
```

Reference table:

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

**h=3 and h=5** were originally *not* marker positions — the 3rd and 5th
were absorbed entirely into the base shape's fill (section 3). They were
formally opened up as marker positions in section 10, for showing
microtonal deviation on the tones that define the base shape. Their
positions follow the same table (h=3 → 0°, h=5 → 60°) and use the same
`R_orbit` = 20 as every other extension.

Two radii, two meanings for anything *other* than 3/5 deviation markers:

- **`R_rim` (14):** the tone is *structural* — it replaces something that
  would otherwise be there. Fused to the base circle's own edge.
- **`R_orbit` (20):** the tone is *added* on top of an intact triad.
  Floats outside the circle, optionally with a thin dashed guide ring.

This is what lets `add4` and `sus4` share 4 o'clock without colliding: one
is a rim marker, the other an orbit marker.

---

## 3. Base quality — the moon cycle

The base shape's *fill* encodes triad quality, like lunar phases. All drawn
at `R_base = 14` (or `R_base_no5 = 9`, section 10), centered at the origin.

The cycle reads as the **amount of lit area grows with tonal certainty**,
then breaks to a fully hollow ring for the "extra" quality (augmented). The
lit-side convention is LEFT (waning), consistent across all phases.

**Diminished** — full disc, solid fill. The moon has gone entirely dark:
"all gone." This is the dark end of the cycle.
```svg
<circle r="14" fill="{{FG}}"/>
```

**Minor** — a thin crescent. A small lit area on the left, drawn as a
`moonFill` path (outer circle arc + terminator ellipse arc) over a stroked
outline so the dark limb stays visible.
```svg
<path d="M0,-14 A14,14 0 0,0 0,14 A8.4,14 0 0,0 0,-14Z" fill="{{FG}}"/>
<circle r="14" fill="none" stroke="{{FG}}" stroke-width="1.5"/>
```
The crescent's illuminated fraction is `FILL_CRESCENT = 0.2`.

**No third / suspended** — half fill (left half), outline for definition.
Both halves equal because tonality is genuinely undecided: a chord with no
third can't tell you major or minor, and a sus chord is substituting a tone
in place of that decision. The suspended variant adds the rim marker from
section 4 (a dot at hour 2 or 4) to say *which* tone is standing in.
```svg
<circle r="14" fill="none" stroke="{{FG}}" stroke-width="1.5"/>
<path d="M0,-14 A14,14 0 0,0 0,14 Z" fill="{{FG}}"/>
```

**Major** — a gibbous, mostly lit with a small dark sliver on the right.
Same `moonFill` technique as minor, illuminated fraction `FILL_GIBBOUS = 0.8`.
```svg
<path d="M0,-14 A14,14 0 0,0 0,14 A8.4,14 0 0,1 0,-14Z" fill="{{FG}}"/>
<circle r="14" fill="none" stroke="{{FG}}" stroke-width="1.5"/>
```

**Augmented** — the "new moon" sits fully open: a hollow stroked outline
with no fill. Augmented means added/extra, so the shape is the empty/full
ring at the far end of the cycle.
```svg
<circle r="14" fill="none" stroke="{{FG}}" stroke-width="1.5"/>
```

Ordering along the cycle: **dark disc (diminished) → crescent (minor) →
half (no third / suspended) → gibbous (major) → hollow ring (augmented)**.
Withdrawal/multiplication of the lit area tracks how decided the tonality
is, with augmented breaking out of the lit-area axis entirely.

**Deprecated approach, do not use:** an earlier revision of this system
tried a continuous pie-sweep fill, proportional to exactly where the middle
note sits between root and fifth, to handle microtonal chords smoothly.
It was rejected — it looked mechanical and lost the moon-phase read at a
glance, and a true major triad no longer rendered as a clean gibbous.
Section 10 has the adopted replacement (round + mark deviation separately).
Do not reintroduce continuous fill sweeps.

---

## 4. Suspended tones

A suspended chord uses the half-moon base above, plus one marker at the
orbit ring (`R_orbit` = 20) at the replacing tone's clock hour — the same
ring extension markers sit on, so the suspended tone reads as a station on
the orbit rather than something fused to the base circle's edge.
Plain marker = natural.

```
sus2: half-moon base + natural marker at position(2, 20)
sus4: half-moon base + natural marker at position(4, 20)
```

`sus#4` and `sus♭2` use the sharp or flat marker treatment from section 5
at the same orbit position instead of a plain marker.

---

## 5. The marker vocabulary (extensions and alterations)

Every extension or color tone uses one of four marker types, positioned at
`position(h, R_orbit)` = `(20*cos(angle(h)), 20*sin(angle(h)))`. This
vocabulary is reused, unchanged, for microtonal deviation in section 10 —
same shapes, new job. Markers compose: each non-natural marker is the
natural or flat marker with one extra element added.

**Natural** (major / unaltered degree) — plain empty stroked dot.
```svg
<circle cx="{{x}}" cy="{{y}}" r="3" fill="none" stroke="{{FG}}" stroke-width="1.2"/>
```

**Flat** (lowered a half step) — plain filled dot.
```svg
<circle cx="{{x}}" cy="{{y}}" r="3" fill="{{FG}}"/>
```

**Sharp** (raised a half step) — natural's empty dot with a short outward
tick along the same radial line as the dot's own position.
```svg
<circle cx="{{x}}" cy="{{y}}" r="3" fill="none" stroke="{{FG}}" stroke-width="1.2"/>
<line x1="{{tick_x1}}" y1="{{tick_y1}}" x2="{{tick_x2}}" y2="{{tick_y2}}"
      stroke="{{FG}}" stroke-width="2" stroke-linecap="round"/>
```
Tick endpoints: unit vector `u = (cos(angle(h)), sin(angle(h)))`,
`tick_start = u * 23`, `tick_end = u * 27`.

**Double flat** (lowered a whole step) — flat's filled dot with one outer
ring. Originally built for the fully-diminished seventh (a whole step
below natural). Also the required marker for an exact 50-cent microtonal
tie (section 10).
```svg
<circle cx="{{x}}" cy="{{y}}" r="3" fill="{{FG}}"/>
<circle cx="{{x}}" cy="{{y}}" r="4.5" fill="none" stroke="{{FG}}" stroke-width="1"/>
```

**Deliberately out of scope:** the b9/#9 enharmonic question is a
performer/context judgment, not something the glyph should resolve.

---

## 6. Inversions — the halo marker

**This section replaces the earlier wedge-pointer design.** The wedge was
tried, tested against real collisions, and rejected on shape grounds (it
read as an arrow/compass needle, not an indicator). A tally-tick
alternative and a teardrop-pointer alternative were also prototyped; the
adopted design is the **halo**: a larger hollow ring placed at the bass
tone's existing clock position, drawn *underneath* whatever marker (if any)
is already there.

Root position needs no marker of any kind — the absence of a halo means
root position, full stop.

For any other tone in the bass, draw a hollow ring at `r_halo` (7.5),
centered at `position(h, R)` for that tone — using whatever radius (`R_rim`
or `R_orbit`) that tone would normally use — **before** drawing that tone's
own marker (or the base shape, if the bass tone is the 3rd/5th and has no
marker of its own in root position).

```svg
<circle cx="{{x}}" cy="{{y}}" r="7.5" fill="none" stroke="{{FG}}"
        stroke-width="1.5" opacity="0.6"/>
```

**Why this design won over the alternatives:**
- No nesting/collision math required. The wedge needed to calculate the
  outer edge of whatever marker already occupied that hour and offset
  past it with a gap; the halo just centers on the same point, behind it.
  This makes it strictly simpler to generate than the wedge was.
- It reads as "spotlighting" an existing feature of the chord rather than
  adding a new directional element, which fits a chord glyph better than
  a shape that has to be read as "pointing at" something.
- It was tested against real collisions (a seventh with the seventh in the
  bass, a ninth with the ninth in the bass) and holds up cleanly — see the
  `halo-with-extensions.svg` reference asset.

**Rejected alternatives**, kept here so they aren't reinvented:
- *Wedge pointer* (tip inward, wide edge outward, rotated to the target
  hour): worked functionally, including a full collision-nesting rule, but
  its triangular shape read as a compass needle rather than an indicator.
- *Teardrop pointer*: softer than the wedge, same nesting logic. Tested
  cleanly against 7th and 9th collisions. Reasonable fallback if the halo
  turns out not to work at very small hex-cell sizes, but not the primary
  choice.
- *Satellite crescent*: reused the minor-quality crescent technique in
  miniature as a pointer. Rejected — it visually implied "a small
  minor chord attached to the side," which fights the base shape's
  own quality reading instead of supporting it.
- *Pin and stem* (a small ball connected to the circle by a short line):
  rejected — visually too similar to the sharp marker's tick-and-dot, easy
  to confuse the two.
- *Whole-glyph rotation* (rotate the entire glyph so the bass tone's clock
  position becomes the new "up"): rejected — it destroys the clock-hour
  convention's legibility, since every other marker's position becomes
  ambiguous once the frame of reference itself has rotated.
- *Tally ticks* (a fixed cluster of short ticks below the glyph, one per
  inversion depth, not tied to any clock hour): a real, viable, simpler
  alternative that avoids collision math entirely. Not adopted only
  because it can't tell you *which* tone is in the bass, only *how many
  positions up* — you have to infer the tone from the rest of the glyph.
  Worth reconsidering if the halo proves too visually busy in practice.

---

## 7. Assembly order

1. Base quality shape (section 3)
2. Inversion halo, if not root position (section 6) — drawn early so
   everything else layers on top of it
3. Rim marker, if suspended (section 4)
4. Orbit guide ring, optional, `<circle r="20" fill="none" stroke-dasharray="2 2" stroke="{{FG}}" opacity="0.3"/>`
5. Extension/alteration markers (section 5), one per active clock hour,
   including 3rd/5th deviation markers (section 10)

---

## 8. Worked example — C7 with the 7th in the bass

1. Base: major (dominant chords are built on a major triad) → filled circle
2. Inversion: 7th in bass → halo, `r_halo=7.5`, centered at
   `position(7, 20) = (-10, 17.3)`, drawn before the marker below
3. Extension at h=7 → flat marker at `(-10, 17.3)` (on top of the halo)

Full glyph = filled base circle + halo at (-10, 17.3) + flat marker at
(-10, 17.3). See `svg/halo-with-extensions.svg` for this exact case
rendered alongside a 9th-in-bass example.

---

## 9. Scale pitch constellations

A separate glyph family from chords, for showing a full scale rather than
a 3–4 note chord. Necessary because scale degrees in non-diatonic or
microtonal scales don't reliably have names to hang the chord clock's
mnemonic convention on (there's no agreed name for "the note at 694
cents"). Constellations use **proportional position**, not the named
degree-clock, and are not meant to be visually merged with chord glyphs —
they answer "where does this note actually sit," not "what would a
musician call it."

For a scale with a declared period `P` (usually 1200 cents, but not
always — see the hexany/harmonics examples below, and Sanza at P=2400 from
earlier in this project) and a list of note values in cents `c_1=0, c_2,
c_3, ...`:

```
angle(c) = -90 + (c / P) * 360
position(c, R) = ( R * cos(angle(c)), R * sin(angle(c)) )
```

Use `R = 18` for constellation dots. Draw:

1. A faint dashed reference circle at `R = 18` (the `leader` class in the
   example SVGs)
2. A thin polygon outline connecting every note's position in ascending
   cents order, closing back to the root — this gives each scale a
   distinct, recognizable silhouette (a whole-tone scale becomes a
   perfect hexagon; an irregular tuning becomes a visibly irregular shape)
3. The root at `c=0`, always at the top (`(0,-18)`), drawn larger:
   `r_root_marker = 4.5`, filled
4. Every other note as a plain filled dot, `r_constellation_dot = 3`

```svg
<circle r="18" fill="none" class="leader"/>
<polygon points="{{all note positions, ascending cents order}}"
         fill="none" stroke="{{FG}}" stroke-width="1" opacity="0.6"/>
<circle cx="0" cy="-18" r="4.5" fill="{{FG}}"/>
<!-- one <circle r="3" fill="{{FG}}"/> per remaining note -->
```

Worked reference: the hexany scale `{0, 386.314, 498.045, 701.955,
813.686}` and the harmonics scale `{0, 386.314, 701.955, 968.826}`, both
P=1200, are rendered in full in `svg/hexany-constellation.svg` and
`svg/harmonics-constellation.svg`.

---

## 10. Microtonal chords

The problem: take 3–4 notes from a scale like the ones in section 9 and
render them as a chord glyph. The named degree-clock (section 2) can't
apply directly, because there's no guarantee any note lands near a
recognizable 3rd or 5th. The resolution, in order:

### 10.1 Round each note to the nearest 12-TET semitone

This is a **deliberate, permanent design decision**: the reference grid is
always standard 12-TET, never adapted to the scale's own internal
structure, even for scales (like 24-EDO) that have a different natural
grid. One universal glyph vocabulary that every scale gets translated into
is worth more than per-scale dialects, even though it means some scales
will lean heavily on sharp/flat/double-flat markers.

```
nearest_semitone(c) = round(c / 100) * 100        // reduce c mod 1200 first if the scale's period isn't 1200
deviation(c) = c - nearest_semitone(c)             // range: -50 to +50
```

### 10.2 Resolve the exact 50-cent tie

If a note is exactly 50 cents from both neighboring semitones, **always
round up** (to the higher semitone) and mark it with the **double-flat**
marker from section 5. This is an arbitrary but permanent convention —
which direction you round doesn't matter, as long as it's applied
consistently everywhere. Rounding up and calling it double-flat was chosen
because it reuses an existing marker rather than requiring a new
double-sharp shape.

### 10.3 Classify the base shape from the rounded 3rd and 5th

Whichever note is the middle pitch of the chord plays the "3rd role";
whichever is highest plays the "5th role." Classify using the standard
diatonic definitions (major = 3rd role rounds to 4 semitones + 5th role
rounds to 7; minor = 3 + 7; diminished = 3 + 6; augmented = 4 + 8; sus4 = 5
semitones in the 3rd-role slot, no fifth-role classification needed; sus2 =
2 semitones in the 3rd-role slot).

**If the middle note doesn't round to 2, 3, 4, or 5 semitones**, it isn't
functioning as a 3rd or a sus-replacement at all — see 10.4 (no3).

### 10.4 No-fifth and no-third states

Two structural gaps, both now resolved as a 2×2 matrix based on whether a
3rd-role and/or 5th-role note is present at all in the chord (not just
whether it rounds cleanly — whether anything is there to round):

| 3rd present? | 5th present? | Base shape |
|---|---|---|
| yes | yes | Normal: full `R_base=14` circle, filled per section 3 |
| yes | no | **No5**: filled circle at `R_base_no5=9`, same fill logic as section 3, just smaller — "the moon shrinks because there's no fifth to anchor its full size" |
| no | yes | **No3**: half-moon circle at full `R_base=14` — identical to the suspended half moon, and that's intentional: a chord with a fifth and no third is genuinely ambiguous about major/minor, the same way a sus chord is |
| no | no | Both at once: half-moon circle at `R_base_no5=9` |

No rim marker is added in the no3 case unless an actual 2nd or 4th is
present replacing the third (in which case it's a normal sus chord, not a
no3 chord).

### 10.5 Mark the residual deviation — no boundary warping

**Rejected approach:** an earlier version of this tried warping the base
shape's own boundary (a small bump or bite carved into the circle at the
deviating note's angle) to show microtonal deviation continuously. It was
dropped for two reasons: it was confusing to read (a round bump doesn't
clearly mean "sharp" vs. "flat" the way a tick vs. a ring already does
elsewhere in the vocabulary), and it fought the "spec" moon-phase read —
you want the base shape to stay a clean, instantly-recognizable quality
indicator, with all deviation information pushed to satellite markers, not
baked into the primary silhouette.

**Adopted approach:** treat the 3rd-role and 5th-role tones exactly like
any other clock position. Place a marker at `position(3, 20)` and/or
`position(5, 20)` — the same `R_orbit=20` used for every extension — using
the same natural/flat/sharp/double-flat vocabulary from section 5, sized
and styled identically. A deviation small enough to be negligible (under
roughly 15 cents — recalibrate this threshold once tested against a real
scale library) gets no marker at all. This means the base shape is always
clean and undistorted; all microtonal nuance lives in small markers outside
it, using zero new visual vocabulary.

Full worked example (hexany chord, degrees 1,2,5 — root, 386.314¢,
813.686¢): 3rd-role note rounds to 400 (major 3rd) with -13.7¢ deviation,
5th-role note rounds to 800 (augmented 5th) with +13.7¢ deviation → base =
augmented (hollow ring) + flat marker at `position(3,20)=(20,0)` + sharp
marker at `position(5,20)=(10,17.3)`. See
`svg/microtonal-chord-deviation-markers.svg`.

### 10.6 Open items, not yet resolved

- **Inversions have not been re-tested against no5/no3 or against 3rd/5th
  deviation markers.** The halo (section 6) should in principle work the
  same way regardless — center it behind whatever's there — but this
  specific combination hasn't been drawn and checked.
- **The ~15 cent negligible-deviation threshold is a guess**, not derived
  from anything. Needs calibration against a real scale library.
- **Deviation markers currently only apply to the 3rd/5th roles**, not to
  extensions (a 7th or 9th still only gets natural/flat/sharp/double-flat
  as a plain classification, with no finer-grained deviation shown even if
  the actual cents value is unusually far from its rounded target).
  Whether that asymmetry is fine or needs fixing is undecided.
