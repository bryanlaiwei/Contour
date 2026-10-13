import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { cx } from "../helpers";

/** Height and fade for a section that opens and closes. Stays mounted long enough for the close to play. */
export function Disclosure({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    setShown(false);
  }, [open]);

  useEffect(() => {
    if (!open || !present) {
      return;
    }
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setShown(true));
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [open, present]);

  useEffect(() => {
    if (open || !present) {
      return;
    }
    const timer = window.setTimeout(() => setPresent(false), 220);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  if (!present) {
    return null;
  }

  return (
    <div className={cx("disclosure", className)} data-open={shown ? "true" : "false"}>
      <div className="disclosure-clip">{children}</div>
    </div>
  );
}
