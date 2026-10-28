/**
 * Shared timing knobs for the document upload session flow.
 *
 * Consumed by BOTH the client uploader (browser) and server-side code
 * (service, Inngest cleanup) — must not import client-only modules.
 *
 * See UploadFlow.md at the project root for the full flow rationale.
 */

/**
 * Absolute recovery window: how long an ACTIVE upload session may be
 * resumed after its last mutation. This is client-agnostic and enforced
 * server-side (sessions outside it are abandoned).
 */
export const UPLOAD_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * How often the uploading client pings `heartbeatUploadSession`.
 */
export const UPLOAD_HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * A session whose heartbeat is older than this is considered INTERRUPTED
 * (client lost — browser closed / crashed). Still recoverable, but the UI
 * switches from the live spinner to the "Resume upload" affordance.
 */
export const UPLOAD_HEARTBEAT_STALE_MS = 120_000;

/**
 * Providers expire TUS upload resources after 24h. A stored `upload_ref`
 * older than this is presumed dead WITHOUT a network probe, and the file
 * takes the safe re-upload path (same storagePath, x-upsert: true).
 * Slightly smaller than 24h for clock-skew safety.
 */
export const UPLOAD_TUS_RESOURCE_LIFETIME_MS = 23.5 * 60 * 60 * 1000;

export const UPLOAD_MAX_CONCURRENCY = 4;
