// Tiny structured-ish logger — enough to follow a job through the pipeline
// without pulling in a logging framework for the MVP.
function ts() {
  return new Date().toISOString();
}

export const log = {
  info: (msg: string, meta?: unknown) =>
    console.log(`[${ts()}] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
  warn: (msg: string, meta?: unknown) =>
    console.warn(`[${ts()}] WARN ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
  error: (msg: string, meta?: unknown) =>
    console.error(`[${ts()}] ERROR ${msg}${meta ? " " + JSON.stringify(meta) : ""}`),
};

// Scoped logger that prefixes every line with the video id.
export function jobLogger(videoId: string) {
  const tag = `video=${videoId}`;
  return {
    info: (msg: string, meta?: unknown) =>
      log.info(`${tag} ${msg}`, meta),
    warn: (msg: string, meta?: unknown) =>
      log.warn(`${tag} ${msg}`, meta),
    error: (msg: string, meta?: unknown) =>
      log.error(`${tag} ${msg}`, meta),
  };
}
