"use client";

/**
 * Google Docs 出力（AgreementWriter の google-docs.js をそのまま移植）。
 * Google Identity Services のトークンクライアントでブラウザ側 OAuth を行い、
 * Docs API で新規ドキュメントを作成して書式を当てる。サーバは経由しない。
 *
 * OAuth クライアント ID は公開値（承認済み JavaScript 生成元で保護）。
 * 生成元: https://kakerukun.vercel.app / http://localhost:3000
 */

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
  "858462833179-s3br03k4o3duulgn87a26v8jj3ct98nv.apps.googleusercontent.com";

const SCOPES =
  "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";

interface TokenResponse {
  access_token?: string;
  error?: string;
}
interface TokenClient {
  callback: (response: TokenResponse) => void;
  requestAccessToken: (opts: { prompt: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let loading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Google API の読み込みに失敗しました"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * 画面表示時に GIS を先読みしておく。クリック時にスクリプト読込を待つと
 * ユーザー操作の猶予を過ぎてログインのポップアップがブロックされるため。
 */
export function preloadGoogleDocs(): void {
  loadGis().catch(() => {});
}

async function requestAuth(): Promise<void> {
  await loadGis();
  tokenClient ??= window.google!.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  });
  await new Promise<void>((resolve, reject) => {
    tokenClient!.callback = (response) => {
      if (response.error || !response.access_token) {
        reject(new Error("Googleへのログインに失敗しました"));
      } else {
        accessToken = response.access_token;
        resolve();
      }
    };
    tokenClient!.requestAccessToken({ prompt: "consent" });
  });
}

/** 未認証なら Google ログイン（同意画面）を出してから Docs を作成する。 */
export async function createGoogleDoc(
  title: string,
  contractText: string,
  appendixText: string,
): Promise<{ documentId: string; url: string }> {
  if (!accessToken) await requestAuth();

  const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });
  if (!createResponse.ok) {
    // トークン失効時は次回ログインし直せるよう破棄する
    if (createResponse.status === 401) accessToken = null;
    const err = await createResponse.json().catch(() => ({}));
    throw new Error(
      `ドキュメント作成に失敗しました: ${err.error?.message || "Unknown error"}`,
    );
  }
  const { documentId } = (await createResponse.json()) as { documentId: string };

  const updateResponse = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests: buildDocumentRequests(contractText, appendixText) }),
    },
  );
  if (!updateResponse.ok) {
    const err = await updateResponse.json().catch(() => ({}));
    throw new Error(
      `ドキュメント更新に失敗しました: ${err.error?.message || "Unknown error"}`,
    );
  }

  return { documentId, url: `https://docs.google.com/document/d/${documentId}/edit` };
}

function buildDocumentRequests(contractText: string, appendixText: string) {
  const requests: unknown[] = [];

  // Append extra blank line after appendix title for spacing
  const appendixWithSpacing = appendixText.replace(/^(【別紙】本件業務の詳細\n)/, "$1\n");

  const separator = "\n\n";
  const fullText = contractText + separator + appendixWithSpacing;
  const appendixStart = contractText.length + separator.length;

  // 1. Insert all text
  requests.push({ insertText: { location: { index: 1 }, text: fullText } });

  // 2. Base font size first — subsequent requests override specific ranges
  requests.push({
    updateTextStyle: {
      range: { startIndex: 1, endIndex: fullText.length + 1 },
      textStyle: { fontSize: { magnitude: 10.5, unit: "PT" } },
      fields: "fontSize",
    },
  });

  // 3. Contract title — centered, 12.5pt, bold
  const titleEnd = fullText.indexOf("\n");
  if (titleEnd > 0) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: titleEnd + 2 },
        paragraphStyle: {
          alignment: "CENTER",
          spaceAbove: { magnitude: 20, unit: "PT" },
          spaceBelow: { magnitude: 20, unit: "PT" },
        },
        fields: "alignment,spaceAbove,spaceBelow",
      },
    });
    requests.push({
      updateTextStyle: {
        range: { startIndex: 1, endIndex: titleEnd + 1 },
        textStyle: { bold: true, fontSize: { magnitude: 12.5, unit: "PT" } },
        fields: "bold,fontSize",
      },
    });
  }

  // 4. Contract section headers (第X条)
  const sectionRegex = /第\d+条（[^）]+）/g;
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(contractText)) !== null) {
    const startIdx = match.index + 1;
    const endIdx = startIdx + match[0].length;
    requests.push({
      updateTextStyle: {
        range: { startIndex: startIdx, endIndex: endIdx },
        textStyle: { bold: true },
        fields: "bold",
      },
    });
  }

  // 5. Appendix title — pageBreakBefore, centered, 12.5pt, bold
  //    endIndex must reach past the paragraph's terminal \n for pageBreakBefore to apply
  const appendixTitleEnd = appendixStart + appendixWithSpacing.indexOf("\n");
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: appendixStart + 1,
        endIndex: appendixTitleEnd + 2, // +2 to include the terminal \n
      },
      paragraphStyle: {
        pageBreakBefore: true,
        alignment: "CENTER",
        spaceAbove: { magnitude: 20, unit: "PT" },
        spaceBelow: { magnitude: 20, unit: "PT" },
      },
      fields: "pageBreakBefore,alignment,spaceAbove,spaceBelow",
    },
  });
  requests.push({
    updateTextStyle: {
      range: { startIndex: appendixStart + 1, endIndex: appendixTitleEnd + 1 },
      textStyle: { bold: true, fontSize: { magnitude: 12.5, unit: "PT" } },
      fields: "bold,fontSize",
    },
  });

  // 6. Appendix major headings (１．〜１４．)
  const appendixMajorRegex = /^(１０|１１|１２|１３|１４|[１-９])[．.].+/gm;
  while ((match = appendixMajorRegex.exec(appendixWithSpacing)) !== null) {
    const startIdx = appendixStart + match.index + 1;
    const lineEnd = appendixWithSpacing.indexOf("\n", match.index);
    const endIdx =
      appendixStart + (lineEnd === -1 ? appendixWithSpacing.length : lineEnd) + 2;
    requests.push({
      updateTextStyle: {
        range: { startIndex: startIdx, endIndex: endIdx - 1 },
        textStyle: { bold: true },
        fields: "bold",
      },
    });
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: startIdx, endIndex: endIdx },
        paragraphStyle: {
          spaceAbove: { magnitude: 10, unit: "PT" },
          spaceBelow: { magnitude: 4, unit: "PT" },
        },
        fields: "spaceAbove,spaceBelow",
      },
    });
  }

  return requests;
}
