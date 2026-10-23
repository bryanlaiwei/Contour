import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { macHelperInstallCommand } from "@apm/shared";
import { Button } from "../ui/ui";

export function MacHelperDownload({ command = macHelperInstallCommand }: { command?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-zinc-50 py-1.5 pr-1.5 pl-3 ring-1 ring-zinc-200">
      <span className="font-mono text-[11px] text-zinc-400" aria-hidden>
        $
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[11px] whitespace-nowrap text-zinc-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{command}</code>
      <Button size="sm" className="shrink-0" icon={copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
