# Document Upload Sessions — Architecture & Data Flows (v2)

Resumable, direct-to-Supabase document uploads. The **server owns every upload
attempt** as an *upload session*; the browser is a dumb executor that holds
files and TUS connections in memory, persists nothing but identity metadata,
and never decides who may resume.

> **The Uppy TUS fingerprint is completely abandoned.** No fingerprint is
> stored, trusted, or consulted (`storeFingerprintForResuming: false`). All
> resume decisions come from server actions that return per-file recovery
> plans (§ Recovery algorithm).

---

## 1. Tech stack & invariants

| Concern | Choice |
| --- | --- |
| Framework | Next.js App Router, Server Actions |
| Storage | Supabase Storage (TUS protocol endpoints) |
| Client uploader | Uppy `@uppy/tus` (chunk ≤ 6 MiB, max 3 concurrent files, `x-upsert: true`) |
| Client persistence | IndexedDB **metadata only** (ids, probes, sizes, FS handles). **Never file bytes.** |
| Cross-tab claim | Web Locks: `upload-session:{documentId}` |
| Liveness | heartbeat every 25 s; stale > 120 s |
| Resumability window | 24 h (`recovery_expires_at`, absolute) |
| Provider facts (verified against Supabase docs) | signed TUS token lives 2 h; an incomplete TUS upload expires after ~24 h; token renewal does **not** extend a TUS resource |
| Content identity | SHA-256 content probe (`fileSize ‖ first 256 KiB ‖ last 256 KiB`; whole file when ≤ 512 KiB) |

Rules enforced by this design:

- **R1 — auto-continue within one live session**: network blips recover
  inside the same session/tabs without user action (Uppy retry delays +
  coordinator heartbeat).
- **R2 — resume ONLY on explicit user click** (“Resume Upload” on the card);
  the click runs `resumeDocumentUploadAction` and obeys its plan.
- **R3 — a new attempt never hijacks or revives an abandoned session.** A new
  document attempt is a new upload session; terminal sessions are never
  revived (partial unique index + terminal guards).
- **R4 — at most one ACTIVE session per document** (partial unique index,
  DB-level).
- **R5 — a document cannot claim resumability from a client fingerprint.**
  Re-select verification is content-probe based; filename/size matches alone
  are insufficient.

---

## 2. Database schema (drizzle)

### `upload_sessions` (new, migration 0023)

```
id                  uuid PK
user_id             uuid NOT NULL → user (cascade)
document_id         uuid NOT NULL → documents (cascade)
status              upload_session_status_enum NOT NULL DEFAULT 'active'
                    ('active' | 'completed' | 'abandoned' | 'cancelled')
last_heartbeat_at   timestamptz NOT NULL DEFAULT now()
recovery_expires_at timestamptz NOT NULL            -- created_at + 24h
progress            jsonb DEFAULT '{}'              -- per-file progress cache
created_at          timestamptz NOT NULL DEFAULT now()
ended_at            timestamptz NULL
end_reason          text NULL
```

Partial unique index — the R4 business rule at the DB level:

```
uq_active_upload_session_per_document
  UNIQUE (document_id) WHERE status = 'active'
```

### `document_files` (changed)

| Column | Change |
| --- | --- |
| `upload_status` | enum extended: `pending, uploading, uploaded, completed, failed, cancelled, expired`; default now `'pending'` |
| `session_id` (new) | uuid NULL → `upload_sessions.id`, ON DELETE SET NULL. Binds the file to the attempt that owns it. |
| `content_probe` (new) | text NULL — client-computed content fingerprint stored server-side for re-select verification |
| `upload_ref` (new) | text NULL — **suggested column**: the TUS resource URL persisted via `saveUploadReference`. Required by the recovery algorithm (§8.2/§11). |
| `upload_ref_created_at` (new) | timestamptz NULL — **suggested column**: when the TUS resource was created. Providers expire TUS uploads after ~24 h; this is the cheap lifetime pre-check before spending a network probe. |
| `last_activity_at` | **removed** (superseded by session-level `last_heartbeat_at`) |

### Session state machine

```
            createDocument
                 │  (status='active', recovery_expires_at=now+24h)
                 ▼
   ┌───────── active ─────────┐
   │   live = fresh heartbeat │
   │   interrupted = stale    │
   ▼            │              ▼
completed   heartbeat stops    abandoned (recovery window elapsed)
(verify     & user resumes     (cron sweep or lazy expiry on any touch)
 bytes ✔)   → R2 path
                │
                ▼ (explicit user cancel)
            cancelled
```

