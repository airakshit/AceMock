import { documentCommands, DocumentCommands } from "./document-commands";
import { documentQueries, DocumentQueries } from "./document-queries";


export class DocumentsRepository {
  readonly commands: DocumentCommands = documentCommands;
  readonly queries: DocumentQueries = documentQueries;
}

export const documentRepository = new DocumentsRepository();