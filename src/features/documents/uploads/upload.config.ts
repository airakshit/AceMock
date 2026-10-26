import { env } from "@/config/env/client";
import { UPLOAD_MAX_CONCURRENCY } from "./upload-session-constants";

export const UPPY_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_MB: 50,
  // Kept in sync with the shared session-flow knob (3 files at a time).
  MAX_CONCURRENT_UPLOAD: UPLOAD_MAX_CONCURRENCY,
  TUS_ENDPOINT: env.NEXT_PUBLIC_SUPABASE_TUS_ENDPOINT,
  RETRY_DELAYS: [0, 3000, 5000, 10000, 20000],
  CHUNK_SIZE_MB: 6,
  ALLOWED_METADATA_FIELDS: ["bucketName", "objectName", "contentType"],
};
