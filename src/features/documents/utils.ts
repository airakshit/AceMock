import { DocumentFormData } from "./schemas";
import { CreateNewDocumentActionPayload } from "./types";

export function documentFormDataToCreateNewDocumentPayload(
    data: DocumentFormData,
): CreateNewDocumentActionPayload {
    return {
        title: data.title,
        contentType: data.contentType,
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
