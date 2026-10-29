# Cost study: Epic 12

Measured 2026-10-29 on **Metal driver on macOS Version 26.6.2 (Build 25G83)** (unclassified), Dawn (node webgpu bindings).

Method: GPU timestamps: frame span (first pass start to last pass end) and marginal cost per extra frame. 12 warm-up frames, then the median of 11 rounds; each round encodes the frame once and 4 times in one command buffer.

- **span** is one frame alone, first pass start to last pass end. It includes the timing floor of this adapter (the `(floor)` row).
- **per frame** is the cost of one more frame of the same work (the slope). It is the number to compare effects by, and the one the Scorecard shows.
- `(tail)` is the HDR tail alone at its default settings. Every effect below includes it.

Only this adapter was measured. spanMs includes the timing floor (see the "(floor)" rows); slopeMs is the cost of one more frame of the same work and is the number to compare by. A slope at or below zero means the work is below what this method can resolve.

Two limits on reading these numbers. Repeated runs of a light effect differ by up to about half a millisecond (see the Range column), and a GPU's clock follows its load, so a light effect can read slower per unit of work than a heavy one: differences under about half a millisecond mean nothing. And the Tier A and B budgets are set for an integrated GPU; a time measured on a faster one can show an effect is over budget but cannot show that it fits.

## 1920 × 1080

| Effect            | Configuration                   | Passes | Span (ms) | Per frame (ms) | Range (ms)   |
| ----------------- | ------------------------------- | -----: | --------: | -------------: | ------------ |
| (floor)           | one constant-colour pass        |      1 |      0.07 |           0.07 | 0.04 to 0.52 |
| (tail)            | constant scene + bloom + output |     11 |      0.52 |           0.39 | 0.35 to 1.18 |
| cherry-branch     | default                         |     11 |      1.64 |           1.57 | 1.35 to 1.90 |
| cherry-branch     | preset blossom                  |     11 |      2.10 |           1.75 | 1.33 to 2.53 |
| cherry-branch     | preset on scroll                |     11 |      1.77 |           1.55 | 1.33 to 2.56 |
| cherry-branch     | preset another branch           |     11 |      1.44 |           1.35 | 1.22 to 1.81 |
| dewy-petals       | default                         |     13 |      3.01 |           2.71 | 2.69 to 2.91 |
| dewy-petals       | preset blush                    |     13 |      3.01 |           2.71 | 2.71 to 2.88 |
| dewy-petals       | preset crimson                  |     13 |      3.01 |           2.73 | 2.71 to 2.91 |
| dewy-petals       | preset ivory                    |     13 |      3.01 |           2.86 | 2.71 to 2.91 |
| dewy-petals       | preset deep focus               |     13 |      3.01 |           2.73 | 2.71 to 2.93 |
| flower-opening    | default                         |      2 |      0.33 |           0.22 | 0.17 to 0.31 |
| flower-opening    | preset poppy                    |      2 |      0.39 |           0.31 | 0.26 to 0.35 |
| flower-opening    | preset lily                     |      2 |      0.79 |           0.55 | 0.31 to 1.03 |
| flower-opening    | preset buttercup                |      2 |      0.79 |           0.59 | 0.31 to 1.18 |
| flower-opening    | preset cherry blossom           |      2 |      0.59 |           0.44 | 0.24 to 0.63 |
| flower-opening    | preset rose                     |      2 |      0.85 |           0.76 | 0.50 to 1.11 |
| flower-opening    | preset camellia                 |      2 |      0.79 |           0.46 | 0.37 to 0.90 |
| flower-opening    | preset frilled poppy            |      2 |      0.85 |           0.59 | 0.52 to 0.85 |
| flower-opening    | preset hibiscus                 |      2 |      0.85 |           0.61 | 0.55 to 1.07 |
| flower-opening    | preset morning glory            |      2 |      0.33 |           0.24 | 0.17 to 0.35 |
| flower-opening    | preset daffodil                 |      2 |      0.39 |           0.28 | 0.28 to 0.39 |
| flower-opening    | preset on scroll                |      2 |      0.85 |           0.57 | 0.26 to 0.68 |
| night-bloom       | default                         |     12 |      0.79 |           0.76 | 0.46 to 1.38 |
| night-bloom       | preset moonlit                  |     12 |      1.25 |           1.07 | 0.52 to 1.59 |
| night-bloom       | preset starlit                  |     12 |      1.25 |           1.09 | 0.81 to 1.64 |
| night-bloom       | preset true colour              |     11 |      0.92 |           0.79 | 0.55 to 1.33 |
| night-bloom       | preset on scroll                |     12 |      1.31 |           1.14 | 0.90 to 1.62 |
| rose              | default                         |      2 |      0.85 |           0.68 | 0.42 to 1.46 |
| rose              | preset red                      |      2 |      0.85 |           0.63 | 0.55 to 0.98 |
| rose              | preset pink                     |      2 |      0.72 |           0.57 | 0.42 to 1.40 |
| rose              | preset white                    |      2 |      0.85 |           0.66 | 0.39 to 1.14 |
| rose              | preset yellow                   |      2 |      0.85 |           0.68 | 0.46 to 1.14 |
| rose              | preset peach                    |      2 |      0.79 |           0.68 | 0.22 to 1.11 |
| rose              | preset on scroll                |      2 |      1.05 |           0.94 | 0.35 to 1.35 |
| sunflowers        | default                         |     11 |      2.36 |           2.25 | 2.14 to 2.80 |
| sunflowers        | preset field                    |     11 |      2.36 |           2.23 | 2.18 to 2.38 |
| sunflowers        | preset one row                  |     11 |      0.79 |           0.63 | 0.44 to 0.74 |
| sunflowers        | preset slow growth              |     11 |      2.36 |           2.25 | 2.08 to 2.82 |
| sunflowers        | preset facing east              |     11 |      2.36 |           2.23 | 2.16 to 2.40 |
| tulips            | default                         |     11 |      4.19 |           4.06 | 3.78 to 4.17 |
| tulips            | preset day                      |     11 |      4.19 |           4.00 | 3.54 to 4.11 |
| tulips            | preset evening                  |     11 |      4.13 |           4.09 | 3.84 to 4.19 |
| tulips            | preset other beds               |     11 |      4.00 |           3.87 | 3.65 to 3.95 |
| wildflower-meadow | default                         |     13 |      3.74 |           3.19 | 2.82 to 3.50 |
| wildflower-meadow | preset midday                   |     13 |      3.74 |           3.15 | 2.82 to 3.50 |
| wildflower-meadow | preset golden hour              |     14 |      5.51 |           4.54 | 4.39 to 4.92 |
| wildflower-meadow | preset dusk                     |     13 |      4.19 |           3.39 | 3.12 to 4.15 |
| wildflower-meadow | preset sparse                   |     13 |      2.29 |           1.97 | 1.90 to 2.10 |
| wildflower-meadow | preset walk through             |     13 |      3.80 |           3.34 | 3.06 to 3.63 |

