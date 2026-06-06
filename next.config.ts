import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfmake (and its pdfkit/fontkit deps) and docx are Node libraries that the
  // bundler should not try to bundle — require them at runtime instead. This
  // also lets pdfmake's subpath entry (pdfmake/src/printer) resolve normally.
  serverExternalPackages: [
    "pdfmake",
    "docx",
    "exceljs",
    "pptxgenjs",
    "@libsql/client",
  ],
};

export default nextConfig;
