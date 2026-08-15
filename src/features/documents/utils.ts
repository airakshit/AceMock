import { DocumentFormData } from "./schemas";
import { CreateNewDocumentPayload } from "./types";

export function buildStorageUrl(
    documentId: string,
    documentFileId: string,
    fileName: string,
): string {
    return `documents/${documentId}/files/${documentFileId}/${fileName}`;
}

export function documentFormDataToCreateNewDocumentPayload(
    data: DocumentFormData,
): CreateNewDocumentPayload {
    return {
        title: data.title,
        description: data.description,
        pdfs: data.pdfs.map((value, _) => {
            return {
                name: value.name,
                size: value.size,
                type: value.type,
            };
        }),
        images: data.images.map((value, _) => {
            return {
                name: value.name,
                size: value.size,
                type: value.type,
            };
        }),
    };
}
