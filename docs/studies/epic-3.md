# Cost study: Epic 3

Measured 2026-10-29 on **Metal driver on macOS Version 26.6.2 (Build 25G83)** (unclassified), Dawn (node webgpu bindings).

Method: GPU timestamps: frame span (first pass start to last pass end) and marginal cost per extra frame. 12 warm-up frames, then the median of 11 rounds; each round encodes the frame once and 4 times in one command buffer.

- **span** is one frame alone, first pass start to last pass end. It includes the timing floor of this adapter (the `(floor)` row).
- **per frame** is the cost of one more frame of the same work (the slope). It is the number to compare effects by, and the one the Scorecard shows.
- `(tail)` is the HDR tail alone at its default settings. Every effect below includes it.

Only this adapter was measured. spanMs includes the timing floor (see the "(floor)" rows); slopeMs is the cost of one more frame of the same work and is the number to compare by. A slope at or below zero means the work is below what this method can resolve.

Two limits on reading these numbers. Repeated runs of a light effect differ by up to about half a millisecond (see the Range column), and a GPU's clock follows its load, so a light effect can read slower per unit of work than a heavy one: differences under about half a millisecond mean nothing. And the Tier A and B budgets are set for an integrated GPU; a time measured on a faster one can show an effect is over budget but cannot show that it fits.

## 1920 × 1080

| Effect       | Configuration                          | Passes | Span (ms) | Per frame (ms) | Range (ms)   |
| ------------ | -------------------------------------- | -----: | --------: | -------------: | ------------ |
| (floor)      | one constant-colour pass               |      1 |      0.07 |           0.07 | 0.02 to 0.44 |
| (tail)       | constant scene + bloom + output        |     11 |      0.72 |           0.68 | 0.66 to 1.20 |
| grass-footer | default                                |      3 |      1.31 |           0.83 | 0.59 to 1.40 |
| grass-footer | preset meadow                          |      3 |      1.18 |           0.74 | 0.50 to 1.07 |
| grass-footer | preset lawn                            |      3 |      1.05 |           0.68 | 0.46 to 1.33 |
| grass-footer | preset golden hour                     |      3 |      1.44 |           1.11 | 0.63 to 1.38 |
| grass-footer | preset dry grass                       |      3 |      1.11 |           0.70 | 0.61 to 0.96 |
| grass-footer | preset overcast                        |      3 |      1.18 |           0.70 | 0.59 to 1.00 |
| meadow       | default                                |     13 |      2.56 |           2.23 | 1.99 to 2.75 |
| meadow       | preset midday                          |     13 |      2.56 |           2.10 | 1.90 to 2.21 |
| meadow       | preset golden hour                     |     14 |      3.74 |           3.36 | 3.06 to 3.78 |
| meadow       | preset dusk                            |     14 |      4.13 |           3.60 | 3.41 to 3.71 |
| meadow       | preset sparse                          |     13 |      1.84 |           1.73 | 1.53 to 1.77 |
| meadow       | preset walk through                    |     13 |      2.56 |           2.08 | 1.90 to 2.25 |
| grass-footer | density=0.25                           |      3 |      0.52 |           0.33 | 0.15 to 0.46 |
| grass-footer | density=0.5                            |      3 |      0.72 |           0.42 | 0.37 to 0.76 |
| grass-footer | density=1                              |      3 |      1.31 |           0.83 | 0.61 to 0.96 |
| grass-footer | band=0.2                               |      3 |      1.11 |           0.85 | 0.70 to 1.29 |
| grass-footer | band=0.6                               |      3 |      1.18 |           0.85 | 0.61 to 1.38 |
| grass-footer | band=0.9                               |      3 |      1.31 |           0.72 | 0.31 to 1.09 |
| grass-footer | height=0.5                             |      3 |      1.05 |           0.74 | 0.52 to 1.03 |
| grass-footer | height=2                               |      3 |      1.57 |           0.98 | 0.87 to 1.31 |
| meadow       | ablate=clumps                          |     13 |      2.56 |           1.99 | 1.92 to 2.40 |
| meadow       | ablate=translucency                    |     13 |      2.56 |           2.10 | 1.88 to 2.91 |
| meadow       | ablate=sheen                           |     13 |      2.42 |           1.90 | 1.73 to 2.12 |
| meadow       | ablate=canopy                          |     13 |      2.56 |           2.08 | 2.03 to 2.23 |
| meadow       | ablate=gusts                           |     13 |      2.56 |           2.10 | 1.88 to 2.25 |
| meadow       | ablate=clouds                          |     13 |      2.03 |           1.51 | 1.38 to 1.66 |
| meadow       | ablate=fog                             |     13 |      2.49 |           2.05 | 1.88 to 2.18 |
| meadow       | ablate=antialias                       |     13 |      1.90 |           1.49 | 1.35 to 1.73 |
| meadow       | ablate=depth of field                  |     13 |      2.62 |           2.05 | 1.88 to 2.25 |
| meadow       | ablate=pollen                          |     13 |      2.56 |           2.08 | 1.90 to 2.21 |
| meadow       | ablate=flowers                         |     13 |      2.56 |           2.18 | 1.92 to 2.36 |
| meadow       | time=golden hour ablate=depth of field |     13 |      2.29 |           1.94 | 1.70 to 2.53 |
| meadow       | time=golden hour ablate=antialias      |     14 |      3.21 |           2.82 | 2.64 to 2.99 |
| meadow       | distance=shells                        |     13 |      2.82 |           2.29 | 2.25 to 2.45 |
| meadow       | density=0.3                            |     13 |      1.64 |           1.49 | 1.40 to 1.66 |
| meadow       | density=0.5                            |     13 |      1.97 |           1.81 | 1.73 to 2.01 |