## 960 × 540

| Effect            | Configuration                   | Passes | Span (ms) | Per frame (ms) | Range (ms)    |
| ----------------- | ------------------------------- | -----: | --------: | -------------: | ------------- |
| (floor)           | one constant-colour pass        |      1 |      0.07 |           0.04 | 0.02 to 0.07  |
| (tail)            | constant scene + bloom + output |      9 |      0.39 |           0.33 | 0.28 to 0.37  |
| cherry-branch     | default                         |      9 |      0.92 |           0.83 | 0.66 to 1.03  |
| cherry-branch     | preset blossom                  |      9 |      0.72 |           0.66 | 0.61 to 0.70  |
| cherry-branch     | preset on scroll                |      9 |      0.72 |           0.63 | 0.63 to 0.74  |
| cherry-branch     | preset another branch           |      9 |      0.72 |           0.61 | 0.42 to 0.66  |
| dewy-petals       | default                         |     11 |      1.51 |           1.03 | 0.81 to 1.84  |
| dewy-petals       | preset blush                    |     11 |      1.84 |           1.38 | 0.85 to 1.84  |
| dewy-petals       | preset crimson                  |     11 |      1.44 |           1.14 | 0.87 to 1.94  |
| dewy-petals       | preset ivory                    |     11 |      1.18 |           1.22 | 0.79 to 2.23  |
| dewy-petals       | preset deep focus               |     11 |      1.84 |           1.31 | 0.94 to 2.10  |
| flower-opening    | default                         |      2 |      0.33 |           0.24 | 0.22 to 0.70  |
| flower-opening    | preset poppy                    |      2 |      0.52 |           0.37 | 0.35 to 0.50  |
| flower-opening    | preset lily                     |      2 |      0.39 |           0.26 | 0.24 to 0.74  |
| flower-opening    | preset buttercup                |      2 |      0.79 |           0.57 | 0.44 to 0.74  |
| flower-opening    | preset cherry blossom           |      2 |      0.33 |           0.24 | 0.22 to 0.74  |
| flower-opening    | preset rose                     |      2 |      0.72 |           0.55 | 0.55 to 0.94  |
| flower-opening    | preset camellia                 |      2 |      0.46 |           0.37 | 0.15 to 0.42  |
| flower-opening    | preset frilled poppy            |      2 |      0.52 |           0.37 | 0.35 to 0.55  |
| flower-opening    | preset hibiscus                 |      2 |      0.39 |           0.31 | 0.28 to 0.31  |
| flower-opening    | preset morning glory            |      2 |      0.33 |           0.22 | 0.20 to 0.72  |
| flower-opening    | preset daffodil                 |      2 |      0.39 |           0.24 | 0.24 to 0.66  |
| flower-opening    | preset on scroll                |      2 |      0.46 |           0.39 | 0.35 to 0.85  |
| night-bloom       | default                         |     10 |      0.59 |           0.50 | 0.46 to 0.98  |
| night-bloom       | preset moonlit                  |     10 |      0.59 |           0.48 | 0.46 to 0.50  |
| night-bloom       | preset starlit                  |     10 |      0.59 |           0.48 | -0.04 to 1.00 |
| night-bloom       | preset true colour              |      9 |      0.52 |           0.39 | 0.37 to 0.90  |
| night-bloom       | preset on scroll                |     10 |      0.66 |           0.52 | 0.02 to 0.98  |
| rose              | default                         |      2 |      0.72 |           0.59 | 0.46 to 1.09  |
| rose              | preset red                      |      2 |      0.72 |           0.59 | 0.11 to 0.61  |
| rose              | preset pink                     |      2 |      0.72 |           0.59 | 0.09 to 1.11  |
| rose              | preset white                    |      2 |      0.72 |           0.59 | 0.11 to 0.96  |
| rose              | preset yellow                   |      2 |      0.72 |           0.59 | 0.57 to 1.00  |
| rose              | preset peach                    |      2 |      0.72 |           0.48 | 0.09 to 1.14  |
| rose              | preset on scroll                |      2 |      0.72 |           0.61 | 0.59 to 1.03  |
| sunflowers        | default                         |      9 |      1.25 |           1.27 | 0.81 to 2.12  |
| sunflowers        | preset field                    |      9 |      1.51 |           1.18 | 0.74 to 1.35  |
| sunflowers        | preset one row                  |      9 |      0.46 |           0.35 | 0.28 to 0.66  |
| sunflowers        | preset slow growth              |      9 |      1.25 |           1.29 | 1.09 to 1.51  |
| sunflowers        | preset facing east              |      9 |      1.51 |           1.40 | 1.05 to 1.66  |
| tulips            | default                         |      9 |      2.75 |           2.77 | 2.08 to 4.52  |
| tulips            | preset day                      |      9 |      2.36 |           2.34 | 2.10 to 4.33  |
| tulips            | preset evening                  |      9 |      2.82 |           2.84 | 2.21 to 4.02  |
| tulips            | preset other beds               |      9 |      2.29 |           2.40 | 2.16 to 2.95  |
| wildflower-meadow | default                         |     11 |      2.62 |           2.01 | 1.62 to 3.43  |
| wildflower-meadow | preset midday                   |     11 |      2.10 |           1.92 | 1.75 to 2.08  |
| wildflower-meadow | preset golden hour              |     12 |      2.82 |           2.47 | 2.27 to 2.73  |
| wildflower-meadow | preset dusk                     |     11 |      2.56 |           2.29 | 2.16 to 2.53  |
| wildflower-meadow | preset sparse                   |     11 |      1.44 |           1.16 | 1.07 to 1.62  |
| wildflower-meadow | preset walk through             |     11 |      2.16 |           1.92 | 1.68 to 2.77  |

## Download size

What the page fetches to show the effect, beyond the first-load bundle (10.3 kB gzipped, no shaders).

| Effect            | Chunks | Own chunk (kB gzip) | Total (kB gzip) |
| ----------------- | -----: | ------------------: | --------------: |
| cherry-branch     |     20 |                 3.7 |            49.0 |
| dewy-petals       |     25 |                 2.8 |            66.5 |
| flower-opening    |     18 |                 1.9 |            45.7 |
| night-bloom       |     19 |                 1.7 |            45.8 |
| rose              |     18 |                 1.8 |            45.6 |
| sunflowers        |     21 |                 2.4 |            47.1 |
| tulips            |     17 |                 3.1 |            47.1 |
| wildflower-meadow |     29 |                 0.1 |            72.6 |
