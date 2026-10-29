# Cost study: Epic 1

Measured 2026-10-29 on **Metal driver on macOS Version 26.6.2 (Build 25G83)** (unclassified), Dawn (node webgpu bindings).

Method: GPU timestamps: frame span (first pass start to last pass end) and marginal cost per extra frame. 12 warm-up frames, then the median of 11 rounds; each round encodes the frame once and 4 times in one command buffer.

- **span** is one frame alone, first pass start to last pass end. It includes the timing floor of this adapter (the `(floor)` row).
- **per frame** is the cost of one more frame of the same work (the slope). It is the number to compare effects by, and the one the Scorecard shows.
- `(tail)` is the HDR tail alone at its default settings. Every effect below includes it.

Only this adapter was measured. spanMs includes the timing floor (see the "(floor)" rows); slopeMs is the cost of one more frame of the same work and is the number to compare by. A slope at or below zero means the work is below what this method can resolve.

Two limits on reading these numbers. Repeated runs of a light effect differ by up to about half a millisecond (see the Range column), and a GPU's clock follows its load, so a light effect can read slower per unit of work than a heavy one: differences under about half a millisecond mean nothing. And the Tier A and B budgets are set for an integrated GPU; a time measured on a faster one can show an effect is over budget but cannot show that it fits.

## 1920 × 1080

| Effect  | Configuration                   | Passes | Span (ms) | Per frame (ms) | Range (ms)    |
| ------- | ------------------------------- | -----: | --------: | -------------: | ------------- |
| (floor) | one constant-colour pass        |      1 |      0.07 |           0.07 | 0.04 to 0.09  |
| (tail)  | constant scene + bloom + output |     11 |      0.59 |           0.39 | 0.17 to 0.70  |
| hello   | default                         |      2 |      0.13 |           0.13 | 0.11 to 0.26  |
| hello   | preset breeze                   |      2 |      0.20 |           0.17 | -0.20 to 0.31 |
| hello   | preset still                    |      2 |      0.39 |           0.33 | 0.24 to 0.63  |
| hello   | preset tall                     |      2 |      0.39 |           0.33 | 0.31 to 0.85  |

## 960 × 540

| Effect  | Configuration                   | Passes | Span (ms) | Per frame (ms) | Range (ms)    |
| ------- | ------------------------------- | -----: | --------: | -------------: | ------------- |
| (floor) | one constant-colour pass        |      1 |      0.07 |           0.07 | -0.09 to 0.09 |
| (tail)  | constant scene + bloom + output |      9 |      0.46 |           0.35 | 0.31 to 0.63  |
| hello   | default                         |      2 |      0.13 |           0.11 | 0.09 to 0.11  |
| hello   | preset breeze                   |      2 |      0.13 |           0.11 | -0.44 to 0.13 |
| hello   | preset still                    |      2 |      0.13 |           0.11 | 0.09 to 0.63  |
| hello   | preset tall                     |      2 |      0.13 |           0.11 | 0.09 to 0.63  |

## Download size

What the page fetches to show the effect, beyond the first-load bundle (6.9 kB gzipped, no shaders).

| Effect | Chunks | Own chunk (kB gzip) | Total (kB gzip) |
| ------ | -----: | ------------------: | --------------: |
| hello  |     13 |                 1.0 |            25.4 |
