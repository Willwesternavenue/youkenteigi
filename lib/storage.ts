import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Storage facade — local filesystem adapter.
 *
 * Objects are written under ./data/storage keyed by `${orgId}/${projectId}/...`.
 * Not on the critical path for document generation (exports stream directly),
 * but kept here so file upload can land in a later slice without app changes.
 * Swaps to Supabase Storage / Cloud Storage behind the same interface.
 */

const ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), "data", "storage");

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

function safePath(key: string): string {
  const rootResolved = path.resolve(ROOT);
  const resolved = path.resolve(ROOT, key);
  // Must be ROOT itself or a true descendant — guards against sibling escapes
  // like key="../storage-evil" (which would startsWith("…/storage")).
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export const storage = {
  async put(
    key: string,
    data: Buffer | Uint8Array,
    contentType: string,
  ): Promise<StoredObject> {
    const file = safePath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return { key, size: data.byteLength, contentType };
  },
  async get(key: string): Promise<Buffer> {
    return fs.readFile(safePath(key));
  },
  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(safePath(key));
      return true;
    } catch {
      return false;
    }
  },
  async delete(key: string): Promise<void> {
    await fs.rm(safePath(key), { force: true });
  },
  // Downloads go through `/api/files/[fileId]` (keyed by file id, looked up
  // org-scoped), not by storage path — so no url() helper here.
};
