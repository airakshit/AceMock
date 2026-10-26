"use server";

/**
 * Server-side TUS resource probe ("supported resource check" from the
 * recovery decision table).
 *
 * Given an existing TUS upload URL, this verifies — before the client
 * resumes — that the resource still exists, is reachable with a fresh
 * signed token, and returns its confirmed byte offset.
 *
 * This is what makes the SERVER the single source of truth for resume
 * decisions: local TUS fingerprints are never trusted.
 */

import { env } from "@/config/env/client";

export type TusProbeResult =
  | { ok: true; offsetBytes: number }
  | {
      ok: false;
      reason: "missing" | "unauthorized" | "unknown";
    };

export async function probeTusResource(
  uploadRef: string,
  uploadToken: string,
): Promise<TusProbeResult> {
  try {
    const response = await fetch(uploadRef, {
      method: "HEAD",
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${uploadToken}`,
        "x-signature": uploadToken,
        "Tus-Resumable": "1.0.0",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const offsetRaw = response.headers.get("upload-offset");
      const offsetBytes = offsetRaw === null ? 0 : Number(offsetRaw);
      return {
        ok: true,
        offsetBytes:
          Number.isFinite(offsetBytes) && offsetBytes >= 0 ? offsetBytes : 0,
      };
    }

    if (response.status === 404 || response.status === 410) {
      return { ok: false, reason: "missing" };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthorized" };
    }

    return {
      ok: false,
      reason: "unknown",
    };
  } catch (error) {
    console.error(`[tus-probe] HEAD failed for resource:`, error);
    return { ok: false, reason: "unknown" };
  }
}
