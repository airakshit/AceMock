import { create } from "zustand";

export type UploadStatus =
    | "queued"
    | "uploading"
    | "paused"
    | "success"
    | "error"
    | "canceled";

export interface UploadItem {
    clientFileId: string;
    file: File;
    kind: "pdf" | "image";
    bytesUploaded: number;
    bytesTotal: number;
    status: UploadStatus;
    error?: string;
    path?: string;
}

interface UploadState {
    items: Record<string, UploadItem>;
    upsertItem: (clientFileId: string, patch: Partial<UploadItem>) => void;
    reset: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
    items: {},
    upsertItem: (clientFileId, patch) =>
        set((state) => ({
            items: {
                ...state.items,
                [clientFileId]: {
                    ...state.items[clientFileId],
                    ...patch,
                } as UploadItem,
            },
        })),
    reset: () => set({ items: {} }),
}));
