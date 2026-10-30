import { DocumentSearchCursor, DocumentSearchData } from "./dto/projections";
import z from "zod";
import {
  DocumentSearchCursorSchema,
  DocumentSearchSchema,
} from "./schemas/pagination";

export function validateDocumentSearchRows(
  rows: unknown[],
): DocumentSearchData[] {
  return z.array(DocumentSearchSchema).parse(rows);
}

export function validateDocumentSearchCursor(
  cursor: unknown,
): DocumentSearchCursor {
  return DocumentSearchCursorSchema.parse(cursor);
}
