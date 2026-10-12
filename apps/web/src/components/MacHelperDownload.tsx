import { Download } from "lucide-react";
import { macHelperDownloadNote, stagingMacHelperDownloadUrl } from "../mac-helper";

export function MacHelperDownload() {
  return (
    <div className="mt-3 rounded-lg bg-zinc-50 p-3">
      <p className="text-sm leading-relaxed text-zinc-600">{macHelperDownloadNote}</p>
      <a
        href={stagingMacHelperDownloadUrl}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-500"
      >
        <Download className="size-4" aria-hidden />
        Download for Mac
      </a>
    </div>
  );
}
