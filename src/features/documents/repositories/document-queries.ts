import {
  documentFiles,
  documents,
  filePages,
  questions,
  uploadSessions,
} from "@/db/schemas";
import {
  and,
  desc,
  eq,
  inArray,
  count,
  ilike,
  or,
  sql,
  lt,
  type SQL,
} from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import {
  DocumentDTO,
  DocumentFileDTO,
  DocumentWithFilesDTO,
  DocumentWithPagesDTO,
  DocumentSearchCursor,
  DocumentSearchData,
  DocumentSearchProjection,
  DocumentWithQuestionCountProjection,
} from "../dto/projections";
import { validateDocumentSearchRows } from "../validators";
import { DocumentProcessingStatus } from "../types";

export class DocumentQueries {
  async findById(
    db: DbExecutor,
    documentId: string,
  ): Promise<DocumentDTO | null> {
    const [document] = await db
      .select({
        documentId: documents.id,
        title: documents.title,
        description: documents.description,
        processingStatus: documents.processingStatus,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    return document || null;
  }

  async findFileById(db: DbExecutor, fileId: string) {
    const [file] = await db
      .select()
      .from(documentFiles)
      .where(eq(documentFiles.id, fileId))
      .limit(1);

    return file || null;
  }

  /**
   * Full user document row or null — ownership enforced. Server flows use
   * it where columns beyond the DTO projection are required (e.g. the
   * resume decision tree reads `.id`, `.title`, `.description`, `.status`).
   */
  async findByIdForUser(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ) {
    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .limit(1);

    return document || null;
  }

  async findFilesByDocumentId(
    db: DbExecutor,
    documentId: string,
  ): Promise<DocumentFileDTO[]> {
    const data = await db
      .select({
        fileId: documentFiles.id,
        filename: documentFiles.filename,
        size: documentFiles.fileSize,
        mimeType: documentFiles.mimeType,
        storagePath: documentFiles.storagePath,
        uploadStatus: documentFiles.uploadStatus,
        contentProbe: documentFiles.contentProbe,
      })
      .from(documentFiles)
      .where(eq(documentFiles.documentId, documentId));

    return data as DocumentFileDTO[];
  }

  /**
   * Session-scoped file reads for the recovery/verification flows. Returns
   * the full row on purpose: resume decisions and storage verification need
   * `uploadRef`, `uploadRefCreatedAt` and `fileSize`, columns deliberately
   * excluded from the public file DTOs.
   */
  async findFilesBySessionId(db: DbExecutor, sessionId: string) {
    return db
      .select()
      .from(documentFiles)
      .where(eq(documentFiles.sessionId, sessionId))
      .orderBy(desc(documentFiles.createdAt));
  }

  async findDocumentsWithQuestionsCount(
    db: DbExecutor,
  ): Promise<DocumentWithQuestionCountProjection[]> {
    const records = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        questionCount: count(questions.id),
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(questions, eq(questions.fileId, documentFiles.id))
      .groupBy(documents.id, documents.title, documents.createdAt)
      .orderBy(desc(documents.createdAt));

    return records.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      questionCount: Number(r.questionCount || 0),
    }));
  }

  /**
   * Same summary as above, restricted to one user's documents.
   * Source for the mock-creation document picker (admin sees their own
   * documents, a student sees theirs).
   */
  async findDocumentsWithQuestionsCountForUser(
    db: DbExecutor,
    userId: string,
  ): Promise<DocumentWithQuestionCountProjection[]> {
    const records = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        questionCount: count(questions.id),
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(questions, eq(questions.fileId, documentFiles.id))
      .where(eq(documents.userId, userId))
      .groupBy(documents.id, documents.title, documents.createdAt)
      .orderBy(desc(documents.createdAt));

    return records.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      questionCount: Number(r.questionCount || 0),
    }));
  }

  /**
   * Of the given ids, the subset that exists AND belongs to `userId`.
   * Lets a caller prove ownership of a client-supplied id list without
   * leaking whether an unowned id exists at all.
   */
  async findByIdsForUser(
    db: DbExecutor,
    userId: string,
    documentIds: string[],
  ): Promise<string[]> {
    if (documentIds.length === 0) return [];

    const rows = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(eq(documents.userId, userId), inArray(documents.id, documentIds)),
      );

    return rows.map((r) => r.id);
  }

  async getDocumentWithFiles(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ): Promise<DocumentWithFilesDTO | null> {
    const [record] = await db
      .select({
        documentId: documents.id,
        title: documents.title,
        description: documents.description,
        processingStatus: documents.processingStatus,
        createdAt: documents.createdAt,
        files: sql<unknown>`
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'fileId', ${documentFiles.id},
                'filename', ${documentFiles.filename},
                'size', ${documentFiles.fileSize},
                'mimeType', ${documentFiles.mimeType},
                'storagePath', ${documentFiles.storagePath},
                'uploadStatus', ${documentFiles.uploadStatus},
                'contentProbe', ${documentFiles.contentProbe}
              )
              ORDER BY ${documentFiles.createdAt} DESC
            ) FILTER (
              WHERE ${documentFiles.id} IS NOT NULL,
            )
            '[]'::jsonb
          )
        `.as("files"),
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .groupBy(
        documents.id,
        documents.title,
        documents.description,
        documents.processingStatus,
        documents.createdAt,
      );

    if (!record) return null;

    return { ...record, files: record.files as DocumentFileDTO[] };
  }

  async getDocumentWithPages(
    db: DbExecutor,
    documentId: string,
    userId: string,
  ): Promise<DocumentWithPagesDTO | null> {
    const doc = db.$with("doc").as(
      db
        .select({
          documentId: documents.id,
          title: documents.title,
          description: documents.description,
          processingStatus: documents.processingStatus,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId))),
    );

    // One row per file with its pages pre-aggregated ('[]' when it has none).
    const docPages = db.$with("doc_pages").as(
      db
        .select({
          fileId: documentFiles.id,
          pages: sql<unknown>`
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', ${filePages.id},
                  'fileId', ${filePages.fileId},
                  'pageNo', ${filePages.pageNo},
                  'ocrText', ${filePages.ocrText},
                  'ocrStatus', ${filePages.ocrStatus},
                  'survivedValidation', ${filePages.survivedValidation},
                  'ocrModel', ${filePages.ocrModel},
                  'isRelevant', ${filePages.isRelevant},
                  'createdAt', ${filePages.createdAt}
                )
                ORDER BY ${filePages.pageNo} ASC
              ) FILTER (
                WHERE ${filePages.id} IS NOT NULL,
              )
              '[]'::jsonb
            )
          `.as("pages"),
        })
        .from(doc)
        .innerJoin(documentFiles, eq(documentFiles.documentId, doc.documentId))
        .leftJoin(filePages, eq(filePages.fileId, documentFiles.id))
        .groupBy(documentFiles.id),
    );

    const [record] = await db
      .select({
        documentId: doc.documentId,
        title: doc.title,
        description: doc.description,
        processingStatus: doc.processingStatus,
        createdAt: doc.createdAt,
        files: sql<unknown>`
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'fileId', ${documentFiles.id},
                'filename', ${documentFiles.filename},
                'size', ${documentFiles.fileSize},
                'mimeType', ${documentFiles.mimeType},
                'storagePath', ${documentFiles.storagePath},
                'uploadStatus', ${documentFiles.uploadStatus},
                'contentProbe', ${documentFiles.contentProbe},
                'pages', ${docPages.pages}
              )
              ORDER BY ${documentFiles.createdAt} DESC
            ) FILTER (
              WHERE ${documentFiles.id} IS NOT NULL,
            )
            '[]'::jsonb
          )
        `.as("files"),
      })
      .from(doc)
      .leftJoin(documentFiles, eq(documentFiles.documentId, doc.documentId))
      .leftJoin(docPages, eq(docPages.fileId, documentFiles.id))
      .groupBy(
        doc.documentId,
        doc.title,
        doc.description,
        doc.processingStatus,
        doc.createdAt,
      );

    if (!record) return null;

    return {
      documentId: record.documentId,
      title: record.title,
      description: record.description,
      processingStatus: record.processingStatus,
      createdAt: record.createdAt,
      files: record.files as DocumentWithPagesDTO["files"],
    };
  }

  async getUserDocument(
    db: DbExecutor,
    userId: string,
    documentId: string,
  ): Promise<DocumentSearchData | null> {
    const docRows = db.$with("matching_docs").as(
      db
        .select({
          documentId: documents.id,
          title: documents.title,
          description: documents.description,
          processingStatus: documents.processingStatus,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
        .limit(1),
    );

    const docFiles = db.$with("document_files").as(
      db
        .select({
          documentId: docRows.documentId,
          files: sql<unknown>`
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'fileId', ${documentFiles.id},
                  'filename', ${documentFiles.filename},
                  'size', ${documentFiles.fileSize},
                  'mimeType', ${documentFiles.mimeType},
                  'storagePath', ${documentFiles.storagePath},
                  'uploadStatus', ${documentFiles.uploadStatus},
                  'contentProbe', ${documentFiles.contentProbe}
                )
                ORDER BY ${documentFiles.createdAt} DESC
              ) FILTER (
                WHERE ${documentFiles.id} IS NOT NULL,
              )
              '[]'::jsonb
            )
          `.as("files"),
        })
        .from(docRows)
        .innerJoin(
          documentFiles,
          eq(documentFiles.documentId, docRows.documentId),
        )
        .groupBy(docRows.documentId),
    );

    const latestUploadSession = db
      .select({
        sessionId: uploadSessions.id,
        status: uploadSessions.status,
        lastHeartbeatAt: uploadSessions.lastHeartbeatAt,
        recoveryExpiresAt: uploadSessions.recoveryExpiresAt,
        progress: uploadSessions.progress,
      })
      .from(uploadSessions)
      .where(eq(uploadSessions.documentId, docRows.documentId))
      .orderBy(desc(uploadSessions.createdAt))
      .limit(1)
      .as("latest_session");

    const rows = await db
      .select({
        documentId: docRows.documentId,
        title: docRows.title,
        description: docRows.description,
        processingStatus: docRows.processingStatus,
        createdAt: docRows.createdAt,
        session: {
          sessionId: latestUploadSession.sessionId,
          lastHeartbeatAt: latestUploadSession.lastHeartbeatAt,
          recoveryExpiresAt: latestUploadSession.recoveryExpiresAt,
          status: latestUploadSession.status,
          progress: latestUploadSession.progress,
        },
        files: docFiles.files,
      })
      .from(docRows)
      .innerJoinLateral(latestUploadSession, sql`true`)
      .innerJoin(docFiles, eq(docFiles.documentId, docRows.documentId));

    return validateDocumentSearchRows(rows)[0] || null;
  }

  async searchUserDocuments(
    db: DbExecutor,
    userId: string,
    query: {
      searchKey: string;
      processingStatus?: DocumentProcessingStatus;
      pagination: {
        pageSize: number;
        cursor?: DocumentSearchCursor;
      };
    },
  ): Promise<DocumentSearchProjection> {
    const conditions: SQL<unknown>[] = [eq(documents.userId, userId)];
    if (query.processingStatus) {
      conditions.push(eq(documents.processingStatus, query.processingStatus));
    }
    if (query.searchKey) {
      const pattern = `%${query.searchKey}%`;
      conditions.push(
        or(
          ilike(documents.title, pattern),
          ilike(documents.description, pattern),
        )!,
      );
    }
    if (query.pagination.cursor) {
      const date = query.pagination.cursor.createdAt;
      conditions.push(
        and(
          lt(
            documents.createdAt,
            typeof date === "string" ? new Date(date) : date,
          ),
          lt(documents.id, query.pagination.cursor.id),
        )!,
      );
    }

    const matchingDocs = db.$with("matching_docs").as(
      db
        .select({
          documentId: documents.id,
          title: documents.title,
          description: documents.description,
          processingStatus: documents.processingStatus,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(documents.createdAt), desc(documents.id))
        .limit(query.pagination.pageSize + 1),
    );

    const docFiles = db.$with("document_files").as(
      db
        .select({
          documentId: matchingDocs.documentId,
          files: sql<unknown>`
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'fileId', ${documentFiles.id},
                  'filename', ${documentFiles.filename},
                  'size', ${documentFiles.fileSize},
                  'mimeType', ${documentFiles.mimeType},
                  'storagePath', ${documentFiles.storagePath},
                  'uploadStatus', ${documentFiles.uploadStatus},
                  'contentProbe', ${documentFiles.contentProbe}
                )
                ORDER BY ${documentFiles.createdAt} DESC
              ) FILTER (
                WHERE ${documentFiles.id} IS NOT NULL,
              )
              '[]'::jsonb
            )
          `.as("files"),
        })
        .from(matchingDocs)
        .innerJoin(
          documentFiles,
          eq(documentFiles.documentId, matchingDocs.documentId),
        )
        .groupBy(matchingDocs.documentId),
    );

    const latestUploadSession = db
      .select({
        sessionId: uploadSessions.id,
        status: uploadSessions.status,
        lastHeartbeatAt: uploadSessions.lastHeartbeatAt,
        recoveryExpiresAt: uploadSessions.recoveryExpiresAt,
        progress: uploadSessions.progress,
      })
      .from(uploadSessions)
      .where(eq(uploadSessions.documentId, matchingDocs.documentId))
      .orderBy(desc(uploadSessions.createdAt))
      .limit(1)
      .as("latest_session");

    const rows = await db
      .select({
        documentId: matchingDocs.documentId,
        title: matchingDocs.title,
        description: matchingDocs.description,
        processingStatus: matchingDocs.processingStatus,
        createdAt: matchingDocs.createdAt,
        session: {
          sessionId: latestUploadSession.sessionId,
          lastHeartbeatAt: latestUploadSession.lastHeartbeatAt,
          recoveryExpiresAt: latestUploadSession.recoveryExpiresAt,
          status: latestUploadSession.status,
          progress: latestUploadSession.progress,
        },
        files: docFiles.files,
      })
      .from(matchingDocs)
      .innerJoinLateral(latestUploadSession, sql`true`)
      .innerJoin(docFiles, eq(docFiles.documentId, matchingDocs.documentId));

    return { documents: validateDocumentSearchRows(rows) };
  }
}

export const documentQueries = new DocumentQueries();
