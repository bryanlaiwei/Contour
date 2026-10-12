import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { macHelperDownloadNote, macHelperInstallCommand } from "../mac-helper";

export function MacHelperDownload() {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(macHelperInstallCommand).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-3 rounded-lg bg-zinc-50 p-3">
      <p className="text-sm leading-relaxed text-zinc-600">{macHelperDownloadNote}</p>
      <div className="mt-3 flex items-start gap-2">
        <code className="min-w-0 flex-1 rounded-md bg-white px-2 py-1.5 font-mono text-[11px] leading-relaxed break-all text-zinc-800 ring-1 ring-zinc-200">
          {macHelperInstallCommand}
        </code>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-500"
          onClick={copy}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
