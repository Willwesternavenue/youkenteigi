"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const FORMATS: { format: string; label: string }[] = [
  { format: "md", label: "Markdown" },
  { format: "docx", label: "Word" },
  { format: "pdf", label: "PDF" },
];

export function ExportButtons({ documentId }: { documentId: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {FORMATS.map((f) => (
        <Button
          key={f.format}
          render={
            <a href={`/api/export/${documentId}?format=${f.format}`} download />
          }
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          <FileDown className="size-3.5" />
          {f.label}
        </Button>
      ))}
    </div>
  );
}
