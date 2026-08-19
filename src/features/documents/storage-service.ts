import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/config/env/server";

export interface SignedUrlResponseObject {
    clientFileId: string;
    storagePath: string;
    token: string;
    signedUrl: string;
}

class SupabaseStorageClient {
    private readonly _supabaseClient: ReturnType<
        typeof createSupabaseServerClient
    >;
    public concurrencyLimit: number = 3; // Default network request is three.

    constructor(
        _supabaseClient: ReturnType<typeof createSupabaseServerClient>,
        concurrencyLimit: number = 3,
    ) {
        this._supabaseClient = _supabaseClient;
        this.concurrencyLimit = concurrencyLimit;
    }

    private async _createUploadSignedUrl(
        clientFileId: string,
        storagePath: string,
    ): Promise<{
        clientFileId: string;
        signedUrl: string;
        path: string;
        token: string;
    }> {
        const response = await this._supabaseClient.storage
            .from(env.SUPABASE_STORAGE_BUCKET_NAME)
            .createSignedUploadUrl(storagePath, { upsert: true });

        if (response.error) {
            console.log(
                `Error for path: ${storagePath}: [MESSAGE]: ${response.error.message}, [STATUS]: ${response.error.status}, [CAUSE]: ${response.error.cause}`,
            );
            throw response.error;
        }
        return { clientFileId: clientFileId, ...response.data };
    }

    async getUploadSignedUrls(
        data: Array<{ clientFileId: string; storagePath: string }>,
    ): Promise<SignedUrlResponseObject[]> {
        const functions = data.map((value) => {
            return this._createUploadSignedUrl(
                value.clientFileId,
                value.storagePath,
            );
        });

        try {
            const signedUrls: SignedUrlResponseObject[] = [];

            for (let i = 0; i < functions.length; i += this.concurrencyLimit) {
                const batchResult = await Promise.all(
                    functions.slice(i, i + 3),
                );

                for (const element of batchResult) {
                    signedUrls.push({
                        clientFileId: element.clientFileId,
                        signedUrl: element.signedUrl,
                        storagePath: element.path,
                        token: element.token,
                    });
                }
            }

            return signedUrls;
        } catch (error) {
            throw error;
        }
    }
}

export const supabaseStorageClient = new SupabaseStorageClient(
    createSupabaseServerClient(),
    3,
);
