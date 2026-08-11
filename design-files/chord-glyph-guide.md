# CLUSTER chord glyphs — design guide

## What this is

A visual language for chord quality on CLUSTER's hexagonal chord surface,
built to replace text chord symbols (Cm7♭5, C∆7(♭9), etc.) with abstract
circular glyphs. The goal: a performer can recognize a chord's shape and feel
without reading letters or doing music-theory math in real time, the same way
a fingering shape on a guitar becomes recognizable long before you can name
every note in it.

This guide explains *why* the system is built the way it is. The companion
file, `chord-glyph-rules.md`, is the precise geometric spec — read that one
if you're generating SVGs. Read this one first if you're deciding whether
the system holds together.

## Why circles, not triangles or an existing alphabet

Early candidates included triangles (major/minor as mirrored shapes),
rune-like stroke glyphs, and even literal Old Hungarian script for its
"mysterious, ancient" look. Old Hungarian was dropped early: it's a real,
living writing system used by heritage communities today, and repurposing
its letterforms as arbitrary chord markers would be meaningless to anyone
who can't read it and a little jarring to anyone who can. Triangles and
runes both worked, but circles won out because a *fill amount* (empty →
crescent → half → full → gibbous) is something people already read
intuitively from moon phases, and because circles are the only one of the
three families whose extensions (dots orbiting the shape) don't visually
compete with the base shape's own silhouette.

## The one rule that holds the whole system together

**Every chord tone's number is also its clock position.** The 7th sits at 7
o'clock. The 9th at 9 o'clock. The 4th at 4 o'clock. This started as a
convenient pun (the numbers already look like clock hours) but turned out to
generalize much further than expected — it's what let suspended tones,
extensions, alterations, and inversions all share one spatial vocabulary
instead of needing separate systems for each. If you only remember one thing
about this design, remember this rule; everything else is built on top of
it.

## How to read a glyph, in order

1. **Look at the fill of the main circle.** Empty (outline only) means no
   third — it's a suspended chord. A crescent, half, full, or gibbous circle
   tells you diminished, minor, major, or augmented.
2. **If it's hollow, find the dot on the rim.** That's the tone standing in
   for the third — 2 o'clock for a sus2, 4 o'clock for a sus4.
3. **Look at any dots floating outside the circle.** Their clock position
   tells you which extension they are. A plain dot means natural. A dot with
   a ring around it (nicknamed the Saturn marker) means flattened. A dot
   with a small tick flagged outward means sharpened.
4. **Look for a wedge pointing in from outside.** No wedge means root
   position. A wedge means the tone it points at is in the bass, i.e. this
   is an inversion.

That's the entire reading order. A performer doesn't need to know *why* 7
o'clock means the seventh — they need to recognize the shape, the same way
recognizing a barre chord doesn't require thinking about the notes inside
it.

## What's settled and tested

- The four base qualities (major/minor/diminished/augmented as moon phases)
  and the hollow "new moon" for suspended chords.
- sus2, sus4, add2, add6, add#4.
- Extensions 7, 9, 11 with natural/flat/sharp states.
- b5/#5 as standalone alterations, independent of full diminished/augmented
  quality (this closed a real gap — the original triangle system couldn't
  express "mostly a normal chord, just the fifth is bent").
- Root position, first inversion, second inversion, and the general nesting
  rule for when an inversion's clock hour is already occupied by an
  extension marker (worked through explicitly for the seventh).
- The rim-vs-orbit distinction that lets sus4 and add4/#4 share 4 o'clock
  without colliding — one is fused to the circle's edge, one floats outside
  it.

## What's still open

**No5 chords don't have a marker yet.** The document this system was
checked against (a broader chord-theory reference) makes clear that dropping
the fifth entirely is extremely common in extended voicings — it's not an
edge case. Right now, silence at 5 o'clock only means "ordinary fifth,
present." It can't also mean "absent." This needs either a fifth visual
state or a different mechanism before the book can be considered complete.

**The 5 o'clock collision is untested.** Both "fifth in the bass" (an
inversion) and "flattened or sharpened fifth" (an alteration) want to live
at 5 o'clock. The nesting rule in the rules document *should* resolve this
the same way it resolved the seventh collision, but it hasn't actually been
drawn and checked by eye yet. Do this before trusting the rule blindly for
the rest of the book.

**Legibility at true scale is unverified.** Every glyph in this system has
been designed and reviewed at a size much larger than an actual hex cell
will be on a touch surface. The single flat-vs-double-flat ring distinction
in particular (used only for the fully-diminished seventh) is visually
subtle even at large size — it may not survive shrinking. Before finalizing
the book, render a representative sample at true hex-pad scale, ideally with
several neighboring glyphs visible at once rather than one glyph alone with
lots of white space, since real usage will never show a glyph in isolation.

**The sharp-tick marker gets busy near other markers.** It reads clearly in
isolation but was flagged as fragile once it sits close to a ring marker on
the same glyph (see the C7#9 example in the SVG set) — worth extra scrutiny
during the scale test above.

**Hexagonal versions exist but are the weaker option.** An alternate version
of the base moon-cycle shapes clipped into hexagon silhouettes (to tile
CLUSTER's grid edge-to-edge) was explored and works for major/minor, but the
crescent and gibbous phases read less naturally inside a hex boundary than a
circular one, since the subtraction technique that produces them was
designed for circular symmetry. If hex tiling turns out to matter more than
the moon-cycle's rotational cleanliness, revisit this — but the working
recommendation is to keep glyphs circular and let them sit inside hex cells
with a small margin, rather than forcing the glyph itself into a hex
outline.

## Extending this to the rest of the chord book

The rules document gives you closed-form coordinates for any scale degree
2 through 13 at either the rim or orbit radius, plus the marker vocabulary
and the inversion-nesting algorithm. In principle, every chord up to a
tetrad-plus-extensions in the reference document this system was checked
against can be generated mechanically:

1. Pick the base quality (major/minor/diminished/augmented/suspended).
2. Add one marker per active extension or alteration, at its clock hour,
   in the correct natural/flat/sharp/double-flat state.
3. If it's an inversion, add the pointer, applying the nesting rule if that
   hour is already occupied.

The open items above (no5, the untested 5 o'clock collision, scale
legibility) are the things worth resolving before treating that process as
fully mechanical rather than something that still needs a human eye on each
result.
