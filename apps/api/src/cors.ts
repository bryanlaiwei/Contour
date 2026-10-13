const localDevOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5175",
  "http://localhost:5175",
]);

/** Preview hosts for this Vercel team. Branch aliases are truncated, so match the project prefix plus this suffix. */
const vercelPreviewHostSuffix = "-bwei2398-5560s-projects.vercel.app";
const vercelProjectPrefix = "automatic-project-map-";

/** The hosted site, local Vite, and this project's Vercel preview hosts. */
export function isAllowedWebOrigin(origin: string, webOrigin: string): boolean {
  if (origin === webOrigin || localDevOrigins.has(origin)) {
    return true;
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin || url.protocol !== "https:") {
    return false;
  }
  const host = url.hostname;
  return host.startsWith(vercelProjectPrefix) && host.endsWith(vercelPreviewHostSuffix);
}