## 960 × 540

| Effect       | Configuration                          | Passes | Span (ms) | Per frame (ms) | Range (ms)   |
| ------------ | -------------------------------------- | -----: | --------: | -------------: | ------------ |
| (floor)      | one constant-colour pass               |      1 |      0.07 |           0.04 | 0.02 to 0.07 |
| (tail)       | constant scene + bloom + output        |      9 |      0.39 |           0.31 | 0.15 to 0.33 |
| grass-footer | default                                |      3 |      1.05 |           0.90 | 0.42 to 1.49 |
| grass-footer | preset meadow                          |      3 |      0.79 |           0.66 | 0.22 to 1.22 |
| grass-footer | preset lawn                            |      3 |      0.66 |           0.52 | 0.48 to 0.81 |
| grass-footer | preset golden hour                     |      3 |      0.92 |           0.63 | 0.52 to 1.40 |
| grass-footer | preset dry grass                       |      3 |      0.79 |           0.61 | 0.48 to 0.72 |
| grass-footer | preset overcast                        |      3 |      0.72 |           0.59 | 0.46 to 0.79 |
| meadow       | default                                |     11 |      1.70 |           1.46 | 1.14 to 1.94 |
| meadow       | preset midday                          |     11 |      1.64 |           1.35 | 1.20 to 1.53 |
| meadow       | preset golden hour                     |     12 |      2.10 |           1.57 | 1.44 to 1.88 |
| meadow       | preset dusk                            |     12 |      2.36 |           1.81 | 1.66 to 2.14 |
| meadow       | preset sparse                          |     11 |      1.11 |           0.98 | 0.83 to 1.22 |
| meadow       | preset walk through                    |     11 |      1.84 |           1.44 | 1.22 to 2.34 |
| grass-footer | density=0.25                           |      3 |      0.46 |           0.31 | 0.17 to 0.55 |
| grass-footer | density=0.5                            |      3 |      0.92 |           0.83 | 0.46 to 1.18 |
| grass-footer | density=1                              |      3 |      0.92 |           0.74 | 0.61 to 1.14 |
| grass-footer | band=0.2                               |      3 |      0.98 |           0.96 | 0.79 to 1.29 |
| grass-footer | band=0.6                               |      3 |      1.11 |           0.98 | 0.63 to 1.42 |
| grass-footer | band=0.9                               |      3 |      0.98 |           0.70 | 0.48 to 1.40 |
| grass-footer | height=0.5                             |      3 |      1.05 |           0.85 | 0.68 to 1.22 |
| grass-footer | height=2                               |      3 |      1.31 |           0.76 | 0.55 to 1.94 |
| meadow       | ablate=clumps                          |     11 |      2.03 |           1.16 | 0.92 to 2.12 |
| meadow       | ablate=translucency                    |     11 |      1.64 |           1.31 | 1.18 to 1.86 |
| meadow       | ablate=sheen                           |     11 |      1.64 |           1.40 | 1.16 to 1.66 |
| meadow       | ablate=canopy                          |     11 |      1.64 |           1.46 | 1.18 to 2.21 |
| meadow       | ablate=gusts                           |     11 |      1.70 |           1.42 | 1.25 to 1.75 |
| meadow       | ablate=clouds                          |     11 |      1.51 |           1.25 | 1.11 to 1.53 |
| meadow       | ablate=fog                             |     11 |      1.84 |           1.46 | 1.27 to 2.32 |
| meadow       | ablate=antialias                       |     11 |      1.64 |           1.33 | 1.14 to 2.25 |
| meadow       | ablate=depth of field                  |     11 |      1.64 |           1.27 | 1.18 to 1.59 |
| meadow       | ablate=pollen                          |     11 |      1.64 |           1.20 | 1.16 to 1.62 |
| meadow       | ablate=flowers                         |     11 |      1.70 |           1.29 | 1.18 to 1.86 |
| meadow       | time=golden hour ablate=depth of field |     11 |      1.70 |           1.42 | 1.33 to 1.77 |
| meadow       | time=golden hour ablate=antialias      |     12 |      1.84 |           1.51 | 1.22 to 1.73 |
| meadow       | distance=shells                        |     11 |      2.03 |           1.46 | 1.25 to 1.73 |
| meadow       | density=0.3                            |     11 |      1.31 |           1.18 | 0.94 to 1.55 |
| meadow       | density=0.5                            |     11 |      1.51 |           1.35 | 1.11 to 1.57 |

## Download size

What the page fetches to show the effect, beyond the first-load bundle (6.9 kB gzipped, no shaders).

| Effect       | Chunks | Own chunk (kB gzip) | Total (kB gzip) |
| ------------ | -----: | ------------------: | --------------: |
| grass-footer |     16 |                 1.6 |            43.4 |
| meadow       |     19 |                 5.3 |            50.4 |
