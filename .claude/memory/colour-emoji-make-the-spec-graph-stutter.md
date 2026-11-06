# Colour emoji make the spec graph stutter

**Hit 2026-10-07**, when the developer said zooming the spec graph "lags quite
a bit". Measured in the preview (30 wheel notches, three levels open): frames of
50–170 ms during a zoom and a ~480 ms freeze each time it settled.

- **Find the cost by switching suspects off one at a time, timing each.** Card
  shadows, the dot grid and non-scaling strokes made no difference. Hiding the
  cards' emojis made the zoom smooth: colour emoji are the costliest glyphs to
  draw, and every new scale redrew each one.
- **So the cards draw each emoji once into a canvas and place it as an
  `<image>`** (`emojiPic` in `dev/ui/components/harness/SpecGraph.jsx`). A
  change that puts emoji back as SVG text brings the stutter back.
- **`will-change: transform` on an SVG group made it worse, not better**: the
  layer was redrawn whole on every step. The map moves as one composited
  `<svg>` while it moves and is drawn once when it rests; a wheel glides by a
  CSS transition, which the compositor runs without a redraw. A script
  changing the scale every frame redraws every frame.
- **Headless Chrome exaggerates paint costs**, so compare runs against each
  other, never against 16.7 ms alone.
