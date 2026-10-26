import { describe, expect, it } from "vitest";

/**
 * Unit tests for the pure/shared parts of the server-owned upload session
 * flow (UploadFlow.md).
 *
 * Browser-bound pieces (IndexedDB session storage, Web Locks, the Uppy
 * coordinator) are exercised by the manual test script in UploadFlow.md.
 * What is testable outside a browser:
 *   1. the timing knobs (heartbeat / staleness / recovery window / TUS
 *      resource lifetime),
 *   2. the content probe (SHA-256 over size + head/tail slices),
 *   3. the recovery decision table (§11) as a pure function.
 */

import {
  UPLOAD_HEARTBEAT_INTERVAL_MS,
  UPLOAD_HEARTBEAT_STALE_MS,
  UPLOAD_RECOVERY_WINDOW_MS,
  UPLOAD_TUS_RESOURCE_LIFETIME_MS,
  UPLOAD_MAX_CONCURRENCY,
} from "../src/features/documents/uploads/upload-session-constants";
import {
  computeContentProbe,
  isProbeVerified,
} from "../src/features/documents/uploads/upload-probe";
import {
  decideFileRecoveryAction,
  type RecoveryFileSnapshot,
  type TusProbeOutcome,
} from "../src/features/documents/uploads/recovery-decision";

// ---------------------------------------------------------------------------
// Timing knobs
// ---------------------------------------------------------------------------

