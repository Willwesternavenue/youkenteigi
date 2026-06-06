// Ambient declarations for pdfmake 0.3 server-side internal modules
// (@types/pdfmake only types the browser entry point).

declare module "pdfmake/js/Printer" {
  import type { TDocumentDefinitions } from "pdfmake/interfaces";
  export default class PdfPrinter {
    constructor(
      fontDescriptors: Record<string, Record<string, string>>,
      virtualfs?: unknown,
      urlResolver?: unknown,
      localAccessPolicy?: (path: string) => boolean,
    );
    createPdfKitDocument(
      docDefinition: TDocumentDefinitions,
      options?: Record<string, unknown>,
    ): Promise<NodeJS.ReadableStream & { end: () => void }>;
  }
}

declare module "pdfmake/js/virtual-fs" {
  interface VFS {
    existsSync(filename: string): boolean;
    readFileSync(filename: string, options?: string | object): string | Buffer;
    writeFileSync(filename: string, content: string | Buffer | ArrayBuffer): void;
  }
  const vfs: VFS;
  export default vfs;
}

declare module "pdfmake/js/URLResolver" {
  export default class URLResolver {
    constructor(fs: unknown);
    setUrlAccessPolicy(cb: (url: string) => boolean): void;
    resolve(url: string, headers?: Record<string, string>): void;
  }
}
