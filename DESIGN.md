# Paper

## Brief
A modern, tactile online typewriter. The idle screen is blank paper and a single metal type guide. No machine body, branding, formatting toolbar, autocorrect, deletion, or backtracking. Save text and an image, print to PDF, keep work locally. Publish only to NPCLABS-19 on GitHub Pages.

## Concepts considered
| Territory | Idea | Signature | Emotion / frame | Anchor | Originality / fit / feasibility / portability (low is good) |
|---|---|---|---|---|---|
| Material | Paper under a fixed steel type guide | Paper advances one physical pitch with each impact | Quiet, precise; a single inked line beneath chrome | The user's requested guide-only overlay | 4 / 5 / 5 / 1 |
| Optical | A magnified impression of each letter | A close view of ribbon contact | Intimate; oversized letter | Detailed type movement | 4 / 3 / 4 / 3 |
| Spatial | A whole sheet travelling across a desk | Carriage crosses the frame | Analog; visible page edges | Blank physical paper | 3 / 4 / 4 / 2 |

Selected: material. It delivers mechanical fidelity without adding a scene around the writing.

## Concept card
Idea: A blank sheet. Every strike stays.
Metaphor: The working point of a well-maintained manual typewriter.
Signature: A stationary steel guide; variable ink impressions and paper advance share one carriage state.
Emotion: Silence and concentration, interrupted by convincing mechanical impact.
Motion verb: Strike, advance, return, settle.
Screenshot: A short imperfect line on grainy white stock, a small polished steel guide underneath.

## System
Stack: buildless semantic HTML, CSS, ES modules, locally bundled GSAP. Zero runtime service or framework dependency; appropriate for a fast, private writing instrument on GitHub Pages.
Palette: paper #f8f7f3, light #fffefa, ink #292a29, muted #686964, steel #969b9c, marker #862f2b. The warm white comes from the requested material, not a decorative brand palette.
Type: self-hosted TT2020 Base Regular by Fredrick R. Brennan, OFL; 22px desktop / 20px touch with fixed physical pitch. System sans for the optional utility menu.
Grid: a 68-column typewriter, 8 spaces of margin warning; 34px line advance. Fixed point centred horizontally at 58% screen height; small screens 42% height, adapting to visualViewport when the keyboard opens.
Shape: steel geometry uses real mechanical curves; utility menu radius 12px.
Motion: one GSAP carriage driver, short 55ms escapement, 200–480ms return dependent on carriage distance. Small damped settle. Reduced motion uses immediate state changes. Idle intentionally remains still: nothing in a parked mechanical instrument needs to float or breathe.
Composition: full viewport paper, one 180px guide, ephemeral margin feedback. Utility menu is hidden by default, opened with Escape or a discreet corner button. No additional pages or visible editorial copy, as explicitly requested.

```
┌──────────────────────────────────────────┐
│                                          │
│             blank paper                  │
│                                          │
│                [guide]                   │
│                                          │
│                                  menu*   │
└──────────────────────────────────────────┘
* reveals on pointer movement, keyboard focus or touch
```

Genericness check: removed app branding, counters, toolbar, machine shell, theme options, ornamental rules, onboarding hero, and any placeholder text on the paper. The guide is a drawn mechanical assembly, not a cursor dressed as a typewriter.

## References
- https://uniqcode.com/typewriter/ : fixed strike position, carriage physics, variable impressions, margin lock.
- https://typewritesomething.com/ : sparse writing experience.
- https://github.com/ctrlcctrlv/TT2020 : authentic typewriter forms.

## Verification
Test real typing, spaces, manual returns, bell threshold, right margin lock, no erase/undo/replacement/paste, mobile beforeinput and composition, storage restore, text and PNG export, print layout, menu focus, sound decode and timing, mobile and reduced motion. Two visual passes, accessibility audit and an independent screenshot critic.

## User refinements
Backspace now asks to start a fresh page; a confirmed action tears away a snapshot with a recorded paper tear. Keep the ten newest pages, including the active page, and stable sequential page numbers. Lift the guide away from the text baseline so the entire impression stays visible. Paper is now a richer warm cotton stock with layered pulp and fiber texture. Pointer movement shifts the soft paper light, specular metal gradient, and related cast shadow from a single GSAP lighting state. On phones, move the writing point toward the right to expose more of the current line.
