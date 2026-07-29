import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get,
  head,
  put,
} from "@vercel/blob";

const options = {
  access: "private" as const,
  addRandomSuffix: false,
  allowOverwrite: false,
};

export class BlobStorageError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`Vercel Blob ${operation} failed`, { cause });
    this.name = "BlobStorageError";
  }
}

export async function createBlob(path: string, value: string): Promise<void> {
  try {
    await put(path, value, { ...options, contentType: "application/json" });
  } catch (error) {
    throw new BlobStorageError("write", error);
  }
}

export async function readBlob(path: string): Promise<string | undefined> {
  try {
    const result = await get(path, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return undefined;
    return new Response(result.stream).text();
  } catch (error) {
    throw new BlobStorageError("read", error);
  }
}

export async function claimBlob(issuedPath: string, usedPath: string): Promise<boolean> {
  return claimBlobWith(issuedPath, usedPath, { head, put, del });
}

export async function claimBlobWith(
  issuedPath: string,
  usedPath: string,
  store: { head: typeof head; put: typeof put; del: typeof del },
): Promise<boolean> {
  try {
    await store.head(issuedPath);
    await store.put(usedPath, "1", { ...options, contentType: "text/plain" });
  } catch (error) {
    if (error instanceof BlobNotFoundError || error instanceof BlobPreconditionFailedError) return false;
    throw new BlobStorageError("claim", error);
  }
  // ponytail: used markers are retained; add scheduled expiry cleanup if storage growth matters.
  void store.del(issuedPath).catch(() => undefined);
  return true;
}
