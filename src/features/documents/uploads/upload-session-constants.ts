/**
 * Shared timing knobs for the document upload session flow.
 *
 * Consumed by BOTH the client uploader (browser) and server-side code
 * (service, Inngest cleanup) — must not import client-only modules.
 */


export const UPLOAD_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * Providers expire TUS upload resources after 24h. A stored `upload_ref`
 * older than this is presumed dead.
 * Slightly smaller than 24h for clock-skew safety.
 */
export const UPLOAD_TUS_RESOURCE_LIFETIME_MS = 23.5 * 60 * 60 * 1000;

export const UPLOAD_HEARTBEAT_INTERVAL_MS = 25_000;
export const UPLOAD_HEARTBEAT_STALE_MS = 120_000;

export const UPLOAD_MAX_CONCURRENCY = 4;
