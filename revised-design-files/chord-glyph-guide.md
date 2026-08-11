# CLUSTER chord glyphs — design guide

## What this is

A visual language for chord quality on CLUSTER's hexagonal chord surface,
and — as of this revision — for scale structure on OMNI too, replacing
text chord symbols and spoke diagrams with abstract circular glyphs. The
goal: a performer recognizes a chord's shape and feel without reading
letters or doing music-theory math in real time.

This guide explains *why* the system is built the way it is. The
companion file, `chord-glyph-rules.md`, is the precise geometric spec —
read that one if you're generating SVGs. Read this one first if you're
deciding whether the system holds together, or if you want the story of
what was tried and rejected along the way, which matters as much as what
was kept.

## Why circles, not triangles or an existing alphabet

Early candidates included triangles, rune-like stroke glyphs, and literal
Old Hungarian script for its "mysterious, ancient" look. Old Hungarian was
dropped early — it's a real, living writing system, and repurposing its
letterforms as arbitrary chord markers would be meaningless to anyone who
can't read it. Triangles and runes both worked, but circles won because a
*fill amount* is something people already read intuitively from moon
phases, and because circles let extensions orbit outside the shape without
fighting its own silhouette.

## The one rule that holds the chord system together

**Every chord tone's number is also its clock position.** The 7th sits at
7 o'clock. The 9th at 9 o'clock. This is a mnemonic — the numbers already
look like clock hours — not a physically accurate spacing. It's what let
suspended tones, extensions, alterations, and inversions all share one
spatial vocabulary. Important caveat, learned the hard way while building
the microtonal system: **this convention only works because Western
scale-degree names are a shared convention everyone already knows.** A
scale without named degrees (most microtonal and xenharmonic scales) has
nothing to hang that mnemonic on, which is why scale constellations and
microtonal chords use a completely different, proportional convention
instead (see below). The two conventions look superficially similar — both
are circles with dots — but they answer different questions and were never
meant to merge.

## How to read a chord glyph, in order

1. **Fill of the main circle.** A dark disc means diminished ("all gone").
   A crescent means minor. A half-moon means no third — suspended or truly
   absent. A gibbous means major. A hollow ring means augmented ("extra"/
   added). A *smaller* circle than usual means the fifth is missing (see
   below).
2. **If half-moon with an orbit dot, find that dot.** That's the tone
   standing in for the third (a sus2 or sus4). A half-moon with no orbit dot
   is a true no-third chord.
3. **Dots floating outside the circle.** Clock position tells you which
   extension. Filled dot = flat (minor). Empty dot = natural (major). Empty
   dot + tick = sharp. Filled dot + ring = double flat.
4. **A hollow ring sitting behind another marker, or behind the base shape
   itself.** That's the inversion halo — whatever it's sitting behind is
   the note in the bass. No halo anywhere means root position.

## What changed in this revision

Three substantial additions/changes since the first version of this
system, each worth understanding on its own:

### Inversions: the wedge is gone

The original inversion marker was a wedge pointing inward at the bass
tone's clock position, with a whole collision-nesting algorithm for when
that clock hour was already occupied by an extension marker. It worked,
but it never quite read right — a triangle pointing at something reads as
a compass needle, not a musical indicator, and no amount of refining the
wedge's proportions fixed that underlying shape problem.