- `completed` / `abandoned` / `cancelled` are **terminal**; nothing revives
  them (`updateStatus` stamps `ended_at` + `end_reason`, guards are
  idempotent).
- `live` / `interrupted` / `expired` are *derived views* of an `active`
  session (heartbeat freshness / recovery window), never stored.

### File state machine (per session)

```
pending ──(TUS resource created, saveUploadReference)──▶ uploading
uploading ──(final offset confirmed, completeDocumentFileUpload)──▶ uploaded
uploaded ──(storage verification ✔, completeUploadSession)──▶ completed
any live state ──(terminal failure of attempt)──▶ cancelled | expired | failed

Network error is NOT a file state: it keeps the file "uploading" and is
recovered by retry (R1) or resume (R2).
```

---

## 3. Where everything lives

```
src/db/schemas/documents/upload-sessions.ts        table + enum + partial unique index
src/db/schemas/documents/document-files.ts         files (+ probe/refs/session_id)
drizzle/0023_upload_sessions_and_file_lifecycle.sql

src/features/documents/
  service.ts                                       all session services (§5)
  actions/types.ts                                 payloads/responses (contract §6)
  actions/create-document.ts                       createDocumentAction
  actions/save-upload-reference.ts                 saveUploadReferenceAction
  actions/heartbeat-upload-session.ts              heartbeatUploadSessionAction
  actions/get-upload-session-status.ts             getUploadSessionStatusAction
  actions/resume-document-upload.ts                resumeDocumentUploadAction
  actions/complete-document-file-upload.ts         completeDocumentFileUploadAction
  actions/complete-upload-session.ts               completeUploadSessionAction
  actions/cancel-upload-session.ts                 cancelUploadSessionAction
  repositories/upload-sessions.repository.ts       session CRUD/queries
  repositories/documents.repository.ts             files (incl. saveUploadReference,
                                                   reconcileVerifiedFiles)
  uploads/upload-session-constants.ts              timing knobs (25s/120s/24h/3)
  uploads/upload-probe.ts                          SHA-256 probe + isProbeVerified
  uploads/upload-session-storage.ts                metadata-only IndexedDB + sweep
  uploads/upload-coordinator.ts                    Web Lock owner: heartbeat, ref-sync,
                                                   per-file complete, session commit
  uploads/recovery-decision.ts                     §11 decision table (pure, tested)
  uploads/document-uploader-provider.tsx           owns Uppy; create/resume/reselect flows
  uploads/use-document-uploader.ts                 Uppy bindings (addFiles, credentials…)
  uploads/create-uppy.ts                           6 MiB chunks, x-upsert, no fingerprints
                                                   + immediate upload-ref sync hook (§4.2)
  components/DocumentForm.tsx                      orchestration + reselect UI
  components/DocumentCard.tsx                      staleness from session heartbeat
  components/FileDropzone.tsx                      FS handle capture (drag & drop + FS Access picker)
src/lib/supabase/tus-probe.ts                      server-side HEAD probe of a TUS ref
src/inngest/functions/v1/cleanup-stale-uploads/    24h abandonment sweep (hourly cron)
tests/resumable-uploads.test.ts                    unit tests (constants, probe, §11)
```

---

## 4. The upload session coordinator (browser)

One coordinator runs per in-flight attempt, **inside the Web Lock callback**
so the lock is held for its entire lifetime:

```
navigator.locks.request(`upload-session:${documentId}`, { ifAvailable: true },
  async (lock) => {
    if (!lock) → refuse: "upload is already running in another tab"
    …coordinator loop…
  })
```

While holding `upload-session:{documentId}` the coordinator:

1. **Heartbeats** `heartbeatUploadSessionAction` every **25 s** with a
   per-file progress snapshot (`{documentFileId, status, offsetBytes}`) —
   derived from Uppy file state, never from fingerprints.
