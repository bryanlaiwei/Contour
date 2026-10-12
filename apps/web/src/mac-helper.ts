import { macHelperDownloadNote, offerMacHelperDownload, stagingMacHelperDownloadUrl } from "@apm/shared";

export { macHelperDownloadNote, offerMacHelperDownload, stagingMacHelperDownloadUrl };

/** Local dev can preview the staging note with ?siteOrigin= the staging site. Production builds drop this. */
export function currentSiteOrigin(): string {
  if (import.meta.env.DEV) {
    const override = new URLSearchParams(window.location.search).get("siteOrigin");
    if (override) {
      return override;
    }
  }
  return window.location.origin;
}