Several shapes were prototyped as replacements: a teardrop (softer wedge,
same pointing logic), a tiny satellite crescent (rejected — it read as "a
small minor chord stuck on the side," fighting the base shape's own
quality reading instead of supporting it), a pin-and-stem (rejected — too
easily confused with the sharp marker's own tick-and-dot), tally ticks in
a fixed neutral position (simple and collision-free, but can't say *which*
tone is in the bass, only how many positions up), and whole-glyph rotation
(rejected outright — it breaks the clock convention's legibility, since
rotating the frame of reference makes every other marker's position
ambiguous).

The one that stuck: a **hollow halo**, larger than the marker it
accompanies, centered on the exact same clock position as the bass tone,
drawn underneath everything else. It's simpler than the wedge in a real
way — there's no nesting math, no "find the occupied radius and offset
past it," it just sits behind whatever's already there. It reads as
spotlighting a feature that already exists on the glyph, which fits a
chord glyph's logic better than an added arrow does.

### Scales: pitch constellations, not spoke diagrams

OMNI's existing scale visualization uses spokes radiating to in-scale
notes. The alternative built here plots each note's actual proportional
position around a circle (angle = cents / period × 360°) and connects them
with a thin outline, so each scale gets a distinct, recognizable
silhouette — a whole-tone scale becomes a perfect hexagon, an irregular
tuning becomes a visibly irregular shape, entirely as a side effect of the
geometry rather than extra design work.

This was deliberately **not** built as a reuse of the chord clock, even
though early instinct suggested it should be. The chord clock's hours are
named-degree mnemonics; a scale like Sanza's has no named degrees to hang
that on. Building a second circle with a genuinely different meaning
(proportional position, not degree name) turned out to be the more honest
solution than forcing one convention to serve two purposes.

### Microtonal chords: round and mark, don't warp

The first attempt at showing a chord built from off-grid scale notes used
a continuous pie-sweep fill — the moon's fill amount computed exactly from
where the middle note sits between root and fifth, no snapping to the
four familiar phases. It was technically the most accurate solution and
the least liked one: it looked mechanical, and a plain major triad no
longer rendered as a clean gibbous, which broke the "recognize the
shape instantly" goal the whole system exists for.

The adopted fix rounds every note to the nearest 12-TET semitone to choose
one of the four familiar base shapes (or the no5/no3 states below), then
shows the leftover deviation as a small marker — reusing the exact
natural/flat/sharp/double-flat vocabulary already built for extensions,
now also placed at the 3rd's and 5th's own clock positions (3 and 5
o'clock, which had never needed markers before, since they were fully
absorbed into the base fill). A version of this that tried warping the
base shape's boundary itself (a small bump or bite carved right into the
silhouette) was also tried and dropped — a round bump doesn't clearly mean
"sharp" the way a tick does elsewhere in the system, so it broke the
learned vocabulary rather than extending it. The final rule: **the base
shape is always clean; all microtonal nuance lives in satellite markers.**

This also resolved two real structural gaps, no5 and no3 chords, which the
microtonal chords exposed almost immediately once real material (the
hexany and harmonic-series scales) was run through the system. The fix
turned out to generalize past microtonal use — any 12-TET chord missing
its fifth or its third hits the same states:

- **Fifth present, third present:** normal, full-size circle.
- **Third present, fifth absent (no5):** the circle shrinks. The idea,
  verbatim from where it came from: "no5 just means no planet" — the
  circle is smaller because there's nothing anchoring it to full size.
- **Fifth present, third absent (no3):** full-size, but half-moon — visually
  identical to a suspended chord, and that's the right answer, not a
  coincidence. A chord with a fifth and no third genuinely doesn't tell
  you major or minor; the lit/dark sides are equal because no 3rd has
  decided which way the phase should lean.
- **Neither present:** small and half-moon, both at once.

One more permanent decision made along the way: **the reference grid for
rounding is always standard 12-TET, never adapted per-scale.** A scale
like 24-EDO will lean heavily on double-flat and double-sharp markers as a
result, but that's the system being honest about how far that scale
disagrees with 12-TET, not a flaw to design around. The alternative — a
different glyph dialect per scale — was rejected as too confusing to
actually use.

## What's still open

- **Inversions haven't been tested against no5/no3 chords, or against 3rd/
  5th deviation markers.** The halo should work identically regardless in
  principle (center it behind whatever's there) but this hasn't actually
  been drawn and checked.
- **The ~15-cent threshold** for "small enough to skip a deviation marker
  entirely" is a guess. Needs calibration against a real scale library —
  run several dozen real microtonal chords through the system and see
  where the threshold actually wants to sit.
- **Deviation markers only apply to the 3rd and 5th**, not to extensions.
  A flat 7th marker looks the same whether the real deviation is 2 cents
  or 45 cents. Possibly fine, possibly an inconsistency worth fixing.
- **Legibility at true hex-cell scale is still unverified** for everything
  in this document. All of it has been designed and reviewed at a much
  larger size than a real touch surface will show. This was flagged in the
  first version of this guide and remains true.
- **Hexagonal versions of the base moon-cycle shapes** were explored
  (clipped into hex silhouettes to tile the grid edge-to-edge) and work for
  the dark disc / half moon / hollow ring cases but not cleanly for the
  crescent (minor) / gibbous (major) `moonFill` arcs, whose curved
  terminators don't tile cleanly into hex edges. Current recommendation is
  still to keep glyphs circular inside hex cells with a small margin, rather
  than force the glyph itself into a hex outline.

## Extending this system

The rules document gives closed-form coordinates for any scale degree, the
full marker vocabulary, the no5/no3 matrix, and the microtonal
rounding/deviation procedure. In principle:

1. **For a chord:** pick the base quality using the no5/no3 matrix if
   needed, add one marker per active extension or alteration at its clock
   hour, add deviation markers at 3/5 o'clock if the source material is
   microtonal, add the inversion halo if it's not in root position.
2. **For a scale:** compute proportional positions for every note against
   the scale's own declared period, plot as a constellation, connect with
   a thin outline.

The open items above are the things worth resolving with a human eye
before treating either process as fully mechanical.
