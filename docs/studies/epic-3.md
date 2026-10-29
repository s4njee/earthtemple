# Cost study: Epic 3

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
| (floor) | one constant-colour pass | 1 | 0.07 | 0.07 | -0.17 to 0.31 |
| (tail) | constant scene + bloom + output | 11 | 1.25 | 0.52 | 0.00 to 0.72 |
| fur-text | default | 2 | 1.31 | 1.00 | 0.66 to 1.20 |
| fur-text | preset fur | 2 | 1.31 | 1.20 | 0.70 to 1.86 |
| fur-text | preset grass | 2 | 0.92 | 0.83 | 0.59 to 1.79 |
| fur-text | preset moss | 2 | 1.11 | 1.29 | 1.14 to 1.51 |
| fur-text | preset long fur | 2 | 1.05 | 1.16 | 0.33 to 2.64 |
| fur-text | preset over the page | 2 | 1.25 | 0.94 | 0.55 to 1.20 |
| grass-edges | default | 2 | 0.26 | 0.24 | 0.04 to 0.52 |
| grass-edges | preset spring | 2 | 0.39 | 0.44 | 0.13 to 1.07 |
| grass-edges | preset on scroll | 2 | 0.72 | 0.39 | -0.26 to 1.09 |
| grass-edges | preset meadow | 2 | 0.46 | 0.33 | 0.11 to 0.70 |
| grass-footer | default | 3 | 1.18 | 0.83 | 0.55 to 1.09 |
| grass-footer | preset meadow | 3 | 1.18 | 0.70 | 0.31 to 1.09 |
| grass-footer | preset lawn | 3 | 0.66 | 0.39 | 0.28 to 1.25 |
| grass-footer | preset golden hour | 3 | 1.44 | 0.98 | 0.63 to 1.27 |
| grass-footer | preset dry grass | 3 | 0.98 | 0.68 | 0.55 to 0.92 |
| grass-footer | preset overcast | 3 | 1.05 | 0.76 | 0.55 to 0.96 |
| grass-growth | default | 3 | 1.51 | 1.53 | 1.22 to 1.73 |
| grass-growth | preset over time | 3 | 1.64 | 1.44 | 1.14 to 1.68 |
| grass-growth | preset on scroll | 3 | 1.84 | 1.86 | 1.51 to 2.03 |
| grass-growth | preset evening | 3 | 1.31 | 1.22 | 0.92 to 1.33 |
| lawn | default | 3 | 1.70 | 1.07 | 0.92 to 1.51 |
| lawn | preset afternoon | 3 | 1.38 | 1.33 | 1.00 to 1.51 |
| lawn | preset evening | 3 | 1.05 | 1.00 | 0.74 to 1.27 |
| lawn | preset overcast | 3 | 1.25 | 0.79 | 0.55 to 1.22 |
| lawn | preset deep trail | 3 | 1.05 | 1.09 | 0.74 to 1.35 |
| meadow | default | 13 | 3.01 | 2.53 | 2.32 to 2.84 |
| meadow | preset midday | 13 | 2.56 | 2.77 | 2.56 to 2.91 |
| meadow | preset golden hour | 14 | 4.13 | 3.98 | 3.50 to 4.37 |
| meadow | preset dusk | 13 | 3.67 | 2.60 | 2.23 to 3.30 |
| meadow | preset sparse | 13 | 2.10 | 2.18 | 1.68 to 2.36 |
| meadow | preset walk through | 13 | 6.23 | 4.63 | 2.29 to 7.32 |
| mowing | default | 3 | 1.70 | 1.49 | 0.98 to 1.64 |
| mowing | preset afternoon | 3 | 1.64 | 1.53 | 0.76 to 1.79 |
| mowing | preset evening | 3 | 1.11 | 1.09 | 0.74 to 1.40 |
| mowing | preset half mown | 3 | 1.64 | 1.44 | 0.92 to 1.64 |
| mowing | preset bold stripes | 3 | 1.38 | 1.42 | 0.87 to 1.55 |
| grass-footer | density=0.25 | 3 | 0.59 | 0.37 | 0.07 to 0.74 |
| grass-footer | density=0.5 | 3 | 0.85 | 0.46 | 0.26 to 2.12 |
| grass-footer | density=1 | 3 | 1.31 | 0.92 | 0.70 to 1.29 |
| grass-footer | band=0.2 | 3 | 1.05 | 0.79 | 0.55 to 1.03 |
| grass-footer | band=0.6 | 3 | 1.05 | 0.59 | 0.39 to 0.92 |
| grass-footer | band=0.9 | 3 | 0.98 | 0.72 | 0.46 to 0.98 |
| grass-footer | height=0.5 | 3 | 0.79 | 0.55 | 0.48 to 0.94 |
| grass-footer | height=2 | 3 | 1.77 | 0.83 | 0.35 to 1.03 |
| meadow | ablate=clumps | 13 | 2.49 | 2.60 | 2.34 to 3.04 |
| meadow | ablate=translucency | 13 | 3.34 | 2.32 | 2.18 to 3.01 |
| meadow | ablate=sheen | 13 | 2.75 | 2.18 | 1.73 to 5.16 |
| meadow | ablate=canopy | 13 | 2.56 | 2.73 | 2.49 to 2.91 |
| meadow | ablate=gusts | 13 | 6.23 | 4.37 | 1.97 to 5.59 |
| meadow | ablate=clouds | 13 | 6.23 | 4.02 | 2.64 to 5.70 |
| meadow | ablate=fog | 13 | 3.93 | 2.88 | 2.14 to 6.66 |
| meadow | ablate=antialias | 13 | 4.00 | 3.17 | 2.47 to 4.65 |
| meadow | ablate=depth of field | 13 | 2.95 | 2.38 | 2.12 to 2.71 |
| meadow | ablate=pollen | 13 | 3.21 | 2.51 | 2.08 to 4.78 |
| meadow | ablate=flowers | 13 | 2.69 | 2.58 | 2.23 to 5.90 |
| meadow | time=golden hour ablate=depth of field | 13 | 2.62 | 2.45 | 2.36 to 2.64 |
| meadow | time=golden hour ablate=antialias | 14 | 3.54 | 3.10 | 2.91 to 3.45 |
| meadow | distance=shells | 13 | 3.01 | 2.75 | 2.32 to 3.10 |
| meadow | density=0.3 | 13 | 1.90 | 1.73 | 1.38 to 1.88 |
| meadow | density=0.5 | 13 | 2.16 | 2.08 | 1.57 to 2.45 |
| lawn | far=shells | 3 | 1.84 | 1.79 | 1.57 to 1.94 |
| lawn | density=0.4 | 3 | 1.05 | 1.03 | 0.74 to 1.25 |
| lawn | density=1 | 3 | 1.57 | 1.33 | 1.11 to 1.57 |
| fur-text | length=0.5 | 2 | 0.59 | 0.55 | 0.42 to 0.83 |
| fur-text | length=2 | 2 | 0.92 | 0.96 | 0.66 to 1.97 |
| grass-edges | density=2 | 2 | 0.26 | 0.26 | 0.22 to 0.61 |

