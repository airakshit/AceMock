import { and, asc, desc, eq, lt } from "drizzle-orm";
import { uploadSessions } from "@/db/schemas";
import {
  TouchUploadSessionCommand,
  UpdateUploadSessionStatusCommand,
} from "../dto/commands";
import { DbExecutor } from "../../shared/types";
import { UploadSessionStatus } from "../types";

export type UploadSessionRow = typeof uploadSessions.$inferSelect;

/**
 * Commands + queries for the server-owned upload sessions.
 *
 * All read/write methods take a `DbExecutor` so sessions can be created
 * inside the same transaction as their document (atomic attempt creation).
 */
export class UploadSessionsRepository {
  // ==================== COMMANDS (writes) ====================

  /**
   * Creates an ACTIVE session. The partial unique index
   * `uq_active_upload_session_per_document` makes a concurrent second
   * active session for the same document impossible at the database level.
   */
  async create(
    db: DbExecutor,
    data: {
      id: string;
      userId: string;
      documentId: string;
      recoveryExpiresAt: Date;
    },
  ): Promise<UploadSessionRow> {
    const [session] = await db
      .insert(uploadSessions)
      .values({
        id: data.id,
        userId: data.userId,
        documentId: data.documentId,
        recoveryExpiresAt: data.recoveryExpiresAt,
        status: "active" as UploadSessionStatus,
      })
      .returning();

    return session;
  }

  /**
   * Terminal transitions stamp `endedAt`; idempotent for repeat calls.
   */
  async updateStatus(
    db: DbExecutor,
    data: UpdateUploadSessionStatusCommand,
  ): Promise<UploadSessionRow | null> {
    const [session] = await db
      .update(uploadSessions)
      .set({
        status: data.status as UploadSessionStatus,
        endedAt: new Date(),
        ...(data.endReason !== undefined && { endReason: data.endReason }),
      })
      .where(eq(uploadSessions.id, data.sessionId))
      .returning();

    return session || null;
  }

  /**
   * Server-side liveness: refresh `lastHeartbeatAt` and persist the
   * optional per-file progress snapshot.
   */
  async touchHeartbeat(
    db: DbExecutor,
    data: TouchUploadSessionCommand,
  ): Promise<UploadSessionRow | null> {
    const [session] = await db
      .update(uploadSessions)
      .set({
        lastHeartbeatAt: new Date(),
        ...(data.progress !== undefined && { progress: data.progress }),
      })
      .where(eq(uploadSessions.id, data.sessionId))
      .returning();

    return session || null;
  }

  async findByIdForUser(
    db: DbExecutor,
    sessionId: string,
    userId: string,
  ): Promise<UploadSessionRow | null> {
    const [session] = await db
      .select()
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.id, sessionId),
          eq(uploadSessions.userId, userId),
        ),
      )
      .limit(1);

    return session || null;
  }

  /**
   * THE session that matters for a document: the only one allowed to be
   * active. Enforced globally by `uq_active_upload_session_per_document`,
   * so this returns at most one row.
   */
  async findActiveByDocumentIdForUser(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ): Promise<UploadSessionRow | null> {
    const [session] = await db
      .select()
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.documentId, documentId),
          eq(uploadSessions.userId, userId),
          eq(uploadSessions.status, "active" as UploadSessionStatus),
        ),
      )
      .limit(1);

    return session || null;
  }

  /**
   * The most recent session of any status — status displays and audit.
   */
  async findLatestByDocumentIdForUser(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ): Promise<UploadSessionRow | null> {
    const [session] = await db
      .select()
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.documentId, documentId),
          eq(uploadSessions.userId, userId),
        ),
      )
      .orderBy(desc(uploadSessions.createdAt))
      .limit(1);

    return session || null;
  }

  /**
   * Active sessions whose recovery window has elapsed — the reclamation
   * queue for the Inngest cleanup job.
   */
  async findStaleActiveSessions(
    db: DbExecutor,
    cutoff: Date,
  ): Promise<Array<{ id: string; userId: string; documentId: string }>> {
    return db
      .select({
        id: uploadSessions.id,
        userId: uploadSessions.userId,
        documentId: uploadSessions.documentId,
      })
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.status, "active" as UploadSessionStatus),
          lt(uploadSessions.recoveryExpiresAt, cutoff),
        ),
      )
      .orderBy(asc(uploadSessions.createdAt));
  }
}

export const uploadSessionsRepository = new UploadSessionsRepository();
