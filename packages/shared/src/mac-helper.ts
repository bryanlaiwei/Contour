// The Mac menu-bar build and the hosted site share these. The Mac app only accepts this site.

export const macHelperSiteOrigin = "https://contourmaps.vercel.app";

export const macHelperDownloadUrl =
  "https://github.com/bryanlaiwei/Contour/releases/download/mac-helper-v1.0.0/Contour-Mac.zip";

/** Opens the helper that is already installed in the user's Applications folder. */
export const macHelperOpenCommand = 'open "$HOME/Applications/Contour.app"';

/** curl does not mark the app as a browser download, so Gatekeeper does not block it. */
export const macHelperInstallCommand = `mkdir -p "$HOME/Applications" && curl -fsSL -o /tmp/Contour-Mac.zip ${macHelperDownloadUrl} && rm -rf "$HOME/Applications/Contour.app" && ditto -xk /tmp/Contour-Mac.zip "$HOME/Applications" && ${macHelperOpenCommand}`;

export const macHelperDownloadNote =
  "Paste this in Terminal. It downloads the app and opens it. Allow folder access, then come back and click Connect this computer.";

/** The download is offered on the hosted site. Local development keeps the terminal helper. */
export function offerMacHelperDownload(origin: string): boolean {
  return origin === macHelperSiteOrigin;
}
