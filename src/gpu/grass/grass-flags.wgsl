// The grass recipe's parts, each switchable for story 2.9's ablation. Twin of FLAGS in field.ts.

const CLUMPS: u32 = 1u;
const VARIATION: u32 = 2u;
const DRY: u32 = 4u;
const TRANSLUCENCY: u32 = 8u;
const SHEEN: u32 = 16u;
const ROUNDED: u32 = 32u;
const CANOPY: u32 = 64u;
const GUSTS: u32 = 128u;
const CLOUDS: u32 = 256u;
const FOG: u32 = 512u;

fn has(flags: u32, bit: u32) -> bool {
  return (flags & bit) != 0u;
}
