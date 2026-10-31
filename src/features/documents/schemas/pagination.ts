import { fileUploadStatusEnum, uploadSessionStatusEnum } from "@/db/schemas";
import { z } from "zod";

export const DocumentSearchCursorSchema = z.object({
  createdAt: z.union([z.date(), z.iso.datetime()]),
  id: z.uuid(),
});

export const DocumentFileSearchSchema = z.object({
  fileId: z.string(),
  filename: z.string(),
  size: z.number(),
  mimeType: z.string(),
  storagePath: z.string(),
  uploadStatus: z.enum(fileUploadStatusEnum.enumValues),
  contentProbe: z.string().nullable(),
});

export const DocumentUploadSessionSearchSchema = z.object({
  sessionId: z.string(),
  status: z.enum(uploadSessionStatusEnum.enumValues),
  lastHeartbeatAt: z.date(),
  recoveryExpiresAt: z.date(),
  progress: z.record(z.string(), z.union([z.number(), z.unknown()])).nullable(),
});

export const DocumentSearchSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  processingStatus: z.string(),
  createdAt: z.date(),
  files: z.array(DocumentFileSearchSchema),
  session: DocumentUploadSessionSearchSchema.nullable(),
});