2. **Ref-sync** (two paths, mutually idempotent via
   `serverFileId:uploadRef` keys in the coordinator):
   - **Immediate (authoritative)**: tus-js-client invokes the per-file
     `onUploadUrlAvailable` callback inside `_createUpload`
     synchronously right after the create request returns `201` and the
     client parses its `Location` header — i.e., **the moment the TUS
     endpoint exists**, before any chunk is sent. `setCredentials`
     attaches a per-file closure per file (`attachOnUploadUrlAvailable`
     in `create-uppy.ts`, carried to tus-js-client through @uppy/tus's
     per-file merge `...(file.tus || {})`), which reads the fresh URL
     from the plugin's public `uploaders[uppyFileId].url` (assigned
     before the callback fires) and dispatches (`serverFileId`, URL)
     into the coordinator's `saveUploadRef`. Without this, a queued
     file's ref could stay server-unknown for a full heartbeat cycle,
     and a tab close in that window would degrade a perfectly good ~24h
     resource to the re-upload path.
     Fire-and-forget by construction — the sink owns the server action,
     the callback itself never delays a request.
     Resumed resources are unaffected: `_createUpload` only runs for
     fresh creates and upload-retry fallbacks; resuming an EXISTING
     resource via HTTP HEAD does not fire the hook, and those refs are
     already server-owned anyway.
   - **Fallback sweep**: the heartbeat tick still pushes any
     `file.tus.uploadUrl` known to Uppy's file state that the immediate
     hook has not covered (restored states, plugin-version gaps) —
     deduped by the same key inside `saveUploadRef`.
   The uppy option merge (`...(file.tus || {})`) is the ONLY per-file
   channel the plugin gets (both continuation URLs and the immediate
   ref-sync callback live per file); nothing is read from
   `localStorage`. The sink is registered per active coordinator via
   `setUploadRefHandler` (WeakMap keyed by the uppy instance — no
   React refs); no handler registered → only the fallback sweep runs.
3. **Per-file completion**: Uppy `upload-success` →
   `completeDocumentFileUploadAction` (uploading → uploaded).
4. **Commit**: Uppy `complete` with zero failures → awaits all in-flight
   completions → `completeUploadSessionAction` → on success the IndexedDB
   record is deleted; on unreconciled files the user is told to re-upload.
5. **pagehide flush**: one last heartbeat (progress snapshot only) so a
   tab close leaves the freshest offsets behind.

Failures inside the heartbeat (server said “terminal / expired”) end the
lifecycle gracefully with a toast; the session on the server already decided
that.

---

## 5. Server action contracts

All actions follow the repo pattern (`requireSession`, `ServerActionError`,
`handleActionError` → `ServerActionResult<T>`). Exact payload/response shapes:
`src/features/documents/actions/types.ts`.

| Action | Semantics |
| --- | --- |
| `createDocumentAction` | Creates document + files (+ `contentProbe` per file) + the ACTIVE session in ONE transaction; mints short-lived signed TUS credentials after commit. Response: `{documentId, sessionId, files: SignedUrlResponseObject[]}`. |
| `saveUploadReferenceAction` | Stores the client’s TUS resource URL for one file (`session_id`-scoped, ownership-checked), `pending → uploading`. Rejects non-active sessions (409). |
| `heartbeatUploadSessionAction` | Refreshes `last_heartbeat_at` (and the progress cache). **409** when the session is terminal or its recovery window elapsed (lazy abandonment). |
| `getUploadSessionStatusAction` | Read-only: the document’s relevant session (active one, else most recent terminal one). |
| `resumeDocumentUploadAction` | THE recovery algorithm (§7). Accepts only explicit user intent (the card button). Returns `canResume`, `reason ∈ {no-session, session-terminal, session-expired}` or a per-file plan. |
| `completeDocumentFileUploadAction` | `uploading → uploaded` for one file. Idempotent; scoped to the session. |
| `completeUploadSessionAction` | Verifies every `uploaded` file actually exists in storage (`objectExists`), flips verified files `uploaded → completed`, then marks the session **completed** (terminal). Reports `unreconciledFiles` (verification failures are demoted to `failed` and the session stays open for recovery). |
| `cancelUploadSessionAction` | Explicit user cancel — terminal immediately (409-safe, idempotent). In-flight files → `cancelled`; their partial storage folders are deleted best-effort; uploaded files keep their bytes (deleting user data on cancel would be destructive). |

Why tokens are minted *after* the create commit: if minting fails, the
session already exists — the client recovers through
`resumeDocumentUploadAction` instead of racing a second attempt.

---

## 6. Client flows

### 6.1 Normal upload (happy path)

```
User picks files (click or drag & drop)
  → click: File System Access picker (Chromium) returns restorable handles
    for every picked file; legacy input is used elsewhere
  → drop: dropzone captures FS handles from DataTransferItems where supported
    (Chromium drag & drop) and generates clientFileIds. In memory only.
User submits (Create)
  → DocumentForm computes the content probe per file (SHA-256)
  → createDocumentAction({title, description, files+probes})
      server: doc + files + ACTIVE session (one transaction) → signed URLs
  → beginUploadSession:
      • persist IndexedDB record (metadata + FS handles — no bytes)
      • uppy.addFiles + setCredentials(credentials, documentId)
        (attaches the per-file onUploadUrlAvailable ref-sync callback)
      • coordinator.start() — Web Lock acquired
      • uppy.upload() — TUS: POST → 201 + Location →
        onUploadUrlAvailable → saveUploadReference fires IMMEDIATELY
        (server owns the ref before any chunk) →
        PATCH chunks (≤6 MiB, 3 concurrent)
  → per-file: upload-success → completeDocumentFileUploadAction
  → batch complete → completeUploadSessionAction → session COMPLETED
  → IndexedDB record deleted; router.refresh() shows "uploaded/completed".
```

