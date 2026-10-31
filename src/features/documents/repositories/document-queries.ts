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
  isNotNull,
  isNull,
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
  documentDTOReturning,
  documentFileDTOReturning,
  filePageProjectionReturning,
  uploadSessionDTOReturning,
  SingleDocumentFileAndSessionProjection,
} from "../dto/projections";
import { validateDocumentSearchRows } from "../validators";
import { DocumentFilterProcessingStatus, DocumentProcessingStatus } from "../types";

const documentFilesAggregate = sql<unknown>`
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
      WHERE ${documentFiles.id} IS NOT NULL AND ${documentFiles.deletedAt} IS NULL
    ),
    '[]'::jsonb
  )
`.as("files");

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
  async findByIdForUser(db: DbExecutor, documentId: string, userId: string) {
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

  /**
   * Returns a single document file and the document session.
   */
  async getSingleDocumentFileAndSession(
    db: DbExecutor,
    userId: string,
    documentId: string,
    fileId: string,
  ): Promise<SingleDocumentFileAndSessionProjection | null> {
    const singleFile = db
      .select(documentFileDTOReturning)
      .from(documentFiles)
      .where(
        and(
          eq(documentFiles.documentId, documentId),
          eq(documentFiles.id, fileId),
          isNull(documentFiles.deletedAt),
        ),
      )
      .limit(1)
      .as("single_doc_file");

    const latestSession = db
      .select(uploadSessionDTOReturning)
      .from(uploadSessions)
      .where(eq(uploadSessions.documentId, documentId))
      .orderBy(desc(uploadSessions.createdAt))
      .limit(1)
      .as("doc_latest_session");

    const data = await db
      .select({
        ...documentDTOReturning,
        file: {
          fileId: singleFile.fileId,
          filename: singleFile.filename,
          size: singleFile.size,
          mimeType: singleFile.mimeType,
          uploadStatus: singleFile.uploadStatus,
          contentProbe: singleFile.contentProbe,
          storagePath: singleFile.storagePath,
        },
        session: {
          sessionId: latestSession.sessionId,
          status: latestSession.status,
          lastHeartbeatAt: latestSession.lastHeartbeatAt,
          recoveryExpiresAt: latestSession.recoveryExpiresAt,
          progress: latestSession.progress,
        },
      })
      .from(documents)
      .innerJoin(singleFile, sql`true`)
      .innerJoin(latestSession, sql`true`)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
        ),
      )
      .limit(1);

    return data[0] || null;
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
        files: documentFilesAggregate,
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
        .select(documentDTOReturning)
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
        files: documentFilesAggregate,
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
    const latestUploadSession = db
      .select({
        sessionId: uploadSessions.id,
        status: uploadSessions.status,
        lastHeartbeatAt: uploadSessions.lastHeartbeatAt,
        recoveryExpiresAt: uploadSessions.recoveryExpiresAt,
        progress: uploadSessions.progress,
      })
      .from(uploadSessions)
      .where(eq(uploadSessions.documentId, documents.id))
      .orderBy(desc(uploadSessions.createdAt))
      .limit(1)
      .as("latest_session");

    const docFiles = db
      .select({
        documentId: documentFiles.documentId,
        files: documentFilesAggregate,
      })
      .from(documentFiles)
      .groupBy(documentFiles.documentId)
      .as("doc_files");

    const rows = await db
      .select({
        documentId: documents.id,
        title: documents.title,
        description: documents.description,
        processingStatus: documents.processingStatus,
        createdAt: documents.createdAt,
        session: {
          sessionId: latestUploadSession.sessionId,
          status: latestUploadSession.status,
          lastHeartbeatAt: latestUploadSession.lastHeartbeatAt,
          recoveryExpiresAt: latestUploadSession.recoveryExpiresAt,
          progress: latestUploadSession.progress,
        },
        files: sql<unknown>`COALESCE(${docFiles.files}, '[]'::jsonb)`.as(
          "files",
        ),
      })
      .from(documents)
      .leftJoinLateral(latestUploadSession, sql`true`)
      .leftJoin(docFiles, eq(docFiles.documentId, documents.id))
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .limit(1);

    return validateDocumentSearchRows(rows)[0] || null;
  }

  async searchUserDocuments(
    db: DbExecutor,
    userId: string,
    query: {
      searchKey?: string;
      processingStatus?: DocumentFilterProcessingStatus;
      pagination: {
        pageSize: number;
        cursor?: DocumentSearchCursor;
      };
    },
  ): Promise<DocumentSearchProjection> {
    const conditions: SQL<unknown>[] = [eq(documents.userId, userId)];
    if (query.processingStatus) {
      if (query.processingStatus === "processing") {
        conditions.push(
          inArray(documents.processingStatus, [
            "processing_files",
            "extracting_questions",
            "merging_questions",
          ]),
        );
      } else {
        conditions.push(eq(documents.processingStatus, query.processingStatus));
      }
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

    const latestUploadSession = db
      .select({
        sessionId: uploadSessions.id,
        status: uploadSessions.status,
        lastHeartbeatAt: uploadSessions.lastHeartbeatAt,
        recoveryExpiresAt: uploadSessions.recoveryExpiresAt,
        progress: uploadSessions.progress,
      })
      .from(uploadSessions)
      .where(eq(uploadSessions.documentId, documents.id))
      .orderBy(desc(uploadSessions.createdAt))
      .limit(1)
      .as("latest_session");

    const docFiles = db
      .select({
        documentId: documentFiles.documentId,
        files: documentFilesAggregate,
      })
      .from(documentFiles)
      .groupBy(documentFiles.documentId)
      .as("doc_files");

    const rows = await db
      .select({
        documentId: documents.id,
        title: documents.title,
        description: documents.description,
        processingStatus: documents.processingStatus,
        createdAt: documents.createdAt,
        session: {
          sessionId: latestUploadSession.sessionId,
          status: latestUploadSession.status,
          lastHeartbeatAt: latestUploadSession.lastHeartbeatAt,
          recoveryExpiresAt: latestUploadSession.recoveryExpiresAt,
          progress: latestUploadSession.progress,
        },
        files: sql<unknown>`COALESCE(${docFiles.files}, '[]'::jsonb)`.as(
          "files",
        ),
      })
      .from(documents)
      .leftJoinLateral(latestUploadSession, sql`true`)
      .leftJoin(docFiles, eq(docFiles.documentId, documents.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(query.pagination.pageSize + 1);

    return { documents: validateDocumentSearchRows(rows) };
  }
}

export const documentQueries = new DocumentQueries();
