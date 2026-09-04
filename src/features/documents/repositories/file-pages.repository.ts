import { filePages } from "@/db/schemas";
import { and, desc, eq, inArray } from "drizzle-orm";
import { generateUUIDv7 } from "../../shared/utils";
import { DbExecutor } from "../../shared/types";
import { FilePageOCRStatus } from "../types";

export class FilePagesRepository {
  async create(
    db: DbExecutor,
    fileId: string,
    data: {
      pageNo: number;
    },
  ) {
    const pageId = generateUUIDv7();

    const [page] = await db
      .insert(filePages)
      .values({
        id: pageId,
        fileId: fileId,
        pageNo: data.pageNo,
      })
      .returning();

    return page;
  }

  async createMany(
    db: DbExecutor,
    pages: Array<{
      fileId: string;
      pageNo: number;
    }>,
  ) {
    const values = pages.map((page) => ({
      id: generateUUIDv7(),
      fileId: page.fileId,
      pageNo: page.pageNo,
    }));

    const createdPages = await db.insert(filePages).values(values).returning();

    return createdPages;
  }

  async findById(db: DbExecutor, pageId: string) {
    const [page] = await db
      .select()
      .from(filePages)
      .where(eq(filePages.id, pageId))
      .limit(1);

    return page;
  }

  async findByFileId(db: DbExecutor, fileId: string) {
    return db
      .select()
      .from(filePages)
      .where(eq(filePages.fileId, fileId))
      .orderBy(desc(filePages.createdAt));
  }

  async updateStatusByDocumentId(
    db: DbExecutor,
    fileId: string,
    ocrStatus: FilePageOCRStatus,
  ) {
    const pages = await db
      .update(filePages)
      .set({
        ocrStatus: ocrStatus,
        updatedAt: new Date(),
      })
      .where(eq(filePages.fileId, fileId))
      .returning();

    return pages;
  }

  async updateStatusByPageId(
    db: DbExecutor,
    pageId: string,
    ocrStatus: FilePageOCRStatus,
  ) {
    const [page] = await db
      .update(filePages)
      .set({ ocrStatus: ocrStatus, updatedAt: new Date() })
      .where(eq(filePages.id, pageId))
      .returning();
    return page;
  }

  async update(
    db: DbExecutor,
    pageId: string,
    fileId: string,
    data: {
      pageNo: number;
      ocrText?: string;
      ocrStatus?: FilePageOCRStatus;
    },
  ) {
    const [page] = await db
      .update(filePages)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(filePages.id, pageId), eq(filePages.fileId, fileId)))
      .returning();

    return page;
  }

  async delete(db: DbExecutor, pageId: string, fileId: string) {
    const [page] = await db
      .delete(filePages)
      .where(and(eq(filePages.id, pageId), eq(filePages.fileId, fileId)))
      .returning();

    return page;
  }

  async updateStatusForPages(
    db: DbExecutor,
    fileId: string,
    pageIds: string[],
    status: FilePageOCRStatus,
  ) {
    if (pageIds.length === 0) return [];

    return db
      .update(filePages)
      .set({
        ocrStatus: status,
        updatedAt: new Date(),
      })
      .where(and(eq(filePages.fileId, fileId), inArray(filePages.id, pageIds)))
      .returning();
  }
}

export const filePagesRepository = new FilePagesRepository();