### 6.2 Network failure during upload (R1, same session, no user action)

```
chunk PATCH fails → tus client retries per retryDelays [0,3s,5s,10s,20s]
  → if browser fires offline event: uppy.pauseAll(); resumeAll() on online
  → heartbeats may fail: coordinator only logs (transient), next tick retries
  → restore: tus PATCH continues at the resource's Upload-Offset
  → in-memory session keeps running; NO file is ever marked "failed" by a
    network error; no server state change.
```

### 6.3 Browser / tab close (mid-transfer)

```
pagehide → one flushed heartbeat (fresh offsets)
lock released automatically; heartbeats stop.
Server view: session stays active, last_heartbeat_at freezes.
  Derived states: interrupted (heartbeat >120s stale) → later abandoned
  (recovery window elapsed at 24h).
Card shows "Upload Interrupted" + Resume Upload button (R2 only).
Client leftovers: IndexedDB record (metadata + FS handles). No bytes stored.
```

Two tabs racing: the second tab’s lock request resolves `null` → it refuses
with "already running in another tab" and nothing races the storage.

### 6.4 Explicit resume (R2 — user clicked)

```
Resume Upload click → startResume(documentId)
  → resumeDocumentUploadAction        ← ALL eligibility decided SERVER-side
  → per-file plan (§7) + fresh 2h tokens + document meta
  → provider loads IndexedDB record:
      • FS-handle files: queryPermission → requestPermission (resume
        click gesture, only if not already granted) → handle.getFile() →
        probe re-verified →
        addFiles + setCredentials + (plan="resume") inject
        uppy.setFileState(id, {tus: {uploadUrl: plan.uploadRef}})
      • files without handles → reselect UI
  → files with probe-matched bytes: upload continues the server-probed TUS
    resource at plan.offsetBytes (or reuploads from scratch, incl. x-upsert)
  → reselect rows: user picks the file again → isProbeVerified (exact
    content expected) → enqueued with the same server plan → batch resumes.
  → One active session keeps its identity; no new session is created.
```

Notably **nothing** about the continuation depends on client fingerprints:
the TUS URL to continue comes from `document_files.upload_ref`, HEAD-probed
and re-authorized server-side with a fresh token.

### 6.5 Re-select fallback (no handle available)

