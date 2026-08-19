import { DocumentFormData } from "./schemas";
import { CreateNewDocumentActionPayload } from "./actions/types";
import { generateUUIDv7 } from "../shared/utils";

export function documentFormDataToCreateNewDocumentPayload(
    data: DocumentFormData,
): CreateNewDocumentActionPayload {
    return {
        title: data.title,
        contentType: data.contentType,
        description: data.description,
        pdfs: data.pdfs.map((value) => {
            return {
                clientFileId: generateUUIDv7(),
                name: value.name,
                size: value.size,
                type: value.type,
            };
        }),
        images: data.images.map((value) => {
            return {
                clientFileId: generateUUIDv7(),
                name: value.name,
                size: value.size,
                type: value.type,
            };
        }),
    };
}