describe("upload session timing", () => {
  it("recovery window is the full 24h the plan specifies", () => {
    expect(UPLOAD_RECOVERY_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("TUS resource lifetime sits strictly under the provider's 24h Tus expiry", () => {
    // A stored reference older than this is presumed dead WITHOUT probing
    // (token renewal does NOT extend the TUS resource lifetime).
    expect(UPLOAD_TUS_RESOURCE_LIFETIME_MS).toBeLessThan(24 * 60 * 60 * 1000);
    expect(UPLOAD_TUS_RESOURCE_LIFETIME_MS).toBeGreaterThan(0);
  });

  it("stale threshold clears 2+ missed heartbeats (interrupted, not glitch)", () => {
    expect(UPLOAD_HEARTBEAT_STALE_MS).toBeGreaterThanOrEqual(
      UPLOAD_HEARTBEAT_INTERVAL_MS * 2,
    );
  });

  it("heartbeat interval keeps the session well inside the stale window", () => {
    expect(UPLOAD_HEARTBEAT_INTERVAL_MS).toBe(25_000);
    expect(UPLOAD_HEARTBEAT_STALE_MS).toBe(120_000);
  });

  it("matches the Uppy per-batch concurrency limit (3 files)", () => {
    expect(UPLOAD_MAX_CONCURRENCY).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Content probe
// ---------------------------------------------------------------------------

describe("content probe", () => {
  const bytes = (n: number, seed = 7) => {
    const arr = new Uint8Array(n);
    let x = seed;
    for (let i = 0; i < n; i++) {
      x = (x * 31 + 17) % 251;
      arr[i] = x;
    }
    return arr;
  };

  const makeFile = (
    data: Uint8Array,
    name = "original.pdf",
    type = "application/pdf",
  ) =>
    new File([new Uint8Array(data)], name, {
      type,
      lastModified: 1_700_000_000_000,
    });

  it("is stable across renames and re-selections of the same content", async () => {
    const data = bytes(10_000);
    const a = await computeContentProbe(makeFile(data, "a.pdf"));
    const b = await computeContentProbe(makeFile(data, "totally-different-name.pdf"));

    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // hex SHA-256
  });

  it("separates files of identical size but different content", async () => {
    const a = await computeContentProbe(makeFile(bytes(10_000, 7)));
    const b = await computeContentProbe(makeFile(bytes(10_000, 8)));

    expect(a).not.toBe(b);
  });

  it("changes when any probed byte changes (small file, whole-file hash)", async () => {
    const original = bytes(600, 3);
    const edited = Uint8Array.from(original);
    edited[200] ^= 0xff;

    const a = await computeContentProbe(makeFile(original));
    const b = await computeContentProbe(makeFile(edited));

    expect(a).not.toBe(b);
  });

  it("changes when head or tail bytes change (large-file head/tail hash)", async () => {
    const original = bytes(600_000, 5); // > 512 KiB
    const editedHead = Uint8Array.from(original);
    editedHead[10] ^= 0xff;
    const editedTail = Uint8Array.from(original);
    editedTail[editedTail.length - 10] ^= 0xff;

    const base = await computeContentProbe(makeFile(original));
    expect(await computeContentProbe(makeFile(editedHead))).not.toBe(base);
    expect(await computeContentProbe(makeFile(editedTail))).not.toBe(base);
  });

  it("hashes the whole content when the file is <= 512 KiB", async () => {
    const original = bytes(511 * 1024, 9);
    const edited = Uint8Array.from(original);
    // 256 KiB into the file — INSIDE the head slice only if large-file mode;
    // for whole-file hashing ANY interior change must be detected.
    edited[300 * 1024] ^= 0xff;

    const a = await computeContentProbe(makeFile(original));
    const b = await computeContentProbe(makeFile(edited));

    expect(a).not.toBe(b);
  });

  it("empty files get a deterministic probe too", async () => {
    const empty = await computeContentProbe(makeFile(new Uint8Array(0)));
    expect(empty).toMatch(/^[0-9a-f]{64}$/);
  });

  it("re-select verification accepts only exact content", async () => {
    const original = bytes(1_000, 4);
    const probe = await computeContentProbe(makeFile(original));

    const impostor = makeFile(bytes(1_000, 5), "original.pdf");

    expect(await isProbeVerified(makeFile(original), probe)).toBe(true);
    expect(await isProbeVerified(impostor, probe)).toBe(false);
    // Filename/size matches alone are never trusted — no probe, no pass.
    expect(await isProbeVerified(makeFile(original), null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Recovery decision table (§11)
// ---------------------------------------------------------------------------

describe("recovery decision table", () => {
  const snapshot = (
    over: Partial<RecoveryFileSnapshot> = {},
  ): RecoveryFileSnapshot => ({
    uploadStatus: "uploading",
    uploadRef: "https://tus.example/resource",
    isReferenceWithinProviderLifetime: true,
    ...over,
  });

  it("uploaded → verify-commit (no transfer, verification at commit)", () => {
    expect(
      decideFileRecoveryAction(snapshot({ uploadStatus: "uploaded" }), null),
    ).toBe("verify-commit");
  });

  it("completed → skip (terminal, never revived)", () => {
    expect(
      decideFileRecoveryAction(snapshot({ uploadStatus: "completed" }), null),
    ).toBe("skip");
  });

  it("uploading + live resource probe → resume", () => {
    expect(
      decideFileRecoveryAction(snapshot(), {
        ok: true as const,
        offsetBytes: 654_321,
      }),
    ).toBe("resume");
  });

  it("uploading + resource gone (404/410) → reupload", () => {
    expect(
      decideFileRecoveryAction(snapshot(), {
        ok: false,
        reason: "missing",
      }),
    ).toBe("reupload");
  });

  it("uploading + probe refused (401/403) → reupload, not a blind resume", () => {
    expect(
      decideFileRecoveryAction(snapshot(), {
        ok: false,
        reason: "unauthorized",
      }),
    ).toBe("reupload");
  });

  it("uploading + unknown HEAD failure → safe reupload", () => {
    expect(
      decideFileRecoveryAction(snapshot(), { ok: false, reason: "unknown" }),
    ).toBe("reupload");
  });

  it("uploading + outside provider TUS lifetime → presumptively dead, reupload", () => {
    const expired = snapshot({ isReferenceWithinProviderLifetime: false });

    // Validity unknown (no probe) → cheap lifetime pre-check wins.
    expect(decideFileRecoveryAction(expired, null)).toBe("reupload");
    // Even a "valid" probe is not trusted for an expired-lifetime reference.
    expect(
      decideFileRecoveryAction(expired, {
        ok: true as const,
        offsetBytes: 1,
      }),
    ).toBe("reupload");
  });

  it("uploading + no stored reference → reupload", () => {
    expect(
      decideFileRecoveryAction(snapshot({ uploadRef: null }), null),
    ).toBe("reupload");
  });

  it("pending (never started) → reupload with fresh credentials", () => {
    expect(
      decideFileRecoveryAction(snapshot({ uploadStatus: "pending" }), null),
    ).toBe("reupload");
  });

  it("failed / cancelled / expired → safe reupload path", () => {
    for (const status of ["failed", "cancelled", "expired"] as const) {
      expect(
        decideFileRecoveryAction(snapshot({ uploadStatus: status }), null),
      ).toBe("reupload");
    }
  });

  it("an over-probing server must never 'resume' a terminal session", () => {
    // Even a maximally-positive probe signature cannot rescue terminal rows.
    const positiveProbe: TusProbeOutcome = { ok: true, offsetBytes: 42 };
    expect(
      decideFileRecoveryAction(
        snapshot({ uploadStatus: "completed" }),
        positiveProbe,
      ),
    ).toBe("skip");
    expect(
      decideFileRecoveryAction(
        snapshot({ uploadStatus: "uploaded" }),
        positiveProbe,
      ),
    ).toBe("verify-commit");
  });
});
