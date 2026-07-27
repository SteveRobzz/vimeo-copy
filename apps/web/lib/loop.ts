// Small presentational helpers for the Loop theme (colors + thumbnail URLs).

// Deterministic hue from a string, so a given channel/title always maps to the
// same avatar / placeholder color.
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function avatarColors(seed: string): { bg: string; fg: string } {
  const hue = hueFromString(seed);
  return { bg: `oklch(0.9 0.05 ${hue})`, fg: `oklch(0.32 0.09 ${hue})` };
}

// Diagonal stripe fill used as a thumbnail placeholder when there's no poster.
export function stripeBg(seed: string): string {
  const hue = hueFromString(seed);
  return `repeating-linear-gradient(115deg, oklch(0.93 0.015 ${hue}), oklch(0.93 0.015 ${hue}) 10px, oklch(0.9 0.018 ${hue}) 10px, oklch(0.9 0.018 ${hue}) 20px)`;
}

export function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}
