import type { Metadata } from "next";
// Noto Sans JP はリポジトリ（npm パッケージ）に同梱する。next/font/google はビルド時に
// Google から数百の分割ファイルを取得し、その失敗でビルドが落ちることがあったため。
// 文字範囲ごとの分割配信は同じなので、ブラウザは必要な分だけ読み込む。
import "@fontsource-variable/noto-sans-jp";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "要件定義かけるくん Internal",
  description:
    "初回商談から RFP・要件定義書・見積・スケジュールを生成する社内向けプリセールス支援ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-muted/30 font-sans">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
