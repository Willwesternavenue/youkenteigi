import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfmake (and its pdfkit/fontkit deps) and docx are Node libraries that the
  // bundler should not try to bundle — require them at runtime instead. This
  // also lets pdfmake's subpath entry (pdfmake/src/printer) resolve normally.
  serverExternalPackages: ["pdfmake", "docx", "exceljs", "pptxgenjs"],
  // Baseline security headers (no CSP yet — would need per-route tuning).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
