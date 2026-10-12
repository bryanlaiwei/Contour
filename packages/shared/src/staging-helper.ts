// The staging Mac build and the staging site share these. A later production build uses its own origin.

export const stagingWebOrigin = "https://automatic-project-map-staging.vercel.app";

export const stagingMacHelperDownloadUrl =
  "https://github.com/bryanlaiwei/automatic-project-map/releases/download/mac-helper-staging-1/Automatic-Project-Map-Mac.zip";

export const macHelperDownloadNote =
  "Download the app, open it, allow folder access, then come back and click Connect this computer.";

/** The download is offered on the staging site. Local development keeps the terminal helper. */
export function offerMacHelperDownload(origin: string): boolean {
  return origin === stagingWebOrigin;
}
