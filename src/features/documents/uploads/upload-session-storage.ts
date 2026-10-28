"use client";

/**
 * Metadata-only IndexedDB persistence for upload sessions.
 *
 * The browser NEVER stores file bytes here — only identity metadata
 * (server ids, probes, sizes, names) plus an optional File System Access
 * handle captured at pick time (Chromium: drag & drop). Restorable File
 * objects are re-obtained through that handle; everything else falls back
 * to the user re-selecting the file, verified by content probe.
 *
 * Keyed by documentId — the same document has exactly one attempt worth
 * storing (the active session).
 */

export interface PersistedSessionFile {
  /** document_files.id (server-side identity). */
  documentFileId: string;
  /** Client-side identity used inside Uppy meta. */
  clientFileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  /** Original File.lastModified — kept for handle-sourced re-hydration. */
  lastModified: number;
  /** Deterministic storage path in the bucket. */
  storagePath: string;
  /** Content fingerprint (see upload-probe.ts). */
  contentProbe: string;
  /**
   * File System Access handle captured on drag & drop (Chromium only).
   * null when nothing was capturable → the re-select fallback is used.
   */
  fileHandle: FileSystemFileHandle | null;
}

export interface PersistedUploadSessionRecord {
  documentId: string;
  sessionId: string;
  title: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  files: PersistedSessionFile[];
}

const DB_NAME = "ace-doc-upload-sessions";
const DB_VERSION = 1;
const STORE_NAME = "sessions";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "documentId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSessionRecord(
  record: PersistedUploadSessionRecord,
): Promise<void> {
  const db = await openDatabase();
  try {
    await runRequest(db, "readwrite", (store) => store.put(record));
  } finally {
    db.close();
  }
}

export async function loadSessionRecord(
  documentId: string,
): Promise<PersistedUploadSessionRecord | null> {
  const db = await openDatabase();
  try {
    const record = await runRequest(
      db,
      "readonly",
      (store) => store.get(documentId) as IDBRequest<PersistedUploadSessionRecord | undefined>,
    );
    return record ?? null;
  } finally {
    db.close();
  }
}

export async function deleteSessionRecord(documentId: string): Promise<void> {
  const db = await openDatabase();
  try {
    await runRequest(db, "readwrite", (store) => store.delete(documentId));
  } finally {
    db.close();
  }
}

/**
 * Purges persisted sessions for documents the server no longer lists —
 * e.g. deleted by the user or reclaimed by the abandonment cron. Called
 * by the documents list after each fetch (same spirit as the v1 sweep,
 * but metadata-only now).
 */
