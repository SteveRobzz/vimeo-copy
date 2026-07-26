// Shared contracts used by BOTH the web app (job producer) and the worker
// (job consumer). Keeping these here is the main reason this is a monorepo:
// if the job payload shape drifts between the two sides, TypeScript catches it.

export const QUEUE_NAMES = {
  TRANSCODE: "transcode",
} as const;

export const JOB_NAMES = {
  TRANSCODE_VIDEO: "transcode-video",
} as const;

/** Payload the web app enqueues and the worker consumes. Keep this minimal —
 *  the worker re-reads authoritative state from Postgres by videoId. */
export interface TranscodeJobData {
  videoId: string;
  sourceObjectKey: string;
}

/** A single rung of the quality ladder. The worker skips any rung whose height
 *  exceeds the source height (never upscale). */
export interface LadderRung {
  label: string;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
}

/** Default H.264 ladder. Tunable later; VMAF (stretch goal) can validate it. */
export const QUALITY_LADDER: LadderRung[] = [
  { label: "360p", height: 360, videoBitrateKbps: 800, audioBitrateKbps: 96 },
  { label: "480p", height: 480, videoBitrateKbps: 1400, audioBitrateKbps: 128 },
  { label: "720p", height: 720, videoBitrateKbps: 2800, audioBitrateKbps: 128 },
  { label: "1080p", height: 1080, videoBitrateKbps: 5000, audioBitrateKbps: 192 },
];
