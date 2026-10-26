"use client";

/**
 * Content probe — the ONLY identity check trusted for re-selected files.
 *
 * A filename/size match is never sufficient (an edited file can keep both),
 * so resumable uploads verify content with a cheap, deterministic hash:
 *
 *   size <= 512 KiB  →  SHA-256(fileSize || whole file)
 *   size >  512 KiB  →  SHA-256(fileSize || first 256 KiB || last 256 KiB)
 *
 * `fileSize` is serialized as 8 big-endian bytes to avoid any ambiguity
 * between the length prefix and content bytes.
 *
 * The probe is computed ONCE when the user selects a file (sent to
 * `createDocument`, persisted in the session record, and re-computed on a
 * re-select to prove identity) — it is never stored for the original File
 * bytes themselves.
 */

const PROBE_CHUNK_BYTES = 256 * 1024; // first/last slice size
const PROBE_WHOLE_FILE_LIMIT_BYTES = 512 * 1024;

export async function computeContentProbe(file: File): Promise<string> {
  const sizeBytes = new Uint8Array(8);
  new DataView(sizeBytes.buffer).setBigUint64(
    0,
    BigInt(file.size),
    false, // big-endian
  );

  let contentBytes: Uint8Array;

  if (file.size <= PROBE_WHOLE_FILE_LIMIT_BYTES) {
    contentBytes = new Uint8Array(await file.arrayBuffer());
  } else {
    const [head, tail] = await Promise.all([
      file
        .slice(0, PROBE_CHUNK_BYTES)
        .arrayBuffer(),
      file
        .slice(file.size - PROBE_CHUNK_BYTES)
        .arrayBuffer(),
    ]);

    contentBytes = new Uint8Array(head.byteLength + tail.byteLength);
    contentBytes.set(new Uint8Array(head), 0);
    contentBytes.set(new Uint8Array(tail), head.byteLength);
  }

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array([...sizeBytes, ...contentBytes]),
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Strict re-select verification: the user-picked file must prove it is the
 * same content the session expects (probe match) — filename/size matches
 * alone NEVER continue a session.
 */
export async function isProbeVerified(
  file: File,
  expectedProbe: string | null,
): Promise<boolean> {
  if (!expectedProbe) return false;
  const actualProbe = await computeContentProbe(file);
  return actualProbe === expectedProbe;
}
