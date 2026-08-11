# CLUSTER chord glyphs

**Live page: <https://lukephills.github.io/chord-glyphs/>** &middot; **Source: <https://github.com/lukephills/chord-glyphs>**

An abstract, circular visual language for chord quality and scale structure. Each glyph encodes a chord's shape and feel without letters or traditional chord symbols — a performer recognizes the quality at a glance.

| C major | Cm7 | C7 (7th in bass) | Whole-tone scale |
| --- | --- | --- | --- |
| ![C major](svg/C-major.svg) | ![Cm7](svg/Cm7.svg) | ![C7 with 7th in the bass](svg/C7-3rd-inv.svg) | ![Whole-tone constellation](svg/constellation-wholetone.svg) |

## Reading order

1. **Fill of the main circle** — the triad quality, read like moon phases:
   dark disc (diminished) → crescent (minor) → half (no third / suspended) → gibbous (major) → hollow ring (augmented). The lit area grows with how decided the tonality is; augmented breaks out of the lit-area axis entirely. A *smaller* circle means no fifth (no5).
2. **Dots on the rim** — the tone replacing the third (sus2 / sus4). A half-moon with no rim dot is a true no-third chord.
3. **Dots outside the circle** — extensions and alterations, one per clock hour (7th at 7 o'clock, 9th at 9 o'clock…). Plain dot = natural, empty dot = flat, ticked dot = sharp, empty dot with a ring = double flat.
4. **A black radial spoke poking out of the main circle** — the inversion pointer: it points at the clock hour of the note in the bass. No spoke = root position.

## Scale constellations

A separate glyph family from chords. Each note sits at its proportional position on a circle (angle = cents / period × 360°), connected by a thin outline so each scale gets a distinct silhouette — whole-tone becomes a hexagon, irregular tunings become visibly irregular. A separate family because most microtonal scales have no named degrees to hang the chord clock's mnemonic on.

## Microtonal chords

Round each note to the nearest 12-TET semitone, classify the base shape from the rounded 3rd/5th, then push residual deviation to satellite markers at 3 and 5 o'clock using the existing natural/flat/sharp/double-flat vocabulary. The base shape always stays clean; all microtonal nuance lives in markers. A note exactly 50¢ between two semitones always rounds up and takes the double-flat marker.

## No-fifth / no-third

| 3rd present? | 5th present? | Base shape |
| --- | --- | --- |
| yes | yes | Normal r=14 circle, filled per quality |
| yes | no | Smaller r=9 filled circle ("the moon shrinks — no planet") |
| no | yes | Half-moon r=14 (visually identical to sus, intentionally) |
| no | no | Half-moon r=9 |

## Repository layout

- `generate.js` — generator implementing the rules; emits the SVGs and `index.html`.
- `svg/` — every chord glyph + scale constellation as a standalone file.
- `index.html` — full sight of the catalogue.

## Running

```sh
node generate.js
```

Regenerates `svg/` and `index.html`. No dependencies.

