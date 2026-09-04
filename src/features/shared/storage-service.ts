import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/config/env/server";
import { StorageError } from "@supabase/storage-js";

export interface SignedUrlResponseObject {
  serverFileId: string;
  clientFileId: string;
  storagePath: string;
  token: string;
  signedUrl: string;
}

export interface DownloadedObject {
  path: string;
  data: Blob;
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

  private async _createUploadSignedUrl(data: {
    serverFileId: string;
    clientFileId: string;
    storagePath: string;
  }): Promise<{
    serverFileId: string;
    clientFileId: string;
    signedUrl: string;
    path: string;
    token: string;
  }> {
    const response = await this._supabaseClient.storage
      .from(env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME)
      .createSignedUploadUrl(data.storagePath, { upsert: true });

    if (response.error) {
      console.log(
        `Error for path: ${data.storagePath}: [MESSAGE]: ${response.error.message}, [STATUS]: ${response.error.status}, [CAUSE]: ${response.error.cause}`,
      );
      throw response.error;
    }
    return {
      serverFileId: data.serverFileId,
      clientFileId: data.clientFileId,
      ...response.data,
    };
  }

  async getUploadSignedUrls(
    data: Array<{
      clientFileId: string;
      storagePath: string;
      serverFileId: string;
    }>,
  ): Promise<SignedUrlResponseObject[]> {
    const functions = data.map((value) => {
      return this._createUploadSignedUrl({
        serverFileId: value.serverFileId,
        clientFileId: value.clientFileId,
        storagePath: value.storagePath,
      });
    });

    try {
      const signedUrls: SignedUrlResponseObject[] = [];

      for (let i = 0; i < functions.length; i += this.concurrencyLimit) {
        const batchResult = await Promise.all(functions.slice(i, i + 3));

        for (const element of batchResult) {
          signedUrls.push({
            serverFileId: element.serverFileId,
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

  private async _downloadObject(objectPath: string): Promise<DownloadedObject> {
    const { data, error } = await this._supabaseClient.storage
      .from(env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME)
      .download(objectPath);

    if (error) {
      console.log(
        `Error downloading the file: [PATH]: ${objectPath} [MESSAGE]: ${error.message}, [STATUS]: ${error.status}, [CAUSE]: ${error.cause}`,
      );
      throw error;
    }

    return {
      path: objectPath,
      data: data,
    };
  }

  private async _downloadConcurrently(
    functions: Promise<DownloadedObject>[],
    concurrency: number,
  ): Promise<DownloadedObject[]> {
    const downloadedObjs: DownloadedObject[] = [];

    for (let i = 0; i < functions.length; i += concurrency) {
      const batchResult = await Promise.all(functions.slice(i, i + 3));

      for (const element of batchResult) {
        downloadedObjs.push({
          path: element.path,
          data: element.data,
        });
      }
    }

    return downloadedObjs;
  }

  private async _downloadNonConcurrent(
    functions: Promise<DownloadedObject>[],
  ): Promise<DownloadedObject[]> {
    const downloadedObjs: DownloadedObject[] = [];
    for (let i = 0; i < functions.length; i++) {
      const result = await functions[i];
      downloadedObjs.push(result);
    }
    return downloadedObjs;
  }

  async download(
    objectPaths: Array<string>,
    options?: { allowConcurrency?: Boolean; concurrency?: number },
  ) {
    // Validations
    if (options && !options.allowConcurrency && options.concurrency) {
      throw Error(
        `allowConcurrency is false but concurrency value is provided.`,
      );
    }
    if (
      options &&
      options.concurrency &&
      options.concurrency > this.concurrencyLimit
    ) {
      throw Error(
        `Max concurrency limit is: ${this.concurrencyLimit}. Provided: ${options.concurrency}`,
      );
    }
    // Validation Finished

    const functions = objectPaths.map((value) => {
      return this._downloadObject(value);
    });

    try {
      if (options && options.concurrency) {
        // Runs when concurrency number is provided.
        return await this._downloadConcurrently(functions, options.concurrency);
      }
      if (options && options.allowConcurrency === true) {
        // Runs when concurrency number is not provided but is allowed.
        return await this._downloadConcurrently(
          functions,
          this.concurrencyLimit,
        );
      }
      return this._downloadNonConcurrent(functions);
    } catch (error) {
      if (error instanceof StorageError) {
        return null;
      }
      return null;
    }
  }

  async downloadSingle(objectPath: string): Promise<DownloadedObject> {
    return this._downloadObject(objectPath);
  }

  async getPageAccessUrls(
    objectPaths: string[],
    expiresIn = 600,
  ): Promise<Array<{ path: string; signedUrl: string }>> {
    if (objectPaths.length === 0) {
      return [];
    }

    const { data, error } = await this._supabaseClient.storage
      .from(env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME)
      .createSignedUrls(objectPaths, expiresIn);

    if (error) {
      console.log(
        `Error generating signed URLs: [MESSAGE]: ${error.message}, ` +
          `[STATUS]: ${error.status}, [CAUSE]: ${error.cause}`,
      );

      throw error;
    }

    return data.map((item) => ({
      path: item.path as string,
      signedUrl: item.signedUrl as string,
    }));
  }

  async getPageAccessUrl(
    objectPath: string,
    expiresIn = 600,
  ): Promise<string> {
    const { data, error } = await this._supabaseClient.storage
      .from(env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME)
      .createSignedUrl(objectPath, expiresIn);

    if (error) {
      console.log(
        `Error generating signed URL for path ${objectPath}: [MESSAGE]: ${error.message}, [STATUS]: ${error.status}`,
      );
      throw error;
    }

    return data.signedUrl;
  }

  async upload(
    storagePath: string,
    fileBody: Buffer | Blob | ArrayBuffer,
    options?: { contentType?: string; upsert?: boolean },
  ) {
    const { data, error } = await this._supabaseClient.storage
      .from(env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME)
      .upload(storagePath, fileBody, {
        contentType: options?.contentType,
        upsert: options?.upsert ?? true,
      });

    if (error) {
      console.log(
        `Error uploading file: [PATH]: ${storagePath} [MESSAGE]: ${error.message}, [STATUS]: ${error.status}, [CAUSE]: ${error.cause}`,
      );
      throw error;
    }

    return data;
  }
}

export const supabaseStorageClient = new SupabaseStorageClient(
  createSupabaseServerClient(),
  3,
);