## 960 × 540

| Effect | Configuration | Passes | Span (ms) | Per frame (ms) | Range (ms) |
| --- | --- | ---: | ---: | ---: | --- |
| (floor) | one constant-colour pass | 1 | 0.07 | 0.04 | -0.15 to 0.11 |
| (tail) | constant scene + bloom + output | 9 | 0.52 | 0.35 | 0.22 to 0.83 |
| fur-text | default | 2 | 0.79 | 0.68 | 0.37 to 1.14 |
| fur-text | preset fur | 2 | 0.66 | 0.76 | 0.44 to 1.03 |
| fur-text | preset grass | 2 | 0.39 | 0.46 | 0.31 to 0.59 |
| fur-text | preset moss | 2 | 0.72 | 0.81 | 0.46 to 1.42 |
| fur-text | preset long fur | 2 | 0.46 | 0.44 | 0.22 to 0.68 |
| fur-text | preset over the page | 2 | 0.52 | 0.42 | 0.09 to 0.87 |
| grass-edges | default | 2 | 0.13 | 0.11 | -0.24 to 0.33 |
| grass-edges | preset spring | 2 | 0.20 | 0.09 | 0.00 to 0.57 |
| grass-edges | preset on scroll | 2 | 0.13 | 0.09 | -0.39 to 0.28 |
| grass-edges | preset meadow | 2 | 0.26 | 0.09 | -0.28 to 0.44 |
| grass-footer | default | 3 | 0.66 | 0.48 | 0.35 to 0.87 |
| grass-footer | preset meadow | 3 | 0.66 | 0.44 | 0.20 to 0.90 |
| grass-footer | preset lawn | 3 | 0.46 | 0.39 | 0.15 to 0.85 |
| grass-footer | preset golden hour | 3 | 1.05 | 0.72 | 0.22 to 1.90 |
| grass-footer | preset dry grass | 3 | 0.92 | 0.68 | 0.39 to 0.98 |
| grass-footer | preset overcast | 3 | 0.72 | 0.63 | 0.28 to 0.74 |
| grass-growth | default | 3 | 0.85 | 0.79 | 0.44 to 1.16 |
| grass-growth | preset over time | 3 | 0.72 | 0.72 | 0.46 to 1.05 |
| grass-growth | preset on scroll | 3 | 0.98 | 0.98 | 0.63 to 1.22 |
| grass-growth | preset evening | 3 | 0.59 | 0.61 | 0.42 to 0.94 |
| lawn | default | 3 | 1.05 | 0.90 | 0.52 to 1.18 |
| lawn | preset afternoon | 3 | 1.38 | 1.27 | 0.87 to 3.36 |
| lawn | preset evening | 3 | 0.98 | 1.22 | 0.96 to 1.49 |
| lawn | preset overcast | 3 | 1.11 | 1.42 | 1.25 to 1.55 |
| lawn | preset deep trail | 3 | 1.11 | 1.35 | 1.00 to 2.14 |
| meadow | default | 11 | 2.10 | 1.64 | 1.16 to 1.84 |
| meadow | preset midday | 11 | 1.77 | 1.55 | 1.42 to 1.81 |
| meadow | preset golden hour | 12 | 2.29 | 1.86 | 1.57 to 2.05 |
| meadow | preset dusk | 11 | 2.16 | 1.86 | 1.57 to 1.99 |
| meadow | preset sparse | 11 | 1.31 | 1.05 | 0.76 to 4.33 |
| meadow | preset walk through | 11 | 1.84 | 1.57 | 1.22 to 1.75 |
| mowing | default | 3 | 0.98 | 0.72 | 0.55 to 1.11 |
| mowing | preset afternoon | 3 | 0.98 | 0.98 | 0.50 to 1.20 |
| mowing | preset evening | 3 | 0.85 | 0.83 | 0.52 to 0.94 |
| mowing | preset half mown | 3 | 1.18 | 1.05 | 0.68 to 1.31 |
| mowing | preset bold stripes | 3 | 1.18 | 0.87 | 0.48 to 1.44 |
| grass-footer | density=0.25 | 3 | 0.52 | 0.39 | 0.02 to 0.87 |
| grass-footer | density=0.5 | 3 | 0.92 | 0.81 | 0.57 to 1.18 |
| grass-footer | density=1 | 3 | 0.92 | 0.90 | 0.42 to 1.40 |
| grass-footer | band=0.2 | 3 | 0.79 | 0.70 | 0.52 to 1.07 |
| grass-footer | band=0.6 | 3 | 0.66 | 0.42 | 0.26 to 0.68 |
| grass-footer | band=0.9 | 3 | 0.66 | 0.44 | 0.20 to 0.59 |
| grass-footer | height=0.5 | 3 | 0.92 | 0.83 | 0.35 to 1.22 |
| grass-footer | height=2 | 3 | 0.98 | 0.66 | 0.35 to 1.09 |
| meadow | ablate=clumps | 11 | 1.70 | 1.25 | 1.03 to 1.77 |
| meadow | ablate=translucency | 11 | 1.97 | 1.40 | 1.22 to 1.79 |
| meadow | ablate=sheen | 11 | 1.97 | 1.51 | 1.27 to 1.77 |
| meadow | ablate=canopy | 11 | 1.90 | 1.55 | 1.11 to 1.90 |
| meadow | ablate=gusts | 11 | 1.90 | 1.51 | 1.16 to 1.79 |
| meadow | ablate=clouds | 11 | 1.70 | 1.51 | 1.05 to 1.73 |
| meadow | ablate=fog | 11 | 1.84 | 1.57 | 1.16 to 1.79 |
| meadow | ablate=antialias | 11 | 1.70 | 1.38 | 0.87 to 2.60 |
| meadow | ablate=depth of field | 11 | 1.84 | 1.42 | 1.11 to 1.81 |
| meadow | ablate=pollen | 11 | 1.90 | 1.40 | 1.09 to 1.79 |
| meadow | ablate=flowers | 11 | 1.84 | 1.59 | 1.14 to 1.86 |
| meadow | time=golden hour ablate=depth of field | 11 | 1.90 | 1.46 | 1.27 to 1.77 |
| meadow | time=golden hour ablate=antialias | 12 | 2.03 | 1.62 | 1.42 to 1.70 |
| meadow | distance=shells | 11 | 1.90 | 1.68 | 1.22 to 1.86 |
| meadow | density=0.3 | 11 | 2.10 | 1.05 | 0.68 to 3.10 |
| meadow | density=0.5 | 11 | 1.51 | 1.31 | 1.16 to 2.10 |
| lawn | far=shells | 3 | 1.64 | 0.94 | 0.83 to 1.14 |
| lawn | density=0.4 | 3 | 0.79 | 0.59 | 0.50 to 0.92 |
| lawn | density=1 | 3 | 1.25 | 1.11 | 0.94 to 1.33 |
| fur-text | length=0.5 | 2 | 0.39 | 0.37 | -0.13 to 0.79 |
| fur-text | length=2 | 2 | 0.52 | 0.39 | 0.24 to 0.72 |
| grass-edges | density=2 | 2 | 0.20 | 0.13 | 0.07 to 0.39 |

## Download size

What the page fetches to show the effect, beyond the first-load bundle (8.1 kB gzipped, no shaders).

| Effect | Chunks | Own chunk (kB gzip) | Total (kB gzip) |
| --- | ---: | ---: | ---: |
| fur-text | 14 | 19.0 | 46.2 |
| grass-edges | 17 | 1.8 | 32.8 |
| grass-footer | 17 | 1.6 | 44.9 |
| grass-growth | 20 | 0.7 | 48.4 |
| lawn | 19 | 0.9 | 47.7 |
| meadow | 21 | 3.7 | 52.5 |
| mowing | 19 | 1.0 | 47.9 |
