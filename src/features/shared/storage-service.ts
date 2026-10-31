import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/config/env/server";
import { StorageError } from "@supabase/storage-js";

export interface SignedUrlResponseObject {
  fileId: string;
  clientFileId: string;
  token: string;
  signedUrl: string;
  storagePath: string;
}

export interface DownloadedObject {
  path: string;
  data: Blob;
}

const DEFAULT_FILE_ACCESS_EXPIRY_MINUTES = 30;

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
            fileId: element.serverFileId,
            clientFileId: element.clientFileId,
            signedUrl: element.signedUrl,
            token: element.token,
            storagePath: element.path,
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
    expiresIn = DEFAULT_FILE_ACCESS_EXPIRY_MINUTES * 60,
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

  async getPageAccessUrl(objectPath: string, expiresIn = 600): Promise<string> {
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

  /**
   * Checks whether an object exists in the storage bucket.
   *
   */
  async objectExists(objectPath: string): Promise<boolean> {
    const { data: exists, error } = await this._supabaseClient.storage
      .from(env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME)
      .exists(objectPath);

    if (error) {
      throw error;
    }

    return exists;
  }

  async deleteFiles(objectPaths: string[]): Promise<void> {
    if (!objectPaths || objectPaths.length === 0) {
      return;
    }

    const batchSize = 100;
    for (let i = 0; i < objectPaths.length; i += batchSize) {
      const batch = objectPaths.slice(i, i + batchSize);
      const { error } = await this._supabaseClient.storage
        .from(env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME)
        .remove(batch);

      if (error) {
        console.error(
          `Error deleting files in batch [${batch.join(", ")}]: [MESSAGE]: ${error.message}, [STATUS]: ${error.status}`,
        );
        throw error;
      }
    }
  }

  async deleteFolder(folderPath: string): Promise<void> {
    const cleanFolder = folderPath.replace(/^\/+|\/+$/g, "");
    if (!cleanFolder) return;

    const allFiles: string[] = [];

    const listRecursively = async (currentPath: string) => {
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await this._supabaseClient.storage
          .from(env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME)
          .list(currentPath, {
            limit,
            offset,
            sortBy: { column: "name", order: "asc" },
          });

        if (error) {
          console.error(`Error listing storage path ${currentPath}:`, error);
          return;
        }

        if (!data || data.length === 0) {
          break;
        }

        for (const item of data) {
          const itemPath = currentPath
            ? `${currentPath}/${item.name}`
            : item.name;
          if (item.id === null) {
            // It's a folder in Supabase Storage
            await listRecursively(itemPath);
          } else {
            allFiles.push(itemPath);
          }
        }

        if (data.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }
    };

    await listRecursively(cleanFolder);

    if (allFiles.length > 0) {
      await this.deleteFiles(allFiles);
    }
  }
}

export const supabaseStorageClient = new SupabaseStorageClient(
  createSupabaseServerClient(),
  3,
);
