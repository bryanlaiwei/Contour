// The staging Mac build and the staging site share these. A later production build uses its own origin.

export const stagingWebOrigin = "https://automatic-project-map-staging.vercel.app";

export const stagingMacHelperDownloadUrl =
  "https://github.com/bryanlaiwei/Contour/releases/download/mac-helper-staging-1/Contour-Mac.zip";

/** curl does not mark the app as a browser download, so Gatekeeper does not block it. */
export const macHelperInstallCommand = `mkdir -p "$HOME/Applications" && curl -fsSL -o /tmp/Contour-Mac.zip ${stagingMacHelperDownloadUrl} && rm -rf "$HOME/Applications/Contour.app" && ditto -xk /tmp/Contour-Mac.zip "$HOME/Applications" && open "$HOME/Applications/Contour.app"`;

export const macHelperDownloadNote =
  "Paste this in Terminal. It downloads the app and opens it. Allow folder access, then come back and click Connect this computer.";

/** The download is offered on the staging site. Local development keeps the terminal helper. */
export function offerMacHelperDownload(origin: string): boolean {
  return origin === stagingWebOrigin;
}
