# Cost study: Epic 12

Measured 2026-10-29 on **Apple M1 Max** (apple-silicon), Dawn (node webgpu bindings).

Method: GPU timestamps: frame span (first pass start to last pass end) and marginal cost per extra frame. 12 warm-up frames, then the median of 11 rounds; each round encodes the frame once and 4 times in one command buffer.

- **span** is one frame alone, first pass start to last pass end. It includes the timing floor of this adapter (the `(floor)` row).
- **per frame** is the cost of one more frame of the same work (the slope). It is the number to compare effects by, and the one the Scorecard shows.
- `(tail)` is the HDR tail alone at its default settings. Every effect below includes it.

Only this adapter was measured. spanMs includes the timing floor (see the "(floor)" rows); slopeMs is the cost of one more frame of the same work and is the number to compare by. A slope at or below zero means the work is below what this method can resolve.

Two limits on reading these numbers. Repeated runs of a light effect differ by up to about half a millisecond (see the Range column), and a GPU's clock follows its load, so a light effect can read slower per unit of work than a heavy one: differences under about half a millisecond mean nothing. And the Tier A and B budgets are set for an integrated GPU; a time measured on a faster one can show an effect is over budget but cannot show that it fits.

## 1920 × 1080

| Effect | Configuration | Passes | Span (ms) | Per frame (ms) | Range (ms) |
| --- | --- | ---: | ---: | ---: | --- |
| (floor) | one constant-colour pass | 1 | 0.72 | 0.17 | -0.98 to 1.35 |
| (tail) | constant scene + bloom + output | 11 | 1.97 | 0.70 | -0.68 to 2.53 |
| flower-opening | default | 2 | 0.59 | 0.46 | -0.44 to 1.70 |
| flower-opening | preset poppy | 2 | 0.85 | 0.22 | -0.17 to 1.20 |
| flower-opening | preset lily | 2 | 1.64 | 0.11 | -0.52 to 1.73 |
| flower-opening | preset buttercup | 2 | 2.88 | -0.20 | -0.81 to 1.31 |
| flower-opening | preset cherry blossom | 2 | 1.05 | 0.70 | -0.46 to 1.53 |
| flower-opening | preset rose | 2 | 1.11 | 0.22 | -0.11 to 1.55 |
| flower-opening | preset camellia | 2 | 1.38 | -0.07 | -0.46 to 1.49 |
| flower-opening | preset frilled poppy | 2 | 0.52 | 0.22 | -0.81 to 1.62 |
| flower-opening | preset hibiscus | 2 | 0.46 | 0.35 | -0.74 to 1.07 |
| flower-opening | preset morning glory | 2 | 0.26 | 0.26 | 0.13 to 1.07 |
| flower-opening | preset daffodil | 2 | 0.39 | 0.17 | -0.52 to 0.87 |
| flower-opening | preset on scroll | 2 | 0.26 | 0.20 | -0.35 to 0.70 |

## 960 × 540

| Effect | Configuration | Passes | Span (ms) | Per frame (ms) | Range (ms) |
| --- | --- | ---: | ---: | ---: | --- |
| (floor) | one constant-colour pass | 1 | 0.07 | 0.07 | -0.07 to 0.85 |
| (tail) | constant scene + bloom + output | 9 | 0.59 | 0.50 | -0.35 to 1.57 |
| flower-opening | default | 2 | 0.20 | 0.20 | 0.00 to 0.42 |
| flower-opening | preset poppy | 2 | 0.20 | 0.07 | -0.20 to 1.70 |
| flower-opening | preset lily | 2 | 0.13 | 0.11 | -1.00 to 0.92 |
| flower-opening | preset buttercup | 2 | 0.20 | 0.11 | -0.37 to 1.05 |
| flower-opening | preset cherry blossom | 2 | 0.13 | 0.09 | -0.50 to 0.52 |
| flower-opening | preset rose | 2 | 0.33 | 0.11 | -0.87 to 0.44 |
| flower-opening | preset camellia | 2 | 0.26 | 0.07 | -1.05 to 1.07 |
| flower-opening | preset frilled poppy | 2 | 0.13 | 0.13 | -0.15 to 1.18 |
| flower-opening | preset hibiscus | 2 | 0.20 | 0.11 | -0.04 to 1.03 |
| flower-opening | preset morning glory | 2 | 0.13 | 0.09 | 0.04 to 0.74 |
| flower-opening | preset daffodil | 2 | 0.13 | 0.09 | -0.37 to 0.15 |
| flower-opening | preset on scroll | 2 | 0.13 | 0.17 | -0.04 to 1.25 |

## Download size

What the page fetches to show the effect, beyond the first-load bundle (8.1 kB gzipped, no shaders).

| Effect | Chunks | Own chunk (kB gzip) | Total (kB gzip) |
| --- | ---: | ---: | ---: |
