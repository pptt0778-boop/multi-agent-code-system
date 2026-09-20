"use client";

import { useMemo, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";

export function PreviewTab() {
  const { files } = useWorkspace();
  const [nonce, setNonce] = useState(0);

  // Render a simple sandboxed HTML preview when an html file exists;
  // otherwise show a placeholder. Web-app dev-server previews are wired
  // via the backend sandbox preview URL (Phase 5).
  const htmlFile = useMemo(
    () =>
      files.find(
        (f) => f.path.endsWith(".html") || f.language === "html",
      ),
    [files],
  );

  const srcDoc = useMemo(() => {
    if (!htmlFile) return "";
    const css = files
      .filter((f) => f.path.endsWith(".css"))
      .map((f) => `<style>${f.content}</style>`)
      .join("\n");
    const js = files
      .filter((f) => f.path.endsWith(".js"))
      .map((f) => `<script>${f.content}<\/script>`)
      .join("\n");
    return htmlFile.content
      .replace("</head>", `${css}</head>`)
      .replace("</body>", `${js}</body>`);
  }, [files, htmlFile]);

  if (!htmlFile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
        <Eye size={28} strokeWidth={1.5} />
        <p className="text-xs">
          Preview appears when the Coder generates a web artifact.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
        <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
          sandbox://preview/{htmlFile.path}
        </span>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="p-1 text-[var(--muted-foreground)] transition hover:text-foreground"
          aria-label="Reload preview"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <iframe
        key={nonce}
        title="preview"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="min-h-0 flex-1 bg-white"
      />
    </div>
  );
}
