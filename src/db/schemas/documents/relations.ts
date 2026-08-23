import { documents } from "./documents";
import { documentFiles } from "./document-files";
import { documentPages } from "./document-pages";

import { relations } from "drizzle-orm";

export const documentRelations = relations(documents, ({ many }) => ({
  documentFiles: many(documentFiles),
}));

export const documentFilesRelations = relations(
  documentFiles,
  ({ one, many }) => ({
    documentPages: many(documentPages),
    document: one(documents, {
      fields: [documentFiles.documentId],
      references: [documents.id],
    }),
  }),
);

export const documentPagesRelation = relations(
  documentPages,
  ({ one, many }) => ({
    documentFiles: one(documentFiles, {
      fields: [documentPages.documentFileId],
      references: [documentFiles.id],
    }),
  }),
);
