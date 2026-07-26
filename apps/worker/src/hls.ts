export interface VariantInfo {
  label: string;
  width: number;
  height: number;
  bandwidthBps: number;
}

/**
 * Build the HLS master playlist that points at each variant's index.m3u8.
 * Variants are listed low→high bandwidth so players pick a safe rung first.
 */
export function buildMasterPlaylist(variants: VariantInfo[]): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", ""];
  for (const v of [...variants].sort((a, b) => a.bandwidthBps - b.bandwidthBps)) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidthBps},RESOLUTION=${v.width}x${v.height}`
    );
    lines.push(`${v.label}/index.m3u8`);
  }
  return lines.join("\n") + "\n";
}

/** Even-numbered width for a target height, preserving the source aspect ratio. */
export function scaledWidth(
  sourceWidth: number,
  sourceHeight: number,
  targetHeight: number
): number {
  const w = Math.round((sourceWidth * targetHeight) / sourceHeight);
  return w % 2 === 0 ? w : w + 1;
}