export async function sweepSessionRecords(
  knownDocumentIds: string[],
): Promise<void> {
  const known = new Set(knownDocumentIds);
  const db = await openDatabase();
  try {
    const allKeys = await runRequest(
      db,
      "readonly",
      (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>,
    );

    const staleKeys = allKeys.filter((key) => !known.has(String(key)));
    if (staleKeys.length === 0) return;

    await runRequest(db, "readwrite", (store) => {
      let lastRequest: IDBRequest<undefined> | undefined;
      for (const key of staleKeys) {
        lastRequest = store.delete(key) as IDBRequest<undefined>;
      }
      return lastRequest as IDBRequest<undefined>;
    });
  } finally {
    db.close();
  }
}

/**
 * Best-effort File System Access handle capture for a dropped file.
 * Returns null on non-Chromium browsers or any capture failure — the
 * re-select fallback covers those cases.
 */
export async function captureFileHandleFromDropItem(
  item: DataTransferItem,
): Promise<FileSystemFileHandle | null> {
  const maybeGetter = (
    item as { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }
  ).getAsFileSystemHandle;

  if (typeof maybeGetter !== "function") {
    return null;
  }

  try {
    const handle = await maybeGetter.call(item);
    if (handle && handle.kind === "file") {
      return handle as FileSystemFileHandle;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// FS Access permission gate (MDN pattern: query → request → getFile)
// ---------------------------------------------------------------------------

/** Minimal structural type — TS DOM lib versions differ here. */
interface PermissionCapableHandle {
  queryPermission?(
    descriptor: { mode: "read" | "readwrite" },
  ): Promise<PermissionState>;
  requestPermission?(
    descriptor: { mode: "read" | "readwrite" },
  ): Promise<PermissionState>;
}

/**
 * Ensures a persisted FS Access handle may be read BEFORE calling
 * `getFile()` on it.
 *
 * This is the recommended MDN pattern:
 *   1. `queryPermission({ mode: "read" })` — already granted?
 *   2. `requestPermission({ mode: "read" })` — only when it is not
 *      (Chromium reverts access to "prompted" between page loads, and
 *      calling `getFile()` in that state throws
 *      "Failed to execute 'getFile' on 'FileSystemFileHandle': The
 *      request is not allowed by the user agent or the platform in the
 *      current context").
 *   3. The caller invokes `getFile()` only after this resolves true.
 *
 * `requestPermission()` must run inside a user gesture: the restore path
 * always starts from the explicit "Resume Upload" click, so activation
 * is normally still alive; if it expired (e.g. a slow server round trip
 * in between), the request fails and the caller falls back to the
 * probe-verified re-select path.
 *
 * Never throws.
 */
export async function ensureFSHandleReadAccess(
  handle: FileSystemFileHandle,
): Promise<boolean> {
  const capable = handle as unknown as PermissionCapableHandle;

  // No permission API on this handle (older implementations): attempt
  // optimistically — getFile() itself will fail cleanly if needed.
  if (typeof capable.queryPermission !== "function") {
    return true;
  }

  try {
    if (
      (await capable.queryPermission.call(handle, { mode: "read" })) ===
      "granted"
    ) {
      return true;
    }
  } catch {
    return false;
  }

  // Not granted — explicitly request, but ONLY inside the resume user
  // gesture. A failure here must degrade to the re-select fallback.
  if (typeof capable.requestPermission !== "function") {
    return false;
  }

  try {
    return (
      (await capable.requestPermission.call(handle, { mode: "read" })) ===
      "granted"
    );
  } catch {
    return false;
  }
}

/**
 * BATCHED variant for whole-resume restores.
 *
 * The File System Access spec has no single "request access to N files"
 * call — one `requestPermission()` per handle — but batch WAVES of the
 * phase get the important benefits:
 *
 *   Phase 1 — ALL `queryPermission()` calls run concurrently first. No
 *   prompts, no User Activation needed, so already-granted handles are
 *   separated for free.
 *
 *   Phase 2 — ALL pending `requestPermission()` calls fire
 *   CONCURRENTLY inside the same User Activation (the "Resume Upload"
 *   click). Firing them together keeps every request well inside the
 *   activation window — a sequential request after hashing each file's
 *   probe could expire it and get denied — and Chromium coalesces /
 *   fast-fires the prompts natively (it serializes the dialogs but they
 *   all belong to one decision burst, so one "Allow" typically answers
 *   handles picked from the same picker/drop).
 *
 * Returns a granted boolean per input index (null handles count as
 * granted — nothing to prompt for; the restore path treats a missing
 * handle via its own fallback). Never throws.
 */
export async function ensureFSHandlesReadAccess(
  handles: Array<FileSystemFileHandle | null>,
): Promise<boolean[]> {
  const results: boolean[] = new Array<boolean>(handles.length).fill(false);

  // Phase 1: batched queries (no activation required).
  const pendingRequests: Array<Promise<void>> = [];
  const capableMap = new Map<number, PermissionCapableHandle>();

  handles.forEach((handle, index) => {
    if (!handle) {
      // Nothing to prompt for; the restore path ignores null handles.
      results[index] = true;
      return;
    }

    const capable = handle as unknown as PermissionCapableHandle;

    if (typeof capable.queryPermission !== "function") {
      // No permission API: attempt optimistically.
      results[index] = true;
      return;
    }

    pendingRequests.push(
      capable
        .queryPermission.call(handle, { mode: "read" })
        .then((state) => {
          if (state === "granted") {
            results[index] = true;
          } else {
            capableMap.set(index, capable);
          }
        })
        .catch(() => {
          results[index] = false;
        }),
    );
  });

  await Promise.all(pendingRequests);

  // Phase 2: batched requests, one shot, same activation.
  await Promise.all(
    Array.from(capableMap.entries()).map(([index, capable]) => {
      // Only non-null handles reach this map.
      const handle = handles[index] as FileSystemFileHandle;

      if (typeof capable.requestPermission !== "function") {
        return Promise.resolve();
      }

      return capable
        .requestPermission.call(handle, { mode: "read" })
        .then((state) => {
          results[index] = state === "granted";
        })
        .catch(() => {
          results[index] = false;
        });
    }),
  );

  return results;
}