Only picks that could not yield a handle need re-selection: the legacy
`<input type="file">` path on browsers without the File System Access API
(click-picks there) and non-Chromium browsers — the persisted record
therefore stores only the probe. A handle whose read permission was
refused on resume (the MDN query → request flow returned non-granted, e.g.
user dismissal) also lands here. On re-select the probe proves identity
(same fingerprint as stored, or the server plan's `contentProbe`); wrong
file → red toast, nothing starts.

### 6.6 User cancel

An explicit cancel (card menu → Planned / `cancelUploadSessionAction`):
session → `cancelled` (terminal), in-flight files → `cancelled`, partial
folders deleted. Already-uploaded files keep their bytes (safe cleanup
policy). The IndexedDB record is swept by the next `notifyKnownDocuments`
pass or on document deletion.

### 6.7 Abandonment + cleanup (R3 enforcement, cron)

```
Inngest hourly cron (cleanup-abandoned-upload-sessions):
  find ACTIVE sessions with recovery_expires_at < now
  per session (Inngest steps):
    • mark non-terminal files 'failed'
    • delete partial storage folders + direct objects (best-effort)
    • session → 'abandoned' (ended_at, end_reason='recovery-window-elapsed')
Document row is KEPT so the attempt remains visible and deletable by the user.
Lazy abandonment also happens on touch: any heartbeat / resume call against
an expired session flips it and 409s.
```

---

## 7. Recovery decision table (the §11 table, implemented in `recovery-decision.ts`)

Inputs: file row (status, `upload_ref`, `upload_ref_created_at`) + optional
server-side HEAD probe result.

| File status | TUS reference condition | Probe (HEAD with fresh token) | Decision |
| --- | --- | --- | --- |
| `completed` | — | — | **skip** (terminal) |
| `uploaded` | — | — | **verify-commit** (no transfer; verified at commit) |
| `uploading` | ref exists within provider lifetime (≤23.5 h old) | `200` + `Upload-Offset: N` | **resume** — continue at N with the same ref |
| `uploading` | ref exists within lifetime | `404/410` (resource gone) | **reupload** (same storagePath, x-upsert) |
| `uploading` | ref exists within lifetime | `401/403` | **reupload** with fresh credentials |
| `uploading` | ref exists within lifetime | unknown HEAD failure | **reupload** (safe) |
| `uploading` | older than provider lifetime | *(no probe — cheap check)* | **reupload** (token renewal never extended the resource) |
| `uploading` | no stored ref | — | **reupload** |
| `pending` | — | — | **reupload** (first transfer) |
| `failed` | any | — | **reupload** while the session is still in-window |
| `cancelled` / `expired` | — | — | **reupload** only via a NEW attempt (cancelled) — `expired` marks safe reupload in-session |

Two guarantees fall out:

1. **Validity unknown → the server performs a resource check** (HEAD with a
   re-minted token) *before* returning instructions; the client never probes.
2. **Network error ≠ failed** — no table row ever transitions a file to
   `failed` because a chunk didn’t land.

The probe (`src/lib/supabase/tus-probe.ts`) sends
`HEAD {uploadRef}` with `Authorization: Bearer`, `x-signature`,
`apikey`, `Tus-Resumable: 1.0.0` and reads `Upload-Offset`.

---

## 8. Identity & security

- Every action re-verifies ownership (`user_id` on the document/session).
- Session/file scoping: file mutations require BOTH the session id and the
  document id to match the file row.
- Signed TUS tokens are 2 h and only exist in memory; `uploadToken` is
  never sent as TUS metadata (`ALLOWED_METADATA_FIELDS`).
- The probe is executed server-side with a freshly minted token — the client
  never sees long-lived credentials.
- Content probes are stored server-side; a re-select must present the exact
  content (`isProbeVerified`) before continuing.
- Storage paths are deterministic (`user/{u}/documents/{d}/files/{f}/{name}`)
  and `x-upsert: true` makes restart-from-scratch safe for every re-upload
  path in the table.

---

## 9. Data-flow cheat sheet (who writes what)

| Store | Writers | Reads |
| --- | --- | --- |
| `upload_sessions` | createDocument, heartbeat, resume (lazy abandon), complete, cancel, cron | status actions, card staleness, resume |
| `document_files` | createDocument, saveUploadReference, completeDocumentFileUpload, complete/cancel/reconcile, cron | resume plan, document views |
| Storage bucket | Uppy chunks (browser, signed) | verification (`objectExists`), deletion (cancel/cron/document delete) |
| IndexedDB | beginUploadSession / reselect (metadata + FS handles) | resume/reselect; swept by `notifyKnownDocuments` |
| Web Lock (`upload-session:{documentId}`) | coordinator | every other tab’s start attempts |

---

## 10. Validation

```bash
npx tsc --noEmit                                    # clean
npx eslint src/features/documents src/inngest       # no new issues (2 pre-existing)
npx vitest run tests/resumable-uploads.test.ts      # 23 unit tests
```

### Manual test script

1. **Happy path** — create a document, watch chunks upload, see session
   complete; a storage-sweep shows objects exist; IndexedDB record removed
   after completion.
2. **Network failure** — DevTools → Network → Offline mid-chunk; resume
   Online; the same TUS resource continues (verify `Upload-Offset` in
   request; no duplicate objects, no `failed` rows).
3. **Tab close + resume** — close the tab mid-batch; wait for the card’s
   "Upload Interrupted"; open DevTools → Application → IndexedDB, confirm
   the record has **no file bytes**; click Resume Upload with files with
   FS handles (click/FS-Access-picker or drag & dropped originally) →
   continue with no reselect.
4. **Cross-tab** — start resuming the same attempt in tab B while tab A is
   running: tab B must show "already running in another tab" and the batch
   must not start.
5. **Re-select identity** — re-select a *different* file of identical
   size/name at the reselect prompt → must be rejected; the exact file →
   accepted and uploaded.
6. **Cancellation** — cancel mid-batch (console call to
   `cancelUploadSessionAction`): status `cancelled`, partial folders gone,
   uploaded files intact; further heartbeats 409.
7. **Abandonment** — push `recovery_expires_at` into the past (SQL) and run
   the Inngest cron: session `abandoned`, unfinished files `failed`, storage
   swept, document row intact; Resume after that reports
   "cannot be resumed".
```